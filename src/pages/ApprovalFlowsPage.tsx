import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Workflow, List, Network } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ApprovalFlowTree } from '@/components/ApprovalFlowTree';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

const SECTOR_ALL = '__ALL__';

const ApprovalFlowsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [sector, setSector] = useState<string>(SECTOR_ALL);
  const [active, setActive] = useState(true);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [approverSearch, setApproverSearch] = useState('');

  const { data: services = [] } = useQuery({
    queryKey: ['services-active-for-approval'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('id, name, code').eq('status', 'Ativo').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-approval'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name, email, sector').eq('status', 'Ativo').order('name');
      if (error) throw error;
      return data;
    },
  });

  const sectors = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p: any) => { if (p.sector) set.add(p.sector); });
    return Array.from(set).sort();
  }, [profiles]);

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ['approval-flows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_flows')
        .select('*, services(name, code), approval_flow_approvers(approver_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const flowsColumns: ExportColumn<any>[] = useMemo(() => [
    { key: 'name', label: 'Nome' },
    { key: 'service_name', label: 'Serviço', accessor: r => r.services?.name || '' },
    { key: 'service_code', label: 'Código', accessor: r => r.services?.code || '' },
    { key: 'sector', label: 'Setor', accessor: r => r.sector || 'Todos' },
    { key: 'approvers', label: 'Aprovadores', accessor: r => (r.approval_flow_approvers || []).map((a: any) => profiles.find((p: any) => p.user_id === a.approver_id)?.name).filter(Boolean).join(', ') },
    { key: 'active', label: 'Ativo', accessor: r => r.active ? 'Sim' : 'Não' },
    { key: 'created_at', label: 'Criado em', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
  ], [profiles]);
  const { rows: filteredFlows, toolbarProps } = useListToolbar(flows as any[], flowsColumns);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setServiceId('');
    setSector(SECTOR_ALL);
    setActive(true);
    setApproverIds([]);
  };

  const openNew = () => { resetForm(); setOpenModal(true); };

  const openEdit = (flow: any) => {
    setEditingId(flow.id);
    setName(flow.name);
    setServiceId(flow.service_id);
    setSector(flow.sector || SECTOR_ALL);
    setActive(flow.active);
    setApproverIds((flow.approval_flow_approvers || []).map((a: any) => a.approver_id));
    setOpenModal(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Informe o nome do fluxo.');
      if (!serviceId) throw new Error('Selecione um serviço.');
      if (approverIds.length === 0) throw new Error('Selecione ao menos um aprovador.');

      const payload = {
        name: name.trim(),
        service_id: serviceId,
        sector: sector === SECTOR_ALL ? null : sector,
        active,
      };

      let flowId = editingId;
      if (editingId) {
        const { error } = await supabase.from('approval_flows').update(payload).eq('id', editingId);
        if (error) throw error;
        // Resync approvers
        await supabase.from('approval_flow_approvers').delete().eq('flow_id', editingId);
      } else {
        const { data, error } = await supabase
          .from('approval_flows')
          .insert({ ...payload, created_by: user!.id })
          .select('id')
          .single();
        if (error) throw error;
        flowId = data.id;
      }

      const inserts = approverIds.map(aid => ({ flow_id: flowId!, approver_id: aid }));
      const { error: apErr } = await supabase.from('approval_flow_approvers').insert(inserts);
      if (apErr) throw apErr;

      const svc = services.find((s: any) => s.id === serviceId);
      const aprovadoresNomes = approverIds
        .map(aid => profiles.find((p: any) => p.user_id === aid)?.name)
        .filter(Boolean)
        .join(', ');
      const setorTxt = sector === SECTOR_ALL ? 'Todos os setores' : sector;
      const detalhes = `"${name}" • Serviço: "${svc?.name || '—'}" • Setor: ${setorTxt} • ${approverIds.length} aprovador${approverIds.length === 1 ? '' : 'es'}: ${aprovadoresNomes} • Status: ${active ? 'Ativo' : 'Inativo'}`;
      void logAction(editingId ? 'UPDATE' : 'CREATE', 'approval_flows', flowId!, `${editingId ? 'Fluxo de aprovação atualizado' : 'Novo fluxo de aprovação criado'}: ${detalhes}.`);
      return flowId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] });
      setOpenModal(false);
      resetForm();
      toast({ title: '✅ Fluxo salvo!' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('approval_flows').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-flows'] }),
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const flow = flows.find((f: any) => f.id === id);
      const { error } = await supabase.from('approval_flows').delete().eq('id', id);
      if (error) throw error;
      const setorTxt = flow?.sector || 'Todos os setores';
      const detalhes = flow ? `"${flow.name}" (Serviço: "${flow.services?.name || '—'}" • Setor: ${setorTxt})` : id;
      void logAction('DELETE', 'approval_flows', id, `Fluxo de aprovação excluído: ${detalhes}. Tickets desse serviço não passarão mais por esse fluxo.`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-flows'] });
      toast({ title: 'Fluxo excluído.' });
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const toggleApprover = (id: string) => {
    setApproverIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Workflow size={22} /> Fluxos de Aprovação</h1>
          <p className="text-sm text-muted-foreground">Defina serviços que exigem aprovação prévia antes de ir ao atendente.</p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground"><Plus size={16} className="mr-1" /> Novo fluxo</Button>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list"><List size={14} className="mr-1" /> Tabela</TabsTrigger>
          <TabsTrigger value="tree"><Network size={14} className="mr-1" /> Árvore</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3 mt-4">
          <ListToolbar title="Fluxos de Aprovação" {...toolbarProps} />

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Serviço</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Setor</th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground">Aprovadores</th>
                    <th className="text-center px-4 py-3 font-semibold text-foreground">Ativo</th>
                    <th className="text-right px-4 py-3 font-semibold text-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Carregando...</td></tr>
                  )}
                  {!isLoading && filteredFlows.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Nenhum fluxo cadastrado.</td></tr>
                  )}
                  {filteredFlows.map((f: any) => {
                    const apIds = (f.approval_flow_approvers || []).map((a: any) => a.approver_id);
                    const apNames = apIds.map((id: string) => profiles.find((p: any) => p.user_id === id)?.name).filter(Boolean);
                    return (
                      <tr key={f.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{f.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{f.services?.name} <span className="text-[10px]">({f.services?.code})</span></td>
                        <td className="px-4 py-3">{f.sector ? <Badge variant="outline">{f.sector}</Badge> : <Badge>Todos</Badge>}</td>
                        <td className="px-4 py-3 text-muted-foreground">{apNames.length > 0 ? apNames.join(', ') : <span className="text-destructive">Sem aprovadores</span>}</td>
                        <td className="px-4 py-3 text-center">
                          <Switch checked={f.active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: f.id, active: checked })} />
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil size={16} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(f.id)}><Trash2 size={16} className="text-destructive" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tree" className="mt-4">
          <ApprovalFlowTree
            flows={flows as any[]}
            profiles={profiles as any[]}
            onEdit={(f) => openEdit(f)}
            onDelete={(id) => setDeleteId(id)}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={openModal} onOpenChange={(o) => { setOpenModal(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar fluxo' : 'Novo fluxo de aprovação'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Nome do fluxo *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Aprovação TI - Comercial" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Serviço *</label>
              <div className="mt-1">
                <SearchableSelect
                  value={serviceId}
                  onValueChange={setServiceId}
                  options={services.map((s: any) => ({
                    value: s.id,
                    label: `${s.name} (${s.code})`,
                  }))}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar serviço..."
                  emptyText="Nenhum serviço encontrado."
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Setor do solicitante</label>
              <div className="mt-1">
                <SearchableSelect
                  value={sector}
                  onValueChange={setSector}
                  options={[
                    { value: SECTOR_ALL, label: 'Todos os setores' },
                    ...sectors.map(s => ({ value: s, label: s })),
                  ]}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar setor..."
                  emptyText="Nenhum setor encontrado."
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">"Todos" aplica para qualquer usuário deste serviço.</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground">Aprovadores *</label>
                <span className="text-[10px] text-muted-foreground">{approverIds.length} selecionado(s)</span>
              </div>
              <Input
                value={approverSearch}
                onChange={e => setApproverSearch(e.target.value)}
                placeholder="🔍 Buscar por nome ou e-mail..."
                className="mb-2 h-8 text-sm"
              />
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                {(() => {
                  const q = approverSearch.trim().toLowerCase();
                  const filtered = q
                    ? profiles.filter((p: any) =>
                        (p.name || '').toLowerCase().includes(q) ||
                        (p.email || '').toLowerCase().includes(q)
                      )
                    : profiles;
                  if (filtered.length === 0) {
                    return <p className="text-xs text-muted-foreground text-center py-3">Nenhum aprovador encontrado.</p>;
                  }
                  return filtered.map((p: any) => (
                    <label key={p.user_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                      <input type="checkbox" checked={approverIds.includes(p.user_id)} onChange={() => toggleApprover(p.user_id)} />
                      <span className="text-sm">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{p.email}</span>
                    </label>
                  ));
                })()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Todos os aprovadores precisam aprovar para liberar o ticket. Se qualquer um rejeitar, o ticket é rejeitado.</p>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Ativo</label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gradient-primary text-primary-foreground">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O fluxo e seus aprovadores serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { const id = deleteId!; setDeleteId(null); deleteMutation.mutate(id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApprovalFlowsPage;
