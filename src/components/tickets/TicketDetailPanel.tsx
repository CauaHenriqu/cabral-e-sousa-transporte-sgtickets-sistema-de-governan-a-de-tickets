import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, Calendar, CalendarCheck, CalendarClock, ChevronDown, ChevronUp, Download, FileIcon, FileText, Lock, Maximize2, Minimize2, Paperclip, RotateCcw, Send, X as XIcon } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichText } from '@/components/RichText';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { clearDraftFiles, loadDraftFiles, saveDraftFiles } from '@/lib/attachmentDraftStore';
import { sendTicketMessageEmails, sendTicketPrivateMessageEmails } from '@/lib/ticketEmails';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const sanitizeFileName = (name: string) => {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : '';
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  return `${clean(base) || 'arquivo'}${clean(ext)}`;
};

export type TicketDetailPanelProps = {
  attendantName: string;
  blocked: boolean;
  canClose: boolean;
  canEditDevolucao: boolean;
  canChangeReason?: boolean;
  onOpenChangeReason?: () => void;
  canTransfer: boolean;
  className?: string;
  expectedCloseLabel: string;
  hasDevolucaoItens: boolean;
  hasFormData: boolean;
  isMaximized: boolean;
  onClosePanel: () => void;
  onOpenDevolucao: () => void;
  onOpenFormData: () => void;
  onRequestClose: () => void;
  onRequestTransfer: () => void;
  onToggleMaximize: () => void;
  showCloseButton?: boolean;
  showMaximizeButton?: boolean;
  slaTooltip: React.ReactNode;
  ticket: any;
  userName: string;
};

const TicketDetailPanel: React.FC<TicketDetailPanelProps> = ({
  attendantName,
  blocked,
  canClose,
  canEditDevolucao,
  canChangeReason = false,
  onOpenChangeReason,
  canTransfer,
  className,
  expectedCloseLabel,
  hasDevolucaoItens,
  hasFormData,
  isMaximized,
  onClosePanel,
  onOpenDevolucao,
  onOpenFormData,
  onRequestClose,
  onRequestTransfer,
  onToggleMaximize,
  showCloseButton = true,
  showMaximizeButton = true,
  slaTooltip,
  ticket,
  userName,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const ticketId: string = ticket.id;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputId = `chat-file-input-${ticketId}`;

  const draftKeyBase = user?.id ? `sgtickets:${user.id}:ticket:${ticketId}` : null;
  const textDraftKey = draftKeyBase ? `${draftKeyBase}:message` : null;
  const filesDraftKey = draftKeyBase ? `${draftKeyBase}:files` : null;

  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isPrivateMessage, setIsPrivateMessage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);

  const [restored, setRestored] = useState(false);
  const dragCounter = useRef(0);

  const canSendPrivate = user?.role === 'admin' || user?.role === 'attendant';
  const isOpenStatus = ticket.status === 'ABERTO';

  // Restaura rascunho do ticket
  useEffect(() => {
    let cancelled = false;
    setRestored(false);
    try {
      const saved = textDraftKey ? window.localStorage.getItem(textDraftKey) : null;
      setMessageInput(saved || '');
    } catch {
      setMessageInput('');
    }
    void loadDraftFiles(filesDraftKey).then((files) => {
      if (!cancelled) {
        setAttachments(files);
        setRestored(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textDraftKey, filesDraftKey]);

  // Persiste rascunho
  useEffect(() => {
    if (!textDraftKey || !restored) return;
    try {
      if (messageInput) window.localStorage.setItem(textDraftKey, messageInput);
      else window.localStorage.removeItem(textDraftKey);
    } catch {
      // ignora
    }
  }, [messageInput, restored, textDraftKey]);

  useEffect(() => {
    if (!filesDraftKey || !restored) return;
    void saveDraftFiles(filesDraftKey, attachments);
  }, [attachments, filesDraftKey, restored]);

  const { data: messages = [] } = useQuery({
    queryKey: ['ticket-detail-messages', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at');
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  const { data: ticketAttachments = [] } = useQuery({
    queryKey: ['ticket-attachments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_attachments').select('*').eq('ticket_id', ticketId).order('created_at');
      if (error) throw error;
      const withUrls = await Promise.all(
        (data || []).map(async (att: any) => {
          const { data: urlData } = await supabase.storage.from('ticket-attachments').createSignedUrl(att.file_path, 3600);
          return { ...att, signedUrl: urlData?.signedUrl || '' };
        }),
      );
      return withUrls;
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const appendFiles = (selected: File[]) => {
    if (selected.length === 0) return;
    const valid: File[] = [];
    for (const file of selected) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'Arquivo muito grande', description: `"${file.name}" excede o limite de 10 MB.`, variant: 'destructive' });
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) setAttachments((prev) => [...prev, ...valid]);
  };

  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      const filePath = `${ticketId}/${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(filePath, file);
      if (uploadError) {
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
        toast({ title: 'Erro ao registrar anexo', description: `${file.name}: ${insertError.message}`, variant: 'destructive' });
      }
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, isPrivate }: { content: string; isPrivate: boolean }) => {
      const { error } = await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: user!.id,
        sender_name: user!.name,
        sender_role: user!.role === 'attendant' || user!.role === 'admin' ? 'attendant' : 'user',
        content,
        is_private: isPrivate,
      });
      if (error) throw error;

      if (attachments.length > 0) {
        await uploadFiles(attachments);
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          sender_name: 'Sistema',
          sender_role: 'system',
          content: `📎 ${attachments.length} anexo(s): ${attachments.map((f) => f.name).join(', ')}`,
          is_private: isPrivate,
        });
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-detail-messages', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-attachments', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-messages-summary'] });
      void clearDraftFiles(filesDraftKey);

      const payload = {
        ticketCode: String(ticket.code),
        serviceName: ticket.services?.name || '',
        senderName: user!.name,
        messagePreview: vars.content,
        userName,
        attendantName,
        createdAt: new Date(ticket.created_at).toLocaleString('pt-BR'),
      };
      if (vars.isPrivate) {
        sendTicketPrivateMessageEmails(ticketId, payload, ticket.user_id, ticket.attendant_id, user!.id);
      } else {
        sendTicketMessageEmails(ticketId, payload, ticket.user_id, ticket.attendant_id, user!.id);
      }

      setMessageInput('');
      setAttachments([]);
      setIsPrivateMessage(false);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e?.message || 'Falha ao enviar mensagem.', variant: 'destructive' }),
  });

  const sendMessage = () => {
    if (!messageInput.trim() && attachments.length === 0) return;
    sendMessageMutation.mutate({ content: messageInput || '📎 Anexo(s) enviado(s)', isPrivate: canSendPrivate && isPrivateMessage });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const dropEnabled = isOpenStatus && !blocked;

  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!dropEnabled || !e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current += 1;
      setIsDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!dropEnabled || !e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!dropEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!dropEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      appendFiles(Array.from(e.dataTransfer?.files || []));
    },
  };

  return (
    <div
      {...dropHandlers}
      className={cn(
        'relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border-2 border-primary/30 bg-card shadow-[0_0_20px_rgba(70,140,190,0.12)] ring-1 ring-primary/10',
        isMaximized ? 'h-[80vh]' : 'h-[70vh]',
        className,
      )}
    >
      <input
        id={inputId}
        type="file"
        multiple
        accept="image/*,application/*,text/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.csv,.txt"
        onChange={(e) => {
          appendFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
        aria-label="Selecionar anexo do chat"
        className="sr-only"
      />

      {isDragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
          <div className="flex flex-col items-center gap-2 font-semibold text-primary">
            <Paperclip size={28} />
            <span>Solte para anexar ao ticket</span>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="border-b-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-3">
        <div className="flex items-start justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHeaderOpen((v) => !v)}
            className="h-7 w-7 shrink-0"
            title={headerOpen ? 'Ocultar detalhes' : 'Mostrar detalhes'}
            aria-expanded={headerOpen}
          >
            {headerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm font-bold">Ticket #{ticket.code} · {ticket.services?.name || ''}</p>
          <div className="flex shrink-0 items-center gap-1">
            {showMaximizeButton && (
              <Button variant="ghost" size="icon" onClick={onToggleMaximize} className="h-7 w-7" title={isMaximized ? 'Restaurar' : 'Maximizar'}>
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </Button>
            )}
            {showCloseButton && (
              <Button variant="ghost" size="icon" onClick={onClosePanel} className="h-7 w-7" title="Fechar painel">
                <XIcon size={16} />
              </Button>
            )}
          </div>
        </div>


        {headerOpen && (
          <>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar size={11} /> Criado: {formatDateTime(ticket.created_at)}</span>
              <span className="flex items-center gap-1">
                <CalendarClock size={11} /> Prev: {expectedCloseLabel}
                {slaTooltip}
              </span>
              {ticket.closed_at && <span className="flex items-center gap-1"><CalendarCheck size={11} /> Fechado: {formatDateTime(ticket.closed_at)}</span>}
              {ticket.status === 'ABERTO' && <span className="status-open">ABERTO</span>}
              {ticket.status === 'FECHADO' && <span className="status-closed">FECHADO</span>}
              {ticket.status === 'AGUARDANDO_APROVACAO' && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">⏳ AGUARDANDO APROVAÇÃO</span>
              )}
              {ticket.status === 'REJEITADO' && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">❌ REJEITADO</span>
              )}
              <span className="flex items-center gap-1">👤 {userName}</span>
              <span className="flex items-center gap-1">🎧 {attendantName}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {hasFormData && (
                <Button size="sm" variant="outline" onClick={onOpenFormData} className="h-7 text-xs">
                  <FileText size={13} className="mr-1" /> Ver Formulário
                </Button>
              )}
              {hasDevolucaoItens && canEditDevolucao && (
                <Button size="sm" variant="outline" onClick={onOpenDevolucao} className="h-7 text-xs">
                  <FileText size={13} className="mr-1" /> Produtos da Devolução
                </Button>
              )}
              {isOpenStatus && canChangeReason && onOpenChangeReason && (
                <Button size="sm" variant="outline" onClick={onOpenChangeReason} className="h-7 text-xs">
                  <RotateCcw size={13} className="mr-1" /> Alterar Motivo da Devolução
                </Button>
              )}
              {isOpenStatus && !blocked && canClose && (
                <Button size="sm" variant="outline" onClick={onRequestClose} className="h-7 text-xs">
                  <XIcon size={13} className="mr-1" /> Fechar Ticket
                </Button>
              )}
              {isOpenStatus && !blocked && canTransfer && (
                <Button size="sm" variant="outline" onClick={onRequestTransfer} className="h-7 text-xs">
                  <ArrowRightLeft size={13} className="mr-1" /> Transferir
                </Button>
              )}
            </div>
          </>
        )}
      </div>


      {/* Histórico */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages
          .filter((msg: any) => !(msg.is_private && ticket.user_id === user?.id))
          .map((msg: any) => {
            const roleLabel = msg.sender_role === 'user' ? '👤 Usuário' : msg.sender_role === 'attendant' ? '🎧 Atendente' : '⚙️ Sistema';
            const isPrivate = !!msg.is_private;
            return (
              <div key={msg.id} className={`flex ${msg.sender_role === 'attendant' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] overflow-hidden break-words rounded-xl border px-3 py-2 text-sm ${
                    isPrivate
                      ? 'bg-warning/15 text-foreground border-warning/50'
                      : msg.sender_role === 'user'
                        ? 'bg-chat-user text-chat-user-foreground border-chat-user-border'
                        : msg.sender_role === 'attendant'
                          ? 'bg-chat-attendant text-chat-attendant-foreground border-chat-attendant-border'
                          : 'bg-chat-system text-chat-system-foreground border-chat-system-border'
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <p className="text-[11px] font-bold">{msg.sender_name}</p>
                    <span className="text-[9px] opacity-60">({roleLabel})</span>
                    {isPrivate && (
                      <span className="flex items-center gap-0.5 rounded bg-warning/40 px-1.5 py-0.5 text-[9px] font-bold text-warning-foreground">
                        <Lock size={9} /> RESTRITA
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap"><RichText content={msg.content} /></p>
                  <p className="mt-1 text-right text-[10px] opacity-50">{formatDateTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })}

        {ticketAttachments.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Paperclip size={12} /> Anexos ({ticketAttachments.length})
            </p>
            <div className="space-y-1">
              {ticketAttachments.map((att: any) => (
                <a
                  key={att.id}
                  href={att.signedUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-muted/80"
                >
                  <FileIcon size={12} />
                  <span className="flex-1 truncate">{att.file_name}</span>
                  <span className="text-muted-foreground">{formatFileSize(att.file_size)}</span>
                  <Download size={12} className="text-primary" />
                </a>
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Composer */}
      {isOpenStatus && blocked && (
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
            <AlertTriangle size={14} /> Existem tickets prioritários pendentes. Resolva-os antes de interagir com este ticket.
          </div>
        </div>
      )}
      {isOpenStatus && !blocked && (
        <div className="space-y-2 border-t border-border p-3">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {attachments.map((file, i) => (
                <span key={`${file.name}-${i}`} className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                  <FileIcon size={10} /> {file.name}
                  <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-destructive" aria-label="Remover anexo">
                    <XIcon size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {canSendPrivate && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsPrivateMessage((v) => !v)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                  isPrivateMessage ? 'bg-warning/20 border-warning text-warning-foreground' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                }`}
                title="Mensagem visível apenas para administradores e atendentes do ticket"
              >
                <Lock size={12} />
                {isPrivateMessage ? 'Mensagem restrita ativada' : 'Marcar como restrita'}
              </button>
              {isPrivateMessage && <span className="text-[10px] text-muted-foreground">🔒 O usuário não verá esta mensagem</span>}
            </div>
          )}
          <div className="flex items-center gap-2">
            <label
              htmlFor={inputId}
              aria-label="Adicionar anexo"
              className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'shrink-0 cursor-pointer')}
              title="Anexar arquivo (máx. 10 MB)"
            >
              <Paperclip size={16} />
            </label>
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isPrivateMessage ? '🔒 Mensagem restrita (admin + atendente)...' : 'Digite sua mensagem...'}
              className={`flex-1 ${isPrivateMessage ? 'border-warning focus-visible:ring-warning' : ''}`}
            />
            <Button
              onClick={sendMessage}
              size="icon"
              disabled={sendMessageMutation.isPending}
              className={`shrink-0 ${isPrivateMessage ? 'bg-warning text-warning-foreground hover:bg-warning/90' : 'gradient-primary text-primary-foreground'}`}
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetailPanel;
