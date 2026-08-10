import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendTicketCreatedEmails, sendTicketMessageEmails } from '@/lib/ticketEmails';
import { logAction } from '@/lib/logAction';
import { preflightFormApi, FormApiError, FormApiErrorDetails } from '@/lib/triggerFormApi';
import { ApiErrorDialog } from '@/components/ApiErrorDialog';
import { RichText } from '@/components/RichText';
import { Send, ArrowLeft, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { buildFormDataLines } from '@/lib/formFormatter';

type ChatStep = 'welcome' | 'selectUser' | 'selectService' | 'fillForm' | 'chatting';

const ChatTicket: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<ChatStep>('welcome');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const canCreateOnBehalf = user?.role === 'admin' || user?.role === 'attendant';

  // Fetch all users for "on behalf" selection (only for attendants/admins)
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-for-ticket'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name, email, sector').eq('status', 'Ativo').order('name');
      if (error) throw error;
      return data;
    },
    enabled: canCreateOnBehalf,
  });

  const filteredUsers = allUsers.filter((u: any) =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const ticketOwnerId = selectedUserId || user!.id;
  const ticketOwnerName = selectedUserId
    ? allUsers.find((u: any) => u.user_id === selectedUserId)?.name || ''
    : user!.name;

  const { data: services = [] } = useQuery({
    queryKey: ['active-services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('status', 'Ativo');
      if (error) throw error;
      return data;
    },
  });

  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role');
      if (error) throw error;
      return data;
    },
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

  const visibleServices = (services as any[]).filter((s: any) => !s.restricted_visibility || isPrivilegedRole(ticketOwnerId));

  const { data: currentTicketMessages = [] } = useQuery({
    queryKey: ['ticket-messages', currentTicketId],
    queryFn: async () => {
      if (!currentTicketId) return [];
      const { data, error } = await supabase.from('ticket_messages').select('*').eq('ticket_id', currentTicketId).order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!currentTicketId,
    refetchInterval: currentTicketId ? 3000 : false,
  });

  const { data: formForService } = useQuery({
    queryKey: ['form-for-service', selectedServiceId],
    queryFn: async () => {
      if (!selectedServiceId) return null;
      const { data, error } = await supabase.from('service_forms').select('*, form_fields(*)').eq('service_id', selectedServiceId).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedServiceId,
  });

  // Check for unrated tickets
  const { data: unratedTickets = [] } = useQuery({
    queryKey: ['unrated-tickets'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_ratings(id)')
        .eq('user_id', user.id)
        .eq('status', 'FECHADO');
      if (error) throw error;
      return (data || []).filter((t: any) => Array.isArray(t.ticket_ratings) ? t.ticket_ratings.length === 0 : !t.ticket_ratings);
    },
  });

  useEffect(() => {
    if (unratedTickets.length > 0) {
      toast({ title: '⭐ Avaliação pendente!', description: `Você tem ${unratedTickets.length} ticket(s) aguardando avaliação.` });
    }
  }, [unratedTickets.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentTicketMessages]);

  const handleSelectService = (serviceId: string) => {
    const sv = (services as any[]).find((s) => s.id === serviceId);
    if (sv?.restricted_visibility && !isPrivilegedRole(ticketOwnerId)) {
      toast({
        title: 'Serviço restrito',
        description: 'Este serviço só pode ser usado em tickets de administradores ou atendentes. Selecione outro solicitante.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedServiceId(serviceId);
  };

  useEffect(() => {
    if (selectedServiceId && formForService !== undefined) {
      if (formForService && formForService.form_fields && formForService.form_fields.length > 0) {
        setStep('fillForm');
      } else if (selectedServiceId) {
        createTicket(selectedServiceId, {});
      }
    }
  }, [formForService, selectedServiceId]);

  const [createStage, setCreateStage] = useState<'idle' | 'api' | 'ticket'>('idle');
  const [apiAttempt, setApiAttempt] = useState<{ current: number; total: number } | null>(null);
  const [apiErrorDetails, setApiErrorDetails] = useState<FormApiErrorDetails | null>(null);

  const createTicketMutation = useMutation({
    mutationFn: async ({ serviceId, formValues }: { serviceId: string; formValues: Record<string, string> }) => {
      setCreateStage('ticket');
      // Find active attendants for this service (via SECURITY DEFINER RPC to bypass profiles RLS for common users)
      const { data: activeAtt, error: attErr } = await supabase.rpc('get_active_attendants_for_service', { _service_id: serviceId });
      if (attErr) throw attErr;
      const attIds = (activeAtt || []).map((r: any) => r.attendant_id);
      if (attIds.length === 0) throw new Error('Nenhum atendente ativo disponível para este serviço.');

      const { data: openTickets } = await supabase.from('tickets').select('attendant_id').eq('status', 'ABERTO').in('attendant_id', attIds);

      const counts: Record<string, number> = {};
      attIds.forEach(id => { counts[id] = 0; });
      openTickets?.forEach((t: any) => { counts[t.attendant_id] = (counts[t.attendant_id] || 0) + 1; });

      const chosenId = attIds.reduce((a, b) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);

      // Integração de API do formulário: se falhar, o ticket NÃO é criado.
      let apiSummary: string | null = null;
      if (Object.keys(formValues).length > 0) {
        setCreateStage('api');
        try {
          const apiResult = await preflightFormApi(serviceId, formValues, (current, total) => setApiAttempt({ current, total }));
          if (!apiResult.skipped) apiSummary = apiResult.summary ?? null;
        } finally {
          setApiAttempt(null);
          setCreateStage('ticket');
        }
      }

      // Create ticket
      const { data: ticket, error } = await supabase.from('tickets').insert({
        user_id: ticketOwnerId,
        attendant_id: chosenId,
        service_id: serviceId,
        form_data: Object.keys(formValues).length > 0 ? formValues : null,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;

      // Get attendant name
      const { data: attProfile } = await supabase.from('profiles').select('name').eq('user_id', chosenId).single();
      const service = services.find(s => s.id === serviceId);

      // Motivo da devolução selecionado no formulário (se houver)
      const rrField = ((formForService?.form_fields || []) as any[]).find((f: any) => f.field_type === 'return_reason');
      const rrValue = rrField ? (formValues[rrField.id] || '').trim() : '';
      const onBehalfNote = ticketOwnerId !== user!.id ? `\n📌 **Criado por:** ${user!.name} em nome de ${ticketOwnerName}` : '';

      const formDataLines = buildFormDataLines(((formForService?.form_fields || []) as any[]), formValues);
      const hasForm = formDataLines.length > 0;
      const returnReasonNote = !hasForm && rrValue ? `\n↩️ **Motivo da Devolução:** ${rrValue}` : '';

      // Add system message
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_name: 'Sistema',
        sender_role: 'system',
        content: [
          `🎫 **Ticket criado!**`,
          ``,
          `🛠️ **Serviço:** ${service?.name || '—'}`,
          `👨‍💼 **Atendente designado:** ${attProfile?.name || 'N/A'}${returnReasonNote}${onBehalfNote}`,
          ...formDataLines,
        ].join('\n'),
      });

      if (apiSummary) {
        await supabase.from('ticket_messages').insert({
          ticket_id: ticket.id,
          sender_name: 'Sistema',
          sender_role: 'system',
          content: apiSummary,
          is_private: false,
        });
      }


      return { ticket, service, attProfile, chosenId };
    },
    onSuccess: ({ ticket, service, attProfile, chosenId }) => {
      setCurrentTicketId(ticket.id);
      setStep('chatting');
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticket.id] });

      toast({ title: `✅ Ticket #${ticket.code} criado com sucesso!` });
      void logAction('CREATE', 'tickets', ticket.id, `Ticket #${ticket.code} aberto via chat • Serviço: "${service?.name || '—'}" • Criado por: ${user?.name || '—'} • Em nome de: ${ticketOwnerName || '—'} • Atendente designado: ${attProfile?.name || '—'} • Data/Hora de criação: ${new Date(ticket.created_at).toLocaleString('pt-BR')}.`);
      sendTicketCreatedEmails(ticket.id, {
        ticketCode: String(ticket.code),
        serviceName: service?.name || '',
        userName: ticketOwnerName,
        attendantName: attProfile?.name || 'N/A',
        createdAt: new Date().toLocaleString('pt-BR'),
      }, ticketOwnerId, chosenId);
    },
    onError: (err: any) => {
      if (err instanceof FormApiError) {
        setApiErrorDetails(err.details);
        return;
      }
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
    onSettled: () => { setCreateStage('idle'); setApiAttempt(null); },
  });

  const createTicket = (serviceId: string, formValues: Record<string, string>) => {
    createTicketMutation.mutate({ serviceId, formValues });
  };

  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const submitFilledForm = () => {
    if (createTicketMutation.isPending) return;
    const fields = ((formForService as any)?.form_fields || []) as any[];
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
    createTicket(selectedServiceId, formData);
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('ticket_messages').insert({
        ticket_id: currentTicketId!,
        sender_id: user!.id,
        sender_name: user!.name,
        sender_role: user!.role === 'attendant' ? 'attendant' : 'user',
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', currentTicketId] });
      setMessageInput('');
    },
  });

  const sendMessage = () => {
    if (!messageInput.trim() || !currentTicketId) return;
    sendMessageMutation.mutate(messageInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const resetChat = () => {
    setStep('welcome');
    setCurrentTicketId(null);
    setSelectedServiceId('');
    setFormData({});
    setSelectedUserId(null);
    setUserSearch('');
  };

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="bg-card border border-border rounded-t-2xl px-4 py-3 flex items-center gap-3 shadow-card">
        {step !== 'welcome' && (
          <button onClick={resetChat} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        )}
        <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center">
          <span className="text-primary-foreground text-sm font-bold">SG</span>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Transporte - SGTickets Chat</p>
          <p className="text-[11px] text-muted-foreground">
            {step === 'chatting' ? `Ticket #${currentTicketId?.slice(-4)}` : 'Assistente virtual'}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-card/50 border-x border-border overflow-y-auto p-4 space-y-3">
        {step === 'welcome' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="chat-bubble-system max-w-[85%]">
              <p>Olá, <strong>{user?.name}</strong>! 👋😊</p>
              <p className="mt-1">Que bom ter você aqui! Como posso ajudar hoje? 👇</p>
            </div>
            {unratedTickets.length > 0 ? (
              <div className="chat-bubble-system max-w-[85%] border-l-4 border-warning">
                <p>⚠️ Você tem <strong>{unratedTickets.length}</strong> ticket(s) aguardando avaliação. Avalie-os antes de abrir novos tickets.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button onClick={() => setStep('selectService')} className="gradient-primary text-primary-foreground font-semibold">
                  Abrir novo ticket 🎫
                </Button>
                {canCreateOnBehalf && (
                  <Button onClick={() => setStep('selectUser')} variant="outline" className="font-semibold">
                    <Users size={16} className="mr-2" /> Abrir em nome de outro usuário 👤
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        )}
        {step === 'selectUser' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="chat-bubble-system max-w-[85%]">
              <p>👤 Selecione o usuário para quem deseja abrir o ticket:</p>
            </div>
            <div className="max-w-[85%] space-y-2">
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {filteredUsers.map((u: any) => (
                  <button
                    key={u.user_id}
                    onClick={() => { setSelectedUserId(u.user_id); setStep('selectService'); }}
                    className="w-full text-left p-3 bg-card border border-border rounded-xl hover:border-primary hover:shadow-soft transition-all"
                  >
                    <p className="text-sm font-semibold text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email} {u.sector ? `• ${u.sector}` : ''}</p>
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário encontrado.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'selectService' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {selectedUserId && (
              <div className="chat-bubble-system max-w-[85%] border-l-4 border-primary">
                <p>📌 Criando ticket em nome de: <strong>{ticketOwnerName}</strong></p>
              </div>
            )}
            <div className="chat-bubble-system max-w-[85%]"><p>Selecione o serviço que você precisa: 📋</p></div>
            <div className="space-y-2 max-w-[85%]">
              {visibleServices.map((service: any) => (
                <button key={service.id} onClick={() => handleSelectService(service.id)}
                  className="w-full text-left p-3 bg-card border border-border rounded-xl hover:border-primary hover:shadow-soft transition-all">
                  <p className="text-sm font-semibold text-foreground">{service.name}</p>
                  <p className="text-xs text-muted-foreground">Código: {service.code}{service.restricted_visibility ? ' • 🔒 Somente admin/atendente' : ''}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'fillForm' && formForService && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="chat-bubble-system max-w-[85%]"><p>Por favor, preencha o formulário abaixo: 📝</p></div>
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 max-w-[85%] relative">
              {createTicketMutation.isPending && (
                <div className="absolute inset-0 z-50 rounded-xl bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 size={26} className="animate-spin text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {createStage === 'api' ? 'Consultando API...' : 'Criando ticket...'}
                  </p>
                  <p className="text-xs text-muted-foreground text-center px-4">
                    {createStage === 'api'
                      ? (apiAttempt && apiAttempt.current > 1
                          ? `Falha temporária — tentativa ${apiAttempt.current} de ${apiAttempt.total}...`
                          : 'Validando os dados na integração externa.')
                      : 'Por favor, aguarde.'}
                  </p>
                </div>
              )}
              {formForService.form_fields?.map((field: any) => (
                <div key={field.id} className={formErrors[field.id] ? '[&_input]:border-destructive' : ''}>
                  <label className="text-xs font-semibold text-foreground">{field.label} {field.required && '*'}</label>
                  <Input value={formData[field.id] || ''} onChange={e => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))} className="mt-1" />
                </div>
              ))}
              <Button onClick={submitFilledForm} disabled={createTicketMutation.isPending}
                className="gradient-primary text-primary-foreground font-semibold w-full">
                {createTicketMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {createStage === 'api' ? 'Consultando API...' : 'Criando...'}
                  </span>
                ) : 'Enviar formulário ✅'}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'chatting' && (
          <>
            {currentTicketMessages.map((msg: any) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.sender_role === 'attendant' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${
                  msg.sender_role === 'user' ? 'chat-bubble-user' :
                  msg.sender_role === 'attendant' ? 'chat-bubble-attendant' :
                  'chat-bubble-system'
                }`}>
                  <p className="text-[11px] font-semibold opacity-70 mb-0.5">{msg.sender_name}</p>
                  <p className="text-sm whitespace-pre-wrap"><RichText content={msg.content} /></p>
                  <p className="text-[10px] opacity-50 mt-1 text-right">
                    {new Date(msg.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {step === 'chatting' && (
        <div className="bg-card border border-border rounded-b-2xl p-3 flex gap-2 shadow-card">
          <Input value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={handleKeyPress}
            placeholder="Digite sua mensagem..." className="flex-1" />
          <Button onClick={sendMessage} size="icon" disabled={sendMessageMutation.isPending}
            className="gradient-primary text-primary-foreground shrink-0"><Send size={18} /></Button>
        </div>
      )}
      <ApiErrorDialog details={apiErrorDetails} onClose={() => setApiErrorDetails(null)} />
    </div>
  );
};

export default ChatTicket;
