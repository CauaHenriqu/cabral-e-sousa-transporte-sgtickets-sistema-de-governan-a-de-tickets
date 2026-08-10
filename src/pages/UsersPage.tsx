import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

const USERS_COLUMNS: ExportColumn<any>[] = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'E-mail' },
  { key: 'sector', label: 'Setor' },
  { key: 'function', label: 'Função' },
  { key: 'phone', label: 'Telefone' },
  { key: 'leader_name', label: 'Líder' },
  { key: 'leader_email', label: 'E-mail do Líder' },
  { key: 'status', label: 'Status' },
  { key: 'first_login', label: 'Primeiro Login', accessor: r => r.first_login ? 'Sim' : 'Não' },
  { key: 'created_at', label: 'Criado em', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
];

const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; userId: string; name: string; reason?: string }>({ open: false, userId: '', name: '' });
  const [form, setForm] = useState({ name: '', sector: '', function: '', email: '', phone: '', leaderName: '', leaderEmail: '', status: 'Ativo', firstLogin: true, password: '', canCloseTickets: true, canReopenTickets: false });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'user');
      if (!roles || roles.length === 0) return [];
      const ids = roles.map(r => r.user_id);
      const { data, error } = await supabase.from('profiles').select('*').in('user_id', ids).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openNew = () => { setForm({ name: '', sector: '', function: '', email: '', phone: '', leaderName: '', leaderEmail: '', status: 'Ativo', firstLogin: true, password: '', canCloseTickets: true, canReopenTickets: false }); setEditingId(null); setDialog(true); };
  const openEdit = (u: any) => {
    setForm({ name: u.name, sector: u.sector || '', function: u.function || '', email: u.email, phone: u.phone || '', leaderName: u.leader_name || '', leaderEmail: u.leader_email || '', status: u.status, firstLogin: u.first_login, password: '', canCloseTickets: u.can_close_tickets ?? true, canReopenTickets: u.can_reopen_tickets ?? false });
    setEditingId(u.user_id);
    setDialog(true);
  };

  const handleDeleteClick = (u: any) => {
    setDeleteConfirm({ open: true, userId: u.user_id, name: u.name });
  };

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return userId;
    },
    onSuccess: (userId) => {
      const d = users.find((u: any) => u.user_id === userId);
      const info = d ? `${d.name} (${d.email}${d.sector ? ' • ' + d.sector : ''}${d.function ? ' • ' + d.function : ''})` : userId;
      logAction('DELETE', 'profiles', userId, `Usuário excluído do sistema: ${info}. O acesso foi removido e a conta encerrada.`);
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      toast({ title: '🗑️ Usuário excluído!' });
    },
    onError: (err: any, userId) => {
      setDeleteConfirm({ open: true, userId, name: deleteConfirm.name, reason: err?.message || 'Erro ao excluir.' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from('profiles').update({
          name: form.name, sector: form.sector, function: form.function, email: form.email,
          phone: form.phone, leader_name: form.leaderName, leader_email: form.leaderEmail, status: form.status, first_login: form.firstLogin,
          can_close_tickets: form.canCloseTickets, can_reopen_tickets: form.canReopenTickets,
        }).eq('user_id', editingId);
        if (error) throw error;
        return { action: 'UPDATE' as const, id: editingId };
      } else {
        if (!form.email || !form.password || !form.name) throw new Error('Nome, e-mail e senha são obrigatórios');
        const emailTrim = form.email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrim)) throw new Error('E-mail inválido. Informe um endereço no formato nome@dominio.com.');
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { email: emailTrim, password: form.password, name: form.name, role: 'user', sector: form.sector, function: form.function, phone: form.phone, leaderName: form.leaderName, leaderEmail: form.leaderEmail },
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
            can_close_tickets: form.canCloseTickets, can_reopen_tickets: form.canReopenTickets,
          }).eq('user_id', newId);
        }
        return { action: 'CREATE' as const, id: newId };
      }
    },
    onSuccess: (result) => {
      const verbo = result.action === 'CREATE' ? 'cadastrou' : 'atualizou os dados';
      const detalhes = `${form.name} • E-mail: ${form.email}${form.sector ? ' • Setor: ' + form.sector : ''}${form.function ? ' • Função: ' + form.function : ''}${form.phone ? ' • Telefone: ' + form.phone : ''}${form.leaderName ? ' • Líder: ' + form.leaderName : ''}`;
      logAction(result.action, 'profiles', result.id, `${verbo === 'cadastrou' ? 'Novo usuário cadastrado' : 'Dados do usuário atualizados'}: ${detalhes}.`);
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      setDialog(false);
      toast({ title: editingId ? '✅ Atualizado!' : '✅ Usuário criado!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const fields = [
    { key: 'name', label: 'Nome' }, { key: 'sector', label: 'Setor' }, { key: 'function', label: 'Função' },
    { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Telefone' }, { key: 'leaderName', label: 'Nome do Líder' }, { key: 'leaderEmail', label: 'E-mail do Líder' },
  ];

  const { rows: filteredUsers, toolbarProps } = useListToolbar(users as any[], USERS_COLUMNS);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{filteredUsers.length} de {users.length} registros</p>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground font-semibold"><Plus size={16} className="mr-1" /> Novo Usuário</Button>
      </div>
      <ListToolbar title="Usuários" {...toolbarProps} />
      {isLoading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : (
        <div className="grid gap-3">
          {filteredUsers.map((u: any) => (
            <div key={u.id} className="bg-card border border-border rounded-xl p-4 card-hover flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email} • {u.sector} • {u.function}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={u.status === 'Ativo' ? 'status-active' : 'status-inactive'}>{u.status}</span>
                <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Edit2 size={16} /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(u)}><Trash2 size={16} className="text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Usuário</DialogTitle></DialogHeader>
          <Tabs defaultValue="dados">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="permissoes">Permissões</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-3 mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>
            </TabsContent>

            <TabsContent value="permissoes" className="space-y-3 mt-4">
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-bold text-foreground">Permissões de Ticket</p>
                <div><label className="text-xs font-semibold text-foreground">Pode Fechar Ticket</label>
                <Select value={form.canCloseTickets ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, canCloseTickets: v === 'SIM' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent></Select>
                <p className="text-[11px] text-muted-foreground mt-1">Permite fechar apenas os tickets abertos por ele.</p></div>
                <div><label className="text-xs font-semibold text-foreground">Pode Reabrir Ticket</label>
                <Select value={form.canReopenTickets ? 'SIM' : 'NÃO'} onValueChange={v => setForm(prev => ({ ...prev, canReopenTickets: v === 'SIM' }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SIM">SIM</SelectItem><SelectItem value="NÃO">NÃO</SelectItem></SelectContent></Select>
                <p className="text-[11px] text-muted-foreground mt-1">Permite reabrir apenas os tickets fechados abertos por ele.</p></div>
              </div>
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
              {deleteConfirm.reason || `Tem certeza que deseja excluir o usuário "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`}
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

export default UsersPage;
