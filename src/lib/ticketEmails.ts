import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface TicketFullData {
  ticketCode: string;
  serviceName: string;
  userName: string;
  attendantName: string;
  description?: string;
  createdAt?: string;
}

async function getTicketParticipantEmails(userId: string, attendantId: string): Promise<string[]> {
  const emails: string[] = [];
  
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('email, leader_email')
    .eq('user_id', userId)
    .single();
  
  if (userProfile?.email) emails.push(userProfile.email);
  if (userProfile?.leader_email) emails.push(userProfile.leader_email);
  
  const { data: attProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('user_id', attendantId)
    .single();
  
  if (attProfile?.email) emails.push(attProfile.email);
  
  return [...new Set(emails.filter(Boolean))];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

async function getTicketFullDetails(ticketId: string, profiles: { user_id: string; name: string }[]): Promise<Partial<TicketFullData>> {
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, services(name)')
    .eq('id', ticketId)
    .single();

  if (!ticket) return {};

  const getName = (id: string) => profiles.find(p => p.user_id === id)?.name || 'N/A';

  return {
    ticketCode: String(ticket.code),
    serviceName: (ticket as any).services?.name || 'N/A',
    userName: getName(ticket.user_id),
    attendantName: getName(ticket.attendant_id),
    createdAt: formatDate(ticket.created_at),
  };
}

async function sendTicketEmail(
  templateName: string,
  recipientEmail: string,
  idempotencyKey: string,
  templateData: Record<string, any>
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error('Sessão inválida. Faça login novamente.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail,
        idempotencyKey,
        templateData,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Falha ao enviar e-mail (${response.status})`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody?.message || errorBody?.error || errorMessage;
      } catch {
        const text = await response.text();
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }
  } catch (err) {
    console.error(`Failed to send ${templateName} to ${recipientEmail}:`, err);
  }
}

export async function sendTicketCreatedEmails(
  ticketId: string,
  data: TicketFullData,
  userId: string,
  attendantId: string
) {
  const emails = await getTicketParticipantEmails(userId, attendantId);
  for (const email of emails) {
    await sendTicketEmail('ticket-created', email, `ticket-created-${ticketId}-${email}`, data);
  }
}

export async function sendTicketClosedEmails(
  ticketId: string,
  data: { ticketCode: string; serviceName: string; closedBy: string; userName: string; attendantName: string; description?: string; createdAt?: string; closedAt?: string },
  userId: string,
  attendantId: string
) {
  const emails = await getTicketParticipantEmails(userId, attendantId);
  for (const email of emails) {
    await sendTicketEmail('ticket-closed', email, `ticket-closed-${ticketId}-${email}`, data);
  }
}

export async function sendTicketTransferredEmails(
  ticketId: string,
  data: { ticketCode: string; serviceName: string; fromAttendant: string; toAttendant: string; userName: string; description?: string; createdAt?: string },
  userId: string,
  oldAttendantId: string,
  newAttendantId: string
) {
  const emailSet = new Set<string>();
  
  const [userProfile, oldAttProfile, newAttProfile] = await Promise.all([
    supabase.from('profiles').select('email, leader_email').eq('user_id', userId).single(),
    supabase.from('profiles').select('email').eq('user_id', oldAttendantId).single(),
    supabase.from('profiles').select('email').eq('user_id', newAttendantId).single(),
  ]);
  
  if (userProfile.data?.email) emailSet.add(userProfile.data.email);
  if (userProfile.data?.leader_email) emailSet.add(userProfile.data.leader_email);
  if (oldAttProfile.data?.email) emailSet.add(oldAttProfile.data.email);
  if (newAttProfile.data?.email) emailSet.add(newAttProfile.data.email);
  
  for (const email of emailSet) {
    if (email) await sendTicketEmail('ticket-transferred', email, `ticket-transferred-${ticketId}-${email}`, data);
  }
}

export async function sendTicketRatedEmails(
  ticketId: string,
  data: { ticketCode: string; serviceName: string; score: number; reason?: string; ratedBy: string; userName: string; attendantName: string; description?: string; createdAt?: string },
  userId: string,
  attendantId: string
) {
  const emails = await getTicketParticipantEmails(userId, attendantId);
  for (const email of emails) {
    await sendTicketEmail('ticket-rated', email, `ticket-rated-${ticketId}-${email}`, data);
  }
}

export async function sendTicketMessageEmails(
  ticketId: string,
  data: { ticketCode: string; serviceName: string; senderName: string; messagePreview: string; userName?: string; attendantName?: string; description?: string; createdAt?: string },
  userId: string,
  attendantId: string,
  senderId: string
) {
  // Fetch names and ALL messages from the ticket
  const [userProfile, attProfile, messagesResult] = await Promise.all([
    supabase.from('profiles').select('name, email, leader_email').eq('user_id', userId).single(),
    supabase.from('profiles').select('name, email').eq('user_id', attendantId).single(),
    supabase.from('ticket_messages').select('sender_name, content, created_at, sender_role, is_private').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
  ]);

  const allMessages = (messagesResult.data || []).map((m: any) => ({
    senderName: m.sender_name,
    content: m.content,
    createdAt: formatDate(m.created_at),
    senderRole: m.sender_role,
    isPrivate: !!m.is_private,
  }));

  const enrichedData = {
    ...data,
    userName: userProfile.data?.name || data.userName || 'N/A',
    attendantName: attProfile.data?.name || data.attendantName || 'N/A',
    allMessages,
  };

  const emails = await getTicketParticipantEmails(userId, attendantId);
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('user_id', senderId)
    .single();
  
  const filteredEmails = emails.filter(e => e !== senderProfile?.email);
  
  for (const email of filteredEmails) {
    await sendTicketEmail('ticket-message', email, `ticket-msg-${ticketId}-${Date.now()}-${email}`, enrichedData);
  }
}

/**
 * Envia e-mail de mensagem RESTRITA (privada) apenas para:
 * - Atendente do ticket
 * - Líder do atendente do ticket
 * - Administradores
 * Exclui: usuário dono do ticket, líder do usuário e o próprio remetente.
 */
export async function sendTicketPrivateMessageEmails(
  ticketId: string,
  data: { ticketCode: string; serviceName: string; senderName: string; messagePreview: string; userName?: string; attendantName?: string; description?: string; createdAt?: string },
  userId: string,
  attendantId: string,
  senderId: string
) {
  // Buscar nomes, mensagens (somente privadas, para contexto seguro), atendente e admins
  const [userProfile, attProfile, messagesResult, adminRolesResult, senderProfile] = await Promise.all([
    supabase.from('profiles').select('name').eq('user_id', userId).single(),
    supabase.from('profiles').select('name, email, leader_email').eq('user_id', attendantId).single(),
    supabase.from('ticket_messages').select('sender_name, content, created_at, sender_role, is_private').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    supabase.from('user_roles').select('user_id').eq('role', 'admin'),
    supabase.from('profiles').select('email').eq('user_id', senderId).single(),
  ]);

  // Filtrar apenas mensagens privadas para incluir no e-mail (não vazar mensagens públicas/conteúdo extra é ok, mas aqui foco no fluxo restrito)
  const allMessages = (messagesResult.data || [])
    .filter((m: any) => m.is_private)
    .map((m: any) => ({
      senderName: m.sender_name,
      content: m.content,
      createdAt: formatDate(m.created_at),
      senderRole: m.sender_role,
      isPrivate: true,
    }));

  const enrichedData = {
    ...data,
    userName: userProfile.data?.name || data.userName || 'N/A',
    attendantName: attProfile.data?.name || data.attendantName || 'N/A',
    allMessages,
    isPrivate: true,
  };

  // Coletar e-mails: atendente + líder do atendente + todos admins
  const recipientEmails = new Set<string>();
  if (attProfile.data?.email) recipientEmails.add(attProfile.data.email);
  if (attProfile.data?.leader_email) recipientEmails.add(attProfile.data.leader_email);

  const adminIds = (adminRolesResult.data || []).map((r: any) => r.user_id).filter(Boolean);
  if (adminIds.length > 0) {
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('user_id', adminIds);
    (adminProfiles || []).forEach((p: any) => { if (p.email) recipientEmails.add(p.email); });
  }

  // Excluir o remetente
  if (senderProfile.data?.email) recipientEmails.delete(senderProfile.data.email);

  for (const email of recipientEmails) {
    await sendTicketEmail('ticket-message', email, `ticket-priv-msg-${ticketId}-${Date.now()}-${email}`, enrichedData);
  }
}

// ============================================================
// APPROVAL FLOW EMAILS
// ============================================================

interface ApprovalContext {
  ticketId: string;
  ticketCode: string;
  serviceName: string;
  userId: string;        // solicitante
  attendantId?: string;  // pode não existir ainda
  createdById?: string;  // quem efetivamente criou
}

async function getAdminEmails(): Promise<string[]> {
  const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
  const ids = (roles || []).map((r: any) => r.user_id).filter(Boolean);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase.from('profiles').select('email').in('user_id', ids);
  return (profiles || []).map((p: any) => p.email).filter(Boolean);
}

async function getProfilesByIds(ids: string[]): Promise<Array<{ user_id: string; name: string; email: string; leader_email?: string }>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('user_id, name, email, leader_email')
    .in('user_id', unique);
  return (data as any[]) || [];
}

/**
 * Envia notificações da criação de um ticket no fluxo de aprovação:
 * - 1 e-mail "approval-requested" para CADA aprovador (com link)
 * - 1 e-mail "approval-pending-info" para: solicitante, criador, líder, atendente, admins
 */
export async function sendApprovalRequestedEmails(
  ctx: ApprovalContext,
  approverIds: string[]
) {
  const profiles = await getProfilesByIds([
    ctx.userId,
    ctx.attendantId || '',
    ctx.createdById || '',
    ...approverIds,
  ]);
  const userProfile = profiles.find(p => p.user_id === ctx.userId);
  const userName = userProfile?.name || 'N/A';
  const createdAt = formatDate(new Date().toISOString());

  // 1) E-mails individuais aos aprovadores (com botão)
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const approvalUrl = `${origin}/approvals`;
  for (const approverId of approverIds) {
    const ap = profiles.find(p => p.user_id === approverId);
    if (!ap?.email) continue;
    await sendTicketEmail(
      'approval-requested',
      ap.email,
      `approval-req-${ctx.ticketId}-${approverId}`,
      {
        ticketCode: ctx.ticketCode,
        serviceName: ctx.serviceName,
        userName,
        approverName: ap.name,
        createdAt,
        approvalUrl,
      }
    );
  }

  // 2) E-mail informativo para envolvidos
  const approverNames = approverIds
    .map(id => profiles.find(p => p.user_id === id)?.name)
    .filter(Boolean)
    .join(', ');

  const infoEmails = new Set<string>();
  if (userProfile?.email) infoEmails.add(userProfile.email);
  if (userProfile?.leader_email) infoEmails.add(userProfile.leader_email);
  if (ctx.attendantId) {
    const att = profiles.find(p => p.user_id === ctx.attendantId);
    if (att?.email) infoEmails.add(att.email);
  }
  if (ctx.createdById && ctx.createdById !== ctx.userId) {
    const creator = profiles.find(p => p.user_id === ctx.createdById);
    if (creator?.email) infoEmails.add(creator.email);
  }
  const adminEmails = await getAdminEmails();
  adminEmails.forEach(e => infoEmails.add(e));

  for (const email of infoEmails) {
    await sendTicketEmail(
      'approval-pending-info',
      email,
      `approval-info-${ctx.ticketId}-${email}`,
      {
        ticketCode: ctx.ticketCode,
        serviceName: ctx.serviceName,
        userName,
        approverNames,
        createdAt,
      }
    );
  }
}

/**
 * Envia notificações pós-decisão (aprovado ou rejeitado) para TODOS os envolvidos:
 * solicitante, criador, atendente, líder, admins, demais aprovadores.
 */
export async function sendApprovalDecisionEmails(
  ctx: ApprovalContext,
  decision: 'APROVADO' | 'REJEITADO',
  decidedBy: { id: string; name: string },
  reason: string | undefined,
  allApproverIds: string[]
) {
  const profiles = await getProfilesByIds([
    ctx.userId,
    ctx.attendantId || '',
    ctx.createdById || '',
    ...allApproverIds,
  ]);
  const userProfile = profiles.find(p => p.user_id === ctx.userId);
  const userName = userProfile?.name || 'N/A';
  const attendantName = ctx.attendantId
    ? profiles.find(p => p.user_id === ctx.attendantId)?.name || 'N/A'
    : 'N/A';
  const decidedAt = formatDate(new Date().toISOString());

  const recipients = new Set<string>();
  if (userProfile?.email) recipients.add(userProfile.email);
  if (userProfile?.leader_email) recipients.add(userProfile.leader_email);
  if (ctx.attendantId) {
    const att = profiles.find(p => p.user_id === ctx.attendantId);
    if (att?.email) recipients.add(att.email);
  }
  if (ctx.createdById && ctx.createdById !== ctx.userId) {
    const creator = profiles.find(p => p.user_id === ctx.createdById);
    if (creator?.email) recipients.add(creator.email);
  }
  // Demais aprovadores (inclui o que decidiu para confirmação)
  for (const aid of allApproverIds) {
    const ap = profiles.find(p => p.user_id === aid);
    if (ap?.email) recipients.add(ap.email);
  }
  const adminEmails = await getAdminEmails();
  adminEmails.forEach(e => recipients.add(e));

  const templateName = decision === 'APROVADO' ? 'approval-approved' : 'approval-rejected';
  const idemPrefix = decision === 'APROVADO' ? 'approval-approved' : 'approval-rejected';

  for (const email of recipients) {
    const data: Record<string, any> = {
      ticketCode: ctx.ticketCode,
      serviceName: ctx.serviceName,
      userName,
      decidedAt,
    };
    if (decision === 'APROVADO') {
      data.attendantName = attendantName;
      data.approvedBy = decidedBy.name;
    } else {
      data.rejectedBy = decidedBy.name;
      data.reason = reason || '';
    }
    await sendTicketEmail(
      templateName,
      email,
      `${idemPrefix}-${ctx.ticketId}-${email}`,
      data
    );
  }
}

