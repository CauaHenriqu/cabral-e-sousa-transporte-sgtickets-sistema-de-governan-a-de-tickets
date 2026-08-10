import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Copy, Clock, WifiOff, ServerCrash, Braces, Settings2, ChevronLeft, Wrench } from 'lucide-react';
import { FormApiErrorDetails, formatFormApiError, FormApiErrorCategory, friendlyApiMessage } from '@/lib/triggerFormApi';


const ICONS: Record<FormApiErrorCategory, React.ComponentType<{ className?: string }>> = {
  network: WifiOff,
  timeout: Clock,
  http: ServerCrash,
  invalid_json: Braces,
  config: Settings2,
  unknown: AlertTriangle,
};

const HINTS: Record<FormApiErrorCategory, string> = {
  network: 'Não foi possível alcançar o servidor da API. Verifique a URL, o DNS e se o serviço está online.',
  timeout: 'A API não respondeu dentro do tempo limite configurado no formulário. Aumente o tempo limite ou verifique a performance da API.',
  http: 'A API respondeu com um status fora da faixa 2xx. Confira os parâmetros enviados e as regras da API.',
  invalid_json: 'A resposta da API não é um JSON válido. Verifique o formato retornado pelo endpoint.',
  config: 'A configuração da integração é inválida. Revise a URL e o método no cadastro do formulário.',
  unknown: 'Ocorreu uma falha não classificada na chamada à API.',
};

interface Props {
  details: FormApiErrorDetails | null;
  onClose: () => void;
}

export function ApiErrorDialog({ details, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  const copy = async () => {
    if (!details) return;
    try {
      await navigator.clipboard.writeText(formatFormApiError(details));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleClose = () => {
    setShowTechnical(false);
    onClose();
  };

  if (!details) return null;
  const Icon = ICONS[details.category] ?? AlertTriangle;

  return (
    <Dialog open={!!details} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {showTechnical ? 'Detalhes técnicos' : 'Não foi possível continuar'}
          </DialogTitle>
        </DialogHeader>

        {!showTechnical ? (
          <div className="space-y-4">
            <p className="text-base font-medium">{friendlyApiMessage(details)}</p>
            <p className="text-xs text-muted-foreground">
              O ticket não foi criado. Corrija o problema e tente novamente.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTechnical(true)}>
                <Wrench className="h-4 w-4 mr-2" />
                Detalhes técnicos
              </Button>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" />
                {details.categoryLabel}
              </Badge>
              {details.status != null && <Badge variant="outline">HTTP {details.status}</Badge>}
              <Badge variant="secondary">
                {details.attempts} tentativa{details.attempts === 1 ? '' : 's'}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">{HINTS[details.category]}</p>

            <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
              <p><span className="font-medium">Motivo:</span> {details.reason}</p>
              {details.method && details.url && (
                <p className="break-all"><span className="font-medium">Requisição:</span> {details.method} {details.url}</p>
              )}
              <p><span className="font-medium">Data/Hora:</span> {new Date(details.occurredAt).toLocaleString('pt-BR')}</p>
            </div>

            {details.responseBody && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Retorno da API</p>
                <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap break-all">
                  {details.responseBody}
                </pre>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              O ticket não foi criado. Corrija o problema e tente novamente.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowTechnical(false)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button variant="outline" onClick={copy}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copiado!' : 'Copiar erro'}
              </Button>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ApiErrorDialog;

