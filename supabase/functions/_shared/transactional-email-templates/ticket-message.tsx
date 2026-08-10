import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
const APP_URL = 'https://cabralesousa.sgtickets.app'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Transporte - SGTickets - TI"

interface MessageItem {
  senderName: string
  content: string
  createdAt: string
  senderRole: string
  isPrivate?: boolean
}

interface Props {
  ticketCode?: string
  serviceName?: string
  senderName?: string
  messagePreview?: string
  userName?: string
  attendantName?: string
  description?: string
  createdAt?: string
  allMessages?: MessageItem[]
  isPrivate?: boolean
}

const roleLabel = (role: string) => {
  if (role === 'attendant') return '🧑‍💼 Atendente'
  if (role === 'system') return '🤖 Sistema'
  return '👤 Usuário'
}

const TicketMessageEmail = ({ ticketCode, serviceName, senderName, messagePreview, userName, attendantName, description, createdAt, allMessages, isPrivate }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{isPrivate ? `🔒 Mensagem RESTRITA no ticket #${ticketCode}` : `💬 Nova mensagem no ticket #${ticketCode} de ${senderName}!`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={isPrivate ? headerPrivate : header}>
          <Heading style={h1}>{isPrivate ? '🔒 Mensagem Restrita (Interna)' : '💬📩 Nova Mensagem!'}</Heading>
          <Text style={subtitle}>{isPrivate ? 'Visível apenas para atendentes e administradores 🛡️' : 'Tem novidade no seu ticket! 🔔'}</Text>
        </Section>

        <Section style={content}>
          <Text style={greeting}>Olá! 👋</Text>
          <Text style={text}>
            {isPrivate
              ? <>🔒 Esta é uma mensagem <strong>RESTRITA</strong> no ticket do <strong>{SITE_NAME}</strong>. O conteúdo abaixo é interno e <strong>não é visível ao usuário solicitante</strong>.</>
              : <>Psiu! 🤫 Uma nova mensagem foi adicionada ao seu ticket no <strong>{SITE_NAME}</strong>. Corre lá para conferir! 🏃‍♂️</>
            }
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>📋 Detalhes do Ticket</Text>
            <Hr style={infoHr} />
            <Text style={infoText}>🔢 <strong>Ticket:</strong> #{ticketCode}</Text>
            <Text style={infoText}>🛠️ <strong>Serviço:</strong> {serviceName || 'N/A'}</Text>
            <Text style={infoText}>👤 <strong>Solicitante:</strong> {userName || 'N/A'}</Text>
            <Text style={infoText}>🧑‍💼 <strong>Atendente:</strong> {attendantName || 'N/A'}</Text>
            {createdAt && <Text style={infoText}>📅 <strong>Aberto em:</strong> {createdAt}</Text>}
            {description && (
              <>
                <Hr style={infoHr} />
                <Text style={infoText}>📝 <strong>Descrição:</strong></Text>
                <Text style={descriptionText}>{description}</Text>
              </>
            )}
          </Section>

          <Section style={messagesSection}>
            <Text style={messagesTitle}>💬 Histórico de Mensagens</Text>
            <Hr style={infoHr} />
            {allMessages && allMessages.length > 0 ? (
              allMessages.map((msg, idx) => (
                <Section key={idx} style={msg.isPrivate ? privateMsgBox : msg.senderRole === 'system' ? systemMsgBox : msg.senderRole === 'attendant' ? attMsgBox : userMsgBox}>
                  <Text style={msgHeader}>
                    {roleLabel(msg.senderRole)} — <strong>{msg.senderName}</strong>
                    {msg.isPrivate && <span style={privateBadge}> 🔒 RESTRITA</span>}
                  </Text>
                  <Text style={msgTime}>🕐 {msg.createdAt}</Text>
                  <Text style={msgContent}>{msg.content}</Text>
                </Section>
              ))
            ) : messagePreview ? (
              <Section style={userMsgBox}>
                <Text style={msgHeader}>💬 <strong>{senderName || 'N/A'}</strong></Text>
                <Text style={msgContent}>"{messagePreview.substring(0, 300)}{(messagePreview.length || 0) > 300 ? '...' : ''}"</Text>
              </Section>
            ) : null}
          </Section>

          <Text style={motivational}>
            💙 Não deixe a conversa esfriar! Responda o mais rápido possível para manter tudo fluindo! 🌊
          </Text>

          <Section style={{ textAlign: 'center' as const, margin: '20px 0 4px' }}>
            <Button href={APP_URL} style={ctaButton}>🔗 Acessar o Sistema</Button>
          </Section>
          <Text style={linkFallback}>
            Ou copie e cole este endereço no seu navegador:<br />
            <a href={APP_URL} style={linkStyle}>{APP_URL}</a>
          </Text>

          <Hr style={hr} />
          <Text style={footer}>Com carinho ❤️ — Equipe {SITE_NAME} | Cabral & Sousa Ltda.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TicketMessageEmail,
  subject: (data: Record<string, any>) => data?.isPrivate
    ? `🔒 [Transporte - SGTickets - TI] Mensagem RESTRITA no ticket #${data.ticketCode || ''} (interna)`
    : `💬 [Transporte - SGTickets - TI] Nova mensagem no ticket #${data.ticketCode || ''} — Confira!`,
  displayName: 'Nova mensagem no ticket',
  previewData: {
    ticketCode: '1234',
    serviceName: 'Suporte Geral',
    senderName: 'João',
    messagePreview: '',
    userName: 'Maria',
    attendantName: 'João',
    description: 'Cadastro de usuário no Winthor',
    createdAt: '04/04/2026 22:11',
    allMessages: [
      { senderName: 'Sistema', content: '🎫 Ticket criado! Serviço: Suporte Geral.', createdAt: '04/04/2026 22:11', senderRole: 'system' },
      { senderName: 'Maria', content: 'Olá, preciso de ajuda com o cadastro.', createdAt: '04/04/2026 22:12', senderRole: 'user' },
      { senderName: 'João', content: 'Oi Maria! Já estou analisando sua solicitação. 😊', createdAt: '04/04/2026 22:15', senderRole: 'attendant' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#F3F4F6', fontFamily: "'Nunito', Arial, sans-serif", padding: '40px 20px' }
const container = { width: '100%', maxWidth: '580px', margin: '0 auto', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' as const, backgroundColor: '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
const header = { backgroundColor: '#2563EB', padding: '28px 24px', textAlign: 'center' as const }
const headerPrivate = { backgroundColor: '#D97706', padding: '28px 24px', textAlign: 'center' as const }
const content = { padding: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0' }
const subtitle = { fontSize: '14px', color: '#BFDBFE', margin: '8px 0 0', fontStyle: 'italic' as const }
const greeting = { fontSize: '16px', color: '#1F2937', margin: '0', fontWeight: 'bold' as const }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.7', margin: '12px 0 0' }
const infoBox = { backgroundColor: '#F0F7FF', borderRadius: '12px', padding: '16px', margin: '16px 0 0', border: '1px solid #DBEAFE' }
const infoTitle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#1E40AF', margin: '0 0 8px' }
const infoHr = { borderColor: '#DBEAFE', margin: '10px 0' }
const infoText = { fontSize: '14px', color: '#374151', margin: '6px 0', lineHeight: '1.6' }
const descriptionText = { fontSize: '14px', color: '#4B5563', margin: '8px 0 0', padding: '10px 12px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #E5E7EB', lineHeight: '1.6', wordBreak: 'break-word' as const }
const messagesSection = { backgroundColor: '#F9FAFB', borderRadius: '12px', padding: '16px', margin: '16px 0 0', border: '1px solid #E5E7EB' }
const messagesTitle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#1E40AF', margin: '0 0 8px' }
const userMsgBox = { backgroundColor: '#EFF6FF', borderRadius: '10px', padding: '10px 14px', margin: '12px 0 0', borderLeft: '4px solid #3B82F6' }
const attMsgBox = { backgroundColor: '#F0FDF4', borderRadius: '10px', padding: '10px 14px', margin: '12px 0 0', borderLeft: '4px solid #22C55E' }
const systemMsgBox = { backgroundColor: '#FFF7ED', borderRadius: '10px', padding: '10px 14px', margin: '12px 0 0', borderLeft: '4px solid #F59E0B' }
const privateMsgBox = { backgroundColor: '#FEF3C7', borderRadius: '10px', padding: '10px 14px', margin: '12px 0 0', borderLeft: '4px solid #D97706', border: '1px dashed #D97706' }
const privateBadge = { fontSize: '11px', fontWeight: 'bold' as const, color: '#92400E', backgroundColor: '#FDE68A', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }
const msgHeader = { fontSize: '13px', color: '#374151', margin: '0 0 2px' }
const msgTime = { fontSize: '11px', color: '#9CA3AF', margin: '0 0 6px' }
const msgContent = { fontSize: '14px', color: '#1F2937', margin: '0', lineHeight: '1.6', wordBreak: 'break-word' as const }
const motivational = { fontSize: '14px', color: '#2563EB', lineHeight: '1.7', margin: '16px 0 0', fontStyle: 'italic' as const }
const hr = { borderColor: '#E5E7EB', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', textAlign: 'center' as const, margin: '0' }
const ctaButton = { backgroundColor: '#2563EB', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const linkFallback = { fontSize: '12px', color: '#6B7280', textAlign: 'center' as const, margin: '10px 0 0', lineHeight: '1.6', wordBreak: 'break-all' as const }
const linkStyle = { color: '#2563EB', textDecoration: 'underline' }
