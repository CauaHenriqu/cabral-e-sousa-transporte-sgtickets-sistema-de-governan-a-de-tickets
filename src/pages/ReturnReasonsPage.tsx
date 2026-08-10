import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logAction';
import { useAuth } from '@/contexts/AuthContext';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

const COLUMNS: ExportColumn<any>[] = [
  { key: 'code', label: 'Código' },
  { key: 'description', label: 'Descrição' },
  { key: 'sector', label: 'Setor Responsável' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Criado em', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
];

const ReturnReasonsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; description: string }>({ open: false, id: '', description: '' });
  const [form, setForm] = useState<{ description: string; status: 'Ativo' | 'Inativo'; sector: string }>({ description: '', status: 'Ativo', sector: '' });

  const { data: reasons = [], isLoading } = useQuery({
    queryKey: ['return_reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('return_reasons' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: profileSectors = [] } = useQuery({
    queryKey: ['profile-sectors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('sector');
      if (error) throw error;
      return (data ?? []).map((p: any) => p.sector).filter(Boolean) as string[];
    },
  });

  const sectorOptions = React.useMemo(() => {
    const set = new Set<string>();
    profileSectors.forEach(s => set.add(s));
    reasons.forEach((r: any) => { if (r.sector) set.add(r.sector); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(s => ({ value: s, label: s }));
  }, [profileSectors, reasons]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from('return_reasons' as any)
          .update({ description: form.description, status: form.status, sector: form.sector || null } as any)
          .eq('id', editingId);
        if (error) throw error;
        return { action: 'UPDATE' as const, id: editingId };
      }
      const { data, error } = await supabase
        .from('return_reasons' as any)
        .insert({ description: form.description, status: form.status, sector: form.sector || null } as any)
        .select()
        .single();
      if (error) throw error;
      return { action: 'CREATE' as const, id: (data as any).id };
    },
    onSuccess: (result) => {
      logAction(result.action, 'return_reasons', result.id,
        `${result.action === 'CREATE' ? 'Novo motivo de devolução cadastrado' : 'Motivo de devolução atualizado'}: "${form.description}" • Setor: ${form.sector || '—'} • Status: ${form.status}.`);
      queryClient.invalidateQueries({ queryKey: ['return_reasons'] });
      setDialog(false);
      toast({ title: editingId ? '✅ Motivo atualizado!' : '✅ Motivo cadastrado!' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('return_reasons' as any).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      const r = reasons.find((x: any) => x.id === id);
      logAction('DELETE', 'return_reasons', id, `Motivo de devolução excluído: "${r?.description ?? id}" (código ${r?.code ?? '—'}).`);
      queryClient.invalidateQueries({ queryKey: ['return_reasons'] });
      toast({ title: '🗑️ Motivo excluído!' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const openNew = () => { setForm({ description: '', status: 'Ativo', sector: '' }); setEditingId(null); setDialog(true); };
  const openEdit = (r: any) => { setForm({ description: r.description, status: r.status, sector: r.sector || '' }); setEditingId(r.id); setDialog(true); };

  const save = () => {
    if (!form.description.trim()) { toast({ title: 'Preencha a descrição', variant: 'destructive' }); return; }
    saveMutation.mutate();
  };

  const { rows: filtered, toolbarProps } = useListToolbar(reasons, COLUMNS);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{filtered.length} de {reasons.length} registros</p>
        {isAdmin && (
          <Button onClick={openNew} className="gradient-primary text-primary-foreground font-semibold">
            <Plus size={16} className="mr-1" /> Novo Motivo
          </Button>
        )}
      </div>

      <ListToolbar title="Motivos de Devolução" {...toolbarProps} />

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum motivo de devolução cadastrado.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r: any) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 card-hover flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{r.description}</p>
                <p className="text-xs text-muted-foreground">Código: {r.code}{r.sector ? ` • Setor: ${r.sector}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={r.status === 'Ativo' ? 'status-active' : 'status-inactive'}>{r.status}</span>
                {isAdmin && (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Edit2 size={16} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm({ open: true, id: r.id, description: r.description })}>
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Motivo de Devolução</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editingId && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Código</label>
                <Input value={(reasons.find((r: any) => r.id === editingId) as any)?.code || ''} disabled className="mt-1 bg-muted" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-foreground">Descrição <span className="text-destructive">*</span></label>
              <Input value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Setor Responsável</label>
              <SearchableSelect
                value={form.sector}
                onValueChange={v => setForm(prev => ({ ...prev, sector: v }))}
                options={sectorOptions}
                allowCreate
                placeholder="Selecione ou cadastre..."
                searchPlaceholder="Buscar ou digitar novo setor..."
                emptyText="Nenhum setor encontrado"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Status</label>
              <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v as any }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
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
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o motivo "{deleteConfirm.description}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteConfirm.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReturnReasonsPage;
