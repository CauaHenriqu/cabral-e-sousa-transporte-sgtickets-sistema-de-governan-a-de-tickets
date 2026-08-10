import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
const APP_URL = 'https://cabralesousa.sgtickets.app'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Transporte - SGTickets - TI"

interface Props {
  ticketCode?: string
  serviceName?: string
  closedBy?: string
  userName?: string
  attendantName?: string
  description?: string
  createdAt?: string
  closedAt?: string
}

const TicketClosedEmail = ({ ticketCode, serviceName, closedBy, userName, attendantName, description, createdAt, closedAt }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>✅ Ticket #{ticketCode} finalizado com sucesso! Missão cumprida!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎉✅ Ticket Finalizado!</Heading>
          <Text style={subtitle}>Missão cumprida com sucesso! 🏆</Text>
        </Section>

        <Section style={content}>
          <Text style={greeting}>Olá! 👋</Text>
          <Text style={text}>
            Ótima notícia! 🥳 O ticket abaixo foi <strong>fechado</strong> no <strong>{SITE_NAME}</strong>. Mais uma demanda resolvida pela nossa equipe incrível!
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>📋 Detalhes do Ticket</Text>
            <Hr style={infoHr} />
            <Text style={infoText}>🔢 <strong>Ticket:</strong> #{ticketCode}</Text>
            <Text style={infoText}>🛠️ <strong>Serviço:</strong> {serviceName || 'N/A'}</Text>
            <Text style={infoText}>👤 <strong>Solicitante:</strong> {userName || 'N/A'}</Text>
            <Text style={infoText}>🧑‍💼 <strong>Atendente:</strong> {attendantName || 'N/A'}</Text>
            <Text style={infoText}>🔒 <strong>Fechado por:</strong> {closedBy || 'N/A'}</Text>
            {createdAt && <Text style={infoText}>📅 <strong>Aberto em:</strong> {createdAt}</Text>}
            {closedAt && <Text style={infoText}>🏁 <strong>Fechado em:</strong> {closedAt}</Text>}
            {description && (
              <>
                <Hr style={infoHr} />
                <Text style={infoText}>📝 <strong>Descrição:</strong></Text>
                <Text style={descriptionText}>{description}</Text>
              </>
            )}
          </Section>

          <Text style={motivational}>
            💚 Ficou satisfeito com o atendimento? Não esqueça de avaliar o ticket! Sua opinião nos ajuda a melhorar cada vez mais! ⭐
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
  component: TicketClosedEmail,
  subject: (data: Record<string, any>) => `✅ [Transporte - SGTickets - TI] Ticket #${data.ticketCode || ''} fechado — Missão cumprida!`,
  displayName: 'Ticket fechado',
  previewData: { ticketCode: '1234', serviceName: 'Suporte Geral', closedBy: 'João', userName: 'Maria', attendantName: 'João', description: 'Cadastro de usuário no Winthor', createdAt: '04/04/2026 22:11', closedAt: '05/04/2026 10:30' },
} satisfies TemplateEntry

const main = { backgroundColor: '#F3F4F6', fontFamily: "'Nunito', Arial, sans-serif", padding: '40px 20px' }
const container = { width: '100%', maxWidth: '580px', margin: '0 auto', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' as const, backgroundColor: '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
const header = { backgroundColor: '#16A34A', padding: '28px 24px', textAlign: 'center' as const }
const content = { padding: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0' }
const subtitle = { fontSize: '14px', color: '#BBF7D0', margin: '8px 0 0', fontStyle: 'italic' as const }
const greeting = { fontSize: '16px', color: '#1F2937', margin: '0', fontWeight: 'bold' as const }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.7', margin: '12px 0 0' }
const infoBox = { backgroundColor: '#F0FFF4', borderRadius: '12px', padding: '16px', margin: '16px 0 0', border: '1px solid #BBF7D0' }
const infoTitle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#166534', margin: '0 0 8px' }
const infoHr = { borderColor: '#BBF7D0', margin: '10px 0' }
const infoText = { fontSize: '14px', color: '#374151', margin: '6px 0', lineHeight: '1.6' }
const descriptionText = { fontSize: '14px', color: '#4B5563', margin: '8px 0 0', padding: '10px 12px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #E5E7EB', lineHeight: '1.6', wordBreak: 'break-word' as const }
const motivational = { fontSize: '14px', color: '#7C3AED', lineHeight: '1.7', margin: '16px 0 0', fontStyle: 'italic' as const }
const hr = { borderColor: '#E5E7EB', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', textAlign: 'center' as const, margin: '0' }
const ctaButton = { backgroundColor: '#16A34A', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const linkFallback = { fontSize: '12px', color: '#6B7280', textAlign: 'center' as const, margin: '10px 0 0', lineHeight: '1.6', wordBreak: 'break-all' as const }
const linkStyle = { color: '#16A34A', textDecoration: 'underline' }
