import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeParam(label: string) {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'campo';
}

/** Only public http/https endpoints are allowed. */
function validateUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Somente URLs http ou https são permitidas.');
  const host = url.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);
  if (blocked) throw new Error('Endereço de rede interna não permitido.');
  return url;
}

function brl(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? '—');
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const val = (v: unknown) => {
  const s = String(v ?? '').trim();
  return s === '' ? '—' : s;
};

/** Busca um campo ignorando maiúsculas/minúsculas. */
function pick(obj: any, ...keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const map: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) map[k.toLowerCase()] = v;
  for (const k of keys) {
    const v = map[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

/** Extrai a lista de pedidos independentemente do formato retornado. */
function extractPedidos(responseBody: string | null): any[] {
  if (!responseBody) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    return [];
  }
  const d = parsed?.data ?? parsed;
  const pedidos = d?.pedidos ?? (Array.isArray(d) ? d : d && typeof d === 'object' ? [d] : null);
  return Array.isArray(pedidos) ? pedidos : [];
}

/** Itens (produtos) normalizados do pedido. */
function extractItens(pedidos: any[]) {
  const out: { codprod: string; descricao: string; pvenda: number; qt: number }[] = [];
  for (const p of pedidos) {
    const itens = pick(p, 'ITENS', 'itens') as any[] | undefined;
    if (!Array.isArray(itens)) continue;
    for (const it of itens) {
      out.push({
        codprod: String(pick(it, 'CODPROD') ?? ''),
        descricao: String(pick(it, 'DESCRICAO') ?? ''),
        pvenda: Number(pick(it, 'PVENDA') ?? 0) || 0,
        qt: Number(pick(it, 'QT') ?? 0) || 0,
      });
    }
  }
  return out;
}

/** Formata o retorno de pedidos da API em blocos legíveis com emojis. */
function formatPedidos(pedidos: any[]): string | null {
  if (!Array.isArray(pedidos) || pedidos.length === 0) return null;

  const blocos = pedidos.slice(0, 10).map((p: any, i: number) => {
    const rota = [val(pick(p, 'ROTA')), val(pick(p, 'DESCRICAO_ROTA'))].filter((x) => x !== '—').join(' - ') || '—';
    const linhas = [
      `👤 **Cliente:** ${val(pick(p, 'NOME_CLIENTE', 'NOME_CLIENT', 'CLIENTE'))}`,
      `🆔 **Cód. Cliente:** ${val(pick(p, 'CODCLI'))}`,
      `🛣️ **Rota:** ${rota}`,
      `🧾 **N.o da NF:** ${val(pick(p, 'NUMNOTA'))}`,
      `📦 **N.o do Pedido:** ${val(pick(p, 'NUMPED'))}`,
      `💰 **Total da NF R$:** ${brl(pick(p, 'VLATEND'))}`,
      `🚚 **Carga:** ${val(pick(p, 'NUMCAR'))}`,
    ];
    const header = pedidos.length > 1 ? `📄 **Pedido ${i + 1} de ${pedidos.length}**\n` : '';
    return `${header}${linhas.join('\n')}`;
  });

  return `📋 Dados do Pedido\n────────────────────────────\n${blocos.join('\n────────────────────────────\n')}`;
}


Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const ticketId: string | null = body?.ticket_id ?? null;
    let serviceId: string | null = body?.service_id ?? null;
    let formData: Record<string, unknown> = (body?.form_data ?? {}) as Record<string, unknown>;

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (ticketId) {
      const { data: allowed } = await admin.rpc('is_ticket_participant', {
        _user_id: userId,
        _ticket_id: ticketId,
      });
      if (!allowed) return json({ error: 'Forbidden' }, 403);

      const { data: ticket, error: tErr } = await admin
        .from('tickets')
        .select('id, code, service_id, form_data')
        .eq('id', ticketId)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!ticket) return json({ error: 'Ticket não encontrado' }, 404);
      serviceId = ticket.service_id as string;
      formData = (ticket.form_data || {}) as Record<string, unknown>;
    }

    if (!serviceId) return json({ error: 'ticket_id ou service_id é obrigatório' }, 400);

    const { data: form } = await admin
      .from('service_forms')
      .select('id, name, api_enabled, api_method, api_url, api_timeout_seconds, api_values_in_path, form_fields(id, label, send_to_api, api_param_name, sort_order)')
      .eq('service_id', serviceId)
      .limit(1)
      .maybeSingle();

    if (!form || !form.api_enabled || !form.api_url) {
      return json({ skipped: true, success: true, reason: 'Formulário sem integração habilitada.' });
    }

    const method = (form.api_method || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST';
    const valuesInPath = method === 'GET' && !!(form as any).api_values_in_path;

    const sentFields = ((form.form_fields || []) as any[])
      .filter((f) => f.send_to_api)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const payload: Record<string, unknown> = {};
    const pathValues: string[] = [];
    for (const f of sentFields) {
      const key = (f.api_param_name || '').trim() || normalizeParam(f.label);
      const value = formData[f.id] ?? '';
      payload[key] = value;
      pathValues.push(String(value ?? ''));
    }

    let status: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let finalUrl = form.api_url as string;

    try {
      const url = validateUrl(form.api_url as string);
      if (valuesInPath) {
        const base = url.pathname.replace(/\/+$/, '');
        url.pathname = `${base}/${pathValues.map((v) => encodeURIComponent(v)).join('/')}`;
      } else if (method === 'GET') {
        for (const [k, v] of Object.entries(payload)) url.searchParams.set(k, String(v ?? ''));
      }
      finalUrl = url.toString();

      const timeoutMs = Math.min(Math.max((form.api_timeout_seconds ?? 15) * 1000, 1000), 60000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(finalUrl, {
          method,
          headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
          body: method === 'POST' ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });
        status = res.status;
        responseBody = (await res.text()).slice(0, 4000);
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage.includes('aborted')) errorMessage = 'Tempo limite excedido ao chamar a API.';
    }

    await admin.from('form_api_calls').insert({
      ticket_id: ticketId,
      form_id: form.id,
      method,
      url: finalUrl,
      request_payload: payload,
      response_status: status,
      response_body: responseBody,
      error_message: errorMessage,
    });

    const ok = status !== null && status >= 200 && status < 300 && !errorMessage;
    const pedidos = ok ? extractPedidos(responseBody) : [];
    const itens = ok ? extractItens(pedidos) : [];
    const formatted = ok ? formatPedidos(pedidos) : null;
    const resumo = errorMessage
      ? `❌ Integração com API falhou (${method} ${finalUrl}): ${errorMessage}`
      : formatted
        ? formatted
        : responseBody
          ? `Retorno: ${responseBody.slice(0, 800)}`
          : '✅ Integração concluída com sucesso.';


    if (ticketId) {
      await admin.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_name: 'Sistema',
        sender_role: 'system',
        content: resumo,
        is_private: false,
      });
    }

    return json({
      success: ok,
      skipped: false,
      status,
      method,
      url: finalUrl,
      request_payload: payload,
      response_body: responseBody,
      error: errorMessage,
      summary: resumo,
      itens,
    });

  } catch (e) {
    console.error('call-form-api error', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Erro inesperado' }, 500);
  }
});
