import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { startGlobalProcessing, stopGlobalProcessing } from '@/contexts/ProcessingContext';
import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

type ScheduleType = 'on_login' | 'period' | 'recurring';

interface MessageForm {
  title: string;
  content: string;
  schedule_type: ScheduleType;
  starts_at: string;
  ends_at: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  active: boolean;
  recipientIds: string[];
}

const emptyForm: MessageForm = {
  title: '',
  content: '',
  schedule_type: 'on_login',
  starts_at: '',
  ends_at: '',
  days_of_week: [],
  start_time: '08:00',
  end_time: '18:00',
  active: true,
  recipientIds: [],
};

const WEEKDAYS = [
  { v: 0, l: 'Dom' }, { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' },
  { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' },
];

const scheduleLabel = (t: ScheduleType) =>
  t === 'on_login'
    ? 'Ao logar (uma vez por usuário)'
    : t === 'period'
      ? 'Ao logar (por um período específico)'
      : 'Ao logar (em dias e horários específicos)';

const MessagesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MessageForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; title: string }>({ open: false, id: '', title: '' });
  const [recipientSearch, setRecipientSearch] = useState('');

  const { data: messages = [] } = useQuery({
    queryKey: ['system-messages-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_messages')
        .select('*, system_message_recipients(user_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles-for-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredProfiles = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
    );
  }, [profiles, recipientSearch]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialog(true);
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      title: m.title,
      content: m.content,
      schedule_type: m.schedule_type,
      starts_at: m.starts_at ? m.starts_at.slice(0, 16) : '',
      ends_at: m.ends_at ? m.ends_at.slice(0, 16) : '',
      days_of_week: m.days_of_week || [],
      start_time: m.start_time?.slice(0, 5) || '08:00',
      end_time: m.end_time?.slice(0, 5) || '18:00',
      active: m.active,
      recipientIds: (m.system_message_recipients || []).map((r: any) => r.user_id),
    });
    setDialog(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.content.trim()) throw new Error('Título e mensagem são obrigatórios');
      if (form.recipientIds.length === 0) throw new Error('Selecione ao menos um destinatário');
      if (form.schedule_type === 'period' && (!form.starts_at || !form.ends_at)) {
        throw new Error('Informe data/hora de início e fim');
      }
      if (form.schedule_type === 'recurring' && form.days_of_week.length === 0) {
        throw new Error('Selecione ao menos um dia da semana');
      }

      const payload: any = {
        title: form.title.trim(),
        content: form.content.trim(),
        schedule_type: form.schedule_type,
        active: form.active,
        starts_at: form.schedule_type === 'period' ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.schedule_type === 'period' ? new Date(form.ends_at).toISOString() : null,
        days_of_week: form.schedule_type === 'recurring' ? form.days_of_week : null,
        start_time: form.schedule_type === 'recurring' ? form.start_time : null,
        end_time: form.schedule_type === 'recurring' ? form.end_time : null,
      };

      let messageId = editingId;
      if (editingId) {
        const { error } = await supabase.from('system_messages').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('system_messages')
          .insert({ ...payload, created_by: user!.id })
          .select('id')
          .single();
        if (error) throw error;
        messageId = data.id;
      }

      // Sync recipients
      if (editingId) {
        const { error: delErr } = await supabase
          .from('system_message_recipients')
          .delete()
          .eq('message_id', messageId);
        if (delErr) throw delErr;
        // Reset acknowledgments so message can re-show after edit
        await supabase
          .from('system_message_acknowledgments')
          .delete()
          .eq('message_id', messageId);
      }
      const rows = form.recipientIds.map((uid) => ({ message_id: messageId, user_id: uid }));
      if (rows.length) {
        const { error: insErr } = await supabase.from('system_message_recipients').insert(rows);
        if (insErr) throw insErr;
      }

      return { id: messageId, action: editingId ? 'UPDATE' : 'CREATE' as const };
    },
    onSuccess: (res: any) => {
      const tipoTxt = scheduleLabel(form.schedule_type);
      let agenda = '';
      if (form.schedule_type === 'period') agenda = ` • Período: ${form.starts_at} até ${form.ends_at}`;
      else if (form.schedule_type === 'recurring') agenda = ` • Dias: ${form.days_of_week.map(d => WEEKDAYS.find(w => w.v === d)?.l).join(', ')} das ${form.start_time} às ${form.end_time}`;
      const detalhes = `"${form.title}" • Exibição: ${tipoTxt}${agenda} • ${form.recipientIds.length} destinatário${form.recipientIds.length === 1 ? '' : 's'} • Status: ${form.active ? 'Ativa' : 'Inativa'}`;
      logAction(res.action, 'system_messages', res.id, `${res.action === 'CREATE' ? 'Nova mensagem do sistema criada' : 'Mensagem do sistema atualizada'}: ${detalhes}.`);
      queryClient.invalidateQueries({ queryKey: ['system-messages-admin'] });
      setDialog(false);
      toast({ title: editingId ? '✅ Mensagem atualizada!' : '✅ Mensagem criada!' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('system_messages').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      logAction('DELETE', 'system_messages', id, `Mensagem do sistema excluída: "${deleteConfirm.title}". Ela não será mais exibida aos usuários.`);
      queryClient.invalidateQueries({ queryKey: ['system-messages-admin'] });
      toast({ title: '🗑️ Mensagem excluída!' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d].sort(),
    }));
  };

  const toggleRecipient = (uid: string) => {
    setForm((f) => ({
      ...f,
      recipientIds: f.recipientIds.includes(uid)
        ? f.recipientIds.filter((x) => x !== uid)
        : [...f.recipientIds, uid],
    }));
  };

  const selectAllRecipients = () => {
    setForm((f) => ({ ...f, recipientIds: filteredProfiles.map((p: any) => p.user_id) }));
  };

  const clearRecipients = () => setForm((f) => ({ ...f, recipientIds: [] }));

  const messagesColumns: ExportColumn<any>[] = [
    { key: 'title', label: 'Título' },
    { key: 'schedule_type', label: 'Tipo', accessor: r => scheduleLabel(r.schedule_type) },
    { key: 'when', label: 'Quando', accessor: r => {
      if (r.schedule_type === 'on_login') return '—';
      if (r.schedule_type === 'period') return r.starts_at && r.ends_at ? `${new Date(r.starts_at).toLocaleString('pt-BR')} → ${new Date(r.ends_at).toLocaleString('pt-BR')}` : '';
      return `${(r.days_of_week || []).map((d: number) => WEEKDAYS[d].l).join(', ')} ${r.start_time?.slice(0,5)}-${r.end_time?.slice(0,5)}`;
    } },
    { key: 'recipients', label: 'Destinatários', accessor: r => (r.system_message_recipients || []).length },
    { key: 'active', label: 'Ativa', accessor: r => r.active ? 'Sim' : 'Não' },
    { key: 'created_at', label: 'Criada em', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
  ];
  const { rows: filteredMessages, toolbarProps } = useListToolbar(messages as any[], messagesColumns);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mensagens do Sistema</h1>
          <p className="text-muted-foreground text-sm">Mensagens personalizadas exibidas ao logar ou em horários programados.</p>
        </div>
        <Button onClick={openNew}><Plus size={18} className="mr-1" /> Nova mensagem</Button>
      </div>

      <ListToolbar title="Mensagens do Sistema" {...toolbarProps} />

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Título</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Quando</th>
              <th className="text-left p-3">Destinatários</th>
              <th className="text-left p-3">Ativo</th>
              <th className="p-3 w-32">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredMessages.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma mensagem cadastrada.</td></tr>
            )}
            {filteredMessages.map((m: any) => (
              <tr key={m.id} className="border-t">
                <td className="p-3 font-medium">{m.title}</td>
                <td className="p-3">{scheduleLabel(m.schedule_type)}</td>
                <td className="p-3 text-muted-foreground">
                  {m.schedule_type === 'on_login' && '—'}
                  {m.schedule_type === 'period' && m.starts_at && m.ends_at && (
                    <>{new Date(m.starts_at).toLocaleString('pt-BR')} → {new Date(m.ends_at).toLocaleString('pt-BR')}</>
                  )}
                  {m.schedule_type === 'recurring' && (
                    <>{(m.days_of_week || []).map((d: number) => WEEKDAYS[d].l).join(', ')} {m.start_time?.slice(0, 5)}–{m.end_time?.slice(0, 5)}</>
                  )}
                </td>
                <td className="p-3">{(m.system_message_recipients || []).length}</td>
                <td className="p-3">{m.active ? 'Sim' : 'Não'}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Edit2 size={16} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm({ open: true, id: m.id, title: m.title })}>
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar mensagem' : 'Nova mensagem'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tipo de exibição</label>
                <Select value={form.schedule_type} onValueChange={(v: ScheduleType) => setForm({ ...form, schedule_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_login">Ao logar (uma vez por usuário)</SelectItem>
                    <SelectItem value="period">Ao logar (por um período específico)</SelectItem>
                    <SelectItem value="recurring">Ao logar (em dias e horários específicos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <span className="text-sm">Ativa</span>
              </div>
            </div>

            {form.schedule_type === 'period' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Início</label>
                  <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Fim</label>
                  <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
              </div>
            )}

            {form.schedule_type === 'recurring' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Dias da semana</label>
                <div className="flex gap-2 flex-wrap">
                  {WEEKDAYS.map((d) => (
                    <Button
                      key={d.v}
                      type="button"
                      size="sm"
                      variant={form.days_of_week.includes(d.v) ? 'default' : 'outline'}
                      onClick={() => toggleDay(d.v)}
                    >
                      {d.l}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-sm font-medium">Hora início</label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Hora fim</label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Destinatários ({form.recipientIds.length} selecionados)</label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={selectAllRecipients}>Selecionar visíveis</Button>
                  <Button type="button" size="sm" variant="outline" onClick={clearRecipients}>Limpar</Button>
                </div>
              </div>
              <Input placeholder="Buscar por nome ou e-mail..." value={recipientSearch} onChange={(e) => setRecipientSearch(e.target.value)} />
              <div className="border rounded max-h-64 overflow-y-auto">
                {filteredProfiles.map((p: any) => (
                  <label key={p.user_id} className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer border-b last:border-b-0">
                    <Checkbox checked={form.recipientIds.includes(p.user_id)} onCheckedChange={() => toggleRecipient(p.user_id)} />
                    <span className="text-sm">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                  </label>
                ))}
                {filteredProfiles.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground text-center">Nenhum usuário encontrado.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button
                disabled={saveMutation.isPending}
                onClick={() => {
                  startGlobalProcessing(editingId ? 'Salvando...' : 'Criando...');
                  saveMutation.mutate(undefined, { onSettled: () => stopGlobalProcessing() });
                }}
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm((p) => ({ ...p, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a mensagem "{deleteConfirm.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteMutation.isPending) return;
                startGlobalProcessing('Excluindo...');
                const id = deleteConfirm.id;
                setDeleteConfirm((p) => ({ ...p, open: false }));
                deleteMutation.mutate(id, { onSettled: () => stopGlobalProcessing() });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MessagesPage;
