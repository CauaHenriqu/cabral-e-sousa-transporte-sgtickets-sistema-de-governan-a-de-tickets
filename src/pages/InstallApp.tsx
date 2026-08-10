import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Monitor, CheckCircle, Share, MoreVertical } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallApp: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <img src="/icon-192.png" alt="Transporte - SGTickets" className="w-24 h-24 mx-auto rounded-2xl shadow-lg" />
        <h1 className="text-2xl font-bold text-foreground">Instalar Transporte - SGTickets</h1>
        <p className="text-muted-foreground text-sm">
          Instale o Transporte - SGTickets no seu dispositivo para acesso rápido, como um app nativo.
        </p>

        {isInstalled ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="text-emerald-500" size={24} />
            <p className="text-sm text-foreground font-semibold">App já instalado! Abra pela tela inicial do seu dispositivo.</p>
          </div>
        ) : deferredPrompt ? (
          <Button onClick={handleInstall} className="w-full gradient-primary text-primary-foreground font-semibold text-base py-6" size="lg">
            <Download size={20} className="mr-2" /> Instalar agora
          </Button>
        ) : isIOS ? (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 text-left">
            <p className="text-sm font-semibold text-foreground text-center">📱 Como instalar no iPhone/iPad:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                <p className="text-sm text-muted-foreground">Toque no botão <Share size={14} className="inline text-primary" /> <strong>Compartilhar</strong> na barra do Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                <p className="text-sm text-muted-foreground">Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                <p className="text-sm text-muted-foreground">Confirme tocando em <strong>"Adicionar"</strong></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 text-left">
            <p className="text-sm font-semibold text-foreground text-center">📱 Como instalar no Android:</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                <p className="text-sm text-muted-foreground">Toque no menu <MoreVertical size={14} className="inline text-primary" /> (três pontos) do navegador</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                <p className="text-sm text-muted-foreground">Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                <p className="text-sm text-muted-foreground">Confirme a instalação</p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-center gap-6 text-muted-foreground">
            <span className="flex items-center gap-1.5 text-xs"><Smartphone size={14} /> Android</span>
            <span className="flex items-center gap-1.5 text-xs"><Smartphone size={14} /> iOS</span>
            <span className="flex items-center gap-1.5 text-xs"><Monitor size={14} /> Desktop</span>
          </div>
          <p className="text-xs text-muted-foreground">Funciona em todos os dispositivos</p>
        </div>

        <a href="/" className="block text-sm text-primary hover:underline mt-4">← Voltar ao sistema</a>
      </div>
    </div>
  );
};

export default InstallApp;
