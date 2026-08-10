import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { startGlobalProcessing, stopGlobalProcessing } from '@/contexts/ProcessingContext';

import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

const ATTENDANTS_COLUMNS: ExportColumn<any>[] = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'E-mail' },
  { key: 'sector', label: 'Setor' },
  { key: 'function', label: 'Função' },
  { key: 'phone', label: 'Telefone' },
  { key: 'leader_name', label: 'Líder' },
  { key: 'status', label: 'Status' },
  { key: 'first_login', label: 'Primeiro Login', accessor: r => r.first_login ? 'Sim' : 'Não' },
  { key: 'created_at', label: 'Criado em', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
];

const AttendantsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; userId: string; name: string; reason?: string }>({ open: false, userId: '', name: '' });
  const [form, setForm] = useState({ name: '', sector: '', function: '', email: '', phone: '', leaderName: '', status: 'Ativo', firstLogin: true, password: '', canCloseTickets: true, canTransferTickets: true, canChangeReturnReason: false, receivesNewTickets: true });
  const [closeServices, setCloseServices] = useState<Record<string, boolean>>({});
  const [closeReasons, setCloseReasons] = useState<Record<string, boolean>>({});

  // Vínculos de serviço do atendente em edição (para definir onde pode fechar ticket)
  const { data: myLinks = [] } = useQuery({
    queryKey: ['attendant-service-links', editingId],
    enabled: !!editingId && dialog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendant_services')
        .select('id, service_id, can_close, services(name, code)')
        .eq('attendant_id', editingId!);
      if (error) throw error;
      return data as any[];
    },
  });

  // Motivos de devolução ativos
  const { data: returnReasons = [] } = useQuery({
    queryKey: ['active-return-reasons-permissions'],
    enabled: dialog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('return_reasons' as any)
        .select('id, code, description')
        .eq('status', 'Ativo')
        .order('description');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Permissões de motivo do atendente em edição
  const { data: myReasonLinks = [] } = useQuery({
    queryKey: ['attendant-return-reason-links', editingId],
    enabled: !!editingId && dialog,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendant_return_reasons' as any)
        .select('id, return_reason_id, can_close')
        .eq('attendant_id', editingId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  React.useEffect(() => {
    if (myLinks.length) {
      setCloseServices(Object.fromEntries(myLinks.map((l: any) => [l.id, l.can_close ?? true])));
    }
  }, [myLinks]);

  React.useEffect(() => {
    if (!dialog) return;
    const map: Record<string, boolean> = {};
    for (const r of returnReasons as any[]) map[r.id] = true;
    for (const l of myReasonLinks as any[]) map[l.return_reason_id] = l.can_close ?? true;
    setCloseReasons(map);
  }, [returnReasons, myReasonLinks, dialog]);


  const { data: attendants = [], isLoading } = useQuery({
    queryKey: ['attendant-profiles'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'attendant');
      if (!roles || roles.length === 0) return [];
      const ids = roles.map(r => r.user_id);
      const { data, error } = await supabase.from('profiles').select('*').in('user_id', ids).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openNew = () => { setForm({ name: '', sector: '', function: '', email: '', phone: '', leaderName: '', status: 'Ativo', firstLogin: true, password: '', canCloseTickets: true, canTransferTickets: true, canChangeReturnReason: false, receivesNewTickets: true }); setEditingId(null); setDialog(true); };
  const openEdit = (a: any) => {
    setForm({ name: a.name, sector: a.sector || '', function: a.function || '', email: a.email, phone: a.phone || '', leaderName: a.leader_name || '', status: a.status, firstLogin: a.first_login, password: '', canCloseTickets: a.can_close_tickets ?? true, canTransferTickets: a.can_transfer_tickets ?? true, canChangeReturnReason: a.can_change_return_reason ?? false, receivesNewTickets: a.receives_new_tickets ?? true });
    setEditingId(a.user_id);
    setDialog(true);
  };


  const handleDeleteClick = (a: any) => {
    setDeleteConfirm({ open: true, userId: a.user_id, name: a.name });
  };

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return userId;
    },
    onSuccess: (userId) => {
      const d = attendants.find((a: any) => a.user_id === userId);
      const info = d ? `${d.name} (${d.email}${d.sector ? ' • ' + d.sector : ''}${d.function ? ' • ' + d.function : ''})` : userId;
      logAction('DELETE', 'profiles', userId, `Atendente excluído do sistema: ${info}. O acesso foi removido e a conta encerrada.`);
      queryClient.invalidateQueries({ queryKey: ['attendant-profiles'] });
      toast({ title: '🗑️ Atendente excluído!' });
    },
    onError: (err: any, userId) => {
      const msg = err?.message || 'Erro ao excluir.';
      const deleted = attendants.find((a: any) => a.user_id === userId);
      setDeleteConfirm({ open: true, userId, name: deleted?.name || '', reason: msg });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from('profiles').update({
          name: form.name, sector: form.sector, function: form.function, email: form.email,
          phone: form.phone, leader_name: form.leaderName, status: form.status, first_login: form.firstLogin,
          can_close_tickets: form.canCloseTickets, can_transfer_tickets: form.canTransferTickets,
          can_change_return_reason: form.canChangeReturnReason, receives_new_tickets: form.receivesNewTickets,
        } as any).eq('user_id', editingId);
        if (error) throw error;
        // Serviços em que pode fechar ticket
        for (const link of myLinks as any[]) {
          const next = closeServices[link.id] ?? (link.can_close ?? true);
          if (next !== (link.can_close ?? true)) {
            const { error: e2 } = await supabase.from('attendant_services').update({ can_close: next } as any).eq('id', link.id);
            if (e2) throw e2;
          }
        }
        // Motivos de devolução em que pode fechar ticket
        const rows = (returnReasons as any[]).map(r => ({
          attendant_id: editingId,
          return_reason_id: r.id,
          can_close: closeReasons[r.id] ?? true,
        }));
        if (rows.length) {
          const { error: e3 } = await supabase
            .from('attendant_return_reasons' as any)
            .upsert(rows as any, { onConflict: 'attendant_id,return_reason_id' });
          if (e3) throw e3;
        }
        return { action: 'UPDATE' as const, id: editingId };


      } else {
        if (!form.email || !form.password || !form.name) throw new Error('Nome, e-mail e senha são obrigatórios');
        const emailTrim = form.email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrim)) throw new Error('E-mail inválido. Informe um endereço no formato nome@dominio.com.');
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { email: emailTrim, password: form.password, name: form.name, role: 'attendant', sector: form.sector, function: form.function, phone: form.phone, leaderName: form.leaderName },
        });
        if (error) {
          let msg = error.message;
          try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === 'function') { const body = await ctx.json(); if (body?.error) msg = body.error; }
            else if (ctx && typeof ctx.text === 'function') { const txt = await ctx.text(); try { const p = JSON.parse(txt); if (p?.error) msg = p.error; } catch { if (txt) msg = txt; } }
          } catch { /* ignora */ }
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        const newId = data?.user?.id || '';
        if (newId) {
          await supabase.from('profiles').update({
            can_close_tickets: form.canCloseTickets, can_transfer_tickets: form.canTransferTickets,
          can_change_return_reason: form.canChangeReturnReason, receives_new_tickets: form.receivesNewTickets,
          } as any).eq('user_id', newId);
        }
        return { action: 'CREATE' as const, id: newId };

      }
    },
    onSuccess: (result) => {
      const detalhes = `${form.name} • E-mail: ${form.email}${form.sector ? ' • Setor: ' + form.sector : ''}${form.function ? ' • Função: ' + form.function : ''}${form.phone ? ' • Telefone: ' + form.phone : ''}${form.leaderName ? ' • Líder: ' + form.leaderName : ''} • Status: ${form.status}`;
      logAction(result.action, 'profiles', result.id, `${result.action === 'CREATE' ? 'Novo atendente cadastrado' : 'Dados do atendente atualizados'}: ${detalhes}.`);
      queryClient.invalidateQueries({ queryKey: ['attendant-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['attendant-services'] });
      queryClient.invalidateQueries({ queryKey: ['attendant-service-links'] });
      queryClient.invalidateQueries({ queryKey: ['attendant-return-reason-links'] });

      setDialog(false);
      toast({ title: editingId ? '✅ Atualizado!' : '✅ Atendente criado!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const fields = [
    { key: 'name', label: 'Nome' }, { key: 'sector', label: 'Setor' }, { key: 'function', label: 'Função' },
    { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Telefone' }, { key: 'leaderName', label: 'Nome do Líder' },
  ];

  const { rows: filteredAttendants, toolbarProps } = useListToolbar(attendants as any[], ATTENDANTS_COLUMNS);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{filteredAttendants.length} de {attendants.length} registros</p>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground font-semibold"><Plus size={16} className="mr-1" /> Novo Atendente</Button>
      </div>
      <ListToolbar title="Atendentes" {...toolbarProps} />
      {isLoading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : (
        <div className="grid gap-3">
          {filteredAttendants.map((a: any) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 card-hover flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.email} • {a.sector} • {a.function}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={a.status === 'Ativo' ? 'status-active' : 'status-inactive'}>{a.status}</span>
                <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Edit2 size={16} /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(a)}><Trash2 size={16} className="text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Atendente</DialogTitle></DialogHeader>
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="permissoes">Permissões</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-3 mt-3">
              {fields.map(f => (
                <div key={f.key}><label className="text-xs font-semibold text-foreground">{f.label}</label>
                <Input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="mt-1" disabled={editingId !== null && f.key === 'email'} /></div>
              ))}
              {!editingId && (
                <div><label className="text-xs font-semibold text-foreground">Senha</label>
                <Input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} className="mt-1" placeholder="Mín. 8 caracteres, maiúscula, minúscula e número" /></div>
              )}
              <div><label className="text-xs font-semibold text-foreground">Status</label>
              <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent></Select></div>
              <div><label className="text-xs font-semibold text-foreground">Primeiro Login</label>
              <Select value={form.firstLogin ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, firstLogin: v === 'SIM' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent></Select></div>
            </TabsContent>

            <TabsContent value="permissoes" className="space-y-3 mt-3">
              <div><label className="text-xs font-semibold text-foreground">Pode Fechar Ticket</label>
              <Select value={form.canCloseTickets ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, canCloseTickets: v === 'SIM' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent></Select>
              <p className="text-[11px] text-muted-foreground mt-1">Só pode fechar tickets associados a ele.</p></div>

              {form.canCloseTickets && (
                <div className="rounded-lg border border-border p-3">
                  <label className="text-xs font-semibold text-foreground">Serviços que pode fechar ticket</label>
                  {!editingId ? (
                    <p className="text-[11px] text-muted-foreground mt-1">Salve o atendente e vincule os serviços para definir esta regra.</p>
                  ) : (myLinks as any[]).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-1">Nenhum serviço vinculado a este atendente.</p>
                  ) : (
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {(myLinks as any[]).map((l: any) => (
                        <label key={l.id} className="flex items-center gap-2 text-xs text-foreground">
                          <Checkbox
                            checked={closeServices[l.id] ?? (l.can_close ?? true)}
                            onCheckedChange={(c) => setCloseServices(prev => ({ ...prev, [l.id]: !!c }))}
                          />
                          <span>{l.services?.code ? `${l.services.code} - ` : ''}{l.services?.name || l.service_id}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2">Desmarque os serviços em que ele não pode fechar tickets.</p>
                </div>
              )}

              {form.canCloseTickets && (
                <div className="rounded-lg border border-border p-3">
                  <label className="text-xs font-semibold text-foreground">Motivos de devolução que pode fechar ticket</label>
                  {!editingId ? (
                    <p className="text-[11px] text-muted-foreground mt-1">Salve o atendente para definir esta regra.</p>
                  ) : (returnReasons as any[]).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-1">Nenhum motivo de devolução ativo cadastrado.</p>
                  ) : (
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {(returnReasons as any[]).map((r: any) => (
                        <label key={r.id} className="flex items-center gap-2 text-xs text-foreground">
                          <Checkbox
                            checked={closeReasons[r.id] ?? true}
                            onCheckedChange={(c) => setCloseReasons(prev => ({ ...prev, [r.id]: !!c }))}
                          />
                          <span>{r.code ? `${r.code} - ` : ''}{r.description}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2">Desmarque os motivos em que ele não pode fechar tickets. A regra vale junto com a do serviço.</p>
                </div>
              )}

              <div><label className="text-xs font-semibold text-foreground">Pode Transferir Ticket</label>
              <Select value={form.canTransferTickets ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, canTransferTickets: v === 'SIM' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent></Select>
              <p className="text-[11px] text-muted-foreground mt-1">Só pode transferir tickets associados a ele.</p></div>
              <div><label className="text-xs font-semibold text-foreground">Pode Alterar Motivo da Devolução</label>
              <Select value={form.canChangeReturnReason ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, canChangeReturnReason: v === 'SIM' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent></Select>
              <p className="text-[11px] text-muted-foreground mt-1">Só pode alterar enquanto o ticket estiver ABERTO.</p></div>
              <div><label className="text-xs font-semibold text-foreground">Recebe Tickets Abertos por Solicitantes</label>
              <Select value={form.receivesNewTickets ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, receivesNewTickets: v === 'SIM' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent></Select>
              <p className="text-[11px] text-muted-foreground mt-1">Se NÃO, recebe apenas tickets transferidos.</p></div>
            </TabsContent>
          </Tabs>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gradient-primary text-primary-foreground font-semibold mt-4">{saveMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>

        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirm.reason ? 'Exclusão não permitida' : 'Confirmar exclusão'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.reason || `Tem certeza que deseja excluir o atendente "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            {!deleteConfirm.reason && (
              <AlertDialogAction
                disabled={deleteMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (deleteMutation.isPending) return;
                  // Feedback instantâneo: overlay aparece antes da animação fechar
                  startGlobalProcessing('Excluindo...');
                  const userId = deleteConfirm.userId;
                  setDeleteConfirm(prev => ({ ...prev, open: false }));
                  deleteMutation.mutate(userId, {
                    onSettled: () => stopGlobalProcessing(),
                  });
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AttendantsPage;
