import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const SchedulesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newAttId, setNewAttId] = useState('');
  const [newDay, setNewDay] = useState('');
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [newLunchStart, setNewLunchStart] = useState('12:00');
  const [newLunchEnd, setNewLunchEnd] = useState('14:00');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; label: string }>({ open: false, id: '', label: '' });

  const { data: schedules = [] } = useQuery({
    queryKey: ['work-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('work_schedules').select('*').order('day_of_week');
      if (error) throw error;
      return data;
    },
  });

  const { data: attendants = [] } = useQuery({
    queryKey: ['attendant-profiles'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'attendant');
      if (!roles || roles.length === 0) return [];
      const ids = roles.map(r => r.user_id);
      const { data, error } = await supabase.from('profiles').select('user_id, name, status').in('user_id', ids);
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('work_schedules').insert({
        attendant_id: newAttId,
        day_of_week: parseInt(newDay),
        start_time: newStart,
        end_time: newEnd,
        lunch_start: newLunchStart,
        lunch_end: newLunchEnd,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const att = attendants.find((a: any) => a.user_id === newAttId);
      const lunch = newLunchStart && newLunchEnd ? ` | Almoço: ${newLunchStart} às ${newLunchEnd}` : '';
      logAction('CREATE', 'work_schedules', data.id, `Novo expediente cadastrado para o atendente ${att?.name || '—'}: ${DAYS[parseInt(newDay)]} das ${newStart} às ${newEnd}${lunch}.`);
      queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
      toast({ title: '✅ Expediente cadastrado!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const ws = schedules.find((s: any) => s.id === id);
      const { error } = await supabase.from('work_schedules').delete().eq('id', id);
      if (error) throw error;
      return { id, ws };
    },
    onSuccess: ({ id, ws }) => {
      const att = attendants.find((a: any) => a.user_id === ws?.attendant_id);
      const horario = ws ? ` (das ${ws.start_time} às ${ws.end_time})` : '';
      logAction('DELETE', 'work_schedules', id, `Expediente removido do atendente ${att?.name || '—'}: ${DAYS[ws?.day_of_week]}${horario}.`);
      queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
      toast({ title: '🗑️ Removido!' });
    },
  });

  const add = () => {
    if (!newAttId || newDay === '') { toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return; }
    addMutation.mutate();
  };

  const grouped = attendants.filter((a: any) => a.status === 'Ativo').map((att: any) => ({
    attendant: att,
    schedules: schedules.filter((ws: any) => ws.attendant_id === att.user_id).sort((a: any, b: any) => a.day_of_week - b.day_of_week),
  }));

  const schedColumns: ExportColumn<any>[] = [
    { key: 'attendant_name', label: 'Atendente', accessor: r => attendants.find((a: any) => a.user_id === r.attendant_id)?.name || '' },
    { key: 'day_of_week', label: 'Dia', accessor: r => DAYS[r.day_of_week] || '' },
    { key: 'start_time', label: 'Início' },
    { key: 'end_time', label: 'Fim' },
    { key: 'lunch_start', label: 'Início Almoço' },
    { key: 'lunch_end', label: 'Fim Almoço' },
  ];
  const { toolbarProps } = useListToolbar(schedules as any[], schedColumns);

  const attendantsWithoutSchedule = attendants
    .filter((a: any) => a.status === 'Ativo')
    .filter((a: any) => !schedules.some((ws: any) => ws.attendant_id === a.user_id));

  return (
    <div className="space-y-4">
      <ListToolbar title="Horários de Trabalho" {...toolbarProps} />

      {attendantsWithoutSchedule.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-destructive">
                {attendantsWithoutSchedule.length} atendente{attendantsWithoutSchedule.length === 1 ? '' : 's'} ativo{attendantsWithoutSchedule.length === 1 ? '' : 's'} sem expediente definido
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Esses atendentes não terão horário de trabalho considerado para SLA e distribuição:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {attendantsWithoutSchedule.map((a: any) => (
                  <span key={a.user_id} className="text-xs bg-card border border-destructive/30 text-foreground px-2 py-1 rounded-md font-medium">
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[160px]">
          <label className="text-xs font-semibold text-foreground">Atendente</label>
          <Select value={newAttId} onValueChange={setNewAttId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>{attendants.filter((a: any) => a.status === 'Ativo').map((a: any) => <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-[120px]">
          <label className="text-xs font-semibold text-foreground">Dia</label>
          <Select value={newDay} onValueChange={setNewDay}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Dia..." /></SelectTrigger>
            <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><label className="text-xs font-semibold text-foreground">Início</label><Input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="mt-1 w-28" /></div>
        <div><label className="text-xs font-semibold text-foreground">Fim</label><Input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="mt-1 w-28" /></div>
        <div><label className="text-xs font-semibold text-foreground">Início Almoço</label><Input type="time" value={newLunchStart} onChange={e => setNewLunchStart(e.target.value)} className="mt-1 w-28" /></div>
        <div><label className="text-xs font-semibold text-foreground">Fim Almoço</label><Input type="time" value={newLunchEnd} onChange={e => setNewLunchEnd(e.target.value)} className="mt-1 w-28" /></div>
        <Button onClick={add} disabled={addMutation.isPending} className="gradient-primary text-primary-foreground font-semibold"><Plus size={16} className="mr-1" /> Adicionar</Button>
      </div>

      {grouped.map((g: any) => (
        <div key={g.attendant.user_id} className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock size={16} className="text-primary" /> {g.attendant.name}
          </h3>
          <div className="grid gap-2">
            {g.schedules.length === 0 && <p className="text-xs text-muted-foreground">Nenhum expediente configurado</p>}
            {g.schedules.map((ws: any) => (
              <div key={ws.id} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                <span className="text-sm text-foreground font-medium">{DAYS[ws.day_of_week]}: {ws.start_time} - {ws.end_time} | Almoço: {ws.lunch_start} - {ws.lunch_end}</span>
                <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm({ open: true, id: ws.id, label: `${g.attendant.name} - ${DAYS[ws.day_of_week]}` })}><Trash2 size={14} className="text-destructive" /></Button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o expediente "{deleteConfirm.label}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMutation.mutate(deleteConfirm.id)}
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

export default SchedulesPage;
