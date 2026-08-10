import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

const LogsPage: React.FC = () => {
  // search é gerenciado pelo ListToolbar
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<any | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['system-logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name, sector, function, email');
      if (error) throw error;
      return data;
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; sector: string; function: string }>();
    for (const p of profiles) {
      map.set(p.user_id, { name: p.name, sector: p.sector || '', function: p.function || '' });
      if (p.email) map.set(p.email.toLowerCase(), { name: p.name, sector: p.sector || '', function: p.function || '' });
    }
    return map;
  }, [profiles]);

  const getProfileInfo = (log: any) => {
    if (log.user_id) {
      const info = profileMap.get(log.user_id);
      if (info) return info;
    }
    if (log.user_email) {
      const info = profileMap.get(log.user_email.toLowerCase());
      if (info) return info;
    }
    return null;
  };

  const logsColumns: ExportColumn<any>[] = useMemo(() => [
    { key: 'created_at', label: 'Data/Hora', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
    { key: 'action', label: 'Ação' },
    { key: 'user_email', label: 'E-mail' },
    { key: 'user_name', label: 'Nome', accessor: r => getProfileInfo(r)?.name || '' },
    { key: 'sector', label: 'Setor', accessor: r => getProfileInfo(r)?.sector || '' },
    { key: 'function', label: 'Função', accessor: r => getProfileInfo(r)?.function || '' },
    { key: 'table_name', label: 'Tabela' },
    { key: 'details', label: 'Detalhes' },
  ], [profileMap]);
  const { rows: filteredLogs, toolbarProps } = useListToolbar(logs as any[], logsColumns);

  const allFilteredSelected = filteredLogs.length > 0 && filteredLogs.every((l: any) => selectedIds.has(l.id));
  const someFilteredSelected = filteredLogs.some((l: any) => selectedIds.has(l.id));

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) filteredLogs.forEach((l: any) => next.add(l.id));
      else filteredLogs.forEach((l: any) => next.delete(l.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('system_logs').delete().in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      void logAction('DELETE', 'system_logs', undefined, `${count} log${count === 1 ? '' : 's'} do sistema excluído${count === 1 ? '' : 's'} em massa pelo administrador.`);
      queryClient.invalidateQueries({ queryKey: ['system-logs'] });
      clearSelection();
      setConfirmOpen(false);
      toast({ title: `🗑️ ${count} log${count === 1 ? '' : 's'} excluído${count === 1 ? '' : 's'}!` });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'bg-success/10 text-success';
      case 'LOGOUT': return 'bg-muted text-muted-foreground';
      case 'CREATE': return 'bg-primary/10 text-primary';
      case 'UPDATE': return 'bg-warning/10 text-warning';
      case 'DELETE': return 'bg-destructive/10 text-destructive';
      case 'CLOSE': return 'bg-success/15 text-success';
      case 'TRANSFER': return 'bg-primary/15 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground whitespace-nowrap">{filteredLogs.length} registros</p>
        {isAdmin && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-semibold text-foreground">{selectedIds.size} selecionado{selectedIds.size === 1 ? '' : 's'}</span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>Limpar</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={14} className="mr-1" />
              Excluir selecionados
            </Button>
          </div>
        )}
      </div>
      <ListToolbar title="Logs do Sistema" {...toolbarProps} />

      {isAdmin && filteredLogs.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-lg">
          <Checkbox
            id="select-all-logs"
            checked={allFilteredSelected ? true : (someFilteredSelected ? 'indeterminate' : false)}
            onCheckedChange={(c) => toggleAllFiltered(c === true)}
          />
          <label htmlFor="select-all-logs" className="text-sm font-medium text-foreground cursor-pointer select-none">
            Selecionar todos os {filteredLogs.length} logs {toolbarProps.search.trim() ? 'filtrados' : 'visíveis'}
          </label>
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : (
        <div className="grid gap-2">
          {filteredLogs.map((log: any) => {
            const profile = getProfileInfo(log);
            const checked = selectedIds.has(log.id);
            return (
              <div
                key={log.id}
                className={`bg-card border rounded-xl px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer hover:border-primary/60 ${checked ? 'border-primary bg-primary/5' : 'border-border'}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-stop-row-click]')) return;
                  setDetailLog(log);
                }}
              >
                {isAdmin && (
                  <div data-stop-row-click onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => toggleOne(log.id, c === true)}
                      aria-label="Selecionar log"
                    />
                  </div>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${getActionColor(log.action)}`}>{log.action}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{log.details}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>{log.user_email}</span>
                    {profile && (
                      <>
                        <span>•</span>
                        <span className="font-medium text-foreground/70">{profile.name}</span>
                        {profile.sector && <><span>•</span><span>{profile.sector}</span></>}
                        {profile.function && <><span>•</span><span>{profile.function}</span></>}
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
              </div>
            );
          })}
          {filteredLogs.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum log encontrado</p>}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão de logs</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> log{selectedIds.size === 1 ? '' : 's'} do sistema? Esta ação não pode ser desfeita e os registros serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate(Array.from(selectedIds));
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getActionColor(detailLog?.action || '')}`}>
                {detailLog?.action}
              </span>
              Detalhes do log
            </DialogTitle>
            <DialogDescription>
              Registrado em {detailLog ? new Date(detailLog.created_at).toLocaleString('pt-BR') : ''}
            </DialogDescription>
          </DialogHeader>

          {detailLog && (() => {
            const profile = getProfileInfo(detailLog);
            const parts: { label: string; value: string }[] = [];
            const raw: string = detailLog.details || '';
            // Cabeçalho (antes do primeiro •) e pares "Label: valor"
            const segments = raw.split('•').map(s => s.trim()).filter(Boolean);
            let header = '';
            segments.forEach((seg, idx) => {
              const colon = seg.indexOf(':');
              if (colon > 0 && colon < 40) {
                const label = seg.slice(0, colon).trim();
                const value = seg.slice(colon + 1).trim().replace(/\.$/, '');
                parts.push({ label, value });
              } else if (idx === 0) {
                header = seg.replace(/\.$/, '');
              } else {
                parts.push({ label: 'Informação', value: seg.replace(/\.$/, '') });
              }
            });

            return (
              <div className="space-y-4">
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Responsável</h4>
                  <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Nome: </span><span className="font-medium">{profile?.name || '—'}</span></div>
                    <div><span className="text-muted-foreground">E-mail: </span><span className="font-medium break-all">{detailLog.user_email || '—'}</span></div>
                    <div><span className="text-muted-foreground">Setor: </span><span className="font-medium">{profile?.sector || '—'}</span></div>
                    <div><span className="text-muted-foreground">Função: </span><span className="font-medium">{profile?.function || '—'}</span></div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Ação</h4>
                  <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Tipo: </span><span className="font-medium">{detailLog.action}</span></div>
                    <div><span className="text-muted-foreground">Tabela: </span><span className="font-medium">{detailLog.table_name || '—'}</span></div>
                    <div className="sm:col-span-2"><span className="text-muted-foreground">ID do registro: </span><span className="font-mono text-xs break-all">{detailLog.record_id || '—'}</span></div>
                    <div className="sm:col-span-2"><span className="text-muted-foreground">Data/Hora: </span><span className="font-medium">{new Date(detailLog.created_at).toLocaleString('pt-BR')}</span></div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Detalhes</h4>
                  <div className="bg-muted/40 rounded-lg p-3 space-y-2 text-sm">
                    {header && <p className="font-semibold text-foreground">{header}</p>}
                    {parts.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                        {parts.map((p, i) => (
                          <div key={i}>
                            <span className="text-muted-foreground">{p.label}: </span>
                            <span className="font-medium break-words">{p.value || '—'}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      !header && <p className="text-muted-foreground italic">Sem detalhes adicionais.</p>
                    )}
                  </div>
                </section>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogsPage;
