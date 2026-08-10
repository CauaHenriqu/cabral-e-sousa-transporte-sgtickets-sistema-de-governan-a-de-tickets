import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const Unsubscribe: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error'>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await response.json();
        if (response.ok && data.valid === true) setStatus('valid');
        else if (data.reason === 'already_unsubscribed') setStatus('already');
        else setStatus('invalid');
      } catch {
        setStatus('error');
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setStatus('success');
      else if (data?.reason === 'already_unsubscribed') setStatus('already');
      else setStatus('error');
    } catch {
      setStatus('error');
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl shadow-card p-8 max-w-md w-full text-center"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center">
          <span className="text-primary-foreground text-2xl font-bold">SG</span>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Transporte - SGTickets</h1>

        {status === 'loading' && <p className="text-muted-foreground">Verificando...</p>}

        {status === 'valid' && (
          <>
            <p className="text-muted-foreground mb-4">Deseja cancelar o recebimento de notificações por e-mail?</p>
            <Button onClick={handleUnsubscribe} disabled={processing} className="gradient-primary text-primary-foreground w-full">
              {processing ? 'Processando...' : 'Confirmar cancelamento'}
            </Button>
          </>
        )}

        {status === 'already' && (
          <p className="text-muted-foreground">Você já cancelou o recebimento de e-mails anteriormente.</p>
        )}

        {status === 'success' && (
          <p className="text-success font-semibold">✅ Inscrição cancelada com sucesso!</p>
        )}

        {status === 'invalid' && (
          <p className="text-destructive">Link inválido ou expirado.</p>
        )}

        {status === 'error' && (
          <p className="text-destructive">Erro ao processar. Tente novamente mais tarde.</p>
        )}
      </motion.div>
    </div>
  );
};

export default Unsubscribe;
