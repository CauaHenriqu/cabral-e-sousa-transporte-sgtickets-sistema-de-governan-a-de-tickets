/**
 * Intercepta operações de escrita do supabase-js (insert/update/delete/upsert),
 * chamadas RPC e functions.invoke para acionar automaticamente o overlay
 * "Processando..." durante a execução.
 *
 * NÃO intercepta SELECT (leituras).
 */
import { supabase } from '@/integrations/supabase/client';
import { startGlobalProcessing, stopGlobalProcessing } from '@/contexts/ProcessingContext';

let installed = false;

const WRITE_METHODS = ['insert', 'update', 'delete', 'upsert'] as const;

function wrapBuilder(builder: any) {
  if (!builder || builder.__processingWrapped) return builder;

  // O builder do PostgREST é "thenable". Envolver o then pra acionar overlay
  // assim que o builder for awaited.
  const originalThen = builder.then?.bind(builder);
  if (typeof originalThen === 'function') {
    builder.then = (onFulfilled: any, onRejected: any) => {
      startGlobalProcessing();
      return originalThen(
        (value: any) => {
          stopGlobalProcessing();
          return onFulfilled ? onFulfilled(value) : value;
        },
        (err: any) => {
          stopGlobalProcessing();
          if (onRejected) return onRejected(err);
          throw err;
        }
      );
    };
  }

  builder.__processingWrapped = true;
  return builder;
}

export function installSupabaseProcessingInterceptor() {
  if (installed) return;
  installed = true;

  // Tabelas cujas escritas são telemetria de fundo e NÃO devem acionar o overlay
  const SILENT_TABLES = new Set<string>(['system_logs']);

  // 1) Intercept .from(table).<write>
  const originalFrom = supabase.from.bind(supabase);
  (supabase as any).from = (table: string) => {
    const qb: any = originalFrom(table as any);
    if (SILENT_TABLES.has(table)) return qb;
    for (const method of WRITE_METHODS) {
      const original = qb[method];
      if (typeof original === 'function') {
        qb[method] = (...args: any[]) => wrapBuilder(original.apply(qb, args));
      }
    }
    return qb;
  };

  // 2) Intercept rpc
  const originalRpc = supabase.rpc.bind(supabase);
  (supabase as any).rpc = (...args: any[]) => wrapBuilder(originalRpc(...(args as [any, any?, any?])));

  // 3) Intercept functions.invoke
  const fnInvoke = supabase.functions.invoke.bind(supabase.functions);
  (supabase.functions as any).invoke = async (...args: any[]) => {
    startGlobalProcessing();
    try {
      return await fnInvoke(...(args as [string, any?]));
    } finally {
      stopGlobalProcessing();
    }
  };

  // 4) Intercept storage uploads/removes (writes)
  const originalStorageFrom = supabase.storage.from.bind(supabase.storage);
  (supabase.storage as any).from = (bucket: string) => {
    const sb: any = originalStorageFrom(bucket);
    for (const method of ['upload', 'remove', 'update', 'move', 'copy'] as const) {
      const original = sb[method];
      if (typeof original === 'function') {
        sb[method] = async (...args: any[]) => {
          startGlobalProcessing();
          try {
            return await original.apply(sb, args);
          } finally {
            stopGlobalProcessing();
          }
        };
      }
    }
    return sb;
  };
}
