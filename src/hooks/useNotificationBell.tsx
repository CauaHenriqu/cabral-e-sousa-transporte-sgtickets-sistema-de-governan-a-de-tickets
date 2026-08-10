import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { ExternalLink } from 'lucide-react';

export interface NotificationItem {
  id: string;
  type: 'new_ticket' | 'new_message';
  ticketId: string;
  ticketCode: string | number;
  message: string;
  timestamp: string;
  read: boolean;
}

const INITIAL_LOOKBACK_MS = 60 * 1000;
const POLL_INTERVAL_MS = 30 * 1000;

export function useNotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [ticketsWithNewMessages, setTicketsWithNewMessages] = useState<Set<string>>(new Set());
  const lastCheckRef = useRef<string>(new Date(Date.now() - INITIAL_LOOKBACK_MS).toISOString());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const requestInFlightRef = useRef(false);

  const markTicketRead = useCallback((ticketId: string) => {
    setTicketsWithNewMessages(prev => {
      const next = new Set(prev);
      next.delete(ticketId);
      return next;
    });
    setNotifications(prev => prev.map(n => n.ticketId === ticketId ? { ...n, read: true } : n));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setTicketsWithNewMessages(new Set());
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  useEffect(() => {
    if (!user) return;

    seenNotificationIdsRef.current.clear();
    lastCheckRef.current = new Date(Date.now() - INITIAL_LOOKBACK_MS).toISOString();

    const addNotification = (notification: NotificationItem, toastTitle: string) => {
      if (seenNotificationIdsRef.current.has(notification.id)) return;
      seenNotificationIdsRef.current.add(notification.id);

      setNotifications(prev => {
        if (prev.some(existing => existing.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, 50);
      });

      toastRef.current({
        title: toastTitle,
        description: notification.message,
        action: (
          <ToastAction
            altText="Abrir ticket"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('sgtickets:open-ticket', { detail: notification.ticketId })
              );
            }}
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            Abrir
          </ToastAction>
        ),
      });
    };

    const checkNewActivity = async () => {
      if (requestInFlightRef.current || document.visibilityState !== 'visible' || !navigator.onLine) return;

      requestInFlightRef.current = true;
      const since = lastCheckRef.current;
      const requestStartedAt = new Date().toISOString();

      try {
        const [{ data: newTickets, error: ticketsError }, { data: newMessages, error: messagesError }] = await Promise.all([
          supabase
            .from('tickets')
            .select('id, code, user_id, attendant_id, created_by, created_at')
            .gt('created_at', since)
            .order('created_at', { ascending: true }),
          supabase
            .from('ticket_messages')
            .select('id, ticket_id, sender_id, sender_name, sender_role, content, created_at, is_private')
            .gt('created_at', since)
            .order('created_at', { ascending: true }),
        ]);

        if (ticketsError) throw ticketsError;
        if (messagesError) throw messagesError;

        if (newTickets?.length) {
          const profileIds = Array.from(new Set(newTickets.flatMap(ticket => [ticket.created_by, ticket.user_id]).filter(Boolean)));
          let profileMap = new Map<string, string>();

          if (profileIds.length > 0) {
            const { data: relatedProfiles, error: profilesError } = await supabase
              .from('profiles')
              .select('user_id, name')
              .in('user_id', profileIds);

            if (profilesError) throw profilesError;
            profileMap = new Map((relatedProfiles || []).map(profile => [profile.user_id, profile.name]));
          }

          for (const ticket of newTickets) {
            if (ticket.user_id === user.id && ticket.created_by !== user.id) {
              addNotification(
                {
                  id: `ticket-${ticket.id}-${ticket.created_at}`,
                  type: 'new_ticket',
                  ticketId: ticket.id,
                  ticketCode: ticket.code,
                  message: `${profileMap.get(ticket.created_by) || 'Atendente'} abriu o ticket #${ticket.code} em seu nome`,
                  timestamp: ticket.created_at,
                  read: false,
                },
                '🎫 Novo Ticket!'
              );
              continue;
            }

            const shouldNotify = ticket.attendant_id === user.id || user.role === 'admin';
            if (!shouldNotify || ticket.user_id === user.id) continue;

            addNotification(
              {
                id: `ticket-${ticket.id}-${ticket.created_at}`,
                type: 'new_ticket',
                ticketId: ticket.id,
                ticketCode: ticket.code,
                message: `${profileMap.get(ticket.user_id) || 'Usuário'} abriu o ticket #${ticket.code}`,
                timestamp: ticket.created_at,
                read: false,
              },
              '🎫 Novo Ticket!'
            );
          }
        }

        if (newMessages?.length) {
          const ticketIds = Array.from(new Set(newMessages.map(msg => msg.ticket_id)));
          let ticketMap = new Map<string, { id: string; user_id: string; attendant_id: string; code: number }>();

          if (ticketIds.length > 0) {
            const { data: relatedTickets, error: relatedTicketsError } = await supabase
              .from('tickets')
              .select('id, user_id, attendant_id, code')
              .in('id', ticketIds);

            if (relatedTicketsError) throw relatedTicketsError;
            ticketMap = new Map((relatedTickets || []).map(ticket => [ticket.id, ticket]));
          }

          for (const msg of newMessages) {
            if (msg.sender_id === user.id) continue;

            const ticket = ticketMap.get(msg.ticket_id);
            if (!ticket) continue;

            const isPrivate = !!msg.is_private;

            // Mensagens privadas: só admin OU atendente do ticket (nunca o usuário dono)
            // Mensagens normais: regra padrão por papel
            let shouldNotifyCreator = false;
            let shouldNotifyAttendant = false;
            let shouldNotifyAdmin = false;

            if (isPrivate) {
              shouldNotifyAttendant = ticket.attendant_id === user.id;
              shouldNotifyAdmin = user.role === 'admin' && ticket.attendant_id !== user.id;
            } else {
              shouldNotifyCreator = msg.sender_role === 'attendant' && ticket.user_id === user.id;
              shouldNotifyAttendant = msg.sender_role === 'user' && ticket.attendant_id === user.id;
              shouldNotifyAdmin = user.role === 'admin' && ticket.user_id !== user.id && ticket.attendant_id !== user.id;
            }

            if (!shouldNotifyCreator && !shouldNotifyAttendant && !shouldNotifyAdmin) continue;

            setTicketsWithNewMessages(prev => new Set(prev).add(msg.ticket_id));

            const prefix = isPrivate ? '🔒 ' : '';
            addNotification(
              {
                id: `message-${msg.id}`,
                type: 'new_message',
                ticketId: msg.ticket_id,
                ticketCode: ticket.code || msg.ticket_id.slice(-4),
                message: `${prefix}${msg.sender_name}: ${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}`,
                timestamp: msg.created_at,
                read: false,
              },
              `${isPrivate ? '🔒 Mensagem restrita' : '💬 Nova mensagem'} no Ticket #${ticket.code || msg.ticket_id.slice(-4)}`
            );
          }
        }

        lastCheckRef.current = requestStartedAt;
      } catch (error) {
        console.error('Notification polling error:', error);
      } finally {
        requestInFlightRef.current = false;
      }
    };

    void checkNewActivity();
    intervalRef.current = setInterval(() => {
      void checkNewActivity();
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkNewActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      requestInFlightRef.current = false;
    };
  }, [user?.id, user?.role]);

  return { notifications, unreadCount, ticketsWithNewMessages, markTicketRead, clearAll };
}
