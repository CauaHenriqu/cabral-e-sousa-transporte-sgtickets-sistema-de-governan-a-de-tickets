import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
const APP_URL = 'https://cabralesousa.sgtickets.app'

const SITE_NAME = "Transporte - SGTickets - TI"

interface Props {
  ticketCode?: string
  serviceName?: string
  userName?: string
  approverName?: string
  createdAt?: string
  approvalUrl?: string
}

const ApprovalRequestedEmail = ({ ticketCode, serviceName, userName, approverName, createdAt, approvalUrl }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>🛂 Aprovação pendente — Ticket #{ticketCode}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🛂 Aprovação Pendente</Heading>
          <Text style={subtitle}>Sua decisão é necessária para destravar este ticket ⚡</Text>
        </Section>

        <Section style={content}>
          <Text style={greeting}>Olá{approverName ? `, ${approverName}` : ''}! 👋</Text>
          <Text style={text}>
            Um novo ticket foi aberto no <strong>{SITE_NAME}</strong> e está aguardando sua aprovação.
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>📋 Detalhes do Ticket</Text>
            <Hr style={infoHr} />
            <Text style={infoText}>🔢 <strong>Ticket:</strong> #{ticketCode}</Text>
            <Text style={infoText}>🛠️ <strong>Serviço:</strong> {serviceName || 'N/A'}</Text>
            <Text style={infoText}>👤 <strong>Solicitante:</strong> {userName || 'N/A'}</Text>
            {createdAt && <Text style={infoText}>📅 <strong>Criado em:</strong> {createdAt}</Text>}
          </Section>

          {approvalUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0 0' }}>
              <Button href={approvalUrl} style={btn}>
                Ir para Minhas Aprovações
              </Button>
            </Section>
          )}

          <Text style={motivational}>
            ⏳ Acesse o sistema para aprovar ou rejeitar a solicitação. Quanto antes, melhor!
          </Text>

          <Section style={{ textAlign: 'center' as const, margin: '20px 0 4px' }}>
            <Button href={APP_URL} style={btn}>🔗 Acessar o Sistema</Button>
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
  component: ApprovalRequestedEmail,
  subject: (data: Record<string, any>) => `🛂 [Transporte - SGTickets - TI] Aprovação pendente — Ticket #${data.ticketCode || ''}`,
  displayName: 'Aprovação solicitada',
  previewData: { ticketCode: '1234', serviceName: 'Compra de Equipamento', userName: 'Maria', approverName: 'João', createdAt: '04/04/2026 22:11', approvalUrl: 'https://app.example.com/approvals' },
} satisfies TemplateEntry

const main = { backgroundColor: '#F3F4F6', fontFamily: "'Nunito', Arial, sans-serif", padding: '40px 20px' }
const container = { width: '100%', maxWidth: '580px', margin: '0 auto', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' as const, backgroundColor: '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
const header = { backgroundColor: '#D97706', padding: '28px 24px', textAlign: 'center' as const }
const content = { padding: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0' }
const subtitle = { fontSize: '14px', color: '#FEF3C7', margin: '8px 0 0', fontStyle: 'italic' as const }
const greeting = { fontSize: '16px', color: '#1F2937', margin: '0', fontWeight: 'bold' as const }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.7', margin: '12px 0 0' }
const infoBox = { backgroundColor: '#FFFBEB', borderRadius: '12px', padding: '16px', margin: '16px 0 0', border: '1px solid #FDE68A' }
const infoTitle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#92400E', margin: '0 0 8px' }
const infoHr = { borderColor: '#FDE68A', margin: '10px 0' }
const infoText = { fontSize: '14px', color: '#374151', margin: '6px 0', lineHeight: '1.6' }
const motivational = { fontSize: '14px', color: '#B45309', lineHeight: '1.7', margin: '16px 0 0', fontStyle: 'italic' as const }
const btn = { backgroundColor: '#D97706', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' as const, fontSize: '14px', display: 'inline-block' }
const hr = { borderColor: '#E5E7EB', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', textAlign: 'center' as const, margin: '0' }
const linkFallback = { fontSize: '12px', color: '#6B7280', textAlign: 'center' as const, margin: '10px 0 0', lineHeight: '1.6', wordBreak: 'break-all' as const }
const linkStyle = { color: '#D97706', textDecoration: 'underline' }
