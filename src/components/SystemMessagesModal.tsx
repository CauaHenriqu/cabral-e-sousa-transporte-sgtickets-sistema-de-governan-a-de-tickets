import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SystemMessage {
  id: string;
  title: string;
  content: string;
  schedule_type: 'on_login' | 'period' | 'recurring';
  starts_at: string | null;
  ends_at: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  active: boolean;
}

/**
 * Determines whether a message should be shown right now based on its schedule.
 * - on_login: shown once per user (filtered by acknowledgments).
 * - period:   shown if now is within [starts_at, ends_at].
 * - recurring: shown if today's weekday matches and current time is within
 *              [start_time, end_time] (server local time of the user).
 */
function isMessageDue(msg: SystemMessage, now: Date): boolean {
  if (!msg.active) return false;
  if (msg.schedule_type === 'on_login') return true;

  if (msg.schedule_type === 'period') {
    const starts = msg.starts_at ? new Date(msg.starts_at) : null;
    const ends = msg.ends_at ? new Date(msg.ends_at) : null;
    if (starts && now < starts) return false;
    if (ends && now > ends) return false;
    return true;
  }

  if (msg.schedule_type === 'recurring') {
    const dow = now.getDay(); // 0=Sun..6=Sat
    if (!msg.days_of_week || !msg.days_of_week.includes(dow)) return false;
    const cur = now.getHours() * 60 + now.getMinutes();
    const toMin = (t: string | null) => {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const s = toMin(msg.start_time);
    const e = toMin(msg.end_time);
    if (s !== null && cur < s) return false;
    if (e !== null && cur > e) return false;
    return true;
  }

  return false;
}

// Captura síncrona no carregamento do módulo: se houver flag de login recente,
// consome-a imediatamente para que um refresh subsequente não reexiba a mensagem.
const JUST_LOGGED_IN: boolean = (() => {
  try {
    const v = sessionStorage.getItem('justLoggedInAt');
    if (!v) return false;
    sessionStorage.removeItem('justLoggedInAt');
    const ts = Number(v);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < 60_000;
  } catch {
    return false;
  }
})();

export const SystemMessagesModal: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  // Só verdadeiro nesta sessão de página até refresh/fechar a aba.
  const [justLoggedIn] = useState<boolean>(JUST_LOGGED_IN);

  const { data } = useQuery({
    queryKey: ['system-messages-for-user', user?.id],
    enabled: !!isAuthenticated && !!user?.id && justLoggedIn,
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from('system_messages')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const { data: acks } = await supabase
        .from('system_message_acknowledgments')
        .select('message_id')
        .eq('user_id', user!.id);
      const ackedIds = new Set((acks || []).map((a: any) => a.message_id));

      return { messages: (msgs || []) as SystemMessage[], ackedIds };
    },
  });

  const ackMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('system_message_acknowledgments')
        .insert({ message_id: messageId, user_id: user!.id });
      if (error && !String(error.message).toLowerCase().includes('duplicate')) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-messages-for-user', user?.id] });
    },
  });

  const visible = useMemo(() => {
    const now = new Date();
    if (!justLoggedIn) return [] as SystemMessage[];
    if (!data) return [] as SystemMessage[];
    return data.messages.filter((m) => {
      if (dismissedIds.has(m.id)) return false;
      // 'on_login' aparece uma única vez por usuário.
      if (m.schedule_type === 'on_login' && data.ackedIds.has(m.id)) return false;
      // 'period' e 'recurring' aparecem ao logar se estiverem dentro da janela.
      return isMessageDue(m, now);
    });
  }, [data, dismissedIds, justLoggedIn]);

  const current = visible[0];
  if (!current) return null;

  const handleClose = () => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(current.id);
      return next;
    });
    if (current.schedule_type === 'on_login') {
      ackMutation.mutate(current.id);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-foreground">
            {current.content}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleClose}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
