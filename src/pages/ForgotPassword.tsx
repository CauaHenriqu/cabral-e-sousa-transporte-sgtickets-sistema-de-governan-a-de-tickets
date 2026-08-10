import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Mail, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { translateAuthError } from '@/lib/authErrors';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        title: 'Erro',
        description: translateAuthError(error.message),
        variant: 'destructive',
      });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-2xl shadow-strong p-8 border border-border">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-medium">
              <MessageSquare size={32} className="text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Recuperar Senha</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sent ? 'Verifique seu e-mail' : 'Informe seu e-mail para redefinir a senha'}
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-xl text-center">
                <p className="text-sm text-muted-foreground">
                  Enviamos um link de redefinição de senha para <strong>{email}</strong>. Verifique sua caixa de entrada e spam.
                </p>
              </div>
              <a href="/">
                <Button variant="outline" className="w-full mt-2">
                  <ArrowLeft size={16} className="mr-2" />
                  Voltar ao login
                </Button>
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">E-mail</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-semibold h-11" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </Button>

              <div className="text-center">
                <a href="/" className="text-sm text-primary hover:underline">
                  <ArrowLeft size={14} className="inline mr-1" />
                  Voltar ao login
                </a>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
