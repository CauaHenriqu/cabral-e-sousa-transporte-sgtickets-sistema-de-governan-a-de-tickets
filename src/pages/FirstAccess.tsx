import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAction } from '@/lib/logAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { KeyRound, ShieldCheck, LogOut } from 'lucide-react';
import { translateAuthError } from '@/lib/authErrors';


const FirstAccess = () => {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!password) {
      toast({ title: 'Senha inválida', description: 'Informe a nova senha.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Senha inválida', description: 'As senhas não conferem.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) {
        toast({ title: 'Erro ao trocar senha', description: translateAuthError(pwError.message), variant: 'destructive' });
        return;
      }

      if (user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ first_login: false })
          .eq('user_id', user.id);

        if (profileError) {
          toast({
            title: 'Senha trocada, mas houve um problema',
            description: 'Sua senha foi alterada, mas não foi possível atualizar seu cadastro. Faça logout e login novamente.',
            variant: 'destructive',
          });
          return;
        }

        void logAction(
          'UPDATE',
          'profiles',
          user.id,
          `${user.name || user.email} trocou a senha no primeiro acesso e marcou Primeiro Login como NÃO.`
        );
      }

      toast({
        title: 'Senha atualizada com sucesso! 🎉',
        description: 'Sua nova senha já está ativa. Bem-vindo(a) ao sistema.',
      });

      await refreshProfile();
      navigate(user?.role === 'user' ? '/tickets' : '/dashboard', { replace: true });
    } catch (err: any) {
      toast({
        title: 'Erro inesperado',
        description: translateAuthError(err?.message),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Primeiro acesso</CardTitle>
          <CardDescription>
            Por segurança, você precisa cadastrar uma nova senha antes de continuar usando o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <strong>Usuário:</strong> {user?.name || '—'}<br />
              <strong>E-mail:</strong> {user?.email || '—'}
            </div>

            <div>
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua nova senha"
                disabled={submitting}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a nova senha"
                disabled={submitting}
                required
                className="mt-1"
              />
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md p-3">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Use uma senha forte que você não utiliza em outros sistemas. A senha temporária recebida por e-mail
                deixará de funcionar após esta troca.
              </span>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar nova senha e continuar'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => void logout()}
              disabled={submitting}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirstAccess;
