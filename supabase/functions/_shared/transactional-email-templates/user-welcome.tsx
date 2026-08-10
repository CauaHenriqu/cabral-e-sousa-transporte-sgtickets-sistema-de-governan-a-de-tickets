import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Transporte - SGTickets - TI"

interface Props {
  userName?: string
  userEmail?: string
  userPassword?: string
  roleName?: string
  loginUrl?: string
}

const DEFAULT_LOGIN_URL = 'https://cabralesousa.sgtickets.app'

const roleLabel = (role?: string) => {
  switch (role) {
    case 'admin': return 'Administrador'
    case 'attendant': return 'Atendente'
    default: return 'Usuário'
  }
}

const UserWelcomeEmail = ({ userName, userEmail, userPassword, roleName, loginUrl }: Props) => {
  const url = loginUrl || DEFAULT_LOGIN_URL
  return (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>🎉 Bem-vindo(a) ao {SITE_NAME}! Seus dados de acesso estão aqui.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎉 Bem-vindo(a) ao {SITE_NAME}!</Heading>
          <Text style={subtitle}>Seu cadastro foi realizado com sucesso! 🚀</Text>
        </Section>

        <Section style={content}>
          <Text style={greeting}>Olá, {userName || 'Usuário'}! 👋</Text>
          <Text style={text}>
            Uma conta foi criada para você no <strong>{SITE_NAME}</strong> com o perfil de <strong>{roleLabel(roleName)}</strong>.
          </Text>
          <Text style={text}>
            Abaixo estão seus dados para acessar o sistema:
          </Text>

          <Section style={infoBox}>
            <Text style={infoTitle}>🔑 Dados de Acesso</Text>
            <Hr style={infoHr} />
            <Text style={infoText}>📧 <strong>E-mail:</strong> {userEmail || 'N/A'}</Text>
            <Text style={infoText}>🔒 <strong>Senha:</strong> {userPassword || '••••••••'}</Text>
            <Text style={infoText}>👤 <strong>Perfil:</strong> {roleLabel(roleName)}</Text>
          </Section>

          <Section style={{ textAlign: 'center' as const, margin: '20px 0 4px' }}>
            <Button href={url} style={ctaButton}>🔗 Acessar o Sistema</Button>
          </Section>
          <Text style={linkFallback}>
            Ou copie e cole este endereço no seu navegador:<br />
            <a href={url} style={linkStyle}>{url}</a>
          </Text>

          <Text style={warningText}>
            🔐 No seu primeiro acesso, o sistema irá solicitar <strong>obrigatoriamente</strong> a criação de uma nova senha pessoal.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>Com carinho ❤️ — Equipe {SITE_NAME} | Cabral & Sousa Ltda.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
  )
}

export const template = {
  component: UserWelcomeEmail,
  subject: '🎉 [Transporte - SGTickets - TI] Bem-vindo(a)! Seus dados de acesso',
  displayName: 'Boas-vindas ao usuário',
  previewData: { userName: 'Maria Silva', userEmail: 'maria@example.com', userPassword: 'Senha@123', roleName: 'user', loginUrl: DEFAULT_LOGIN_URL },
} satisfies TemplateEntry

const main = { backgroundColor: '#F3F4F6', fontFamily: "'Nunito', Arial, sans-serif", padding: '40px 20px' }
const container = { width: '100%', maxWidth: '580px', margin: '0 auto', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' as const, backgroundColor: '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
const header = { backgroundColor: '#007096', padding: '28px 24px', textAlign: 'center' as const }
const content = { padding: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0' }
const subtitle = { fontSize: '14px', color: '#B2E0F0', margin: '8px 0 0', fontStyle: 'italic' as const }
const greeting = { fontSize: '16px', color: '#1F2937', margin: '0', fontWeight: 'bold' as const }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.7', margin: '12px 0 0' }
const infoBox = { backgroundColor: '#F0F7FF', borderRadius: '12px', padding: '16px', margin: '16px 0 0', border: '1px solid #DBEAFE' }
const infoTitle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#007096', margin: '0 0 8px' }
const infoHr = { borderColor: '#DBEAFE', margin: '10px 0' }
const infoText = { fontSize: '14px', color: '#374151', margin: '6px 0', lineHeight: '1.6' }
const warningText = { fontSize: '13px', color: '#D97706', lineHeight: '1.6', margin: '16px 0 0', padding: '10px 12px', backgroundColor: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A' }
const hr = { borderColor: '#E5E7EB', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#9CA3AF', textAlign: 'center' as const, margin: '0' }
const ctaButton = { backgroundColor: '#007096', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const linkFallback = { fontSize: '12px', color: '#6B7280', textAlign: 'center' as const, margin: '10px 0 0', lineHeight: '1.6', wordBreak: 'break-all' as const }
const linkStyle = { color: '#007096', textDecoration: 'underline' }
