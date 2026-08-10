import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Play, Pause, Calendar, Clock } from 'lucide-react';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

type Frequency = 'once' | 'daily' | 'weekly' | 'monthly';

const DAYS = [
  { v: 0, l: 'Dom' }, { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' },
  { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' },
];

const freqLabel = (f: Frequency) =>
  f === 'once' ? 'Única' : f === 'daily' ? 'Diária' : f === 'weekly' ? 'Semanal' : 'Mensal';

const ScheduledTicketsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [form, setForm] = useState({
    name: '',
    user_id: '',
    service_id: '',
    frequency: 'daily' as Frequency,
    run_time: '09:00',
    days_of_week: [] as number[],
    day_of_month: 1,
    run_date: '',
    active: true,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['scheduled-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services-active-sched'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('id,name,code,restricted_visibility').eq('status', 'Ativo').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role');
      if (error) throw error;
      return data;
    },
  });

  const rolesByUserId = React.useMemo(() => {
    const map: Record<string, string> = {};
    (allUserRoles as any[]).forEach((r) => { map[r.user_id] = r.role; });
    return map;
  }, [allUserRoles]);

  const isPrivilegedRole = (uid: string) => {
    const r = rolesByUserId[uid];
    return r === 'admin' || r === 'attendant';
  };

  // Contagem de atendentes por serviço (para alertar quando 0)
  const { data: attendantCounts = {} } = useQuery({
    queryKey: ['attendant-counts-by-service'],
    queryFn: async () => {
      const { data, error } = await supabase.from('attendant_services').select('service_id');
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.service_id] = (map[r.service_id] || 0) + 1; });
      return map;
    },
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users-active-sched'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id,name,email').eq('status', 'Ativo').order('name');
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '', user_id: '', service_id: '',
      frequency: 'daily', run_time: '09:00',
      days_of_week: [], day_of_month: 1, run_date: '', active: true,
    });
  };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      user_id: s.user_id,
      service_id: s.service_id,
      frequency: s.frequency,
      run_time: (s.run_time || '09:00:00').slice(0, 5),
      days_of_week: s.days_of_week || [],
      day_of_month: s.day_of_month || 1,
      run_date: s.run_date || '',
      active: s.active,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.user_id || !form.service_id) throw new Error('Preencha nome, usuário e serviço.');
      if (form.frequency === 'once' && !form.run_date) throw new Error('Informe a data.');
      if (form.frequency === 'weekly' && form.days_of_week.length === 0) throw new Error('Selecione ao menos um dia da semana.');
      const sv = (services as any[]).find((s) => s.id === form.service_id);
      if (sv?.restricted_visibility && !isPrivilegedRole(form.user_id)) {
        throw new Error('Este serviço só pode ser usado em tickets de administradores ou atendentes.');
      }

      const payload: any = {
        name: form.name,
        user_id: form.user_id,
        service_id: form.service_id,
        frequency: form.frequency,
        run_time: form.run_time + ':00',
        days_of_week: form.frequency === 'weekly' ? form.days_of_week : null,
        day_of_month: form.frequency === 'monthly' ? form.day_of_month : null,
        run_date: form.frequency === 'once' ? form.run_date : null,
        active: form.active,
      };

      if (editingId) {
        const { error } = await supabase.from('scheduled_tickets').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('scheduled_tickets').insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Agendamento atualizado!' : 'Agendamento criado!' });
      qc.invalidateQueries({ queryKey: ['scheduled-tickets'] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const toggleActive = useMutation({
    mutationFn: async (s: any) => {
      const { error } = await supabase.from('scheduled_tickets').update({ active: !s.active }).eq('id', s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-tickets'] }),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scheduled_tickets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Agendamento excluído!' });
      qc.invalidateQueries({ queryKey: ['scheduled-tickets'] });
    },
  });

  const toggleDow = (v: number) => {
    setForm(p => ({
      ...p,
      days_of_week: p.days_of_week.includes(v)
        ? p.days_of_week.filter(d => d !== v)
        : [...p.days_of_week, v].sort(),
    }));
  };

  const summarizeFreq = (s: any) => {
    if (s.frequency === 'once') return `Única em ${s.run_date ? new Date(s.run_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} às ${(s.run_time || '').slice(0,5)}`;
    if (s.frequency === 'daily') return `Diariamente às ${(s.run_time || '').slice(0,5)}`;
    if (s.frequency === 'weekly') {
      const ds = (s.days_of_week || []).map((d: number) => DAYS.find(x => x.v === d)?.l).join(', ');
      return `Semanal (${ds}) às ${(s.run_time || '').slice(0,5)}`;
    }
    return `Mensal no dia ${s.day_of_month} às ${(s.run_time || '').slice(0,5)}`;
  };

  const schedColumns: ExportColumn<any>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'user_name', label: 'Solicitante', accessor: r => users.find((u: any) => u.user_id === r.user_id)?.name || '' },
    { key: 'service_name', label: 'Serviço', accessor: r => services.find((s: any) => s.id === r.service_id)?.name || '' },
    { key: 'frequency', label: 'Recorrência', accessor: r => summarizeFreq(r) },
    { key: 'next_run_at', label: 'Próxima execução', accessor: r => r.next_run_at ? new Date(r.next_run_at).toLocaleString('pt-BR') : '' },
    { key: 'active', label: 'Status', accessor: r => r.active ? 'Ativo' : 'Pausado' },
  ];
  const { rows: filteredSchedules, toolbarProps } = useListToolbar(schedules as any[], schedColumns);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tickets Agendados</h1>
          <p className="text-xs text-muted-foreground">Crie tickets automaticamente em horários programados.</p>
        </div>
        <Button onClick={openCreate} className="gradient-primary text-primary-foreground">
          <Plus size={16} className="mr-1" /> Novo Agendamento
        </Button>
      </div>

      <ListToolbar title="Tickets Agendados" {...toolbarProps} />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Solicitante</th>
              <th className="px-3 py-2">Serviço</th>
              <th className="px-3 py-2">Recorrência</th>
              <th className="px-3 py-2">Próxima execução</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhum agendamento.</td></tr>
            )}
            {filteredSchedules.map((s: any) => {
              const u = users.find((x: any) => x.user_id === s.user_id);
              const sv = services.find((x: any) => x.id === s.service_id);
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold text-foreground">{s.name}</td>
                  <td className="px-3 py-2 text-foreground">{u?.name || '-'}</td>
                  <td className="px-3 py-2 text-foreground">{sv?.name || '-'}</td>
                  <td className="px-3 py-2 text-muted-foreground"><Clock size={12} className="inline mr-1" />{summarizeFreq(s)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.next_run_at ? new Date(s.next_run_at).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {s.active ? 'Ativo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => toggleActive.mutate(s)} title={s.active ? 'Pausar' : 'Ativar'}>
                      {s.active ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} title="Editar">
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm({ open: true, id: s.id, name: s.name })} title="Excluir">
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label>Nome do agendamento *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Backup mensal" />
            </div>

            <div>
              <Label>Solicitante (em nome de) *</Label>
              <Select value={form.user_id} onValueChange={v => setForm(p => ({ ...p, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Serviço *</Label>
              <Select value={form.service_id} onValueChange={v => setForm(p => ({ ...p, service_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>
                  {services
                    .filter((s: any) => !s.restricted_visibility || (form.user_id && isPrivilegedRole(form.user_id)))
                    .map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.code}){s.restricted_visibility ? ' 🔒' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.service_id && (attendantCounts as Record<string, number>)[form.service_id] === undefined && (
                <p className="mt-1 text-xs text-destructive">
                  ⚠️ Este serviço não possui atendentes vinculados. O ticket agendado não será criado até que um atendente seja associado em "Atendente x Serviço".
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Frequência *</Label>
                <Select value={form.frequency} onValueChange={(v: Frequency) => setForm(p => ({ ...p, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Única</SelectItem>
                    <SelectItem value="daily">Diária</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hora *</Label>
                <Input type="time" value={form.run_time} onChange={e => setForm(p => ({ ...p, run_time: e.target.value }))} />
              </div>
            </div>

            {form.frequency === 'once' && (
              <div>
                <Label>Data *</Label>
                <Input type="date" value={form.run_date} onChange={e => setForm(p => ({ ...p, run_date: e.target.value }))} />
              </div>
            )}

            {form.frequency === 'weekly' && (
              <div>
                <Label>Dias da semana *</Label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {DAYS.map(d => (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => toggleDow(d.v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        form.days_of_week.includes(d.v)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:border-primary'
                      }`}
                    >{d.l}</button>
                  ))}
                </div>
              </div>
            )}

            {form.frequency === 'monthly' && (
              <div>
                <Label>Dia do mês (1-31) *</Label>
                <Input type="number" min={1} max={31} value={form.day_of_month}
                  onChange={e => setForm(p => ({ ...p, day_of_month: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) }))} />
                <p className="text-[11px] text-muted-foreground mt-1">Se o mês não tiver esse dia, o agendamento pula para o próximo mês válido.</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Switch checked={form.active} onCheckedChange={v => setForm(p => ({ ...p, active: v }))} />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="gradient-primary text-primary-foreground">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agendamento "{deleteConfirm.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSchedule.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ScheduledTicketsPage;
