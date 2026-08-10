/** Formata os dados preenchidos do formulário para a mensagem inicial do ticket. */

const emojiForType = (type: string): string => {
  switch (type) {
    case 'currency':
      return '💰';
    case 'return_reason':
      return '↩️';
    case 'date':
      return '📅';
    case 'number':
      return '🔢';
    case 'select':
      return '📌';
    case 'textarea':
      return '📝';
    case 'checkbox':
      return '☑️';
    default:
      return '🔹';
  }
};

export interface FormFieldLike {
  id: string;
  label?: string | null;
  field_type?: string | null;
  order_index?: number | null;
}

/**
 * Gera as linhas do bloco "Dados do Formulário" no mesmo padrão do bloco
 * "Dados do Pedido" (emoji + rótulo em negrito + valor).
 * Retorna [] quando não há valores preenchidos.
 */
export function buildFormDataLines(
  fields: FormFieldLike[],
  values: Record<string, any>
): string[] {
  const ordered = [...(fields || [])].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  const rows: string[] = [];
  for (const f of ordered) {
    const raw = values?.[f.id];
    const value =
      typeof raw === 'boolean'
        ? raw
          ? 'Sim'
          : 'Não'
        : Array.isArray(raw)
          ? raw.join(', ')
          : (raw ?? '').toString().trim();
    if (!value) continue;
    rows.push(
      `${emojiForType(f.field_type || 'text')} **${f.label || 'Campo'}:** ${value}`
    );
  }

  if (rows.length === 0) return [];
  return ['', '📋 **Dados do Formulário**', '', ...rows];
}
