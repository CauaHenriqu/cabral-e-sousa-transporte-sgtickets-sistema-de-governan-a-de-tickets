import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

const SERVICES_COLUMNS: ExportColumn<any>[] = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Nome' },
  { key: 'sla_hours', label: 'SLA (horas)' },
  { key: 'requires_description', label: 'Exige Descrição', accessor: r => r.requires_description ? 'Sim' : 'Não' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Criado em', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
];

interface ServiceForm {
  name: string;
  status: 'Ativo' | 'Inativo';
  requires_description: boolean;
  sla_hours: string;
  restricted_visibility: boolean;
}

const ServicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string; reason?: string }>({ open: false, id: '', name: '' });
  const [form, setForm] = useState<ServiceForm>({ name: '', status: 'Ativo', requires_description: false, sla_hours: '', restricted_visibility: false });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDeleteClick = async (s: any) => {
    const reasons: string[] = [];
    const { data: tickets } = await supabase.from('tickets').select('id').eq('service_id', s.id).limit(1);
    if (tickets && tickets.length > 0) reasons.push('tickets');
    const { data: assoc } = await supabase.from('attendant_services').select('id').eq('service_id', s.id).limit(1);
    if (assoc && assoc.length > 0) reasons.push('associações de atendentes');
    const { data: forms } = await supabase.from('service_forms').select('id').eq('service_id', s.id).limit(1);
    if (forms && forms.length > 0) reasons.push('formulários');

    if (reasons.length > 0) {
      setDeleteConfirm({ open: true, id: s.id, name: s.name, reason: `O serviço "${s.name}" possui ${reasons.join(', ')} associados e não pode ser excluído. Remova as associações primeiro.` });
      return;
    }
    setDeleteConfirm({ open: true, id: s.id, name: s.name });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      const d = services.find((s: any) => s.id === id);
      const info = d ? `"${d.name}" (código ${d.code || '—'} • SLA: ${d.sla_hours ?? '—'}h • Status: ${d.status})` : id;
      logAction('DELETE', 'services', id, `Serviço excluído do catálogo: ${info}.`);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: '🗑️ Serviço excluído!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from('services').update({ name: form.name, status: form.status, requires_description: form.requires_description, sla_hours: parseInt(form.sla_hours, 10), restricted_visibility: form.restricted_visibility } as any).eq('id', editingId);
        if (error) throw error;
        return { action: 'UPDATE' as const, id: editingId };
      } else {
        const { data, error } = await supabase.from('services').insert({ name: form.name, status: form.status, requires_description: form.requires_description, sla_hours: parseInt(form.sla_hours, 10), restricted_visibility: form.restricted_visibility } as any).select().single();
        if (error) throw error;
        return { action: 'CREATE' as const, id: data.id };
      }
    },
    onSuccess: (result) => {
      const detalhes = `"${form.name}" • SLA: ${form.sla_hours || '—'}h • Status: ${form.status} • Exige descrição: ${form.requires_description ? 'Sim' : 'Não'} • Visível somente para admin/atendente: ${form.restricted_visibility ? 'Sim' : 'Não'}`;
      logAction(result.action, 'services', result.id, `${result.action === 'CREATE' ? 'Novo serviço cadastrado no catálogo' : 'Dados do serviço atualizados'}: ${detalhes}.`);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setDialog(false);
      toast({ title: editingId ? '✅ Serviço atualizado!' : '✅ Serviço cadastrado!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const openNew = () => { setForm({ name: '', status: 'Ativo', requires_description: false, sla_hours: '', restricted_visibility: false }); setEditingId(null); setDialog(true); };
  const openEdit = (s: any) => { setForm({ name: s.name, status: s.status, requires_description: s.requires_description ?? false, sla_hours: String(s.sla_hours ?? ''), restricted_visibility: s.restricted_visibility ?? false }); setEditingId(s.id); setDialog(true); };

  const save = () => {
    if (!form.name) { toast({ title: 'Preencha o nome', variant: 'destructive' }); return; }
    const sla = parseInt(form.sla_hours, 10);
    if (!form.sla_hours || isNaN(sla) || sla < 1) { toast({ title: 'Informe o SLA (horas) — número inteiro maior que 0', variant: 'destructive' }); return; }
    saveMutation.mutate();
  };

  const { rows: filteredServices, toolbarProps } = useListToolbar(services as any[], SERVICES_COLUMNS);

  const { data: serviceForms = [] } = useQuery({
    queryKey: ['service_forms_ids'],
    queryFn: async () => {
      const { data, error } = await supabase.from('service_forms').select('service_id');
      if (error) throw error;
      return data;
    },
  });
  const formServiceIds = new Set((serviceForms as any[]).map(f => f.service_id));
  const servicesMissingForm = (services as any[]).filter(s => !s.requires_description && !formServiceIds.has(s.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{filteredServices.length} de {services.length} registros</p>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground font-semibold"><Plus size={16} className="mr-1" /> Novo Serviço</Button>
      </div>
      {servicesMissingForm.length > 0 && (
        <div className="bg-card border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
          <div className="text-xs text-foreground">
            <p className="font-semibold text-destructive mb-1">
              {servicesMissingForm.length} serviço{servicesMissingForm.length === 1 ? '' : 's'} com obrigatoriedade de descrição no ticket igual a NÃO e sem formulário associado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {servicesMissingForm.map(s => (
                <span key={s.id} className="bg-card border border-destructive/30 rounded px-2 py-0.5">{s.name}</span>
              ))}
            </div>
          </div>
        </div>
      )}
      <ListToolbar title="Serviços" {...toolbarProps} />
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : (
        <div className="grid gap-3">
          {filteredServices.map((s: any) => {
            const missingForm = !s.requires_description && !formServiceIds.has(s.id);
            return (
            <div key={s.id} className={`bg-card border rounded-xl p-4 card-hover flex items-center justify-between ${missingForm ? 'border-destructive/40' : 'border-border'}`}>
              <div className="flex items-start gap-2">
                {missingForm && <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />}
                <div>
                  <p className="text-sm font-bold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">Código: {s.code} • SLA: {s.sla_hours} {s.sla_hours === 1 ? 'hora' : 'horas'} • Descrição no ticket: {s.requires_description ? 'SIM' : 'NÃO'} • Visível somente p/ admin/atendente: {s.restricted_visibility ? 'SIM' : 'NÃO'}</p>
                  {missingForm && <p className="text-xs text-destructive mt-1">Obrigatoriedade de descrição no ticket igual a NÃO e sem formulário associado</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={s.status === 'Ativo' ? 'status-active' : 'status-inactive'}>{s.status}</span>
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Edit2 size={16} /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(s)}><Trash2 size={16} className="text-destructive" /></Button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Serviço</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editingId && (
              <div><label className="text-xs font-semibold text-muted-foreground">Código</label><Input value={(services.find((s: any) => s.id === editingId) as any)?.code || ''} disabled className="mt-1 bg-muted" /></div>
            )}
            <div><label className="text-xs font-semibold text-foreground">Nome</label><Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="mt-1" /></div>
            <div>
              <label className="text-xs font-semibold text-foreground">SLA (horas) <span className="text-destructive">*</span></label>
              <Input
                type="number"
                min={1}
                step={1}
                value={form.sla_hours}
                onChange={e => setForm(prev => ({ ...prev, sla_hours: e.target.value.replace(/[^0-9]/g, '') }))}
                placeholder="Ex.: 3"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Status</label>
              <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v as any }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Informar descrição ao criar o ticket?</label>
              <Select value={form.requires_description ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, requires_description: v === 'SIM' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Visível somente para administradores e atendentes?</label>
              <Select value={form.restricted_visibility ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, restricted_visibility: v === 'SIM' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent>
              </Select>
            </div>
            <Button onClick={save} disabled={saveMutation.isPending} className="w-full gradient-primary text-primary-foreground font-semibold">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirm.reason ? 'Exclusão não permitida' : 'Confirmar exclusão'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.reason || `Tem certeza que deseja excluir o serviço "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            {!deleteConfirm.reason && (
              <AlertDialogAction onClick={() => deleteMutation.mutate(deleteConfirm.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServicesPage;
