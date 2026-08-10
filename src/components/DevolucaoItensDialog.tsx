import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PackageCheck, Pencil, CheckCircle2 } from 'lucide-react';
import { DevolucaoItem, brl, clampQtdeDevolvida } from '@/lib/devolucaoItens';

interface Props {
  open: boolean;
  itens: DevolucaoItem[];
  /** Texto do botão de finalização (ex. "Criar Ticket"). */
  confirmLabel?: string;
  readOnly?: boolean;
  isSaving?: boolean;
  onCancel: () => void;
  onConfirm: (itens: DevolucaoItem[]) => void;
}

/** Tela de informação da quantidade devolvida por produto, com etapa de confirmação. */
export const DevolucaoItensDialog: React.FC<Props> = ({
  open,
  itens,
  confirmLabel = 'Confirmar',
  readOnly = false,
  isSaving = false,
  onCancel,
  onConfirm,
}) => {
  const [rows, setRows] = useState<DevolucaoItem[]>([]);
  const [stage, setStage] = useState<'edit' | 'confirm'>('edit');

  useEffect(() => {
    if (open) {
      setRows(itens.map((i) => ({ ...i, qt_devolvida: clampQtdeDevolvida(Number(i.qt_devolvida ?? 0), i.qt) })));
      setStage('edit');
    }
  }, [open, itens]);

  const totalDev = useMemo(() => rows.reduce((a, i) => a + (i.qt_devolvida ?? 0), 0), [rows]);
  const totalValor = useMemo(
    () => rows.reduce((a, i) => a + (i.qt_devolvida ?? 0) * (i.pvenda || 0), 0),
    [rows],
  );

  const setQtde = (idx: number, raw: string) => {
    const parsed = Number(raw.replace(',', '.'));
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, qt_devolvida: clampQtdeDevolvida(parsed, r.qt) } : r)),
    );
  };

  /** Índices com quantidade devolvida inválida (deve ser > 0 e <= quantidade do pedido). */
  const invalidIdx = useMemo(
    () =>
      rows.reduce<number[]>((acc, r, i) => {
        const q = Number(r.qt_devolvida ?? 0);
        if (!(q > 0) || q > r.qt) acc.push(i);
        return acc;
      }, []),
    [rows],
  );
  const hasInvalid = invalidIdx.length > 0;


  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isSaving) onCancel(); }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck size={18} className="text-primary" />
            {stage === 'edit' ? 'Produtos da Devolução' : 'Confirmar quantidades devolvidas'}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? 'Este ticket já foi fechado. As quantidades não podem mais ser alteradas.'
              : stage === 'edit'
                ? 'Informe a quantidade devolvida de cada produto. O valor não pode ser negativo nem maior que a quantidade do produto.'
                : 'Revise as quantidades informadas. Se algo estiver errado, use "Corrigir quantidades".'}
          </DialogDescription>
        </DialogHeader>

        {/* Mobile: cartões (100% visível, sem rolagem horizontal) */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 sm:hidden">
          {rows.map((r, idx) => (
            <div key={`m-${r.codprod}-${idx}`} className="border border-border rounded-lg p-3 space-y-1">
              <p className="text-sm font-semibold break-words">{r.descricao || '—'}</p>
              <p className="text-xs text-muted-foreground">Cód.: {r.codprod || '—'}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span>Preço: <strong>{brl(r.pvenda)}</strong></span>
                <span>Qtde: <strong>{r.qt}</strong></span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-medium">Qtde. devolvida</span>
                {readOnly || stage === 'confirm' ? (
                  <span className="text-sm font-semibold">{r.qt_devolvida ?? 0}</span>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    max={r.qt}
                    step="any"
                    inputMode="decimal"
                    value={String(r.qt_devolvida ?? 0)}
                    onChange={(e) => setQtde(idx, e.target.value)}
                    className={`h-9 w-24 text-right ${invalidIdx.includes(idx) ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  />
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum produto retornado pela API.</p>
          )}
        </div>

        {/* Desktop/tablet: tabela */}
        <div className="hidden sm:block flex-1 overflow-auto min-h-0 border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Cod.Produto</th>
                <th className="px-3 py-2 font-semibold">Desc.Produto</th>
                <th className="px-3 py-2 font-semibold text-right">Preço R$</th>
                <th className="px-3 py-2 font-semibold text-right">Qtde</th>
                <th className="px-3 py-2 font-semibold text-right">Qtde.Devolvida</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.codprod}-${idx}`} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">{r.codprod || '—'}</td>
                  <td className="px-3 py-2">{r.descricao || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{brl(r.pvenda)}</td>
                  <td className="px-3 py-2 text-right">{r.qt}</td>
                  <td className="px-3 py-2 text-right">
                    {readOnly || stage === 'confirm' ? (
                      <span className="font-semibold">{r.qt_devolvida ?? 0}</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        max={r.qt}
                        step="any"
                        inputMode="decimal"
                        value={String(r.qt_devolvida ?? 0)}
                        onChange={(e) => setQtde(idx, e.target.value)}
                        className={`h-8 w-24 ml-auto text-right ${invalidIdx.includes(idx) ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhum produto retornado pela API.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>


        {!readOnly && stage === 'edit' && hasInvalid && rows.length > 0 && (
          <p className="text-xs font-medium text-destructive">
            Informe uma quantidade devolvida maior que zero e menor ou igual à quantidade do produto no pedido.
          </p>
        )}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            🔢 Total devolvido: <strong>{totalDev}</strong> • 💰 Valor: <strong>{brl(totalValor)}</strong>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" onClick={onCancel} disabled={isSaving} className="w-full sm:w-auto">
              {readOnly ? 'Fechar' : 'Cancelar'}
            </Button>
            {!readOnly && stage === 'edit' && (
              <Button onClick={() => setStage('confirm')} disabled={rows.length === 0 || hasInvalid} className="w-full sm:w-auto gradient-primary text-primary-foreground font-semibold">
                Revisar e confirmar
              </Button>
            )}

            {!readOnly && stage === 'confirm' && (
              <>
                <Button variant="secondary" onClick={() => setStage('edit')} disabled={isSaving} className="w-full sm:w-auto">
                  <Pencil size={14} className="mr-1" /> Corrigir quantidades
                </Button>
                <Button onClick={() => onConfirm(rows)} disabled={isSaving || hasInvalid} className="w-full sm:w-auto gradient-primary text-primary-foreground font-semibold">

                  {isSaving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <CheckCircle2 size={14} className="mr-1" />}
                  {confirmLabel}
                </Button>
              </>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
