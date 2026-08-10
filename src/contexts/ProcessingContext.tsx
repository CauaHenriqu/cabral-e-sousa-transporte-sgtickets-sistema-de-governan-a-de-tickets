import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface ProcessingContextValue {
  isProcessing: boolean;
  message: string;
  start: (msg?: string) => void;
  stop: () => void;
  withProcessing: <T>(fn: () => Promise<T>, msg?: string) => Promise<T>;
}

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

// Module-level controller so non-React code (interceptors) can trigger the overlay
let externalController: { start: (msg?: string) => void; stop: () => void } | null = null;

export function startGlobalProcessing(msg?: string) {
  externalController?.start(msg);
}
export function stopGlobalProcessing() {
  externalController?.stop();
}

// Janela de "graça" para evitar pisca-pisca entre operações sequenciais
// (ex: delete -> invalidate/refetch -> insert de log de auditoria).
// Se outro start ocorrer dentro dessa janela após o contador zerar,
// o overlay permanece visível sem desaparecer e reaparecer.
const HIDE_DELAY_MS = 400;

export const ProcessingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('Processando...');
  const countRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const start = useCallback((msg?: string) => {
    setMessage(msg || 'Processando...');
    countRef.current += 1;
    clearHideTimer();
    setVisible(true);
  }, []);

  const stop = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) {
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        if (countRef.current === 0) setVisible(false);
        hideTimerRef.current = null;
      }, HIDE_DELAY_MS);
    }
  }, []);

  // Register external controller once
  useEffect(() => {
    externalController = { start, stop };
    return () => {
      externalController = null;
    };
  }, [start, stop]);

  const withProcessing = useCallback(
    async <T,>(fn: () => Promise<T>, msg?: string): Promise<T> => {
      start(msg);
      try {
        return await fn();
      } finally {
        stop();
      }
    },
    [start, stop]
  );

  return (
    <ProcessingContext.Provider value={{ isProcessing: visible, message, start, stop, withProcessing }}>
      {children}
    </ProcessingContext.Provider>
  );
};

export function useProcessing() {
  const ctx = useContext(ProcessingContext);
  if (!ctx) throw new Error('useProcessing must be used within ProcessingProvider');
  return ctx;
}
