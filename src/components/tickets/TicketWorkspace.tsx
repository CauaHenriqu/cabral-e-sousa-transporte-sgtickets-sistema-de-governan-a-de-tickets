import React from 'react';
import { X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TicketWorkspaceProps = {
  activeId: string | null;
  onCloseAll: () => void;
  onCloseTicket: (id: string) => void;
  onSetActive: (id: string) => void;
  openIds: string[];
  tickets: any[];
};

const TicketWorkspace: React.FC<TicketWorkspaceProps> = ({
  activeId,
  onCloseAll,
  onCloseTicket,
  onSetActive,
  openIds,
  tickets,
}) => {
  const openTickets = openIds.map((id) => tickets.find((t: any) => t.id === id)).filter(Boolean);
  if (openTickets.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/20 p-2">
      <span className="mr-1 text-xs font-semibold text-muted-foreground">Em atendimento:</span>
      {openTickets.map((t: any) => (
        <span
          key={t.id}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors',
            t.id === activeId ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-background text-muted-foreground',
          )}
        >
          <button type="button" onClick={() => onSetActive(t.id)} className="min-w-0">
            #{t.code}
          </button>
          <button
            type="button"
            onClick={() => onCloseTicket(t.id)}
            aria-label={`Fechar painel do ticket ${t.code}`}
            className="text-destructive"
          >
            <XIcon size={12} />
          </button>
        </span>
      ))}
      {openTickets.length > 1 && (
        <Button size="sm" variant="ghost" onClick={onCloseAll} className="h-7 text-xs">
          Fechar todos
        </Button>
      )}
    </div>
  );
};

export default TicketWorkspace;
