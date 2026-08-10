import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, ShieldCheck, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Sobre: React.FC = () => {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-14 space-y-10">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <img src="/cs-icon.jpg" alt="Logotipo da Cabral &amp; Sousa Ltda." className="h-12 w-12 rounded-lg object-cover" />
            <div>
              <h1 className="text-2xl font-bold leading-tight">Transporte - SGTickets</h1>
              <p className="text-sm text-muted-foreground">Sistema de Governança de Tickets da Cabral &amp; Sousa Ltda.</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Este site é o sistema interno de chamados da Cabral &amp; Sousa Ltda., utilizado exclusivamente por
            colaboradores da empresa para abrir, acompanhar e encerrar solicitações de atendimento das áreas
            operacionais e administrativas.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="bg-card border border-border rounded-xl p-5">
            <Ticket className="mb-2 text-primary" size={20} />
            <h2 className="font-semibold text-sm">Para que serve</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Registro e acompanhamento de chamados internos, fluxos de aprovação, indicadores de atendimento e SLA.
            </p>
          </article>
          <article className="bg-card border border-border rounded-xl p-5">
            <Building2 className="mb-2 text-primary" size={20} />
            <h2 className="font-semibold text-sm">Quem mantém</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Cabral &amp; Sousa Ltda. — empresa de transporte e logística. Desenvolvimento e suporte técnico por
              MPL Tecnologia.
            </p>
          </article>
          <article className="bg-card border border-border rounded-xl p-5">
            <ShieldCheck className="mb-2 text-primary" size={20} />
            <h2 className="font-semibold text-sm">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Não há cadastro público. As contas são criadas pela administração da empresa e o acesso exige e-mail
              corporativo e senha pessoal.
            </p>
          </article>
          <article className="bg-card border border-border rounded-xl p-5">
            <Mail className="mb-2 text-primary" size={20} />
            <h2 className="font-semibold text-sm">Contato</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Dúvidas ou suspeita de uso indevido:{' '}
              <a href="mailto:contato@mpltecnologia.com" className="underline">contato@mpltecnologia.com</a>
            </p>
          </article>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-sm">Privacidade e dados</h2>
          <p className="text-sm text-muted-foreground">
            O sistema coleta apenas os dados necessários ao atendimento dos chamados (nome, e-mail corporativo, setor
            e histórico de solicitações). Nenhum dado é comercializado e não há solicitação de dados bancários,
            documentos pessoais ou download de programas.
          </p>
        </section>

        <div>
          <Button asChild className="gradient-primary text-primary-foreground font-semibold">
            <Link to="/">Acessar o sistema</Link>
          </Button>
        </div>

        <footer className="text-xs text-muted-foreground border-t border-border pt-6">
          © {new Date().getFullYear()} Cabral &amp; Sousa Ltda. — Todos os direitos reservados.
        </footer>
      </div>
    </main>
  );
};

export default Sobre;
