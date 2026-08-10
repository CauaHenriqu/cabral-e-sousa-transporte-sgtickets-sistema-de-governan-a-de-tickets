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
  userName?: string
  approverNames?: string
  createdAt?: string
}

const ApprovalPendingInfoEmail = ({ ticketCode, serviceName, userName, approverNames, createdAt }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>⏳ Ticket #{ticketCode} aguardando aprovação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>⏳ Aguardando Aprovação</Heading>
          <Text style={subtitle}>Seu ticket entrou no fluxo de aprovação 📋</Text>
        </Section>

        <Section style={content}>
          <Text style={greeting}>Olá! 👋</Text>
          <Text style={text}>
            Um ticket foi aberto no <strong>{SITE_NAME}</strong> e precisa de aprovação antes de seguir para o atendimento.
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>📋 Detalhes do Ticket</Text>
            <Hr style={infoHr} />
            <Text style={infoText}>🔢 <strong>Ticket:</strong> #{ticketCode}</Text>
            <Text style={infoText}>🛠️ <strong>Serviço:</strong> {serviceName || 'N/A'}</Text>
            <Text style={infoText}>👤 <strong>Solicitante:</strong> {userName || 'N/A'}</Text>
            {createdAt && <Text style={infoText}>📅 <strong>Criado em:</strong> {createdAt}</Text>}
            {approverNames && <Text style={infoText}>🛂 <strong>Aprovador(es):</strong> {approverNames}</Text>}
          </Section>

          <Text style={motivational}>
            🔔 Você será avisado assim que houver uma decisão.
          </Text>

          <Section style={{ textAlign: 'center' as const, margin: '20px 0 4px' }}>
            <Button href={APP_URL} style={ctaButton}>🔗 Acessar o Sistema</Button>
          </Section>
          <Text style={linkFallback}>
            Ou copie e cole este endereço no seu navegador:<br />
            <a href={APP_URL} style={linkStyle}>{APP_URL}</a>
          </Text>

          <Hr style={hr} />
          <Text style={footer}>Equipe {SITE_NAME} | Cabral & Sousa Ltda.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ApprovalPendingInfoEmail,
  subject: (data: Record<string, any>) => `⏳ [Transporte - SGTickets - TI] Ticket #${data.ticketCode || ''} aguardando aprovação`,
  displayName: 'Aguardando aprovação (informativo)',
  previewData: { ticketCode: '1234', serviceName: 'Compra de Equipamento', userName: 'Maria', approverNames: 'João, Pedro', createdAt: '04/04/2026 22:11' },
} satisfies TemplateEntry

const main = { backgroundColor: '#F3F4F6', fontFamily: "'Nunito', Arial, sans-serif", padding: '40px 20px' }
const container = { width: '100%', maxWidth: '580px', margin: '0 auto', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' as const, backgroundColor: '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
const header = { backgroundColor: '#6366F1', padding: '28px 24px', textAlign: 'center' as const }
const content = { padding: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0' }
const subtitle = { fontSize: '14px', color: '#E0E7FF', margin: '8px 0 0', fontStyle: 'italic' as const }
const greeting = { fontSize: '16px', color: '#1F2937', margin: '0', fontWeight: 'bold' as const }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.7', margin: '12px 0 0' }
const infoBox = { backgroundColor: '#EEF2FF', borderRadius: '12px', padding: '16px', margin: '16px 0 0', border: '1px solid #C7D2FE' }
const infoTitle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#3730A3', margin: '0 0 8px' }
const infoHr = { borderColor: '#C7D2FE', margin: '10px 0' }
const infoText = { fontSize: '14px', color: '#374151', margin: '6px 0', lineHeight: '1.6' }
const motivational = { fontSize: '14px', color: '#4338CA', lineHeight: '1.7', margin: '16px 0 0', fontStyle: 'italic' as const }
const hr = { borderColor: '#E5E7EB', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', textAlign: 'center' as const, margin: '0' }
const ctaButton = { backgroundColor: '#6366F1', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const linkFallback = { fontSize: '12px', color: '#6B7280', textAlign: 'center' as const, margin: '10px 0 0', lineHeight: '1.6', wordBreak: 'break-all' as const }
const linkStyle = { color: '#6366F1', textDecoration: 'underline' }
