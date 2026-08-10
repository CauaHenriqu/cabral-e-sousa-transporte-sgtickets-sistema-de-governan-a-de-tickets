import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { sendApprovalDecisionEmails } from '@/lib/ticketEmails';
import { logAction } from '@/lib/logAction';
import { startGlobalProcessing, stopGlobalProcessing } from '@/contexts/ProcessingContext';

const MyApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filter, setFilter] = useState<'PENDENTE' | 'TODAS'>('PENDENTE');

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['my-approvals', user?.id, filter],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from('ticket_approvals')
        .select('*, tickets(id, code, status, user_id, attendant_id, created_by, service_id, services(name), form_data, created_at), approval_flows(name)')
        .eq('approver_id', user.id)
        .order('created_at', { ascending: false });
      if (filter === 'PENDENTE') q = q.eq('status', 'PENDENTE');
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const userIds = useMemo(() => {
    const set = new Set<string>();
    approvals.forEach((a: any) => {
      if (a.tickets?.user_id) set.add(a.tickets.user_id);
      if (a.tickets?.attendant_id) set.add(a.tickets.attendant_id);
    });
    return Array.from(set);
  }, [approvals]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ['profiles-for-approvals', userIds.join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.name; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const decideMutation = useMutation({
    mutationFn: async ({ approval, decision, reason }: { approval: any; decision: 'APROVADO' | 'REJEITADO'; reason?: string }) => {
      startGlobalProcessing(decision === 'APROVADO' ? 'Aprovando...' : 'Rejeitando...');
      // 1) marca a aprovação
      const { error: updErr } = await supabase
        .from('ticket_approvals')
        .update({ status: decision, reason: reason || null, decided_at: new Date().toISOString() })
        .eq('id', approval.id);
      if (updErr) throw updErr;

      const ticket = approval.tickets;

      // 2) buscar TODAS as aprovações do ticket para decidir o estado final (regra AND)
      const { data: allApprovalsFull } = await supabase
        .from('ticket_approvals')
        .select('approver_id, status')
        .eq('ticket_id', ticket.id);
      const all = allApprovalsFull || [];
      const totalApprovers = all.length;
      const approvedCount = all.filter((a: any) => a.status === 'APROVADO').length;
      const rejectedCount = all.filter((a: any) => a.status === 'REJEITADO').length;
      const pendingCount = all.filter((a: any) => a.status === 'PENDENTE').length;

      // 3) decidir novo status do ticket — regra AND:
      // • REJEITADO assim que QUALQUER aprovador rejeitar
      // • ABERTO (liberado) somente quando TODOS aprovarem
      // • caso contrário, segue AGUARDANDO_APROVACAO
      let newStatus = ticket.status || 'AGUARDANDO_APROVACAO';
      const updates: any = { updated_at: new Date().toISOString() };
      let ticketDecided: 'APROVADO' | 'REJEITADO' | null = null;

      if (decision === 'REJEITADO' || rejectedCount > 0) {
        newStatus = 'REJEITADO';
        updates.closed_at = new Date().toISOString();
        ticketDecided = 'REJEITADO';
      } else if (totalApprovers > 0 && approvedCount === totalApprovers) {
        newStatus = 'ABERTO';
        ticketDecided = 'APROVADO';
      } else {
        newStatus = 'AGUARDANDO_APROVACAO';
      }
      updates.status = newStatus;

      const { error: tErr } = await supabase.from('tickets').update(updates).eq('id', ticket.id);
      if (tErr) throw tErr;

      // 4) mensagem de sistema no ticket — sempre registra a decisão individual
      const progressTxt = totalApprovers > 1
        ? ` (${approvedCount} de ${totalApprovers} aprovaram${pendingCount > 0 ? `, ${pendingCount} pendente(s)` : ''})`
        : '';
      const individualMsg = decision === 'APROVADO'
        ? `✅ ${user!.name} aprovou o ticket${progressTxt}.`
        : `❌ ${user!.name} rejeitou o ticket. Motivo: ${reason || 'Sem justificativa'}`;
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_name: 'Sistema',
        sender_role: 'system',
        content: individualMsg,
      });

      // Mensagem final quando o ticket é decidido
      if (ticketDecided === 'APROVADO') {
        await supabase.from('ticket_messages').insert({
          ticket_id: ticket.id,
          sender_name: 'Sistema',
          sender_role: 'system',
          content: `✅ Todos os ${totalApprovers} aprovadores aprovaram. Ticket encaminhado para atendimento.`,
        });
      }

      // 5) buscar todos aprovadores do mesmo ticket (ids)
      const allApproverIds = all.map((a: any) => a.approver_id);

      // 6) e-mails — só dispara o e-mail final de APROVADO/REJEITADO quando o ticket foi decidido
      if (ticketDecided) {
        await sendApprovalDecisionEmails(
          {
            ticketId: ticket.id,
            ticketCode: String(ticket.code),
            serviceName: ticket.services?.name || 'N/A',
            userId: ticket.user_id,
            attendantId: ticket.attendant_id,
            createdById: ticket.created_by,
          },
          ticketDecided,
          { id: user!.id, name: user!.name },
          reason,
          allApproverIds
        );
      }

      const decisaoTxt = decision === 'APROVADO'
        ? (ticketDecided === 'APROVADO'
            ? `aprovou o ticket #${ticket.code} ("${ticket.services?.name || '—'}"). Todos os aprovadores aprovaram — ticket encaminhado para atendimento.`
            : `aprovou o ticket #${ticket.code} ("${ticket.services?.name || '—'}"). Aguardando demais aprovadores (${approvedCount}/${totalApprovers}).`)
        : `rejeitou o ticket #${ticket.code} ("${ticket.services?.name || '—'}"). Motivo informado: ${reason || 'Sem justificativa'}.`;
      void logAction('UPDATE', 'tickets', ticket.id, `${user!.name} ${decisaoTxt}`);
      return { decision, ticketDecided, approvedCount, totalApprovers };
    },
    onSuccess: ({ decision, ticketDecided, approvedCount, totalApprovers }) => {
      queryClient.invalidateQueries({ queryKey: ['my-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (decision === 'REJEITADO') {
        toast({ title: '❌ Rejeitado.', description: 'O ticket foi rejeitado.' });
      } else if (ticketDecided === 'APROVADO') {
        toast({ title: '✅ Aprovado!', description: 'Todos os aprovadores aprovaram. Ticket liberado para atendimento.' });
      } else {
        toast({ title: '✅ Sua aprovação foi registrada.', description: `Aguardando demais aprovadores (${approvedCount}/${totalApprovers}).` });
      }
      setRejectingId(null);
      setRejectReason('');
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
    onSettled: () => stopGlobalProcessing(),
  });

  const handleApprove = (approval: any) => {
    if (approval.tickets?.user_id === user?.id || approval.tickets?.created_by === user?.id) {
      toast({ title: 'Não permitido', description: 'Você não pode aprovar um ticket que você mesmo criou.', variant: 'destructive' });
      return;
    }
    decideMutation.mutate({ approval, decision: 'APROVADO' });
  };

  const handleReject = () => {
    const approval = approvals.find((a: any) => a.id === rejectingId);
    if (!approval) return;
    if (!rejectReason.trim()) {
      toast({ title: 'Justificativa obrigatória', variant: 'destructive' });
      return;
    }
    decideMutation.mutate({ approval, decision: 'REJEITADO', reason: rejectReason.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><ShieldCheck size={22} /> Minhas Aprovações</h1>
          <p className="text-sm text-muted-foreground">Tickets aguardando sua decisão de aprovação.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === 'PENDENTE' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('PENDENTE')}>Pendentes</Button>
          <Button variant={filter === 'TODAS' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('TODAS')}>Todas</Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && approvals.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground shadow-card">
          {filter === 'PENDENTE' ? 'Nenhuma aprovação pendente. 🎉' : 'Nenhuma aprovação encontrada.'}
        </div>
      )}

      <div className="grid gap-3">
        {approvals.map((a: any) => {
          const t = a.tickets;
          if (!t) return null;
          const requesterName = profileMap[t.user_id] || 'N/A';
          const isPending = a.status === 'PENDENTE';
          const isOwnTicket = t.user_id === user?.id || t.created_by === user?.id;

          return (
            <div key={a.id} className="bg-card border border-border rounded-2xl p-4 shadow-card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">Ticket #{t.code}</span>
                    {a.status === 'PENDENTE' && <Badge className="bg-warning text-warning-foreground">Pendente</Badge>}
                    {a.status === 'APROVADO' && <Badge className="bg-success text-success-foreground"><CheckCircle2 size={12} className="mr-1" />Aprovado</Badge>}
                    {a.status === 'REJEITADO' && <Badge variant="destructive"><XCircle size={12} className="mr-1" />Rejeitado</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    🛠️ {t.services?.name || 'Serviço'} • 👤 {requesterName} • 📅 {new Date(t.created_at).toLocaleString('pt-BR')}
                  </p>
                  {a.approval_flows?.name && (
                    <p className="text-xs text-muted-foreground mt-0.5">Fluxo: {a.approval_flows.name}</p>
                  )}
                  {t.form_data && Object.keys(t.form_data).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-primary cursor-pointer">Ver formulário enviado</summary>
                      <pre className="text-[11px] bg-muted/50 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(t.form_data, null, 2)}</pre>
                    </details>
                  )}
                  {a.status === 'REJEITADO' && a.reason && (
                    <p className="text-xs text-destructive mt-2">📝 Motivo: {a.reason}</p>
                  )}
                  {a.decided_at && (
                    <p className="text-[11px] text-muted-foreground mt-1"><Clock size={10} className="inline mr-1" />Decidido em {new Date(a.decided_at).toLocaleString('pt-BR')}</p>
                  )}
                </div>
                {isPending && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(a)}
                      disabled={decideMutation.isPending || isOwnTicket}
                      className="bg-success text-success-foreground hover:bg-success/90"
                      title={isOwnTicket ? 'Não pode aprovar próprio ticket' : ''}
                    >
                      <CheckCircle2 size={14} className="mr-1" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setRejectingId(a.id); setRejectReason(''); }}
                      disabled={decideMutation.isPending}
                    >
                      <XCircle size={14} className="mr-1" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!rejectingId} onOpenChange={(o) => { if (!o) { setRejectingId(null); setRejectReason(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar ticket</DialogTitle></DialogHeader>
          <div>
            <label className="text-xs font-semibold text-foreground">Justificativa *</label>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explique o motivo da rejeição..."
              className="mt-1"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={decideMutation.isPending || !rejectReason.trim()}>
              {decideMutation.isPending ? 'Rejeitando...' : 'Confirmar rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyApprovalsPage;
