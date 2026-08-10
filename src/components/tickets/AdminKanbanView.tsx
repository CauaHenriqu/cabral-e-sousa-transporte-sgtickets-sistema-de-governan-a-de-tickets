import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarClock, Star, RefreshCw, MessageSquare, X as XIcon, ArrowRightLeft, Trash2, AlertTriangle, Info } from 'lucide-react';
import { calcBusinessHoursOpen, getSlaStatus, formatRemainingMinutes } from '@/lib/slaUtils';

interface AdminKanbanViewProps {
  tickets: any[];
  profiles: any[];
  user: any;
  ticketsWithNewMessages: Set<string>;
  getName: (userId: string) => string;
  formatDateTime: (d: string) => string;
  onOpenDetail: (ticketId: string) => void;
  calcExpectedCloseDate: (createdAt: string, slaHours?: number | null) => Date;
  renderAttendantSchedule?: (attendantId: string) => React.ReactNode;
  onClose: (ticketId: string) => void;
  onTransfer: (ticket: any) => void;
  onDelete: (ticketId: string) => void;
  onRate: (ticketId: string) => void;
  onTogglePriority: (ticketId: string, priority: boolean) => void;
  markTicketRead: (ticketId: string) => void;
  workSchedules?: any[];
  slaGoalPercent?: number;
  ratingGoal?: number;
}

const AdminKanbanView: React.FC<AdminKanbanViewProps> = ({
  tickets,
  profiles,
  user,
  ticketsWithNewMessages,
  getName,
  calcExpectedCloseDate,
  formatDateTime,
  renderAttendantSchedule,
  onOpenDetail,
  onClose,
  onTransfer,
  onDelete,
  onRate,
  onTogglePriority,
  markTicketRead,
  workSchedules = [],
  slaGoalPercent = 90,
  ratingGoal = 3,
}) => {
  const storageKey = user?.id ? `adminKanban:dateFilter:${user.id}` : null;
  const [dateFrom, setDateFrom] = useState<string>(() => {
    if (typeof window === 'undefined' || !user?.id) return '';
    try {
      const raw = window.localStorage.getItem(`adminKanban:dateFilter:${user.id}`);
      if (raw) return JSON.parse(raw).dateFrom || '';
    } catch {}
    return '';
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    if (typeof window === 'undefined' || !user?.id) return '';
    try {
      const raw = window.localStorage.getItem(`adminKanban:dateFilter:${user.id}`);
      if (raw) return JSON.parse(raw).dateTo || '';
    } catch {}
    return '';
  });

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ dateFrom, dateTo }));
    } catch {}
  }, [dateFrom, dateTo, storageKey]);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDateFrom(parsed.dateFrom || '');
        setDateTo(parsed.dateTo || '');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t: any) => {
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(t.created_at) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(t.created_at) > to) return false;
      }
      return true;
    });
  }, [tickets, dateFrom, dateTo]);

  // Group tickets by attendant
  const attendantColumns = useMemo(() => {
    const map = new Map<string, { name: string; tickets: any[] }>();

    filteredTickets.forEach((t: any) => {
      const attId = t.attendant_id;
      if (!map.has(attId)) {
        map.set(attId, { name: getName(attId), tickets: [] });
      }
      map.get(attId)!.tickets.push(t);
    });

    // Sort columns by attendant name
    return Array.from(map.entries())
      .sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [filteredTickets, getName]);

  const [slaTick, setSlaTick] = useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setSlaTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const nowIso = useMemo(() => new Date().toISOString(), [slaTick]);

  const getStats = (columnTickets: any[]) => {
    const total = columnTickets.length;
    const open = columnTickets.filter((t: any) => t.status === 'ABERTO').length;
    const closed = columnTickets.filter((t: any) => t.status === 'FECHADO').length;
    const reopened = columnTickets.filter((t: any) => t.reopened).length;

    // % SLA: tickets dentro do prazo (horas úteis gastas <= sla_hours do serviço)
    const slaEligible = columnTickets.filter((t: any) => t.created_at && t.services?.sla_hours != null);
    const withinSla = slaEligible.filter((t: any) => {
      const endDate = t.status === 'FECHADO' && t.closed_at ? t.closed_at : nowIso;
      const hoursSpent = calcBusinessHoursOpen(t, t.ticket_lifecycle_events, endDate, workSchedules);
      return hoursSpent <= (t.services?.sla_hours ?? Infinity);
    }).length;
    const slaPct = slaEligible.length > 0 ? (withinSla / slaEligible.length) * 100 : null;

    // Avaliação média
    const ratings: number[] = [];
    columnTickets.forEach((t: any) => {
      const r = Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
      if (typeof r === 'number') ratings.push(r);
    });
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    return { total, open, closed, reopened, slaPct, avgRating, ratingsCount: ratings.length };
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Data inicial</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-40 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Data final</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-40 text-sm"
          />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
            <XIcon size={14} className="mr-1" /> Limpar filtro
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredTickets.length} ticket(s) encontrado(s)
        </span>
      </div>

      {/* Kanban columns */}
      {attendantColumns.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Nenhum ticket encontrado no período selecionado</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {attendantColumns.map(([attId, column]) => {
            const stats = getStats(column.tickets);
            return (
              <div
                key={attId}
                className="min-w-[300px] max-w-[340px] flex-shrink-0 snap-start rounded-xl border border-border bg-card flex flex-col"
              >
                {/* Column header */}
                <div className="rounded-t-xl bg-primary/10 border-b border-border px-4 py-3 space-y-2">
                  <h3 className="text-sm font-bold text-foreground truncate">🎧 {column.name}</h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-background px-2 py-1 text-center">
                      <p className="text-xs text-muted-foreground">Criados</p>
                      <p className="text-sm font-bold text-foreground">{stats.total}</p>
                    </div>
                    <div className="rounded-lg bg-green-500/10 px-2 py-1 text-center">
                      <p className="text-xs text-muted-foreground">Abertos</p>
                      <p className="text-sm font-bold text-green-600">{stats.open}</p>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 px-2 py-1 text-center">
                      <p className="text-xs text-muted-foreground">Fechados</p>
                      <p className="text-sm font-bold text-blue-600">{stats.closed}</p>
                    </div>
                    <div className="rounded-lg bg-orange-500/10 px-2 py-1 text-center">
                      <p className="text-xs text-muted-foreground">Reabertos</p>
                      <p className="text-sm font-bold text-orange-600">{stats.reopened}</p>
                    </div>
                  </div>

                  {/* Metas de SLA e Avaliação */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div
                      className={`rounded-lg px-2 py-1 text-center ${
                        stats.slaPct == null
                          ? 'bg-muted/50'
                          : stats.slaPct >= slaGoalPercent
                          ? 'bg-green-500/10'
                          : 'bg-red-500/10'
                      }`}
                      title={`Meta de SLA: ${slaGoalPercent}%`}
                    >
                      <p className="text-xs text-muted-foreground">% SLA (meta {slaGoalPercent}%)</p>
                      <p
                        className={`text-sm font-bold ${
                          stats.slaPct == null
                            ? 'text-muted-foreground'
                            : stats.slaPct >= slaGoalPercent
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {stats.slaPct == null ? '—' : `${stats.slaPct.toFixed(1)}%`}
                      </p>
                    </div>
                    <div
                      className={`rounded-lg px-2 py-1 text-center ${
                        stats.avgRating == null
                          ? 'bg-muted/50'
                          : stats.avgRating >= ratingGoal
                          ? 'bg-yellow-500/10'
                          : 'bg-red-500/10'
                      }`}
                      title={`Meta de avaliação: ${ratingGoal.toFixed(1)} estrelas`}
                    >
                      <p className="text-xs text-muted-foreground">Avaliação (meta {ratingGoal.toFixed(1)})</p>
                      <p
                        className={`text-sm font-bold flex items-center justify-center gap-0.5 ${
                          stats.avgRating == null
                            ? 'text-muted-foreground'
                            : stats.avgRating >= ratingGoal
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {stats.avgRating == null ? '—' : (
                          <>
                            <Star size={12} className="fill-current" />
                            {stats.avgRating.toFixed(2)}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>


                {/* Ticket cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[60vh]">
                  {column.tickets
                    .sort((a: any, b: any) => {
                      // Priority first, then by date ascending
                      if (a.priority && !b.priority) return -1;
                      if (!a.priority && b.priority) return 1;
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    })
                    .map((ticket: any) => {
                      const hasRating = Array.isArray(ticket.ticket_ratings) ? ticket.ticket_ratings.length > 0 : !!ticket.ticket_ratings;
                      const hasNew = ticketsWithNewMessages.has(ticket.id);
                      const slaStatus = getSlaStatus(ticket, workSchedules, nowIso, ticket.ticket_lifecycle_events);
                      const cardCls =
                        slaStatus?.level === 'overdue' ? 'border-red-400 bg-red-200/60' :
                        slaStatus?.level === 'high' ? 'border-red-300 bg-red-100' :
                        slaStatus?.level === 'medium' ? 'border-yellow-300 bg-yellow-100' :
                        ticket.priority ? 'border-destructive/50 bg-destructive/5' :
                        hasNew ? 'border-primary bg-primary/5' : 'border-border bg-background';
                      return (
                        <div
                          key={ticket.id}
                          className={`rounded-lg border p-3 space-y-1.5 transition-all cursor-pointer hover:shadow-md ${cardCls}`}
                          onClick={() => { markTicketRead(ticket.id); onOpenDetail(ticket.id); }}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground">#{ticket.code}</span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                              ticket.status === 'ABERTO' ? 'bg-green-500/15 text-green-600' : 'bg-blue-500/15 text-blue-600'
                            }`}>{ticket.status}</span>
                            {ticket.priority && <span className="bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-0.5"><AlertTriangle size={10} /> PRIORITÁRIO</span>}
                            {ticket.reopened && <span className="bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full text-xs font-bold">REABERTO</span>}
                            {hasNew && <span className="text-xs text-destructive font-bold animate-pulse">💬</span>}
                            {slaStatus?.level === 'overdue' && <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">🚨 SLA VENCIDO</span>}
                            {slaStatus?.level === 'high' && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">🔴 ALTO RISCO SLA</span>}
                            {slaStatus?.level === 'medium' && <span className="bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full text-[10px] font-bold">🟡 MÉDIO RISCO SLA</span>}
                          </div>
                          {slaStatus && (
                            <p className={`text-xs font-semibold flex items-center gap-1 ${
                              slaStatus.level === 'overdue' ? 'text-red-700' :
                              slaStatus.level === 'high' ? 'text-red-700' :
                              slaStatus.level === 'medium' ? 'text-yellow-800' :
                              'text-muted-foreground'
                            }`}>
                              ⏱️ {slaStatus.level === 'overdue' ? `Vencido há ${formatRemainingMinutes(slaStatus.remainingMinutes)}` : `Falta ${formatRemainingMinutes(slaStatus.remainingMinutes)}`}
                            </p>
                          )}

                          <p className="text-xs font-medium text-foreground truncate">{ticket.services?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">👤 {getName(ticket.user_id)}</p>

                          {/* User profile details */}
                          {(() => {
                            const profile = profiles.find((p: any) => p.user_id === ticket.user_id);
                            if (!profile) return null;
                            return (
                              <div className="rounded border border-border/50 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground space-y-0.5">
                                {profile.sector && <p>🏢 <span className="font-medium text-foreground">{profile.sector}</span></p>}
                                {profile.function && <p>💼 <span className="font-medium text-foreground">{profile.function}</span></p>}
                                {profile.email && <p>✉️ <span className="font-medium text-foreground">{profile.email}</span></p>}
                                {profile.phone && <p>📞 <span className="font-medium text-foreground">{profile.phone}</span></p>}
                                {profile.leader_name && <p>👔 <span className="font-medium text-foreground">{profile.leader_name}</span></p>}
                              </div>
                            );
                          })()}

                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar size={10} /> {formatDateTime(ticket.created_at)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarClock size={10} /> Prev: {formatDateTime(calcExpectedCloseDate(ticket.created_at, ticket.services?.sla_hours).toISOString())}
                            <span className="relative group cursor-help">
                              <Info size={10} className="text-primary/70 hover:text-primary" />
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-popover text-popover-foreground text-xs leading-relaxed rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50">
                                <strong>📐 Como é calculado?</strong><br/>
                                O prazo é de <strong>{ticket.services?.sla_hours ?? 12}h úteis</strong> (SLA do serviço) a partir da criação do ticket.<br/><br/>
                                <strong>Expediente do atendente:</strong><br/>
                                {renderAttendantSchedule
                                  ? renderAttendantSchedule(ticket.attendant_id)
                                  : <>🕐 Seg a Sex: 8h–12h e 14h–18h<br/>🕐 Sábado: 8h–12h<br/>🚫 Domingo: não conta<br/></>}
                                <br/>
                                Somente horas dentro do expediente são contabilizadas.
                              </span>
                            </span>
                          </p>

                          {hasRating && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent">
                              <Star size={10} fill="currentColor" /> Nota {Array.isArray(ticket.ticket_ratings) ? ticket.ticket_ratings[0]?.score : ticket.ticket_ratings?.score}
                            </span>
                          )}

                          {/* Quick actions */}
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                            {ticket.status === 'ABERTO' && (
                              <>
                                <button onClick={() => onClose(ticket.id)} className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/50 hover:bg-muted transition-colors">
                                  <XIcon size={10} className="inline mr-0.5" />Fechar
                                </button>
                                <button onClick={() => onTransfer(ticket)} className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/50 hover:bg-muted transition-colors">
                                  <ArrowRightLeft size={10} className="inline mr-0.5" />Transferir
                                </button>
                              </>
                            )}
                            {ticket.status === 'ABERTO' && (
                              <button onClick={() => onTogglePriority(ticket.id, !ticket.priority)} className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${ticket.priority ? 'text-destructive border-destructive/30 hover:bg-destructive/5' : 'text-warning border-warning/30 hover:bg-warning/5'}`}>
                                <AlertTriangle size={10} className="inline mr-0.5" />{ticket.priority ? 'Remover' : 'Priorizar'}
                              </button>
                            )}
                            <button onClick={() => onDelete(ticket.id)} className="text-xs text-destructive hover:text-destructive/80 px-1.5 py-0.5 rounded border border-destructive/30 hover:bg-destructive/5 transition-colors ml-auto">
                              <Trash2 size={10} className="inline mr-0.5" />Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminKanbanView;
