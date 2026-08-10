import { Loader2 } from 'lucide-react';
import { useProcessing } from '@/contexts/ProcessingContext';

export const ProcessingOverlay = () => {
  const { isProcessing, message } = useProcessing();
  if (!isProcessing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/85"
    >
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-8 py-6 shadow-lg">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-base font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
};
