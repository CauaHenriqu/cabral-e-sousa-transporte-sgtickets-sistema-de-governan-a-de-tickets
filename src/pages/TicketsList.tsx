import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Star, RefreshCw, X as XIcon, ArrowRightLeft, MessageSquare, Send, Calendar, CalendarCheck, CalendarClock, Trash2, Plus, Paperclip, FileIcon, FileText, Download, Maximize2, Minimize2, Info, Users, Search, LayoutGrid, List, AlertTriangle, AlertCircle, Lock, Loader2 } from 'lucide-react';

import AdminKanbanView from '@/components/tickets/AdminKanbanView';
import TicketWorkspace from '@/components/tickets/TicketWorkspace';
import TicketDetailPanel from '@/components/tickets/TicketDetailPanel';
import TicketDetailModal from '@/components/tickets/TicketDetailModal';
import { useOpenTickets, MAX_OPEN_TICKETS } from '@/hooks/useOpenTickets';

import { SearchableSelect } from '@/components/SearchableSelect';
import { CurrencyInput } from '@/components/CurrencyInput';
import { RichText } from '@/components/RichText';

import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { logAction } from '@/lib/logAction';
import { preflightFormApi, FormApiError, FormApiErrorDetails } from '@/lib/triggerFormApi';
import { DevolucaoItensDialog } from '@/components/DevolucaoItensDialog';
import { DevolucaoItem, DEVOLUCAO_ITENS_KEY, formatItensBlock, extractItensFromBody } from '@/lib/devolucaoItens';
import { ApiErrorDialog } from '@/components/ApiErrorDialog';
import { sendTicketCreatedEmails, sendTicketClosedEmails, sendTicketTransferredEmails, sendTicketRatedEmails, sendTicketMessageEmails, sendTicketPrivateMessageEmails, sendApprovalRequestedEmails } from '@/lib/ticketEmails';
import { cn } from '@/lib/utils';
import { calcBusinessHours, calcBusinessHoursOpen, getSlaStatus, formatRemainingMinutes } from '@/lib/slaUtils';
import { clearDraftFiles, loadDraftFiles, saveDraftFiles } from '@/lib/attachmentDraftStore';
import { buildFormDataLines } from '@/lib/formFormatter';

import { useNotifications } from '@/contexts/NotificationContext';

const DEFAULT_SLA_HOURS = 12; // fallback quando o serviço não informa

// Fixed work schedule: Mon-Fri 8-12, 14-18; Sat 8-12; Sun off
function getWorkPeriodsForDay(dow: number): { start: number; end: number }[] {
  if (dow === 0) return []; // Sunday
  if (dow === 6) return [{ start: 8 * 60, end: 12 * 60 }]; // Saturday
  return [{ start: 8 * 60, end: 12 * 60 }, { start: 14 * 60, end: 18 * 60 }]; // Mon-Fri
}

function calcExpectedCloseDate(createdAt: string, slaHours?: number | null): Date {
  const current = new Date(createdAt);
  const hours = (typeof slaHours === 'number' && slaHours > 0) ? slaHours : DEFAULT_SLA_HOURS;
  let remainingMin = hours * 60;

  for (let i = 0; i < 365 && remainingMin > 0; i++) {
    const dow = current.getDay();
    const periods = getWorkPeriodsForDay(dow);

    if (periods.length === 0) {
      // No work today, jump to next day 00:00
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const currentMin = current.getHours() * 60 + current.getMinutes();

    for (const period of periods) {
      // If we're past this period, skip it
      if (currentMin >= period.end) continue;

      const effectiveStart = Math.max(currentMin, period.start);
      const availableMin = period.end - effectiveStart;

      if (remainingMin <= availableMin) {
        // Finish within this period
        current.setHours(0, 0, 0, 0);
        current.setMinutes(effectiveStart + remainingMin);
        remainingMin = 0;
        break;
      }

      remainingMin -= availableMin;
    }

    if (remainingMin > 0) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }
  }
  return current;
}

// FilePickerButton renders only the button — the <input type="file"> lives
// OUTSIDE all dialogs (see the two hidden inputs at the top of the JSX tree).
// This avoids the Android bug where the system file picker causes the Radix
// Dialog dismiss layer / focus trap to close the modal.
type FilePickerButtonProps = {
  ariaLabel?: string;
  className?: string;
  icon: React.ReactNode;
  inputId: string;
  onActivate?: () => void;
  size?: React.ComponentProps<typeof Button>['size'];
  text?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
};

const FilePickerButton = React.forwardRef<HTMLLabelElement, FilePickerButtonProps>(({ 
  ariaLabel,
  className = '',
  icon,
  inputId,
  onActivate,
  size = 'sm',
  text,
  variant = 'outline',
}, ref) => {
  const label = ariaLabel || text || 'Selecionar arquivo';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLLabelElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    onActivate?.();

    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.click();
  };

  return (
    <label
      ref={ref}
      htmlFor={inputId}
      aria-label={label}
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      className={cn(buttonVariants({ variant, size }), 'cursor-pointer', size === 'icon' && 'shrink-0', className)}
    >
      {icon}
      {text ? text : <span className="sr-only">{label}</span>}
    </label>
  );
});
FilePickerButton.displayName = 'FilePickerButton';

const DRAFT_TTL_MS = 1000 * 60 * 60 * 12;

type CreateTicketDraft = {
  createStep: 'selectUser' | 'selectService' | 'description' | 'fillForm';
  formData: Record<string, string>;
  savedAt: number;
  selectedServiceId: string;
  selectedUserId: string | null;
  serviceSearch: string;
  ticketDescription: string;
  userSearch: string;
};


const readDraft = <T,>(key: string | null): T | null => {
  if (!key || typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
};

const writeDraft = (key: string | null, value: unknown) => {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
};

const removeDraft = (key: string | null) => {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
};

const isDraftFresh = (savedAt?: number) => typeof savedAt === 'number' && Date.now() - savedAt < DRAFT_TTL_MS;

const TicketsList: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { ticketsWithNewMessages, markTicketRead } = useNotifications();
  const [ratingTicketId, setRatingTicketId] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingReason, setRatingReason] = useState('');
  const [transferTicket, setTransferTicket] = useState<any>(null);
  const [transferTo, setTransferTo] = useState('');
  const { openIds, activeId, openTicket, closeTicket, closeAll, setActiveTicket, clearActiveTicket } = useOpenTickets(
    user?.id,
    () => toast({
      title: 'Limite de painéis abertos',
      description: `Feche um dos painéis para abrir outro ticket (máximo ${MAX_OPEN_TICKETS}).`,
      variant: 'destructive',
    }),
  );
  const [dialogTicketId, setDialogTicketId] = useState<string | null>(null);
  const openTicketPanel = (id: string) => { markTicketRead(id); openTicket(id); };

  // Abre ticket quando o usuário clica na notificação toast de nova mensagem
  useEffect(() => {
    const handleOpenTicket = (e: Event) => {
      const ticketId = (e as CustomEvent<string>).detail;
      if (ticketId) openTicketPanel(ticketId);
    };
    window.addEventListener('sgtickets:open-ticket', handleOpenTicket);
    return () => window.removeEventListener('sgtickets:open-ticket', handleOpenTicket);
  }, [openTicketPanel]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [closeConfirm, setCloseConfirm] = useState<{ open: boolean; id: string; code?: number; requireReason?: boolean; reason?: string }>({ open: false, id: '' });

  const [showFormDataDialog, setShowFormDataDialog] = useState(false);
  const statusFilterStorageKey = user?.id ? `ticketsList:statusFilter:${user.id}` : null;
  const [statusFilter, setStatusFilter] = useState<{ open: boolean; closed: boolean; unrated: boolean; reopened: boolean; awaitingApproval: boolean; rejected: boolean; approved: boolean }>(() => {
    const defaults = { open: true, closed: true, unrated: false, reopened: false, awaitingApproval: false, rejected: false, approved: false };
    try {
      if (typeof window !== 'undefined' && user?.id) {
        const raw = window.localStorage.getItem(`ticketsList:statusFilter:${user.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          return { ...defaults, ...parsed };
        }
      }
    } catch {}
    return defaults;
  });

  // Recarrega filtro salvo quando o usuário logado mudar
  useEffect(() => {
    if (!statusFilterStorageKey) return;
    try {
      const raw = window.localStorage.getItem(statusFilterStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setStatusFilter(prev => ({ ...prev, ...parsed }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persiste alterações do filtro
  useEffect(() => {
    if (!statusFilterStorageKey) return;
    try {
      window.localStorage.setItem(statusFilterStorageKey, JSON.stringify(statusFilter));
    } catch {}
  }, [statusFilter, statusFilterStorageKey]);

  // Garante que pelo menos um filtro fique selecionado
  const toggleStatusFilter = (key: 'open' | 'closed' | 'unrated' | 'reopened' | 'awaitingApproval' | 'rejected' | 'approved') => {
    setStatusFilter(prev => {
      const next = { ...prev, [key]: !prev[key] };
      const anySelected = next.open || next.closed || next.unrated || next.reopened || next.awaitingApproval || next.rejected || next.approved;
      if (!anySelected) {
        toast({ title: 'Pelo menos um filtro deve estar selecionado.' });
        return prev;
      }
      return next;
    });
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(user?.role === 'admin' ? 'kanban' : 'list');
  // Tick para atualizar cronômetro de SLA a cada 60s
  const [slaTick, setSlaTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSlaTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const nowIsoTick = React.useMemo(() => new Date().toISOString(), [slaTick]);
  // New ticket creation state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isDialogMaximized, setIsDialogMaximized] = useState(false);
  const [createStep, setCreateStep] = useState<'selectUser' | 'selectService' | 'description' | 'fillForm'>('selectService');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedServiceForm, setSelectedServiceForm] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDraggingCreate, setIsDraggingCreate] = useState(false);
  const dragCounterCreate = useRef(0);
  // Global file input refs — placed OUTSIDE dialogs to work on Android
  const ticketFileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessingStep, setIsProcessingStep] = useState(false);
  const [ticketDescription, setTicketDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  const canCreateOnBehalf = user?.role === 'admin' || user?.role === 'attendant';
  const storageKeyBase = user?.id ? `sgtickets:${user.id}` : null;
  const createDraftKey = storageKeyBase ? `${storageKeyBase}:create-ticket-draft` : null;
  const createAttachmentDraftKey = storageKeyBase ? `${storageKeyBase}:create-ticket-files` : null;
  const restoredDraftRef = useRef(false);
  const [hasRestoredDrafts, setHasRestoredDrafts] = useState(false);

  // Auto-refresh every 30s when no popup is open
  const isAnyDialogOpen = !!ratingTicketId || !!transferTicket || showCreateDialog || deleteConfirm.open || closeConfirm.open || showFormDataDialog;

  const [countdown, setCountdown] = useState(30);
  const countdownRef = useRef(30);

  useEffect(() => {
    if (isAnyDialogOpen) return;

    countdownRef.current = 30;
    setCountdown(30);

    const tick = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);

      if (countdownRef.current <= 0) {
        queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
        countdownRef.current = 30;
        setCountdown(30);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [isAnyDialogOpen, queryClient]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
    countdownRef.current = 30;
    setCountdown(30);
    toast({ title: '🔄 Atualizado', description: 'Lista de tickets atualizada.' });
  };

  const { data: allUsersForTicket = [] } = useQuery({
    queryKey: ['all-users-for-ticket'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name, email, sector').eq('status', 'Ativo').order('name');
      if (error) throw error;
      return data;
    },
    enabled: canCreateOnBehalf && showCreateDialog,
  });

  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role');
      if (error) throw error;
      return data;
    },
    enabled: showCreateDialog,
  });

  const rolesByUserId = React.useMemo(() => {
    const map: Record<string, string> = {};
    (allUserRoles as any[]).forEach((r) => { map[r.user_id] = r.role; });
    return map;
  }, [allUserRoles]);

  const isPrivilegedRole = (uid: string) => {
    const r = rolesByUserId[uid];
    return r === 'admin' || r === 'attendant';
  };

  const filteredUsersForTicket = allUsersForTicket.filter((u: any) =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const ticketOwnerId = selectedUserId || user!.id;
  const ticketOwnerName = selectedUserId
    ? allUsersForTicket.find((u: any) => u.user_id === selectedUserId)?.name || ''
    : user!.name;

  const persistCreateDraft = () => {
    if (!showCreateDialog) return;
    writeDraft(createDraftKey, {
      createStep,
      formData,
      savedAt: Date.now(),
      selectedServiceId,
      selectedUserId,
      serviceSearch,
      ticketDescription,
      userSearch,
    } satisfies CreateTicketDraft);
  };




  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const validateAndAppendFiles = (
    selectedFiles: File[],
    setter: React.Dispatch<React.SetStateAction<File[]>>,
    draftKey: string | null,
  ) => {
    if (selectedFiles.length === 0) return;
    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'Arquivo muito grande', description: `"${file.name}" excede o limite de 10 MB.`, variant: 'destructive' });
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length > 0) {
      setter((prev) => {
        const next = [...prev, ...validFiles];
        void saveDraftFiles(draftKey, next);
        return next;
      });
    }
  };

  const appendSelectedFiles =
    (setter: React.Dispatch<React.SetStateAction<File[]>>, draftKey: string | null) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files || []);
      validateAndAppendFiles(selectedFiles, setter, draftKey);
      event.target.value = '';
    };


  useEffect(() => {
    restoredDraftRef.current = false;
    setHasRestoredDrafts(false);
    setAttachments([]);
  }, [user?.id]);


  useEffect(() => {
    if (!createDraftKey || !hasRestoredDrafts) return;
    if (!showCreateDialog) {
      removeDraft(createDraftKey);
      return;
    }

    persistCreateDraft();
  }, [createDraftKey, createStep, formData, persistCreateDraft, selectedServiceId, selectedUserId, serviceSearch, showCreateDialog, ticketDescription, userSearch]);


  useEffect(() => {
    if (!createAttachmentDraftKey || !hasRestoredDrafts) return;
    if (!showCreateDialog) {
      void clearDraftFiles(createAttachmentDraftKey);
      return;
    }

    void saveDraftFiles(createAttachmentDraftKey, attachments);
  }, [attachments, createAttachmentDraftKey, hasRestoredDrafts, showCreateDialog]);

  useEffect(() => {
    if (!user?.id || restoredDraftRef.current) return;

    restoredDraftRef.current = true;

    let cancelled = false;

    const restoreDrafts = async () => {
      const savedCreateDraft = readDraft<CreateTicketDraft>(createDraftKey);
      const canRestoreCreate = Boolean(savedCreateDraft && isDraftFresh(savedCreateDraft.savedAt));

      if (canRestoreCreate && savedCreateDraft) {
        setShowCreateDialog(true);
        setCreateStep(savedCreateDraft.createStep || 'selectService');
        setSelectedServiceId(savedCreateDraft.selectedServiceId || '');
        setFormData(savedCreateDraft.formData || {});
        setTicketDescription(savedCreateDraft.ticketDescription || '');
        setSelectedUserId(savedCreateDraft.selectedUserId ?? null);
        setUserSearch(savedCreateDraft.userSearch || '');
        setServiceSearch(savedCreateDraft.serviceSearch || '');
      } else {
        removeDraft(createDraftKey);
      }

      const savedCreateFiles = canRestoreCreate
        ? await loadDraftFiles(createAttachmentDraftKey)
        : await clearDraftFiles(createAttachmentDraftKey).then(() => []);

      if (cancelled) return;

      setAttachments(savedCreateFiles);
      setHasRestoredDrafts(true);
    };

    void restoreDrafts();

    return () => {
      cancelled = true;
    };
  }, [createAttachmentDraftKey, createDraftKey, user?.id]);

  const handleTicketAttachmentChange = appendSelectedFiles(setAttachments, createAttachmentDraftKey);


  const makeDropHandlers = (
    setter: React.Dispatch<React.SetStateAction<File[]>>,
    draftKey: string | null,
    setIsDragging: React.Dispatch<React.SetStateAction<boolean>>,
    counterRef: React.MutableRefObject<number>,
    isEnabled: () => boolean,
  ) => ({
    onDragEnter: (e: React.DragEvent) => {
      if (!isEnabled()) return;
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      counterRef.current += 1;
      setIsDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!isEnabled()) return;
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!isEnabled()) return;
      e.preventDefault();
      e.stopPropagation();
      counterRef.current = Math.max(0, counterRef.current - 1);
      if (counterRef.current === 0) setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!isEnabled()) return;
      e.preventDefault();
      e.stopPropagation();
      counterRef.current = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files || []);
      validateAndAppendFiles(files, setter, draftKey);
    },
  });

  const createDropHandlers = makeDropHandlers(
    setAttachments,
    createAttachmentDraftKey,
    setIsDraggingCreate,
    dragCounterCreate,
    () => true,
  );

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, ticket_ratings(score, reason), services(name, sla_hours), ticket_lifecycle_events(event_type,event_at)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const activeTicket = tickets.find((t: any) => t.id === activeId);


  const { data: allMessages = [] } = useQuery({
    queryKey: ['ticket-messages-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('ticket_id, content, sender_name, sender_role, created_at, is_private')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: lifecycleEvents = [] } = useQuery({
    queryKey: ['ticket-lifecycle-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_lifecycle_events')
        .select('ticket_id, event_type, event_at')
        .order('event_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const lifecycleByTicket = React.useMemo(() => {
    const map = new Map<string, { event_type: 'closed' | 'reopened'; event_at: string }[]>();
    for (const ev of lifecycleEvents as any[]) {
      const arr = map.get(ev.ticket_id) || [];
      arr.push({ event_type: ev.event_type, event_at: ev.event_at });
      map.set(ev.ticket_id, arr);
    }
    return map;
  }, [lifecycleEvents]);


  const ticketSummaryMap = React.useMemo(() => {
    const map = new Map<string, { description?: string; lastMessage?: { content: string; sender_name: string; created_at: string } }>();
    for (const msg of allMessages as any[]) {
      const entry = map.get(msg.ticket_id) || {};
      if (!entry.description && msg.sender_role === 'system' && typeof msg.content === 'string' && msg.content.includes('📝 Descrição:')) {
        const idx = msg.content.indexOf('📝 Descrição:');
        entry.description = msg.content.slice(idx + '📝 Descrição:'.length).split('\n\n')[0].trim();
      }
      if (msg.sender_role !== 'system' && !msg.is_private) {
        entry.lastMessage = { content: msg.content, sender_name: msg.sender_name, created_at: msg.created_at };
      }
      map.set(msg.ticket_id, entry);
    }
    return map;
  }, [allMessages]);

  const { data: searchMessages = [] } = useQuery({
    queryKey: ['ticket-messages-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch) return [];
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('ticket_id, content, sender_name')
        .ilike('content', `%${debouncedSearch}%`);
      if (error) throw error;
      return data;
    },
    enabled: debouncedSearch.length > 0,
  });

  const searchMessageTicketIds = new Set(searchMessages.map((m: any) => m.ticket_id));

  // IDs de tickets que tiveram pelo menos uma aprovação concedida (status APROVADO)
  const { data: approvedTicketRows = [] } = useQuery({
    queryKey: ['approved-ticket-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_approvals')
        .select('ticket_id')
        .eq('status', 'APROVADO');
      if (error) throw error;
      return data || [];
    },
  });
  const approvedTicketIds = React.useMemo(
    () => new Set((approvedTicketRows as any[]).map((r) => r.ticket_id)),
    [approvedTicketRows]
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name, email, phone, sector, function, leader_name, leader_email');
      if (error) throw error;
      return data;
    },
  });

  const { data: workSchedules = [] } = useQuery({
    queryKey: ['work-schedules-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('work_schedules').select('attendant_id, day_of_week, start_time, end_time, lunch_start, lunch_end');
      if (error) throw error;
      return data;
    },
  });

  const { data: appSettings } = useQuery({
    queryKey: ['app-settings-tickets'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('sla_goal_percent, rating_goal').eq('id', 1).maybeSingle();
      return data;
    },
  });




  const { data: attendantServices = [] } = useQuery({
    queryKey: ['attendant-services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('attendant_services').select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!transferTicket,
  });

  // Atendentes ativos elegíveis para transferência (via RPC SECURITY DEFINER — contorna RLS de profiles)
  const { data: transferableActive = [] } = useQuery({
    queryKey: ['transferable-active', transferTicket?.service_id],
    queryFn: async () => {
      if (!transferTicket?.service_id) return [] as { attendant_id: string; name: string }[];
      const { data, error } = await supabase.rpc('get_active_attendants_with_name_for_service', { _service_id: transferTicket.service_id });
      if (error) throw error;
      return (data || []) as { attendant_id: string; name: string }[];
    },
    enabled: !!transferTicket,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['active-services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('status', 'Ativo');
      if (error) throw error;
      return data;
    },
    enabled: showCreateDialog,
  });

  const { data: activeReturnReasons = [] } = useQuery({
    queryKey: ['active-return-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('return_reasons' as any)
        .select('*')
        .eq('status', 'Ativo')
        .order('description');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: allServiceForms = [] } = useQuery({
    queryKey: ['all-service-forms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_forms')
        .select('*, form_fields(*)');
      if (error) throw error;
      return data;
    },
    enabled: showCreateDialog,
  });


  const getServiceForm = (serviceId: string) => {
    return allServiceForms.find((f: any) => f.service_id === serviceId) || null;
  };

  useEffect(() => {
    if (!selectedServiceId) {
      setSelectedServiceForm(null);
      return;
    }

    if (allServiceForms.length === 0) return;
    setSelectedServiceForm(getServiceForm(selectedServiceId));
  }, [allServiceForms, selectedServiceId]);

  const getName = (userId: string) => profiles.find((p: any) => p.user_id === userId)?.name || 'N/A';
  const getProfile = (userId: string) => profiles.find((p: any) => p.user_id === userId);
  const detailTicket = tickets.find((t: any) => t.id === dialogTicketId);

  const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const fmtTime = (t: string) => (t || '').slice(0, 5);
  const getAttendantSchedule = (attendantId: string) => {
    const items = (workSchedules as any[])
      .filter((s) => s.attendant_id === attendantId)
      .sort((a, b) => a.day_of_week - b.day_of_week);
    return items;
  };
  const renderAttendantScheduleLines = (attendantId: string): React.ReactNode => {
    const items = getAttendantSchedule(attendantId);
    if (items.length === 0) {
      return (
        <>
          <span className="italic">Atendente sem expediente cadastrado.</span><br/>
          <span>Considera-se tempo corrido (calendário).</span>
        </>
      );
    }
    return items.map((s: any, idx: number) => {
      const hasLunch = s.lunch_start && s.lunch_end && s.lunch_start !== s.lunch_end;
      return (
        <React.Fragment key={idx}>
          🗓️ {DAY_SHORT[s.day_of_week]}: {fmtTime(s.start_time)}–{hasLunch ? fmtTime(s.lunch_start) : fmtTime(s.end_time)}
          {hasLunch && <> e {fmtTime(s.lunch_end)}–{fmtTime(s.end_time)}</>}
          <br/>
        </React.Fragment>
      );
    });
  };

  const { data: detailFormFields } = useQuery({
    queryKey: ['detail-form-fields', detailTicket?.service_id],
    queryFn: async () => {
      if (!detailTicket?.service_id) return null;
      const { data, error } = await supabase.from('service_forms').select('*, form_fields(*)').eq('service_id', detailTicket.service_id).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!detailTicket?.service_id,
  });

  // Open ticket from notification click (URL param)
  useEffect(() => {
    const openTicketId = searchParams.get('openTicket');
    if (openTicketId && tickets.length > 0) {
      openTicketPanel(openTicketId);

      setSearchParams({}, { replace: true });
    }
  }, [searchParams, tickets]);

  const sanitizeFileName = (name: string) => {
    const lastDot = name.lastIndexOf('.');
    const base = lastDot > 0 ? name.slice(0, lastDot) : name;
    const ext = lastDot > 0 ? name.slice(lastDot) : '';
    const clean = (s: string) => s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${clean(base) || 'arquivo'}${clean(ext)}`;
  };

  const uploadFiles = async (ticketId: string, files: File[]) => {
    for (const file of files) {
      const safeName = sanitizeFileName(file.name);
      const filePath = `${ticketId}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(filePath, file);
      if (uploadError) {
        console.error('Erro upload storage:', uploadError);
        toast({ title: 'Erro ao enviar arquivo', description: `${file.name}: ${uploadError.message}`, variant: 'destructive' });
        continue;
      }
      const { error: insertError } = await supabase.from('ticket_attachments').insert({
        ticket_id: ticketId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
        uploaded_by: user!.id,
      });
      if (insertError) {
        console.error('Erro insert attachment:', insertError);
        toast({ title: 'Erro ao registrar anexo', description: `${file.name}: ${insertError.message}`, variant: 'destructive' });
      }
    }
  };

  // Etapa atual da criação (para feedback de carregamento)
  const [createStage, setCreateStage] = useState<'idle' | 'api' | 'ticket' | 'files'>('idle');
  const [apiAttempt, setApiAttempt] = useState<{ current: number; total: number } | null>(null);
  const [apiErrorDetails, setApiErrorDetails] = useState<FormApiErrorDetails | null>(null);

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async ({ serviceId, formValues, files, description, preApiSummary, devolucaoItens }: { serviceId: string; formValues: Record<string, string>; files: File[]; description: string; preApiSummary?: string | null; devolucaoItens?: DevolucaoItem[] }) => {
      setCreateStage('ticket');
      const { data: activeAtt, error: attErr } = await supabase.rpc('get_active_attendants_for_service', { _service_id: serviceId });
      if (attErr) throw attErr;
      const attIds = (activeAtt || []).map((r: any) => r.attendant_id);
      if (attIds.length === 0) throw new Error('Nenhum atendente ativo disponível para este serviço.');

      const { data: openTickets } = await supabase.from('tickets').select('attendant_id').eq('status', 'ABERTO').in('attendant_id', attIds);
      const counts: Record<string, number> = {};
      attIds.forEach(id => { counts[id] = 0; });
      openTickets?.forEach((t: any) => { counts[t.attendant_id] = (counts[t.attendant_id] || 0) + 1; });
      const chosenId = attIds.reduce((a, b) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);

      // === Verificar fluxo de aprovação ===
      // Setor do solicitante (dono do ticket)
      const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('sector')
        .eq('user_id', ticketOwnerId)
        .maybeSingle();
      const requesterSector = (requesterProfile?.sector || '').trim();

      // Buscar fluxos ativos para o serviço; aceitar fluxo com setor do solicitante OU sem setor (NULL = todos)
      const { data: flows } = await supabase
        .from('approval_flows')
        .select('id, name, sector')
        .eq('service_id', serviceId)
        .eq('active', true);

      const matchedFlow = (flows || []).find((f: any) => {
        const flowSector = (f.sector || '').trim();
        if (!flowSector) return true; // setor nulo => qualquer
        return flowSector.toLowerCase() === requesterSector.toLowerCase();
      });

      let approverIds: string[] = [];
      if (matchedFlow) {
        const { data: approvers } = await supabase
          .from('approval_flow_approvers')
          .select('approver_id')
          .eq('flow_id', matchedFlow.id);
        approverIds = (approvers || []).map((a: any) => a.approver_id).filter(Boolean);
        if (approverIds.length === 0) {
          // Fluxo sem aprovadores cadastrados -> ignora aprovação para não travar
          console.warn('Fluxo de aprovação encontrado sem aprovadores; criando ticket normalmente.');
        }
      }

      const requiresApproval = !!matchedFlow && approverIds.length > 0;

      // Integração de API do formulário: se falhar, o ticket NÃO é criado.
      let apiSummary: string | null = preApiSummary ?? null;
      if (preApiSummary === undefined && Object.keys(formValues).length > 0) {
        setCreateStage('api');
        try {
          const apiResult = await preflightFormApi(serviceId, formValues, (current, total) => setApiAttempt({ current, total }));
          if (!apiResult.skipped) apiSummary = apiResult.summary ?? null;
        } finally {
          setApiAttempt(null);
          setCreateStage('ticket');
        }
      }

      const formDataToSave: Record<string, any> | null = Object.keys(formValues).length > 0 ? { ...formValues } : null;
      if (formDataToSave && devolucaoItens && devolucaoItens.length > 0) {
        formDataToSave[DEVOLUCAO_ITENS_KEY] = devolucaoItens;
      }

      const { data: ticket, error } = await supabase.from('tickets').insert({
        user_id: ticketOwnerId,
        attendant_id: chosenId,
        service_id: serviceId,
        form_data: formDataToSave,
        created_by: user!.id,
        status: requiresApproval ? 'AGUARDANDO_APROVACAO' : 'ABERTO',
      }).select().single();
      if (error) throw error;


      const ticketRef = ticket;

      const { data: attProfile } = await supabase.from('profiles').select('name').eq('user_id', chosenId).maybeSingle();
      const service = services.find((s: any) => s.id === serviceId);

      const onBehalfNote = ticketOwnerId !== user!.id ? `\n📌 **Criado por:** ${user!.name} em nome de ${ticketOwnerName}` : '';
      const approvalNote = requiresApproval ? `\n⏳ **Aprovação:** Este ticket requer aprovação antes de ser atendido.` : '';

      // Motivo da devolução selecionado no formulário (se houver)
      const rrField = ((getServiceForm(serviceId)?.form_fields || []) as any[])
        .find((f: any) => f.field_type === 'return_reason');
      const rrValue = rrField ? (formValues[rrField.id] || '').trim() : '';
      const returnReasonNote = rrValue ? `\n↩️ **Motivo da Devolução:** ${rrValue}` : '';

      const formDataLines = buildFormDataLines(
        ((getServiceForm(serviceId)?.form_fields || []) as any[]),
        formValues
      );

      const hasForm = formDataLines.length > 0;

      const lines = hasForm
        ? [
            `🎫 **Ticket criado!**`,
            ``,
            `🛠️ **Serviço:** ${service?.name || '—'}`,
            `👨‍💼 **Atendente designado:** ${attProfile?.name || 'N/A'}${onBehalfNote}${approvalNote}`,
            ...formDataLines,
          ]
        : [
            `🎫 **Ticket criado!**`,
            ``,
            `🛠️ **Serviço:** ${service?.name || '—'}`,
            `👨‍💼 **Atendente designado:** ${attProfile?.name || 'N/A'}`,
            `📝 **Descrição:** ${description || '—'}${returnReasonNote}${onBehalfNote}${approvalNote}`,
          ];

      const { error: msgError } = await supabase.from('ticket_messages').insert({
        ticket_id: ticketRef.id,
        sender_id: user!.id,
        sender_name: user!.name,
        sender_role: 'system',
        content: lines.join('\n'),
      });
      if (msgError) console.error('Erro ao inserir mensagem inicial:', msgError);

      if (apiSummary) {
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketRef.id,
          sender_name: 'Sistema',
          sender_role: 'system',
          content: apiSummary,
          is_private: false,
        });
      }

      if (devolucaoItens && devolucaoItens.length > 0) {
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketRef.id,
          sender_name: 'Sistema',
          sender_role: 'system',
          content: formatItensBlock(devolucaoItens),
          is_private: false,
        });
      }




      // Upload attachments
      if (files.length > 0) {
        setCreateStage('files');
        await uploadFiles(ticketRef.id, files);
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketRef.id,
          sender_id: user!.id,
          sender_name: user!.name,
          sender_role: 'user',
          content: `📎 ${files.length} anexo(s) adicionado(s): ${files.map(f => f.name).join(', ')}`,
        });
      }

      // Criar registros de aprovação
      if (requiresApproval) {
        const rows = approverIds.map((approver_id) => ({
          ticket_id: ticketRef.id,
          approver_id,
          flow_id: matchedFlow!.id,
          status: 'PENDENTE',
        }));
        const { error: appErr } = await supabase.from('ticket_approvals').insert(rows);
        if (appErr) console.error('Erro ao criar aprovações:', appErr);

        // Mensagem de sistema: fluxo de aprovação iniciado
        // Usa RPC SECURITY DEFINER para garantir leitura dos nomes mesmo sem RLS de profiles
        const { data: namesViaRpc } = await supabase.rpc('get_flow_approver_names', { _flow_id: matchedFlow!.id });
        let approverNames = (namesViaRpc as string) || '';
        if (!approverNames) {
          const { data: approverProfiles } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', approverIds);
          approverNames = (approverProfiles || []).map((p: any) => p.name).filter(Boolean).join(', ');
        }
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketRef.id,
          sender_name: 'Sistema',
          sender_role: 'system',
          content: `🔒 Fluxo de aprovação "${matchedFlow!.name}" iniciado. Aguardando decisão de: ${approverNames || '—'}.`,
        });
      }

      return { ticket: ticketRef, service, attProfile, chosenId, requiresApproval, approverIds };
    },
    onSuccess: ({ ticket, service, attProfile, chosenId, requiresApproval, approverIds }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticket.id] });

      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });

      if (!requiresApproval) openTicketPanel(ticket.id);


      removeDraft(createDraftKey);
      void clearDraftFiles(createAttachmentDraftKey);
      setShowCreateDialog(false);
      resetCreateForm();
      toast({
        title: requiresApproval
          ? `⏳ Ticket #${ticket.code} criado e aguardando aprovação!`
          : `✅ Ticket #${ticket.code} criado com sucesso!`,
      });
      logAction('CREATE', 'tickets', ticket.id, `Ticket #${ticket.code} aberto • Serviço: "${service?.name || '—'}" • Criado por: ${user?.name || '—'} • Em nome de: ${getName(ticketOwnerId) || '—'} • Atendente designado: ${attProfile?.name || '—'} • Data/Hora de criação: ${new Date(ticket.created_at).toLocaleString('pt-BR')}${requiresApproval ? ` • Status: aguardando aprovação (${approverIds.length} aprovador${approverIds.length === 1 ? '' : 'es'})` : ' • Status: aberto e pronto para atendimento'}.`);

      if (requiresApproval) {
        sendApprovalRequestedEmails(
          {
            ticketId: ticket.id,
            ticketCode: String(ticket.code),
            serviceName: service?.name || '',
            userId: ticketOwnerId,
            attendantId: chosenId,
            createdById: user!.id,
          },
          approverIds
        );
      } else {
        sendTicketCreatedEmails(ticket.id, {
          ticketCode: String(ticket.code),
          serviceName: service?.name || '',
          userName: ticketOwnerName,
          attendantName: attProfile?.name || 'N/A',
          description: ticketDescription,
          createdAt: new Date().toLocaleString('pt-BR'),
        }, ticketOwnerId, chosenId);
      }
    },
    onError: (err: any) => {
      if (err instanceof FormApiError) { setApiErrorDetails(err.details); return; }
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
    onSettled: () => { setCreateStage('idle'); setApiAttempt(null); },
  });

  const resetCreateForm = () => {
    setCreateStep('selectService');
    setSelectedServiceId('');
    setSelectedServiceForm(null);
    setFormData({});
    setAttachments([]);
    setTicketDescription('');
    setSelectedUserId(null);
    setUserSearch('');
    setServiceSearch('');
    setIsProcessingStep(false);
  };

  const closeCreateDialog = () => {
    removeDraft(createDraftKey);
    void clearDraftFiles(createAttachmentDraftKey);
    setShowCreateDialog(false);
    setIsDialogMaximized(false);
    resetCreateForm();
  };

  const handleSelectService = (serviceId: string) => {
    if (createTicketMutation.isPending) return;
    const selectedService = services.find((s: any) => s.id === serviceId);

    if (selectedService?.restricted_visibility && !isPrivilegedRole(ticketOwnerId)) {
      toast({
        title: 'Serviço restrito',
        description: 'Este serviço só pode ser usado em tickets de administradores ou atendentes. Selecione outro solicitante.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedServiceId(serviceId);
    setFormData({});

    const serviceForm = getServiceForm(serviceId);
    setSelectedServiceForm(serviceForm);

    if (selectedService?.requires_description) {
      setTicketDescription('');
      setCreateStep('description');
      return;
    }

    const autoDesc = selectedService?.name || '';
    setTicketDescription(autoDesc);

    if (serviceForm) {
      setCreateStep('fillForm');
      return;
    }

    createTicketMutation.mutate({ serviceId, formValues: {}, files: attachments, description: autoDesc });
  };

  const proceedAfterDescription = () => {
    if (createTicketMutation.isPending) return;
    if (selectedServiceForm) {
      setCreateStep('fillForm');
    } else {
      createTicketMutation.mutate({ serviceId: selectedServiceId, formValues: {}, files: attachments, description: ticketDescription });
    }
  };

  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Etapa de produtos da devolução (antes de criar o ticket)
  const [devolucaoStep, setDevolucaoStep] = useState<{ itens: DevolucaoItem[]; apiSummary: string | null } | null>(null);
  const [isPreflighting, setIsPreflighting] = useState(false);

  const submitFilledForm = async () => {
    if (createTicketMutation.isPending || isPreflighting) return;
    const fields = (selectedServiceForm?.form_fields || []) as any[];
    const missing = fields.filter((f: any) => f.required && !String(formData[f.id] ?? '').trim());
    if (missing.length > 0) {
      setFormErrors(missing.reduce((acc: any, f: any) => ({ ...acc, [f.id]: true }), {}));
      toast({
        title: 'Campos obrigatórios',
        description: `Preencha: ${missing.map((f: any) => f.label).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    setFormErrors({});

    // Executa a integração antes de criar o ticket para obter os produtos
    setIsPreflighting(true);
    setCreateStage('api');
    try {
      const apiResult = await preflightFormApi(selectedServiceId, formData, (current, total) => setApiAttempt({ current, total }));
      const summary = apiResult.skipped ? null : (apiResult.summary ?? null);
      const itens: DevolucaoItem[] = apiResult.skipped
        ? []
        : (((apiResult as any).itens as DevolucaoItem[] | undefined) ?? extractItensFromBody(apiResult.response_body));

      if (itens.length > 0) {
        setDevolucaoStep({ itens, apiSummary: summary });
        return;
      }
      createTicketMutation.mutate({ serviceId: selectedServiceId, formValues: formData, files: attachments, description: ticketDescription, preApiSummary: summary });
    } catch (err: any) {
      if (err instanceof FormApiError) setApiErrorDetails(err.details);
      else toast({ title: 'Erro', description: err?.message || 'Falha na integração.', variant: 'destructive' });
    } finally {
      setIsPreflighting(false);
      setApiAttempt(null);
      setCreateStage('idle');
    }
  };

  // Correção das quantidades devolvidas pelo atendente responsável / admin
  const [devolucaoEdit, setDevolucaoEdit] = useState(false);

  const detailDevolucaoItens: DevolucaoItem[] = Array.isArray(detailTicket?.form_data?.[DEVOLUCAO_ITENS_KEY])
    ? (detailTicket.form_data[DEVOLUCAO_ITENS_KEY] as DevolucaoItem[])
    : [];

  // Só é possível alterar o motivo/produtos da devolução enquanto o ticket estiver aberto.
  // Atendente precisa da permissão "Pode Alterar Motivo da Devolução" e ser o responsável.
  const canEditDevolucaoFor = (ticket: any) => !!ticket
    && ticket.status !== 'FECHADO'
    && (
      user?.role === 'admin'
      || (user?.role === 'attendant' && !!user?.canChangeReturnReason && ticket.attendant_id === user?.id)
    );

  const canEditDevolucao = canEditDevolucaoFor(detailTicket);

  // ===== Alteração do motivo da devolução (atendente com permissão / admin) =====
  const [changeReasonOpen, setChangeReasonOpen] = useState(false);
  const [changeReasonValue, setChangeReasonValue] = useState('');

  const { data: activeTicketForm } = useQuery({
    queryKey: ['active-ticket-form', activeTicket?.service_id],
    enabled: !!activeTicket?.service_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_forms')
        .select('*, form_fields(*)')
        .eq('service_id', activeTicket.service_id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const activeReasonField = React.useMemo(
    () => ((activeTicketForm as any)?.form_fields || []).find((f: any) => f.field_type === 'return_reason') || null,
    [activeTicketForm]
  );

  const canChangeReason = !!activeTicket && !!activeReasonField && canEditDevolucaoFor(activeTicket);

  const changeReasonMutation = useMutation({
    mutationFn: async (newReason: string) => {
      if (!activeTicket || !activeReasonField) throw new Error('Ticket sem campo de motivo da devolução.');
      const fd = { ...((activeTicket.form_data || {}) as Record<string, any>) };
      const oldReason = fd[activeReasonField.id] ?? '(não informado)';
      fd[activeReasonField.id] = newReason;
      const { error } = await supabase.from('tickets').update({ form_data: fd as any }).eq('id', activeTicket.id);
      if (error) throw error;
      await supabase.from('ticket_messages').insert({
        ticket_id: activeTicket.id,
        sender_id: user!.id,
        sender_name: user!.name,
        sender_role: 'system',
        content: `↩️ **Motivo da devolução alterado por ${user!.name}** em ${new Date().toLocaleString('pt-BR')}\nDe: ${oldReason}\nPara: ${newReason}`,
        is_private: false,
      });
    },
    onSuccess: () => {
      setChangeReasonOpen(false);
      setChangeReasonValue('');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-detail-messages', activeTicket?.id] });
      toast({ title: '✅ Motivo da devolução atualizado!' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const updateDevolucaoMutation = useMutation({
    mutationFn: async (itens: DevolucaoItem[]) => {
      const newFormData = { ...((detailTicket.form_data || {}) as Record<string, any>), [DEVOLUCAO_ITENS_KEY]: itens };
      const { error } = await supabase.from('tickets').update({ form_data: newFormData as any }).eq('id', detailTicket.id);
      if (error) throw error;
      await supabase.from('ticket_messages').insert({
        ticket_id: detailTicket.id,
        sender_id: user!.id,
        sender_name: user!.name,
        sender_role: 'system',
        content: `✏️ **Quantidades devolvidas corrigidas por ${user!.name}**\n${formatItensBlock(itens, '📦 **Produtos da Devolução (corrigido)**')}`,
        is_private: false,
      });
    },
    onSuccess: () => {
      setDevolucaoEdit(false);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-detail-messages', detailTicket?.id] });
      toast({ title: '✅ Quantidades atualizadas com sucesso!' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });





  const closeMutation = useMutation({
    mutationFn: async (params: string | { ticketId: string; slaReason?: string }) => {
      const ticketId = typeof params === 'string' ? params : params.ticketId;
      const slaReason = typeof params === 'string' ? undefined : params.slaReason;

      const { error } = await supabase.from('tickets').update({ status: 'FECHADO', closed_at: new Date().toISOString() }).eq('id', ticketId);
      if (error) throw error;

      // Se justificativa de SLA foi informada, gravar como mensagem privada (restrita)
      if (slaReason && slaReason.trim()) {
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          sender_id: user!.id,
          sender_name: user!.name,
          sender_role: user!.role,
          content: `⚠️ Justificativa do SLA não atingido:\n${slaReason.trim()}`,
          is_private: true,
        });
      }

      // Registrar mensagem de encerramento do ticket
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_name: 'Sistema',
        sender_role: 'system',
        content: '🎉✅ Este ticket foi encerrado com sucesso! Agradecemos muito pela sua colaboração!\n\n⭐ Por favor, avalie o atendimento que você recebeu! Sua avaliação é muito importante para que possamos melhorar continuamente nossos serviços e oferecer um atendimento cada vez melhor.\n\n⚠️ Lembre-se: enquanto houver tickets com avaliação pendente, não será possível abrir novos tickets. Avalie agora e continue contando com a gente! 😊',
      });

      return ticketId;
    },
    onSuccess: (ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      const ticket = tickets.find((t: any) => t.id === ticketId);
      toast({ title: `✅ Ticket #${ticket?.code ?? ''} fechado!` });
      if (ticket) {
        const closedAtIso = new Date().toISOString();
        logAction('CLOSE', 'tickets', ticketId, `Ticket #${ticket.code} fechado • Serviço: "${(ticket as any).services?.name || '—'}" • Solicitante: ${getName(ticket.user_id) || '—'} • Atendente: ${getName(ticket.attendant_id) || '—'} • Criado por: ${getName((ticket as any).created_by) || '—'} • Data/Hora de criação: ${new Date(ticket.created_at).toLocaleString('pt-BR')} • Fechado por: ${user?.name || '—'} • Data/Hora de fechamento: ${new Date(closedAtIso).toLocaleString('pt-BR')}.`);
        sendTicketClosedEmails(ticketId, {
          ticketCode: String(ticket.code),
          serviceName: (ticket as any).services?.name || '',
          closedBy: user!.name,
          userName: getName(ticket.user_id),
          attendantName: getName(ticket.attendant_id),
          createdAt: new Date(ticket.created_at).toLocaleString('pt-BR'),
          closedAt: new Date(closedAtIso).toLocaleString('pt-BR'),
        }, ticket.user_id, ticket.attendant_id);
      }
    },
  });

  // Serviços em que o atendente logado pode fechar tickets (Atendente x Serviço)
  const { data: myAttendantServices = [] } = useQuery({
    queryKey: ['my-attendant-services', user?.id],
    enabled: user?.role === 'attendant' && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendant_services').select('service_id, can_close').eq('attendant_id', user!.id);
      if (error) throw error;
      return data as any[];
    },
  });
  const closableServiceIds = React.useMemo(
    () => new Set((myAttendantServices as any[]).filter(r => r.can_close ?? true).map(r => r.service_id)),
    [myAttendantServices]
  );

  // Motivos de devolução em que o atendente logado NÃO pode fechar tickets
  const { data: myBlockedReasons = [] } = useQuery({
    queryKey: ['my-blocked-return-reasons', user?.id],
    enabled: user?.role === 'attendant' && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendant_return_reasons' as any)
        .select('can_close, return_reasons(description)')
        .eq('attendant_id', user!.id)
        .eq('can_close', false);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const blockedReasonDescriptions = React.useMemo(
    () => new Set(
      (myBlockedReasons as any[])
        .map(r => String(r.return_reasons?.description ?? '').trim().toLowerCase())
        .filter(Boolean)
    ),
    [myBlockedReasons]
  );

  // Motivo da devolução informado no formulário do ticket (se houver)
  const ticketHasBlockedReason = (ticket: any) => {
    if (blockedReasonDescriptions.size === 0) return false;
    const fd = ticket?.form_data;
    if (!fd || typeof fd !== 'object') return false;
    return Object.values(fd).some(v =>
      typeof v === 'string' && blockedReasonDescriptions.has(v.trim().toLowerCase())
    );
  };


  // Determina se o atendente precisa justificar o fechamento (SLA não atingido)
  const requiresSlaJustification = (ticket: any): boolean => {
    if (!ticket || user?.role !== 'attendant') return false;
    const slaHours = ticket.services?.sla_hours;
    if (slaHours == null) return false;
    const hoursSpent = calcBusinessHoursOpen(ticket, lifecycleByTicket.get(ticket.id), new Date().toISOString(), workSchedules as any[]);
    return hoursSpent > slaHours;
  };

  // Permissões do atendente (configuradas no cadastro do atendente).
  // Atendente só pode fechar/transferir tickets associados a ele.
  const canCloseTicket = (ticket: any) => {
    if (user?.role === 'admin') return true;
    // Solicitante: permissão configurada no cadastro do usuário, apenas em tickets próprios
    if (user?.role === 'user') {
      return !!user?.canCloseTickets && (ticket.user_id === user.id || ticket.created_by === user.id);
    }
    if (user?.role !== 'attendant') return true;
    if (!user?.canCloseTickets || ticket.attendant_id !== user.id) return false;
    // Permissão por serviço (Atendente x Serviço)
    if (!closableServiceIds.has(ticket.service_id)) return false;
    // Permissão por motivo da devolução (Atendente x Motivo)
    return !ticketHasBlockedReason(ticket);
  };

  // Reabertura: admin sempre; solicitante somente com permissão e em tickets próprios
  const canReopenTicket = (ticket: any) => {
    if (ticket.status !== 'FECHADO') return false;
    if (user?.role === 'admin') return true;
    if (user?.role !== 'user') return false;
    return !!user?.canReopenTickets && (ticket.user_id === user.id || ticket.created_by === user.id);
  };

  const reopenMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase.from('tickets').update({ status: 'ABERTO', reopened: true, closed_at: null }).eq('id', ticketId);
      if (error) throw error;
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: user!.id,
        sender_name: user!.name,
        sender_role: user!.role,
        content: `🔄 **Ticket reaberto por:** ${user!.name}`,
        is_private: false,
      });
    },
    onSuccess: (_, ticketId) => {
      const t = tickets.find((x: any) => x.id === ticketId);
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      toast({ title: `🔄 Ticket #${t?.code ?? ''} reaberto!` });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });


  const canTransferTicket = (ticket: any) => {
    if (user?.role === 'admin') return true;
    if (user?.role !== 'attendant') return false;
    return !!user?.canTransferTickets && ticket.attendant_id === user.id;
  };

  const requestCloseTicket = (ticket: any) => {
    setCloseConfirm({ open: true, id: ticket.id, code: ticket.code, requireReason: requiresSlaJustification(ticket), reason: '' });
  };


  const rateMutation = useMutation({
    mutationFn: async () => {
      if (ratingScore <= 3 && !ratingReason.trim()) throw new Error('Para avaliações ≤ 3, informe o motivo.');
      const { data: existing } = await supabase.from('ticket_ratings').select('id').eq('ticket_id', ratingTicketId!).maybeSingle();
      if (existing) throw new Error('Este ticket já foi avaliado.');
      const { error } = await supabase.from('ticket_ratings').insert({ ticket_id: ratingTicketId!, score: ratingScore, reason: ratingReason || null });
      if (error) throw error;
    },
    onSuccess: () => {
      const ticket = tickets.find((t: any) => t.id === ratingTicketId);
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      toast({ title: `⭐ Avaliação do Ticket #${ticket?.code ?? ''} registrada!` });
      if (ticket) {
        sendTicketRatedEmails(ratingTicketId!, {
          ticketCode: String(ticket.code),
          serviceName: (ticket as any).services?.name || '',
          score: ratingScore,
          reason: ratingReason || undefined,
          ratedBy: user!.name,
          userName: getName(ticket.user_id),
          attendantName: getName(ticket.attendant_id),
          createdAt: new Date(ticket.created_at).toLocaleString('pt-BR'),
        }, ticket.user_id, ticket.attendant_id);
      }
      setRatingTicketId(null); setRatingScore(0); setRatingReason('');
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const oldAttendantId = transferTicket.attendant_id;
      const { error } = await supabase.rpc('transfer_ticket', { _ticket_id: transferTicket.id, _new_attendant_id: transferTo });
      if (error) throw error;

      // Resolve nomes de forma robusta (perfis podem não estar carregados p/ solicitantes)
      const resolveName = async (uid: string) => {
        const local = profiles.find((p: any) => p.user_id === uid)?.name;
        if (local) return local;
        const fromList = getTransferableAttendants(transferTicket)?.find((a: any) => a.attendant_id === uid)?.name;
        if (fromList) return fromList;
        const { data } = await supabase.from('profiles').select('name').eq('user_id', uid).maybeSingle();
        return data?.name || '—';
      };

      const [fromName, attName] = await Promise.all([resolveName(oldAttendantId), resolveName(transferTo)]);
      const when = new Date().toLocaleString('pt-BR');
      await supabase.from('ticket_messages').insert({
        ticket_id: transferTicket.id,
        sender_name: 'Sistema',
        sender_role: 'system',
        is_private: false,
        content: `🔄 **Ticket transferido**\n**Data/Hora:** ${when}\n**Transferido por:** ${user?.name || '—'}\n**De:** ${fromName}\n**Para:** ${attName}`,
      });
      return { oldAttendantId, newAttendantName: attName };
    },

    onSuccess: ({ oldAttendantId, newAttendantName }) => {
      const transferredAtIso = new Date().toISOString();
      logAction('TRANSFER', 'tickets', transferTicket.id, `Ticket #${transferTicket.code} transferido • Serviço: "${(transferTicket as any).services?.name || '—'}" • Solicitante: ${getName(transferTicket.user_id) || '—'} • Atendente anterior: ${getName(oldAttendantId) || '—'} • Novo atendente: ${newAttendantName || '—'} • Transferido por: ${user?.name || '—'} • Data/Hora da transferência: ${new Date(transferredAtIso).toLocaleString('pt-BR')}.`);
      sendTicketTransferredEmails(transferTicket.id, {
        ticketCode: String(transferTicket.code),
        serviceName: (transferTicket as any).services?.name || '',
        fromAttendant: getName(oldAttendantId),
        toAttendant: newAttendantName,
        userName: getName(transferTicket.user_id),
        createdAt: new Date(transferTicket.created_at).toLocaleString('pt-BR'),
      }, transferTicket.user_id, oldAttendantId, transferTo);
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', transferTicket.id] });

      setTransferTicket(null); setTransferTo('');
      toast({ title: `✅ Ticket #${transferTicket?.code ?? ''} transferido!` });
    },
    onError: (err: any) => { toast({ title: 'Erro ao transferir', description: err?.message || 'Falha ao transferir o ticket.', variant: 'destructive' }); },
  });


  const deleteMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      // 1. Buscar anexos para remover arquivos do storage
      const { data: attachmentsToDelete } = await supabase
        .from('ticket_attachments')
        .select('file_path')
        .eq('ticket_id', ticketId);

      if (attachmentsToDelete && attachmentsToDelete.length > 0) {
        const paths = attachmentsToDelete.map((a: any) => a.file_path);
        await supabase.storage.from('ticket-attachments').remove(paths);
      }

      // 2. Excluir registros relacionados
      await supabase.from('ticket_messages').delete().eq('ticket_id', ticketId);
      await supabase.from('ticket_ratings').delete().eq('ticket_id', ticketId);
      await supabase.from('ticket_attachments').delete().eq('ticket_id', ticketId);

      // 3. Excluir o ticket
      const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: (_, ticketId) => {
      const ticket = tickets.find((t: any) => t.id === ticketId);
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      toast({ title: `🗑️ Ticket #${ticket?.code ?? ''} excluído!` });
    },
    onError: (err: any) => { toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' }); },
  });

  const priorityMutation = useMutation({
    mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: boolean }) => {
      const { error } = await supabase.from('tickets').update({ priority }).eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: (_, { ticketId, priority }) => {
      const ticket = tickets.find((t: any) => t.id === ticketId);
      queryClient.invalidateQueries({ queryKey: ['tickets-list'] });
      toast({ title: priority ? `🔴 Ticket #${ticket?.code ?? ''} priorizado!` : `✅ Prioridade do Ticket #${ticket?.code ?? ''} removida!` });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  // Check if attendant has open priority tickets blocking other actions
  const hasOpenPriorityTickets = (attendantId: string) => {
    return tickets.some((t: any) => t.attendant_id === attendantId && t.priority && t.status === 'ABERTO');
  };

  const isBlockedByPriority = (ticket: any) => {
    if (user?.role === 'admin') return false;
    if (user?.role === 'user') return false; // Usuários nunca são bloqueados por prioridade
    if (ticket.priority) return false; // Priority ticket itself is never blocked
    return hasOpenPriorityTickets(ticket.attendant_id);
  };

  const getTransferableAttendants = (ticket: any) => {
    // Lista vem da RPC (já filtra por serviço + status Ativo, contornando RLS de profiles)
    const list = (transferableActive as { attendant_id: string; name: string }[])
      .filter(a => a.attendant_id !== ticket.attendant_id)
      .map(a => ({ user_id: a.attendant_id, name: a.name }));
    return list;
  };

  const getFileUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage.from('ticket-attachments').createSignedUrl(filePath, 3600);
    if (error || !data) return '';
    return data.signedUrl;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
  const formatDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Apply status/search filters for both list and kanban views
  const filteredTickets = React.useMemo(() => {
    return tickets.filter((ticket: any) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const code = String(ticket.code || '');
        const serviceName = (ticket.services?.name || '').toLowerCase();
        const userName = getName(ticket.user_id).toLowerCase();
        const attendantName = getName(ticket.attendant_id).toLowerCase();
        const status = (ticket.status || '').toLowerCase();
        const matchesMessages = searchMessageTicketIds.has(ticket.id);
        const matchesSearch = code.includes(q) || serviceName.includes(q) || userName.includes(q) || attendantName.includes(q) || status.includes(q) || matchesMessages;
        if (!matchesSearch) return false;
      }
      // Status filter (OR entre os filtros marcados)
      const hasRatingCheck = Array.isArray(ticket.ticket_ratings) ? ticket.ticket_ratings.length > 0 : !!ticket.ticket_ratings;
      const matches: boolean[] = [];
      if (statusFilter.open) matches.push(ticket.status === 'ABERTO');
      if (statusFilter.closed) matches.push(ticket.status === 'FECHADO');
      if (statusFilter.awaitingApproval) matches.push(ticket.status === 'AGUARDANDO_APROVACAO');
      if (statusFilter.rejected) matches.push(ticket.status === 'REJEITADO');
      if (statusFilter.approved) matches.push(approvedTicketIds.has(ticket.id) && ticket.status !== 'REJEITADO' && ticket.status !== 'AGUARDANDO_APROVACAO');
      if (statusFilter.reopened) matches.push(ticket.reopened === true);
      if (statusFilter.unrated) matches.push(ticket.status === 'FECHADO' && !hasRatingCheck && ticket.user_id === user?.id);
      if (matches.length === 0) return false;
      return matches.some(Boolean);
    });
  }, [tickets, searchQuery, statusFilter, searchMessageTicketIds, approvedTicketIds, user?.id]);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      {/* Hidden file inputs — MUST be outside all Dialogs to work on Android */}
      <input
        id="ticket-file-input"
        ref={ticketFileInputRef}
        type="file"
        multiple
        accept="image/*,application/*,text/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.csv,.txt"
        onChange={handleTicketAttachmentChange}
        aria-label="Selecionar arquivo para ticket"
        className="sr-only"
      />
      {/* Filters and Create button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="text-sm font-semibold text-muted-foreground sm:shrink-0">Filtrar:</span>
          <div className="min-w-0 flex flex-wrap gap-2">
          <button
            onClick={() => toggleStatusFilter('open')}
            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-1.5 text-center text-[11px] font-bold leading-tight transition-all sm:text-xs ${statusFilter.open ? 'bg-primary/15 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'}`}
          >
            🟢 Abertos
          </button>
          <button
            onClick={() => toggleStatusFilter('closed')}
            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-1.5 text-center text-[11px] font-bold leading-tight transition-all sm:text-xs ${statusFilter.closed ? 'bg-primary/15 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border'}`}
          >
            ✅ Fechados
          </button>
          <button
            onClick={() => toggleStatusFilter('awaitingApproval')}
            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-1.5 text-center text-[11px] font-bold leading-tight transition-all sm:text-xs ${statusFilter.awaitingApproval ? 'bg-warning/15 text-warning border-warning/30' : 'bg-muted text-muted-foreground border-border'}`}
          >
            ⏳ Aguardando Aprovação
          </button>
          <button
            onClick={() => toggleStatusFilter('rejected')}
            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-1.5 text-center text-[11px] font-bold leading-tight transition-all sm:text-xs ${statusFilter.rejected ? 'bg-destructive/15 text-destructive border-destructive/30' : 'bg-muted text-muted-foreground border-border'}`}
          >
            ❌ Rejeitados
          </button>
          <button
            onClick={() => toggleStatusFilter('approved')}
            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-1.5 text-center text-[11px] font-bold leading-tight transition-all sm:text-xs ${statusFilter.approved ? 'bg-success/15 text-success border-success/30' : 'bg-muted text-muted-foreground border-border'}`}
          >
            ☑️ Aprovados
          </button>
          <button
            onClick={() => toggleStatusFilter('unrated')}
            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-1.5 text-center text-[11px] font-bold leading-tight transition-all sm:text-xs ${statusFilter.unrated ? 'bg-warning/15 text-warning border-warning/30' : 'bg-muted text-muted-foreground border-border'}`}
          >
            ⭐ Não Avaliados
          </button>
          <button
            onClick={() => toggleStatusFilter('reopened')}
            className={`inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-1.5 text-center text-[11px] font-bold leading-tight transition-all sm:text-xs ${statusFilter.reopened ? 'bg-accent/15 text-accent border-accent/30' : 'bg-muted text-muted-foreground border-border'}`}
          >
            🔄 Reabertos
          </button>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
          {user?.role === 'admin' && (
            <div className="flex rounded-md border border-input overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                title="Visão em lista"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                title="Visão Kanban por atendente"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          )}
          <button
            onClick={handleManualRefresh}
            title={`Próxima atualização em ${countdown}s`}
            className="relative flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors overflow-hidden hover:bg-accent hover:text-accent-foreground"
          >
            <div
              className="absolute inset-0 w-full bg-primary/20 transition-none"
              style={{ height: `${(countdown / 30) * 100}%`, top: 'auto', bottom: 0 }}
            />
            <RefreshCw size={14} className={countdown <= 3 ? 'animate-spin' : ''} />
            <span>{countdown}s</span>
          </button>
          <Button onClick={() => {
            const unratedTickets = tickets.filter((t: any) => t.status === 'FECHADO' && !(Array.isArray(t.ticket_ratings) ? t.ticket_ratings.length > 0 : !!t.ticket_ratings) && t.user_id === user?.id);
            if (unratedTickets.length > 0) {
              toast({ title: '⚠️ Avaliação pendente', description: `Você tem ${unratedTickets.length} ticket(s) aguardando avaliação. Avalie-os antes de abrir novos tickets.`, variant: 'destructive' });
              return;
            }
            setShowCreateDialog(true); resetCreateForm();
          }} className="flex-1 justify-center gradient-primary text-primary-foreground font-semibold sm:flex-none">
            <Plus size={16} className="mr-1" /> Novo Ticket
          </Button>
        </div>
      </div>

      {/* Search */}
        <div className="relative min-w-0 overflow-hidden">
        <Input
          placeholder="Pesquisar por código, serviço, usuário, mensagens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <XIcon size={14} />
          </button>
        )}
      </div>

      {/* Abas dos tickets abertos */}
      <TicketWorkspace
        openIds={openIds}
        activeId={activeId}
        tickets={tickets}
        onSetActive={setActiveTicket}
        onCloseTicket={closeTicket}
        onCloseAll={closeAll}
      />

      {/* Modal do histórico do ticket ativo */}
      {activeTicket && (
        <TicketDetailModal
          open={!!activeId}
          onOpenChange={(open) => {
            if (!open) clearActiveTicket();
          }}
          ticket={activeTicket}
          userName={getName(activeTicket.user_id)}
          attendantName={getName(activeTicket.attendant_id)}
          blocked={isBlockedByPriority(activeTicket)}
          canClose={canCloseTicket(activeTicket)}
          canTransfer={canTransferTicket(activeTicket)}
          canEditDevolucao={canEditDevolucaoFor(activeTicket)}
          hasDevolucaoItens={Array.isArray(activeTicket.form_data?.[DEVOLUCAO_ITENS_KEY])}
          hasFormData={!!activeTicket.form_data && Object.keys(activeTicket.form_data).length > 0}
          expectedCloseLabel={formatDateTime(calcExpectedCloseDate(activeTicket.created_at, activeTicket.services?.sla_hours).toISOString())}
          slaTooltip={(
            <span className="relative group cursor-help">
              <Info size={11} className="text-primary/70 hover:text-primary" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-popover text-popover-foreground text-[11px] leading-relaxed rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                <strong>📐 Como é calculado?</strong><br/>
                O prazo é de <strong>{activeTicket.services?.sla_hours ?? DEFAULT_SLA_HOURS}h úteis</strong> (SLA do serviço) a partir da criação do ticket.<br/><br/>
                <strong>Expediente do atendente:</strong><br/>
                {renderAttendantScheduleLines(activeTicket.attendant_id)}
                <br/>
                Somente horas dentro do expediente são contabilizadas.
              </span>
            </span>
          )}
          isMaximized={false}
          onToggleMaximize={() => {}}
          onClosePanel={clearActiveTicket}
          onRequestClose={() => requestCloseTicket(activeTicket)}
          onRequestTransfer={() => setTransferTicket(activeTicket)}
          onOpenFormData={() => { setDialogTicketId(activeTicket.id); setShowFormDataDialog(true); }}
          onOpenDevolucao={() => { setDialogTicketId(activeTicket.id); setDevolucaoEdit(true); }}
          canChangeReason={canChangeReason}
          onOpenChangeReason={() => {
            setChangeReasonValue(String(activeTicket.form_data?.[activeReasonField?.id] ?? ''));
            setChangeReasonOpen(true);
          }}
        />
      )}

      <Dialog open={changeReasonOpen} onOpenChange={setChangeReasonOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>↩️ Alterar Motivo da Devolução</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <SearchableSelect
              options={(activeReturnReasons as any[]).map((r: any) => ({ value: r.description, label: `${r.code ? r.code + ' - ' : ''}${r.description}` }))}
              value={changeReasonValue}
              onValueChange={setChangeReasonValue}
              placeholder="Selecione o motivo..."
              searchPlaceholder="Buscar motivo..."
              emptyText="Nenhum motivo encontrado"
            />
            <Button
              className="w-full gradient-primary text-primary-foreground font-semibold"
              disabled={!changeReasonValue || changeReasonMutation.isPending}
              onClick={() => changeReasonMutation.mutate(changeReasonValue)}
            >
              {changeReasonMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {isLoading ? <p className="text-center text-muted-foreground py-8">Carregando...</p> : viewMode === 'kanban' && user?.role === 'admin' ? (
        <AdminKanbanView
          tickets={filteredTickets}
          profiles={profiles}
          user={user}
          ticketsWithNewMessages={ticketsWithNewMessages}
          getName={getName}
          formatDateTime={formatDateTime}
          onOpenDetail={(id) => openTicketPanel(id)}
          onClose={(id) => { const t = tickets.find((x: any) => x.id === id); if (t) requestCloseTicket(t); else closeMutation.mutate(id); }}
          onTransfer={(ticket) => setTransferTicket(ticket)}
          onDelete={(id) => setDeleteConfirm({ open: true, id })}
          onRate={(id) => { setRatingTicketId(id); setRatingScore(0); setRatingReason(''); }}
          markTicketRead={markTicketRead}
          calcExpectedCloseDate={calcExpectedCloseDate}
          renderAttendantSchedule={renderAttendantScheduleLines}
          onTogglePriority={(id, priority) => priorityMutation.mutate({ ticketId: id, priority })}
          workSchedules={workSchedules as any[]}
          slaGoalPercent={Number(appSettings?.sla_goal_percent ?? 90)}
          ratingGoal={Number(appSettings?.rating_goal ?? 3)}
        />
      ) : (
        <div className="grid gap-3">
          {filteredTickets.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-semibold">Nenhum ticket encontrado</p>
            </div>
          )}
          {filteredTickets
            .sort((a: any, b: any) => {
              if (a.priority && !b.priority) return -1;
              if (!a.priority && b.priority) return 1;
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            })
            .map((ticket: any) => {
            const hasRating = Array.isArray(ticket.ticket_ratings) ? ticket.ticket_ratings.length > 0 : !!ticket.ticket_ratings;
            const ratingScore = Array.isArray(ticket.ticket_ratings) ? ticket.ticket_ratings[0]?.score : ticket.ticket_ratings?.score;
            const slaHours = ticket.services?.sla_hours;
            const expectedClose = calcExpectedCloseDate(ticket.created_at, slaHours);
            const tEvents = lifecycleByTicket.get(ticket.id);
            const slaStatus = getSlaStatus(ticket, workSchedules as any[], nowIsoTick, tEvents);
            const ratingGoalValue = Number(appSettings?.rating_goal ?? 3);
            const closedSlaViolated = ticket.status === 'FECHADO' && ticket.closed_at && typeof slaHours === 'number' && slaHours > 0 &&
              calcBusinessHoursOpen(ticket, tEvents, ticket.closed_at, workSchedules as any[]) > slaHours;
            const closedBySelf = ticket.status === 'FECHADO' && ticket.closed_by && ticket.closed_by === ticket.user_id;
            const ratingViolated = ticket.status === 'FECHADO' && hasRating && typeof ratingScore === 'number' && ratingScore < ratingGoalValue;
            const riskBg =
              slaStatus?.level === 'overdue' ? 'bg-red-200/60 border-red-400' :
              slaStatus?.level === 'high' ? 'bg-red-100 border-red-300' :
              slaStatus?.level === 'medium' ? 'bg-yellow-100 border-yellow-300' :
              'bg-card border-border';
            return (
              <div key={ticket.id} className={`min-w-0 rounded-xl border p-4 card-hover ${riskBg}`}>
                <div className="min-w-0 space-y-3">
                  {/* Header: code + badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">#{(ticket as any).code || ticket.id.slice(-4)}</span>
                    {ticket.status === 'ABERTO' && <span className="status-open">ABERTO</span>}
                    {ticket.status === 'FECHADO' && <span className="status-closed">FECHADO</span>}
                    {closedSlaViolated && (
                      <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1" title={`SLA do serviço: ${slaHours}h úteis`}>
                        🚨 SLA VIOLADO
                      </span>
                    )}
                    {ratingViolated && (
                      <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1" title={`Meta de avaliação: ≥ ${ratingGoalValue}`}>
                        ⚠️ AVALIAÇÃO ABAIXO DA META
                      </span>
                    )}
                    {ticket.status === 'AGUARDANDO_APROVACAO' && (
                      <span className="bg-warning/15 text-warning px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                        <Lock size={12} /> AGUARDANDO APROVAÇÃO
                      </span>
                    )}
                    {ticket.status === 'REJEITADO' && (
                      <span className="bg-destructive/15 text-destructive px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                        <XIcon size={12} /> REJEITADO
                      </span>
                    )}
                    {ticket.priority && <span className="bg-destructive/15 text-destructive px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"><AlertTriangle size={12} /> PRIORITÁRIO</span>}
                    {ticket.reopened && <span className="bg-warning/10 text-warning px-2 py-0.5 rounded-full text-xs font-semibold">REABERTO</span>}
                    {ticketsWithNewMessages.has(ticket.id) && (
                      <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">💬 Nova mensagem</span>
                    )}
                    {slaStatus && slaStatus.level === 'overdue' && (
                      <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">🚨 SLA VENCIDO</span>
                    )}
                    {slaStatus && slaStatus.level === 'high' && (
                      <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">🔴 ZONA CRÍTICA - ALTO RISCO DE VENCER SLA</span>
                    )}
                    {slaStatus && slaStatus.level === 'medium' && (
                      <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">🟡 ZONA CRÍTICA - MÉDIO RISCO DE VENCER SLA</span>
                    )}
                    {slaStatus && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                        slaStatus.level === 'overdue' ? 'bg-red-100 text-red-700' :
                        slaStatus.level === 'high' ? 'bg-red-50 text-red-700' :
                        slaStatus.level === 'medium' ? 'bg-yellow-50 text-yellow-800' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        ⏱️ {slaStatus.level === 'overdue' ? `Vencido há ${formatRemainingMinutes(slaStatus.remainingMinutes)}` : `Falta ${formatRemainingMinutes(slaStatus.remainingMinutes)} para vencer SLA`}
                      </span>
                    )}
                  </div>

                  {/* Rating badge - separate line for visibility */}
                  {hasRating && (
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${ratingViolated ? 'bg-destructive/15 text-destructive' : 'bg-accent/10 text-accent'}`}>
                      <Star size={12} fill="currentColor" /> AVALIADO - Nota {ratingScore}{ratingViolated ? ` (abaixo da meta ≥ ${ratingGoalValue})` : ''}
                    </span>
                  )}

                  {/* Service name - always visible */}
                  <p className="break-words text-sm font-medium text-foreground">{ticket.services?.name}</p>

                  {/* Users */}
                  <p className="break-words text-xs text-muted-foreground">👤 {getName(ticket.user_id)} → 🎧 {getName(ticket.attendant_id)}</p>

                  {/* User profile details */}
                  {(() => {
                    const profile = getProfile(ticket.user_id);
                    if (!profile) return null;
                    return (
                      <div className="min-w-0 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                        {profile.sector && <p>🏢 Setor: <span className="font-medium text-foreground">{profile.sector}</span></p>}
                        {profile.function && <p>💼 Função: <span className="font-medium text-foreground">{profile.function}</span></p>}
                        {profile.email && <p>✉️ E-mail: <span className="font-medium text-foreground">{profile.email}</span></p>}
                        {profile.phone && <p>📞 Contato: <span className="font-medium text-foreground">{profile.phone}</span></p>}
                        {profile.leader_name && <p>👔 Líder: <span className="font-medium text-foreground">{profile.leader_name}</span>{profile.leader_email ? ` (${profile.leader_email})` : ''}</p>}
                      </div>
                    );
                  })()}

                  {/* Dates */}
                  <div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
                    <span className="flex min-w-0 items-start gap-1 break-words"><Calendar size={12} className="mt-0.5 shrink-0" /> <span className="min-w-0 break-words">Criado: {formatDateTime(ticket.created_at)}</span></span>
                    <span className="flex min-w-0 items-start gap-1 break-words">
                      <CalendarClock size={12} className="mt-0.5 shrink-0" /> <span className="min-w-0 break-words">Prev. fechamento: {formatDateTime(expectedClose.toISOString())}</span>
                      <span className="relative group cursor-help">
                        <Info size={12} className="text-primary/70 hover:text-primary" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-popover text-popover-foreground text-[11px] leading-relaxed rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                          <strong>📐 Como é calculado?</strong><br/>
                          O prazo é de <strong>{slaHours ?? DEFAULT_SLA_HOURS}h úteis</strong> (SLA do serviço) a partir da criação do ticket.<br/><br/>
                          <strong>Expediente do atendente:</strong><br/>
                          {renderAttendantScheduleLines(ticket.attendant_id)}
                          <br/>
                          Somente horas dentro do expediente são contabilizadas.
                        </span>
                      </span>
                    </span>
                    {ticket.closed_at && <span className="flex min-w-0 items-start gap-1 break-words"><CalendarCheck size={12} className="mt-0.5 shrink-0" /> <span className="min-w-0 break-words">Fechado em: {formatDateTime(ticket.closed_at)}</span></span>}
                  </div>

                  {/* Description and last message */}
                  {(() => {
                    const summary = ticketSummaryMap.get(ticket.id);
                    if (!summary?.description && !summary?.lastMessage) return null;
                    return (
                      <div className="min-w-0 space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                        {summary.description && (
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground mb-0.5">📝 Descrição:</p>
                            <p className="whitespace-pre-wrap break-words text-muted-foreground">{summary.description}</p>
                          </div>
                        )}
                        {summary.lastMessage && (
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground mb-0.5">💬 Última mensagem ({summary.lastMessage.sender_name}):</p>
                            <p className="whitespace-pre-wrap break-words text-muted-foreground"><RichText content={summary.lastMessage.content} /></p>
                          </div>
                        )}
                      </div>
                    );
                  })()}


                  {/* Priority block warning */}
                  {isBlockedByPriority(ticket) && ticket.status === 'ABERTO' && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive font-medium flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Existem tickets prioritários pendentes. Resolva-os antes de interagir com este ticket.
                    </div>
                  )}

                  {/* Action buttons - stacked on mobile */}
                  <div className="flex min-w-0 flex-wrap gap-1.5 border-t border-border/50 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openTicketPanel(ticket.id)} className="min-w-0 max-w-full text-xs">
                      <MessageSquare size={14} className="mr-1" /> Ver detalhes do ticket
                    </Button>
                    {ticket.status === 'ABERTO' && !isBlockedByPriority(ticket) && (
                      <>
                        {canCloseTicket(ticket) && (
                          <Button size="sm" variant="outline" onClick={() => requestCloseTicket(ticket)} className="min-w-0 max-w-full text-xs">
                            <XIcon size={14} className="mr-1" /> Fechar Ticket
                          </Button>
                        )}
                        {canTransferTicket(ticket) && (
                          <Button size="sm" variant="outline" onClick={() => setTransferTicket(ticket)} className="min-w-0 max-w-full text-xs">
                            <ArrowRightLeft size={14} className="mr-1" /> Transferir
                          </Button>
                        )}
                      </>

                    )}
                    {ticket.status === 'FECHADO' && !hasRating && user?.id === ticket.user_id && (
                      <Button size="sm" variant="outline" onClick={() => { setRatingTicketId(ticket.id); setRatingScore(0); setRatingReason(''); }} className="min-w-0 max-w-full text-xs">
                        <Star size={14} className="mr-1" /> Avaliar
                      </Button>
                    )}
                    {canReopenTicket(ticket) && (
                      <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate(ticket.id)} disabled={reopenMutation.isPending} className="min-w-0 max-w-full text-xs">
                        <RefreshCw size={14} className="mr-1" /> Reabrir Ticket
                      </Button>
                    )}
                    {user?.role === 'admin' && ticket.status === 'ABERTO' && (
                      <Button size="sm" variant={ticket.priority ? 'outline' : 'default'} onClick={() => priorityMutation.mutate({ ticketId: ticket.id, priority: !ticket.priority })} className={`min-w-0 max-w-full text-xs ${ticket.priority ? 'text-destructive hover:text-destructive' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                        <AlertTriangle size={14} className="mr-1" /> {ticket.priority ? 'Remover Prioridade' : 'Priorizar'}
                      </Button>
                    )}
                    {user?.role === 'admin' && (
                      <Button size="sm" variant="outline" onClick={() => setDeleteConfirm({ open: true, id: ticket.id })} className="min-w-0 max-w-full text-xs text-destructive hover:text-destructive">
                        <Trash2 size={14} className="mr-1" /> Excluir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Ticket Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={() => {}}>
        <DialogContent {...createDropHandlers} className={`${isDialogMaximized ? 'max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh]' : 'max-w-lg'} [&>button.absolute]:hidden transition-all duration-300`} onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} onFocusOutside={(e) => e.preventDefault()}>
          {isDraggingCreate && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-primary font-semibold">
                <Paperclip size={32} />
                <span>Solte para anexar</span>
              </div>
            </div>
          )}
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>🎫 Novo Ticket</DialogTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setIsDialogMaximized(prev => !prev)} className="h-8 w-8 shrink-0" title={isDialogMaximized ? 'Restaurar' : 'Maximizar'}>
                  {isDialogMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </Button>
                <Button variant="ghost" size="icon" onClick={closeCreateDialog} className="h-8 w-8 shrink-0" title="Fechar">
                  <XIcon size={16} />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {createStep === 'selectUser' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">👤 Selecione o usuário para quem deseja abrir o ticket:</p>
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {filteredUsersForTicket.map((u: any) => (
                  <button
                    key={u.user_id}
                    onClick={() => { setSelectedUserId(u.user_id); setCreateStep('selectService'); }}
                    className="w-full text-left p-3 bg-card border border-border rounded-xl hover:border-primary hover:shadow-soft transition-all"
                  >
                    <p className="text-sm font-semibold text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email} {u.sector ? `• ${u.sector}` : ''}</p>
                  </button>
                ))}
                {filteredUsersForTicket.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário encontrado.</p>
                )}
              </div>
            </div>
          )}

          {createStep === 'selectService' && (
            <div className="space-y-3">
              {selectedUserId && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm">
                  📌 Criando ticket em nome de: <strong>{ticketOwnerName}</strong>
                  <button onClick={() => { setSelectedUserId(null); setCreateStep('selectUser'); }} className="ml-2 text-xs text-primary underline">Alterar</button>
                </div>
              )}
              {canCreateOnBehalf && !selectedUserId && (
                <Button onClick={() => setCreateStep('selectUser')} variant="outline" size="sm" className="w-full text-xs font-semibold">
                  <Users size={14} className="mr-1" /> Abrir em nome de outro usuário 👤
                </Button>
              )}
              <p className="text-sm text-muted-foreground">Selecione o serviço:</p>
              <Input
                placeholder="Buscar serviço por nome ou código..."
                value={serviceSearch}
                onChange={e => setServiceSearch(e.target.value)}
              />
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {services.filter((service: any) => {
                  if (service.restricted_visibility && !isPrivilegedRole(ticketOwnerId)) return false;
                  return (
                    service.name?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                    String(service.code)?.toLowerCase().includes(serviceSearch.toLowerCase())
                  );
                }).map((service: any) => (
                  <button key={service.id} onClick={() => handleSelectService(service.id)}
                    className="w-full text-left p-3 bg-card border border-border rounded-xl hover:border-primary hover:shadow-soft transition-all">
                    <p className="text-sm font-semibold text-foreground">{service.name}</p>
                    <p className="text-xs text-muted-foreground">Código: {service.code}{service.restricted_visibility ? ' • 🔒 Somente admin/atendente' : ''}</p>
                  </button>
                ))}
              </div>

              {/* Attachments section */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><Paperclip size={14} /> Anexos (opcional)</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <FilePickerButton
                    inputId="ticket-file-input"
                    onActivate={persistCreateDraft}
                    icon={<Plus size={14} className="mr-1" />}
                    text="Adicionar arquivo"
                    className="text-xs"
                  />
                  <span className="relative group cursor-help">
                    <AlertCircle size={16} className="text-muted-foreground" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-popover text-popover-foreground text-[11px] leading-relaxed rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                      <strong>⚠️ Regras de anexo:</strong><br/>
                      📁 Tamanho máximo: <strong>10 MB</strong><br/>
                      🚫 Vídeos não são permitidos
                    </span>
                  </span>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted rounded-lg px-3 py-1.5 text-xs">
                        <span className="flex items-center gap-1 truncate"><FileIcon size={12} /> {file.name} ({formatFileSize(file.size)})</span>
                        <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><XIcon size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {createStep === 'description' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Serviço selecionado: <strong>{services.find((s: any) => s.id === selectedServiceId)?.name}</strong>
              </p>
              <div>
                <label className="text-xs font-semibold text-foreground">Descrição detalhada do ticket <span className="text-destructive">*</span></label>
                <Textarea
                  value={ticketDescription}
                  onChange={e => setTicketDescription(e.target.value)}
                  className="mt-1"
                  placeholder="Descreva detalhadamente o seu problema ou solicitação..."
                  rows={4}
                />
              </div>
              {/* Attachments */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><Paperclip size={14} /> Anexos (opcional)</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <FilePickerButton
                    inputId="ticket-file-input"
                    onActivate={persistCreateDraft}
                    icon={<Plus size={14} className="mr-1" />}
                    text="Adicionar arquivo"
                    className="text-xs"
                  />
                  <span className="relative group cursor-help">
                    <AlertCircle size={16} className="text-muted-foreground" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-popover text-popover-foreground text-[11px] leading-relaxed rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                      <strong>⚠️ Regras de anexo:</strong><br/>
                      📁 Tamanho máximo: <strong>10 MB</strong><br/>
                      🚫 Vídeos não são permitidos
                    </span>
                  </span>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted rounded-lg px-3 py-1.5 text-xs">
                        <span className="flex items-center gap-1 truncate"><FileIcon size={12} /> {file.name} ({formatFileSize(file.size)})</span>
                        <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><XIcon size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={async () => {
                  if (!ticketDescription.trim()) {
                    toast({ title: 'Descrição obrigatória', description: 'Por favor, informe uma descrição detalhada.', variant: 'destructive' });
                    return;
                  }
                  setIsProcessingStep(true);
                  // Small delay so user sees the processing state
                  await new Promise(r => setTimeout(r, 400));
                  proceedAfterDescription();
                  setIsProcessingStep(false);
                }}
                disabled={createTicketMutation.isPending || isProcessingStep}
                className="w-full gradient-primary text-primary-foreground font-semibold"
              >
                {(createTicketMutation.isPending || isProcessingStep) ? 'Processando ...' : 'Continuar →'}
              </Button>
            </div>
          )}

          {createStep === 'fillForm' && selectedServiceForm && (
            <div className="space-y-4 relative">
              {createTicketMutation.isPending && (
                <div className="absolute inset-0 z-50 -m-2 rounded-lg bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                  <Loader2 size={28} className="animate-spin text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {createStage === 'api' ? 'Consultando API...' : createStage === 'files' ? 'Enviando anexos...' : 'Criando ticket...'}
                  </p>
                  <p className="text-xs text-muted-foreground text-center px-6">
                    {createStage === 'api'
                      ? (apiAttempt && apiAttempt.current > 1
                          ? `Falha temporária — tentativa ${apiAttempt.current} de ${apiAttempt.total}...`
                          : 'Aguarde, estamos validando os dados na integração externa.')
                      : 'Por favor, não feche esta janela.'}
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">Preencha o formulário:</p>
              {selectedServiceForm.form_fields?.length ? selectedServiceForm.form_fields
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((field: any) => (
                  <div key={field.id} className={formErrors[field.id] ? '[&_input]:border-destructive [&_textarea]:border-destructive [&_button]:border-destructive' : ''}>
                    <label className="text-xs font-semibold text-foreground">{field.label} {field.required && <span className="text-destructive">*</span>}</label>
                    {field.field_type === 'textarea' ? (
                      <Textarea value={formData[field.id] || ''} onChange={e => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))} className="mt-1" />
                    ) : field.field_type === 'yesno' ? (
                      <Select value={formData[field.id] || ''} onValueChange={v => setFormData(prev => ({ ...prev, [field.id]: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SIM">SIM</SelectItem>
                          <SelectItem value="NÃO">NÃO</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : field.field_type === 'select' && field.options ? (
                      <Select value={formData[field.id] || ''} onValueChange={v => setFormData(prev => ({ ...prev, [field.id]: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {field.options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : field.field_type === 'currency' ? (
                      <CurrencyInput
                        value={formData[field.id] || ''}
                        onChange={v => setFormData(prev => ({ ...prev, [field.id]: v }))}
                        className="mt-1"
                      />
                    ) : field.field_type === 'return_reason' ? (
                      <SearchableSelect
                        value={formData[field.id] || ''}
                        onValueChange={v => setFormData(prev => ({ ...prev, [field.id]: v }))}
                        options={activeReturnReasons.map((r: any) => ({ value: r.description, label: r.description, description: `Código: ${r.code}` }))}
                        placeholder="Selecione o motivo..."
                        searchPlaceholder="Buscar motivo..."
                        emptyText="Nenhum motivo encontrado"
                        className="mt-1"
                      />
                    ) : (

                      <Input value={formData[field.id] || ''} onChange={e => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))} className="mt-1" />
                    )}
                  </div>
                )) : (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                    Este formulário está associado ao serviço, mas ainda não possui campos cadastrados.
                  </div>
                )}

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><Paperclip size={14} /> Anexos</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <FilePickerButton
                    inputId="ticket-file-input"
                    onActivate={persistCreateDraft}
                    icon={<Plus size={14} className="mr-1" />}
                    text="Adicionar arquivo"
                    className="text-xs"
                  />
                  <span className="relative group cursor-help">
                    <AlertCircle size={16} className="text-muted-foreground" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-popover text-popover-foreground text-[11px] leading-relaxed rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                      <strong>⚠️ Regras de anexo:</strong><br/>
                      📁 Tamanho máximo: <strong>10 MB</strong><br/>
                      🚫 Vídeos não são permitidos
                    </span>
                  </span>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted rounded-lg px-3 py-1.5 text-xs">
                        <span className="flex items-center gap-1 truncate"><FileIcon size={12} /> {file.name} ({formatFileSize(file.size)})</span>
                        <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80"><XIcon size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={submitFilledForm}
                disabled={createTicketMutation.isPending || isPreflighting}
                className="w-full gradient-primary text-primary-foreground font-semibold"
              >
                {createTicketMutation.isPending || isPreflighting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {createStage === 'api' ? 'Consultando API...' : createStage === 'files' ? 'Enviando anexos...' : 'Criando...'}
                  </span>
                ) : 'Criar Ticket ✅'}
              </Button>

            </div>
          )}
        </DialogContent>
      </Dialog>




      {/* Rating Dialog */}
      <Dialog open={!!ratingTicketId} onOpenChange={() => setRatingTicketId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Avaliar Ticket #{tickets.find((t: any) => t.id === ratingTicketId)?.code || ratingTicketId?.slice(-4)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(score => (
                <button key={score} onClick={() => setRatingScore(score)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                    score <= ratingScore ? 'bg-accent text-accent-foreground shadow-soft' : 'bg-muted text-muted-foreground'
                  }`}>{score}</button>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {ratingScore === 5 ? '😊 Muito Satisfeito' : ratingScore === 4 ? '🙂 Satisfeito' : ratingScore === 3 ? '😐 Parcialmente Satisfeito' : ratingScore === 2 ? '😟 Insatisfeito' : ratingScore === 1 ? '😞 Muito Insatisfeito' : 'Selecione uma nota'}
            </p>
            {ratingScore > 0 && ratingScore <= 3 && (
              <div>
                <label className="text-xs font-semibold text-destructive">Motivo da avaliação (obrigatório) *</label>
                <Textarea value={ratingReason} onChange={e => setRatingReason(e.target.value)} className="mt-1" placeholder="Descreva o motivo..." />
              </div>
            )}
            <Button onClick={() => rateMutation.mutate()} disabled={ratingScore === 0 || rateMutation.isPending} className="w-full gradient-primary text-primary-foreground font-semibold">
              {rateMutation.isPending ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={!!transferTicket} onOpenChange={() => setTransferTicket(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transferir Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger><SelectValue placeholder="Selecione o atendente" /></SelectTrigger>
              <SelectContent>
                {transferTicket && getTransferableAttendants(transferTicket).map((att: any) => (
                  <SelectItem key={att.user_id} value={att.user_id}>{att.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => transferMutation.mutate()} disabled={!transferTo || transferMutation.isPending} className="w-full gradient-primary text-primary-foreground font-semibold">
              {transferMutation.isPending ? 'Transferindo...' : 'Confirmar Transferência'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = deleteConfirm.id;
                setDeleteConfirm({ open: false, id: '' });
                deleteMutation.mutate(id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closeConfirm.open} onOpenChange={(open) => setCloseConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fechamento</AlertDialogTitle>
            <AlertDialogDescription>
              {closeConfirm.requireReason ? (
                <>
                  ⚠️ A meta de SLA <strong>não foi atingida</strong> para o ticket{closeConfirm.code ? ` #${closeConfirm.code}` : ''}.
                  <br />Informe abaixo o motivo. Esta justificativa será gravada como uma mensagem <strong>restrita</strong> do ticket.
                </>
              ) : (
                <>Tem certeza que deseja fechar o ticket{closeConfirm.code ? ` #${closeConfirm.code}` : ''}?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {closeConfirm.requireReason && (
            <Textarea
              value={closeConfirm.reason || ''}
              onChange={(e) => setCloseConfirm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Descreva o motivo pelo qual a meta de SLA não foi atingida..."
              rows={4}
              className="mt-2"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={closeConfirm.requireReason && !(closeConfirm.reason || '').trim()}
              onClick={() => {
                if (closeConfirm.requireReason && !(closeConfirm.reason || '').trim()) {
                  toast({ title: 'Justificativa obrigatória', description: 'Informe o motivo do SLA não atingido.', variant: 'destructive' });
                  return;
                }
                const id = closeConfirm.id;
                const slaReason = closeConfirm.requireReason ? (closeConfirm.reason || '').trim() : undefined;
                setCloseConfirm({ open: false, id: '' });
                closeMutation.mutate({ ticketId: id, slaReason });
              }}
            >
              Fechar Ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Form Data Dialog */}
      <Dialog open={showFormDataDialog} onOpenChange={setShowFormDataDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📝 Formulário do Ticket #{(detailTicket as any)?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {detailTicket?.form_data && typeof detailTicket.form_data === 'object' && (
              Object.entries(detailTicket.form_data as Record<string, string>).map(([fieldId, value]) => {
                const fieldLabel = detailFormFields?.form_fields?.find((f: any) => f.id === fieldId)?.label || fieldId;
                return (
                  <div key={fieldId} className="border border-border rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground">{fieldLabel}</p>
                    <p className="text-sm text-foreground mt-0.5">{value || '—'}</p>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ApiErrorDialog details={apiErrorDetails} onClose={() => setApiErrorDetails(null)} />

      {/* Etapa: informar quantidades devolvidas antes de criar o ticket */}
      <DevolucaoItensDialog
        open={!!devolucaoStep}
        itens={devolucaoStep?.itens || []}
        confirmLabel="Criar Ticket ✅"
        isSaving={createTicketMutation.isPending}
        onCancel={() => setDevolucaoStep(null)}
        onConfirm={(itens) => {
          const summary = devolucaoStep?.apiSummary ?? null;
          setDevolucaoStep(null);
          createTicketMutation.mutate({
            serviceId: selectedServiceId,
            formValues: formData,
            files: attachments,
            description: ticketDescription,
            preApiSummary: summary,
            devolucaoItens: itens,
          });
        }}
      />

      {/* Correção das quantidades devolvidas pelo atendente/admin */}
      <DevolucaoItensDialog
        open={devolucaoEdit}
        itens={detailDevolucaoItens}
        confirmLabel="Salvar correção"
        readOnly={!canEditDevolucao}
        isSaving={updateDevolucaoMutation.isPending}
        onCancel={() => setDevolucaoEdit(false)}
        onConfirm={(itens) => updateDevolucaoMutation.mutate(itens)}
      />

    </div>
  );
};

export default TicketsList;
