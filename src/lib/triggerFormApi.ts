import { supabase } from '@/integrations/supabase/client';

export interface FormApiResult {
  success: boolean;
  skipped?: boolean;
  status?: number | null;
  method?: string;
  url?: string;
  request_payload?: Record<string, unknown>;
  response_body?: string | null;
  error?: string | null;
  summary?: string;
}

/**
 * Dispara a integração de API configurada no formulário do serviço.
 * Nunca lança erro: a abertura do ticket não pode ser bloqueada pela integração.
 */
export async function triggerFormApi(ticketId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('call-form-api', {
      body: { ticket_id: ticketId },
    });
    if (error) console.warn('Integração de API do formulário falhou:', error.message);
    return data ?? null;
  } catch (e) {
    console.warn('Integração de API do formulário falhou:', e);
    return null;
  }
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 800;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Determina se vale a pena tentar novamente (erros temporários). */
function isRetryable(status?: number | null): boolean {
  if (status == null) return true; // rede, timeout ou função indisponível
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
}

export type FormApiErrorCategory = 'network' | 'timeout' | 'http' | 'invalid_json' | 'config' | 'unknown';

export const FORM_API_CATEGORY_LABEL: Record<FormApiErrorCategory, string> = {
  network: 'Falha de rede',
  timeout: 'Tempo limite excedido',
  http: 'HTTP não-2xx',
  invalid_json: 'JSON inválido',
  config: 'Configuração inválida',
  unknown: 'Erro desconhecido',
};

export interface FormApiErrorDetails {
  category: FormApiErrorCategory;
  categoryLabel: string;
  reason: string;
  method?: string | null;
  url?: string | null;
  status?: number | null;
  responseBody?: string | null;
  attempts: number;
  occurredAt: string;
}

export class FormApiError extends Error {
  details: FormApiErrorDetails;
  constructor(details: FormApiErrorDetails) {
    super(`Não foi possível abrir o ticket: ${details.categoryLabel} — ${details.reason}`);
    this.name = 'FormApiError';
    this.details = details;
  }
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

function classify(reason: string, status?: number | null, responseBody?: string | null): FormApiErrorCategory {
  const r = (reason || '').toLowerCase();
  if (r.includes('tempo limite') || r.includes('timeout') || r.includes('abort')) return 'timeout';
  if (status === 408) return 'timeout';
  if (r.includes('url') || r.includes('não permitid') || r.includes('configur')) return 'config';
  if (status != null && (status < 200 || status >= 300)) return 'http';
  if (
    status == null &&
    (r.includes('fetch') || r.includes('network') || r.includes('rede') || r.includes('dns') || r.includes('conexão') || r.includes('connect'))
  )
    return 'network';
  if (responseBody && r.includes('json')) return 'invalid_json';
  if (r.includes('json') || (responseBody && !looksLikeJson(responseBody) && r.includes('parse'))) return 'invalid_json';
  if (status == null) return 'network';
  return 'unknown';
}

function buildError(
  reason: string,
  attempts: number,
  result?: FormApiResult | null,
): FormApiError {
  const status = result?.status ?? null;
  const responseBody = result?.response_body ?? null;
  const category = classify(reason, status, responseBody);
  return new FormApiError({
    category,
    categoryLabel: FORM_API_CATEGORY_LABEL[category],
    reason: reason || 'Falha não especificada na chamada à API.',
    method: result?.method ?? null,
    url: result?.url ?? null,
    status,
    responseBody: responseBody ? responseBody.slice(0, 2000) : null,
    attempts,
    occurredAt: new Date().toISOString(),
  });
}

export function formatFormApiError(d: FormApiErrorDetails): string {
  return [
    `Categoria: ${d.categoryLabel}`,
    `Motivo: ${d.reason}`,
    d.method && d.url ? `Requisição: ${d.method} ${d.url}` : null,
    d.status != null ? `Status HTTP: ${d.status}` : null,
    `Tentativas realizadas: ${d.attempts}`,
    `Data/Hora: ${new Date(d.occurredAt).toLocaleString('pt-BR')}`,
    d.responseBody ? `Retorno da API:\n${d.responseBody}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}


/**
 * Executa a chamada à API do formulário ANTES de criar o ticket.
 * Tenta novamente automaticamente (com backoff) em falhas temporárias.
 * Lança erro detalhado se todas as tentativas falharem, impedindo a abertura do ticket.
 */
export async function preflightFormApi(
  serviceId: string,
  formValues: Record<string, unknown>,
  onAttempt?: (attempt: number, total: number) => void,
): Promise<FormApiResult> {
  let lastError: string | null = null;
  let lastResult: FormApiResult | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onAttempt?.(attempt, MAX_ATTEMPTS);

    let result: FormApiResult | null = null;
    let transportError: string | null = null;

    try {
      const { data, error } = await supabase.functions.invoke('call-form-api', {
        body: { service_id: serviceId, form_data: formValues },
      });
      if (error) throw new Error(error.message || 'Falha ao contatar o serviço de integração.');
      result = (data as FormApiResult) ?? null;
      if (!result) transportError = 'Resposta vazia da integração com a API.';
    } catch (e) {
      transportError = e instanceof Error ? e.message : String(e);
    }

    if (transportError) {
      lastError = transportError;
      lastResult = null;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw buildError(lastError, MAX_ATTEMPTS, null);
    }

    if (result!.skipped || result!.success) return result!;

    lastResult = result;
    if (isRetryable(result!.status) && attempt < MAX_ATTEMPTS) {
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
      continue;
    }

    throw buildError(result!.error || 'A API retornou uma resposta sem sucesso.', attempt, result);
  }

  // Inalcançável, mas mantém o contrato de erro
  throw buildError(lastResult?.error || lastError || 'Falha na integração com a API.', MAX_ATTEMPTS, lastResult);
}


/**
 * Extrai uma mensagem amigável e objetiva a partir do retorno da API.
 * Prioriza campos como message/mensagem/error/detail do JSON retornado.
 */
export function friendlyApiMessage(d: FormApiErrorDetails): string {
  const body = d.responseBody?.trim();
  if (body) {
    try {
      const parsed = JSON.parse(body);
      const pick = (obj: unknown): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        const o = obj as Record<string, unknown>;
        for (const key of ['message', 'mensagem', 'msg', 'error_description', 'detail', 'detalhe', 'error', 'erro', 'descricao']) {
          const v = o[key];
          if (typeof v === 'string' && v.trim()) return v.trim();
          if (v && typeof v === 'object') {
            const nested = pick(v);
            if (nested) return nested;
          }
        }
        return null;
      };
      const found = pick(parsed);
      if (found) return found;
    } catch {
      if (body.length <= 200 && !body.startsWith('{') && !body.startsWith('[') && !body.startsWith('<')) return body;
    }
  }

  switch (d.category) {
    case 'network':
      return 'Não foi possível conectar à API. Verifique sua conexão e tente novamente.';
    case 'timeout':
      return 'A API demorou demais para responder. Tente novamente em instantes.';
    case 'config':
      return 'A integração está configurada incorretamente. Contate o administrador.';
    case 'invalid_json':
      return 'A API retornou uma resposta em formato inválido.';
    case 'http':
      return `A API respondeu com erro${d.status != null ? ` (HTTP ${d.status})` : ''}.`;
    default:
      return d.reason;
  }
}
