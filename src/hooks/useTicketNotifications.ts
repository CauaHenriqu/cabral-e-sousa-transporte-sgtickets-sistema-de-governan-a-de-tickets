import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export function useTicketNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    subscribedRef.current = true;

    const channel = supabase
      .channel('ticket-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets' },
        async (payload) => {
          const ticket = payload.new as any;
          // Notify attendant when a new ticket is assigned to them
          if (ticket.attendant_id === user.id && ticket.user_id !== user.id) {
            const { data: creator } = await supabase.from('profiles').select('name').eq('user_id', ticket.user_id).single();
            toast({
              title: '🎫 Novo Ticket!',
              description: `${creator?.name || 'Usuário'} abriu um novo ticket para você.`,
            });
            queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
          }
          // Notify the user when ticket was created on their behalf
          if (ticket.user_id === user.id && ticket.created_by !== user.id) {
            const { data: creator } = await supabase.from('profiles').select('name').eq('user_id', ticket.created_by).single();
            toast({
              title: '🎫 Novo Ticket!',
              description: `${creator?.name || 'Atendente'} abriu o ticket #${ticket.code} em seu nome.`,
            });
            queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
          }
          // Notify admins
          if (user.role === 'admin' && ticket.user_id !== user.id && ticket.created_by !== user.id) {
            const { data: creator } = await supabase.from('profiles').select('name').eq('user_id', ticket.user_id).single();
            toast({
              title: '🎫 Novo Ticket!',
              description: `${creator?.name || 'Usuário'} abriu um novo ticket.`,
            });
            queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages' },
        async (payload) => {
          const msg = payload.new as any;
          // Don't notify yourself
          if (msg.sender_id === user.id) return;

          // Get ticket info
          const { data: ticket } = await supabase.from('tickets').select('user_id, attendant_id, code').eq('id', msg.ticket_id).single();
          if (!ticket) return;

          const ticketCode = (ticket as any).code || msg.ticket_id.slice(-4);
          const isPrivate = !!msg.is_private;
          const preview = `${msg.sender_name}: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`;

          if (isPrivate) {
            // Mensagens restritas: somente atendente do ticket ou admin
            const isAttendant = ticket.attendant_id === user.id;
            const isAdmin = user.role === 'admin' && ticket.attendant_id !== user.id;
            if (!isAttendant && !isAdmin) return;

            toast({
              title: `🔒 Mensagem restrita no Ticket #${ticketCode}`,
              description: preview,
            });
            queryClient.invalidateQueries({ queryKey: ['ticket-detail-messages', msg.ticket_id] });
            queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
            return;
          }

          // Attendant sent message → notify ticket creator
          if (msg.sender_role === 'attendant' && ticket.user_id === user.id) {
            toast({
              title: `💬 Nova mensagem no Ticket #${ticketCode}`,
              description: preview,
            });
            queryClient.invalidateQueries({ queryKey: ['ticket-detail-messages', msg.ticket_id] });
            queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
          }

          // User sent message → notify attendant
          if (msg.sender_role === 'user' && ticket.attendant_id === user.id) {
            toast({
              title: `💬 Nova mensagem no Ticket #${ticketCode}`,
              description: preview,
            });
            queryClient.invalidateQueries({ queryKey: ['ticket-detail-messages', msg.ticket_id] });
            queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
          }

          // Admin sees all messages
          if (user.role === 'admin' && ticket.user_id !== user.id && ticket.attendant_id !== user.id) {
            toast({
              title: `💬 Nova mensagem no Ticket #${ticketCode}`,
              description: preview,
            });
            queryClient.invalidateQueries({ queryKey: ['ticket-detail-messages', msg.ticket_id] });
          }
        }
      )
      .subscribe();

    return () => {
      subscribedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
