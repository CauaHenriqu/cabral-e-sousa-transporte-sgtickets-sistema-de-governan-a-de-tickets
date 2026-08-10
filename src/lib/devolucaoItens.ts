/** Itens (produtos) do pedido retornados pela API, com a quantidade devolvida informada. */
export interface DevolucaoItem {
  codprod: string;
  descricao: string;
  pvenda: number;
  qt: number;
  qt_devolvida?: number;
}

export const DEVOLUCAO_ITENS_KEY = '__devolucao_itens';

export const brl = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Extrai os itens do corpo de retorno da API (fallback quando a função não os envia). */
export function extractItensFromBody(body?: string | null): DevolucaoItem[] {
  if (!body) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const pick = (obj: any, ...keys: string[]) => {
    if (!obj || typeof obj !== 'object') return undefined;
    const map: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) map[k.toLowerCase()] = v;
    for (const k of keys) {
      const v = map[k.toLowerCase()];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
  };
  const d = parsed?.data ?? parsed;
  const pedidos = d?.pedidos ?? (Array.isArray(d) ? d : d && typeof d === 'object' ? [d] : []);
  const out: DevolucaoItem[] = [];
  for (const p of pedidos as any[]) {
    const itens = pick(p, 'ITENS');
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

/** Normaliza a quantidade devolvida: nunca negativa nem maior que a quantidade do produto. */
export function clampQtdeDevolvida(value: number, max: number): number {
  if (!isFinite(value) || value < 0) return 0;
  return Math.min(value, max);
}

/** Bloco de histórico com a tabela de produtos devolvidos. */
export function formatItensBlock(itens: DevolucaoItem[], titulo = '📦 **Produtos da Devolução**'): string {
  const rows = itens.map(
    (i) =>
      `${i.codprod || '—'} | ${i.descricao || '—'} | ${brl(i.pvenda)} | ${i.qt} | ${i.qt_devolvida ?? 0}`,
  );
  const totalDev = itens.reduce((acc, i) => acc + (i.qt_devolvida ?? 0), 0);
  const totalValor = itens.reduce((acc, i) => acc + (i.qt_devolvida ?? 0) * (i.pvenda || 0), 0);
  return [
    titulo,
    '**Cod.Produto** | **Desc.Produto** | **Preço R$** | **Qtde** | **Qtde.Devolvida**',
    ...rows,
    `🔢 **Total devolvido:** ${totalDev}`,
    `💰 **Valor total devolvido:** ${brl(totalValor)}`,
  ].join('\n');
}
