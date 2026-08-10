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
  attendantName?: string
  userName?: string
  description?: string
  createdAt?: string
}

const TicketCreatedEmail = ({ ticketCode, serviceName, attendantName, userName, description, createdAt }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>🎉 Oba! Seu ticket #{ticketCode} foi criado com sucesso!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎫✨ Novo Ticket Criado!</Heading>
          <Text style={subtitle}>Fique tranquilo, estamos cuidando de tudo! 💪</Text>
        </Section>

        <Section style={content}>
          <Text style={greeting}>Olá! 👋</Text>
          <Text style={text}>
            Temos uma ótima notícia! Um novo ticket foi registrado no <strong>{SITE_NAME}</strong> e nossa equipe já está de olho nele! 🔍
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>📋 Detalhes do Ticket</Text>
            <Hr style={infoHr} />
            <Text style={infoText}>🔢 <strong>Ticket:</strong> #{ticketCode}</Text>
            <Text style={infoText}>🛠️ <strong>Serviço:</strong> {serviceName || 'N/A'}</Text>
            <Text style={infoText}>👤 <strong>Solicitante:</strong> {userName || 'N/A'}</Text>
            <Text style={infoText}>🧑‍💼 <strong>Atendente:</strong> {attendantName || 'N/A'}</Text>
            {createdAt && <Text style={infoText}>📅 <strong>Data de Abertura:</strong> {createdAt}</Text>}
            {description && (
              <>
                <Hr style={infoHr} />
                <Text style={infoText}>📝 <strong>Descrição:</strong></Text>
                <Text style={descriptionText}>{description}</Text>
              </>
            )}
          </Section>

          <Text style={motivational}>
            🚀 Nossa equipe está animada para resolver isso o mais rápido possível! Acompanhe as atualizações por aqui.
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
  component: TicketCreatedEmail,
  subject: (data: Record<string, any>) => `🎫 [Transporte - SGTickets - TI] Novo ticket #${data.ticketCode || ''} criado — Estamos nessa!`,
  displayName: 'Ticket criado',
  previewData: { ticketCode: '1234', serviceName: 'Suporte Geral', attendantName: 'João', userName: 'Maria', description: 'Preciso de ajuda com cadastro de usuário', createdAt: '04/04/2026 22:11' },
} satisfies TemplateEntry

const main = { backgroundColor: '#F3F4F6', fontFamily: "'Nunito', Arial, sans-serif", padding: '40px 20px' }
const container = { width: '100%', maxWidth: '580px', margin: '0 auto', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' as const, backgroundColor: '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
const header = { backgroundColor: '#2563EB', padding: '28px 24px', textAlign: 'center' as const }
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
const motivational = { fontSize: '14px', color: '#059669', lineHeight: '1.7', margin: '16px 0 0', fontStyle: 'italic' as const }
const hr = { borderColor: '#E5E7EB', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', textAlign: 'center' as const, margin: '0' }
const ctaButton = { backgroundColor: '#2563EB', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const linkFallback = { fontSize: '12px', color: '#6B7280', textAlign: 'center' as const, margin: '10px 0 0', lineHeight: '1.6', wordBreak: 'break-all' as const }
const linkStyle = { color: '#2563EB', textDecoration: 'underline' }
