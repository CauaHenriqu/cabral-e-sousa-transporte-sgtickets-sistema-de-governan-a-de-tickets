import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

const TV_COLUMNS: ExportColumn<any>[] = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'E-mail' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Criado em', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
];

const TvUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; userId: string; name: string; reason?: string }>({ open: false, userId: '', name: '' });
  const [form, setForm] = useState({ name: '', email: '', status: 'Ativo', firstLogin: false, password: '' });

  const { data: tvUsers = [], isLoading } = useQuery({
    queryKey: ['tv-profiles'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'tv');
      if (!roles || roles.length === 0) return [];
      const ids = roles.map(r => r.user_id);
      const { data, error } = await supabase.from('profiles').select('*').in('user_id', ids).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openNew = () => {
    setForm({ name: '', email: '', status: 'Ativo', firstLogin: false, password: '' });
    setEditingId(null);
    setDialog(true);
  };
  const openEdit = (a: any) => {
    setForm({ name: a.name, email: a.email, status: a.status, firstLogin: a.first_login, password: '' });
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
      const d = tvUsers.find((a: any) => a.user_id === userId);
      const info = d ? `${d.name} (${d.email})` : userId;
      logAction('DELETE', 'profiles', userId, `Usuário TV excluído do sistema: ${info}.`);
      queryClient.invalidateQueries({ queryKey: ['tv-profiles'] });
      toast({ title: '🗑️ Usuário TV excluído!' });
    },
    onError: (err: any, userId) => {
      setDeleteConfirm({ open: true, userId, name: deleteConfirm.name, reason: err?.message || 'Erro ao excluir.' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from('profiles').update({
          name: form.name, email: form.email,
          status: form.status, first_login: form.firstLogin,
        }).eq('user_id', editingId);
        if (error) throw error;
        return { action: 'UPDATE' as const, id: editingId };
      } else {
        if (!form.email || !form.password || !form.name) throw new Error('Nome, e-mail e senha são obrigatórios');
        const emailTrim = form.email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrim)) throw new Error('E-mail inválido.');
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { email: emailTrim, password: form.password, name: form.name, role: 'tv' },
        });
        if (error) {
          let msg = error.message;
          try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx.json === 'function') {
              const body = await ctx.json();
              if (body?.error) msg = body.error;
            } else if (ctx && typeof ctx.text === 'function') {
              const txt = await ctx.text();
              try { const parsed = JSON.parse(txt); if (parsed?.error) msg = parsed.error; } catch { if (txt) msg = txt; }
            }
          } catch { /* ignora */ }
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        return { action: 'CREATE' as const, id: data?.user_id || '' };
      }
    },
    onSuccess: (result) => {
      const detalhes = `${form.name} • E-mail: ${form.email} • Status: ${form.status}`;
      logAction(result.action, 'profiles', result.id, `${result.action === 'CREATE' ? 'Novo usuário TV cadastrado' : 'Dados do usuário TV atualizados'}: ${detalhes}.`);
      queryClient.invalidateQueries({ queryKey: ['tv-profiles'] });
      setDialog(false);
      toast({ title: editingId ? '✅ Atualizado!' : '✅ Usuário TV criado!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const { rows: filtered, toolbarProps } = useListToolbar(tvUsers as any[], TV_COLUMNS);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{filtered.length} de {tvUsers.length} registros</p>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground font-semibold"><Plus size={16} className="mr-1" /> Novo Usuário TV</Button>
      </div>
      <ListToolbar title="Usuários TV" {...toolbarProps} />
      {isLoading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : (
        <div className="grid gap-3">
          {filtered.map((a: any) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 card-hover flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.email}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('pt-BR')}</p>
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
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Usuário TV</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-foreground">Nome</label>
              <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="mt-1" /></div>
            <div><label className="text-xs font-semibold text-foreground">E-mail</label>
              <Input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} className="mt-1" disabled={editingId !== null} /></div>
            {!editingId && (
              <div><label className="text-xs font-semibold text-foreground">Senha</label>
                <Input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} className="mt-1" placeholder="Mínimo 6 caracteres" /></div>
            )}
            <div><label className="text-xs font-semibold text-foreground">Status</label>
              <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent></Select></div>
            <div><label className="text-xs font-semibold text-foreground">Primeiro Login</label>
              <Select value={form.firstLogin ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, firstLogin: v === 'SIM' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent></Select></div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gradient-primary text-primary-foreground font-semibold">{saveMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirm.reason ? 'Exclusão não permitida' : 'Confirmar exclusão'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.reason || `Tem certeza que deseja excluir o usuário TV "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            {!deleteConfirm.reason && (
              <AlertDialogAction onClick={() => deleteMutation.mutate(deleteConfirm.userId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TvUsersPage;
