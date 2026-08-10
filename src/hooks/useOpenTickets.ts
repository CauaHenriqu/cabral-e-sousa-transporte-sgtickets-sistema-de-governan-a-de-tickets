import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_OPEN_TICKETS = 3;

type OpenTicketsState = {
  activeId: string | null;
  ids: string[];
  maximizedId: string | null;
};

const EMPTY: OpenTicketsState = { activeId: null, ids: [], maximizedId: null };

/**
 * Controla os tickets abertos simultaneamente no workspace de atendimento.
 * Persiste no localStorage (por usuário) para restaurar após recarregar a página.
 */
export function useOpenTickets(userId?: string, onLimitReached?: () => void) {
  const storageKey = userId ? `sgtickets:${userId}:open-tickets` : null;
  const [state, setState] = useState<OpenTicketsState>(EMPTY);
  const restoredKeyRef = useRef<string | null>(null);
  const limitCbRef = useRef(onLimitReached);
  limitCbRef.current = onLimitReached;

  // Restaura os painéis salvos
  useEffect(() => {
    if (!storageKey || restoredKeyRef.current === storageKey) return;
    restoredKeyRef.current = storageKey;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<OpenTicketsState>;
      const ids = Array.isArray(parsed?.ids) ? parsed.ids.filter(Boolean).slice(0, MAX_OPEN_TICKETS) : [];
      if (ids.length === 0) return;
      setState({
        ids,
        maximizedId: parsed.maximizedId && ids.includes(parsed.maximizedId) ? parsed.maximizedId : null,
        activeId: parsed.activeId && ids.includes(parsed.activeId) ? parsed.activeId : ids[0],
      });
    } catch {
      // ignora falhas de storage
    }
  }, [storageKey]);

  // Persiste alterações
  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignora falhas de storage
    }
  }, [state, storageKey]);

  const openTicket = useCallback((id: string) => {
    setState((prev) => {
      if (prev.ids.includes(id)) return { ...prev, activeId: id };
      // Ao exceder o limite, libera o painel mais antigo em vez de bloquear a abertura
      const base = prev.ids.length >= MAX_OPEN_TICKETS ? prev.ids.slice(prev.ids.length - MAX_OPEN_TICKETS + 1) : prev.ids;
      const ids = [...base, id];
      return {
        ids,
        maximizedId: prev.maximizedId && ids.includes(prev.maximizedId) ? prev.maximizedId : null,
        activeId: id,
      };
    });
  }, []);

  const closeTicket = useCallback((id: string) => {
    setState((prev) => {
      const ids = prev.ids.filter((t) => t !== id);
      return {
        ids,
        maximizedId: prev.maximizedId === id ? null : prev.maximizedId,
        activeId: prev.activeId === id ? ids[ids.length - 1] ?? null : prev.activeId,
      };
    });
  }, []);

  const closeAll = useCallback(() => setState(EMPTY), []);

  const toggleMaximize = useCallback((id: string) => {
    setState((prev) => ({ ...prev, maximizedId: prev.maximizedId === id ? null : id, activeId: id }));
  }, []);

  const setActiveTicket = useCallback((id: string | null) => {
    setState((prev) => {
      if (!id) return { ...prev, activeId: null };
      return prev.ids.includes(id) ? { ...prev, activeId: id } : prev;
    });
  }, []);

  const clearActiveTicket = useCallback(() => {
    setState((prev) => ({ ...prev, activeId: null }));
  }, []);

  return {
    openIds: state.ids,
    maximizedId: state.maximizedId,
    activeId: state.activeId,
    openTicket,
    closeTicket,
    closeAll,
    toggleMaximize,
    setActiveTicket,
    clearActiveTicket,
  };
}
