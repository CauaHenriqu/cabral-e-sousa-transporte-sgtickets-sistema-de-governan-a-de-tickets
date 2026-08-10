import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/SearchableSelect';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Link2, List, Network, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';
import { AttendantServiceTree } from '@/components/AttendantServiceTree';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const AttendantServicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newAttId, setNewAttId] = useState('');
  const [newSvcId, setNewSvcId] = useState('');
  const [newCanClose, setNewCanClose] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; label: string }>({ open: false, id: '', label: '' });

  const { data: attendantServices = [] } = useQuery({
    queryKey: ['attendant-services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('attendant_services').select('*');
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

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('status', 'Ativo');
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('attendant_services').insert({ attendant_id: newAttId, service_id: newSvcId, can_close: newCanClose } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const att = attendants.find((a: any) => a.user_id === newAttId);
      const svc = services.find((s: any) => s.id === newSvcId);
      logAction('CREATE', 'attendant_services', data.id, `Atendente "${att?.name || '—'}" foi vinculado ao serviço "${svc?.name || '—'}". A partir de agora ele poderá receber tickets desse serviço.`);
      queryClient.invalidateQueries({ queryKey: ['attendant-services'] });
      setNewAttId(''); setNewSvcId(''); setNewCanClose(true);
      toast({ title: '✅ Associação criada!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = attendantServices.find((as_item: any) => as_item.id === id);
      const { error } = await supabase.from('attendant_services').delete().eq('id', id);
      if (error) throw error;
      return { id, item };
    },
    onSuccess: ({ id, item }) => {
      const att = attendants.find((a: any) => a.user_id === item?.attendant_id);
      const svc = services.find((s: any) => s.id === item?.service_id);
      logAction('DELETE', 'attendant_services', id, `Vínculo do atendente "${att?.name || '—'}" com o serviço "${svc?.name || '—'}" foi removido. Ele não receberá mais tickets desse serviço.`);
      queryClient.invalidateQueries({ queryKey: ['attendant-services'] });
      toast({ title: '🗑️ Associação removida!' });
    },
  });

  const updateCanCloseMutation = useMutation({
    mutationFn: async ({ id, canClose }: { id: string; canClose: boolean }) => {
      const { error } = await supabase.from('attendant_services').update({ can_close: canClose } as any).eq('id', id);
      if (error) throw error;
      return { id, canClose };
    },
    onSuccess: ({ id, canClose }) => {
      const item = (attendantServices as any[]).find((i: any) => i.id === id);
      const att = attendants.find((a: any) => a.user_id === item?.attendant_id);
      const svc = services.find((sv: any) => sv.id === item?.service_id);
      logAction('UPDATE', 'attendant_services', id, `Permissão de fechamento do atendente "${att?.name || '—'}" no serviço "${svc?.name || '—'}" alterada para ${canClose ? 'SIM' : 'NÃO'}.`);
      queryClient.invalidateQueries({ queryKey: ['attendant-services'] });
      toast({ title: '✅ Permissão atualizada!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const add = () => {
    if (!newAttId || !newSvcId) { toast({ title: 'Selecione atendente e serviço', variant: 'destructive' }); return; }
    addMutation.mutate();
  };

  const asColumns: ExportColumn<any>[] = [
    { key: 'attendant_name', label: 'Atendente', accessor: r => attendants.find((a: any) => a.user_id === r.attendant_id)?.name || '' },
    { key: 'service_name', label: 'Serviço', accessor: r => services.find((s: any) => s.id === r.service_id)?.name || '' },
    { key: 'can_close', label: 'Pode Fechar Ticket', accessor: r => (r.can_close ?? true) ? 'SIM' : 'NÃO' },
  ];
  const { rows: filteredAS, toolbarProps } = useListToolbar(attendantServices as any[], asColumns);

  const linkedServiceIds = new Set((attendantServices as any[]).map((as: any) => as.service_id));
  const unlinkedServices = (services as any[]).filter((s: any) => !linkedServiceIds.has(s.id));

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-semibold text-foreground">Atendente</label>
          <div className="mt-1">
            <SearchableSelect
              value={newAttId}
              onValueChange={setNewAttId}
              options={attendants
                .filter((a: any) => a.status === 'Ativo')
                .map((a: any) => ({ value: a.user_id, label: a.name }))}
              placeholder="Selecione..."
              searchPlaceholder="Buscar atendente..."
              emptyText="Nenhum atendente encontrado."
            />
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-semibold text-foreground">Serviço</label>
          <div className="mt-1">
            <SearchableSelect
              value={newSvcId}
              onValueChange={setNewSvcId}
              options={services.map((s: any) => ({ value: s.id, label: s.name }))}
              placeholder="Selecione..."
              searchPlaceholder="Buscar serviço..."
              emptyText="Nenhum serviço encontrado."
            />
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className="text-xs font-semibold text-foreground">Pode Fechar Ticket</label>
          <Select value={newCanClose ? 'SIM' : 'NÃO'} onValueChange={v => setNewCanClose(v === 'SIM')}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent>
          </Select>
        </div>
        <Button onClick={add} disabled={addMutation.isPending} className="gradient-primary text-primary-foreground font-semibold"><Plus size={16} className="mr-1" /> Associar</Button>
      </div>

      {unlinkedServices.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-destructive">
                {unlinkedServices.length} serviço{unlinkedServices.length === 1 ? '' : 's'} ativo{unlinkedServices.length === 1 ? '' : 's'} sem atendente vinculado
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tickets desses serviços não poderão ser atribuídos automaticamente:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {unlinkedServices.map((s: any) => (
                  <span key={s.id} className="text-xs bg-card border border-destructive/30 text-foreground px-2 py-1 rounded-md font-medium">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list"><List size={14} className="mr-1" /> Lista</TabsTrigger>
          <TabsTrigger value="tree"><Network size={14} className="mr-1" /> Árvore</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3 mt-4">
          <ListToolbar title="Atendente x Serviço" {...toolbarProps} />

          <div className="grid gap-3">
            {filteredAS.map((as_item: any) => {
              const att = attendants.find((a: any) => a.user_id === as_item.attendant_id);
              const svc = services.find((s: any) => s.id === as_item.service_id);
              return (
                <div key={as_item.id} className="bg-card border border-border rounded-xl p-4 card-hover flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link2 size={16} className="text-primary" />
                    <div>
                      <p className="text-sm font-bold text-foreground">{att?.name || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">→ {svc?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-muted-foreground">Pode fechar ticket</p>
                      <Select
                        value={(as_item.can_close ?? true) ? 'SIM' : 'NÃO'}
                        onValueChange={v => updateCanCloseMutation.mutate({ id: as_item.id, canClose: v === 'SIM' })}
                      >
                        <SelectTrigger className="h-8 w-[90px] mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm({ open: true, id: as_item.id, label: `${att?.name || 'N/A'} → ${svc?.name || 'N/A'}` })}>
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="tree" className="mt-4">
          <AttendantServiceTree
            links={attendantServices as any[]}
            attendants={attendants as any[]}
            services={services as any[]}
            onDelete={(link, label) => setDeleteConfirm({ open: true, id: link.id, label })}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o vínculo "{deleteConfirm.label}"? Esta ação não pode ser desfeita.
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

export default AttendantServicesPage;
