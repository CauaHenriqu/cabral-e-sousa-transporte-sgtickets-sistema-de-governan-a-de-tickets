import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
const APP_URL = 'https://cabralesousa.sgtickets.app'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Transporte - SGTickets - TI"

interface Props {
  meses?: string
}

const FinanceiroPendenciaEmail = ({ meses }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>⚠️ Pendência financeira identificada no {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>⚠️ Pendência Financeira</Heading>
          <Text style={subtitle}>Atenção: foi identificada uma irregularidade</Text>
        </Section>

        <Section style={content}>
          <Text style={greeting}>Olá, Administrador! 👋</Text>
          <Text style={text}>
            Foi identificada uma pendência financeira no sistema <strong>{SITE_NAME}</strong> nos seguintes meses:
          </Text>

          <Section style={infoBox}>
            <Text style={label}>Meses com pendência:</Text>
            <Text style={value}>{meses || 'N/A'}</Text>
          </Section>

          <Hr style={divider} />

          <Text style={text}>
            Por favor, verifique e regularize a situação o mais breve possível.
          </Text>

          <Section style={{ textAlign: 'center' as const, margin: '8px 0 16px' }}>
            <Button href={APP_URL} style={ctaButton}>🔗 Acessar o Sistema</Button>
          </Section>
          <Text style={linkFallback}>
            Ou copie e cole este endereço no seu navegador:<br />
            <a href={APP_URL} style={linkStyle}>{APP_URL}</a>
          </Text>

          <Text style={footer}>Atenciosamente, Equipe {SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FinanceiroPendenciaEmail,
  subject: '⚠️ Pendência Financeira Identificada - Transporte - SGTickets - TI',
  displayName: 'Pendência financeira',
  previewData: { meses: '01/2026, 02/2026' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '520px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden' as const, border: '1px solid #e5e7eb' }
const header = { backgroundColor: '#dc2626', padding: '24px', textAlign: 'center' as const }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0' }
const subtitle = { fontSize: '13px', color: '#fecaca', margin: '6px 0 0' }
const content = { padding: '24px' }
const greeting = { fontSize: '15px', color: '#1e293b', margin: '0 0 12px', fontWeight: 'bold' as const }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#fef2f2', borderRadius: '8px', padding: '16px', margin: '0 0 16px', boxSizing: 'border-box' as const }
const label = { fontSize: '11px', color: '#991b1b', textTransform: 'uppercase' as const, fontWeight: 'bold' as const, margin: '0 0 4px', letterSpacing: '0.5px' }
const value = { fontSize: '14px', color: '#1e293b', margin: '0', fontWeight: '600' as const }
const divider = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0', textAlign: 'center' as const }
const ctaButton = { backgroundColor: '#dc2626', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block' }
const linkFallback = { fontSize: '12px', color: '#64748b', textAlign: 'center' as const, margin: '10px 0 0', lineHeight: '1.6', wordBreak: 'break-all' as const }
const linkStyle = { color: '#dc2626', textDecoration: 'underline' }
