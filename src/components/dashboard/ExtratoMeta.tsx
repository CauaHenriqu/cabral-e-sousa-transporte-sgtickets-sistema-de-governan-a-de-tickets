import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { calcBusinessHours, calcBusinessHoursOpen, timeToMinutes } from '@/lib/slaUtils';
import MultiSelectFilter from './MultiSelectFilter';

interface ExtratoMetaProps {
  tickets: any[];
  workSchedules: any[];
  serviceSlaMap: Record<string, number>;
  slaGoalPercent: number;
  ratingGoal: number;
  attendantProfiles?: any[];
  requesterProfiles?: any[];
}

// Avança `slaHours` horas úteis a partir de `start`, respeitando os horários
// do atendente (com pausa de almoço). Sem horários cadastrados, usa horas corridas.
function addBusinessHours(start: Date, slaHours: number, schedules: any[], attendantId: string): Date {
  const attSchedules = schedules.filter((s: any) => s.attendant_id === attendantId);
  if (attSchedules.length === 0 || slaHours <= 0) {
    return new Date(start.getTime() + slaHours * 60 * 60 * 1000);
  }
  const dayMap: Record<number, { startMin: number; endMin: number; lunchStartMin: number; lunchEndMin: number }[]> = {};
  for (const s of attSchedules) {
    const dow = s.day_of_week;
    if (!dayMap[dow]) dayMap[dow] = [];
    dayMap[dow].push({
      startMin: timeToMinutes(s.start_time),
      endMin: timeToMinutes(s.end_time),
      lunchStartMin: timeToMinutes(s.lunch_start || '12:00'),
      lunchEndMin: timeToMinutes(s.lunch_end || '14:00'),
    });
  }
  let remainingMin = slaHours * 60;
  const cursor = new Date(start);
  for (let i = 0; i < 365 && remainingMin > 0; i++) {
    const dow = cursor.getDay();
    const slots = (dayMap[dow] || []).slice().sort((a, b) => a.startMin - b.startMin);
    for (const slot of slots) {
      if (remainingMin <= 0) break;
      const dayBase = new Date(cursor); dayBase.setHours(0, 0, 0, 0);
      const workStart = new Date(dayBase); workStart.setMinutes(slot.startMin);
      const workEnd = new Date(dayBase); workEnd.setMinutes(slot.endMin);
      const lunchStart = new Date(dayBase); lunchStart.setMinutes(slot.lunchStartMin);
      const lunchEnd = new Date(dayBase); lunchEnd.setMinutes(slot.lunchEndMin);
      const pieces: { from: Date; to: Date }[] = [];
      if (lunchStart > workStart && lunchStart < workEnd) {
        pieces.push({ from: workStart, to: new Date(Math.min(lunchStart.getTime(), workEnd.getTime())) });
        if (lunchEnd < workEnd) pieces.push({ from: lunchEnd, to: workEnd });
      } else {
        pieces.push({ from: workStart, to: workEnd });
      }
      for (const p of pieces) {
        if (remainingMin <= 0) break;
        const from = cursor > p.from ? cursor : p.from;
        if (from >= p.to) continue;
        const availableMin = (p.to.getTime() - from.getTime()) / (1000 * 60);
        if (availableMin <= remainingMin) {
          remainingMin -= availableMin;
          cursor.setTime(p.to.getTime());
        } else {
          return new Date(from.getTime() + remainingMin * 60 * 1000);
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return cursor;
}

const ExtratoMeta: React.FC<ExtratoMetaProps> = ({
  tickets,
  workSchedules,
  serviceSlaMap,
  slaGoalPercent,
  ratingGoal,
  attendantProfiles = [],
  requesterProfiles = [],
}) => {
  const now = new Date().toISOString();

  const attendantNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of attendantProfiles as any[]) {
      if (a?.user_id) m[a.user_id] = a.name || '—';
    }
    return m;
  }, [attendantProfiles]);

  const requesterNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of requesterProfiles as any[]) {
      if (a?.user_id) m[a.user_id] = a.name || '—';
    }
    return m;
  }, [requesterProfiles]);

  const allRows = useMemo(() => {
    return tickets.map((t: any) => {
      const endDate = t.status === 'FECHADO' && t.closed_at ? t.closed_at : now;
      const hoursSpent = calcBusinessHoursOpen(t, t.ticket_lifecycle_events, endDate, workSchedules);
      const slaHours = serviceSlaMap[t.service_id];
      const hasSla = slaHours != null;
      const slaOk = hasSla ? hoursSpent <= slaHours : null;

      const score = Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
      const ratingOk = score != null ? score >= ratingGoal : null;

      const createdDate = new Date(t.created_at);
      const closedDate = t.closed_at ? new Date(t.closed_at) : null;
      const isCrossMonth = closedDate
        ? createdDate.getFullYear() !== closedDate.getFullYear() || createdDate.getMonth() !== closedDate.getMonth()
        : false;

      const expectedCloseAt = hasSla
        ? addBusinessHours(createdDate, slaHours, workSchedules, t.attendant_id).toISOString()
        : null;

      return {
        code: t.code,
        attendantId: t.attendant_id,
        requesterId: t.user_id,
        attendantName: attendantNameMap[t.attendant_id] || '—',
        requesterName: requesterNameMap[t.user_id] || '—',
        createdAt: t.created_at,
        closedAt: t.closed_at,
        expectedCloseAt,
        status: t.status,
        hoursSpent: parseFloat(hoursSpent.toFixed(2)),
        slaHours,
        hasSla,
        score,
        slaOk,
        ratingOk,
        isCrossMonth,
        crossMonthDeduction: isCrossMonth ? 1 : 0,
      };
    }).sort((a: any, b: any) => a.code - b.code);
  }, [tickets, workSchedules, now, serviceSlaMap, ratingGoal, attendantNameMap, requesterNameMap]);

  // Filtros
  const [filterCodes, setFilterCodes] = useState<string[]>([]);
  const [filterAttendants, setFilterAttendants] = useState<string[]>([]);
  const [filterRequesters, setFilterRequesters] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterRatings, setFilterRatings] = useState<string[]>([]);
  const [filterMetaSla, setFilterMetaSla] = useState<string[]>([]);
  const [filterMetaRating, setFilterMetaRating] = useState<string[]>([]);

  const codeOptions = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.code)))
      .sort((a, b) => a - b)
      .map((c) => ({ value: String(c), label: `#${c}` })),
    [allRows],
  );
  const attendantOptions = useMemo(
    () => Array.from(new Map(allRows.map((r) => [r.attendantId, r.attendantName])).entries())
      .filter(([id]) => id)
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .map(([id, name]) => ({ value: String(id), label: String(name) })),
    [allRows],
  );
  const requesterOptions = useMemo(
    () => Array.from(new Map(allRows.map((r) => [r.requesterId, r.requesterName])).entries())
      .filter(([id]) => id)
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .map(([id, name]) => ({ value: String(id), label: String(name) })),
    [allRows],
  );
  const statusOptions = [
    { value: 'ABERTO', label: 'Aberto' },
    { value: 'FECHADO', label: 'Fechado' },
  ];
  const ratingOptions = [
    { value: '5', label: '5' },
    { value: '4', label: '4' },
    { value: '3', label: '3' },
    { value: '2', label: '2' },
    { value: '1', label: '1' },
    { value: 'none', label: 'Sem avaliação' },
  ];
  const metaOptions = [
    { value: 'ok', label: 'Atingiu' },
    { value: 'fail', label: 'Não atingiu' },
    { value: 'na', label: 'N/A' },
  ];

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (filterCodes.length > 0 && !filterCodes.includes(String(r.code))) return false;
      if (filterAttendants.length > 0 && !filterAttendants.includes(String(r.attendantId))) return false;
      if (filterRequesters.length > 0 && !filterRequesters.includes(String(r.requesterId))) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(r.status)) return false;
      if (filterRatings.length > 0) {
        const key = r.score == null ? 'none' : String(r.score);
        if (!filterRatings.includes(key)) return false;
      }
      if (filterMetaSla.length > 0) {
        const key = r.slaOk === null ? 'na' : r.slaOk ? 'ok' : 'fail';
        if (!filterMetaSla.includes(key)) return false;
      }
      if (filterMetaRating.length > 0) {
        const key = r.ratingOk === null ? 'na' : r.ratingOk ? 'ok' : 'fail';
        if (!filterMetaRating.includes(key)) return false;
      }
      return true;
    });
  }, [allRows, filterCodes, filterAttendants, filterRequesters, filterStatus, filterRatings, filterMetaSla, filterMetaRating]);

  const hasActiveFilter =
    filterCodes.length + filterAttendants.length + filterRequesters.length +
    filterStatus.length + filterRatings.length + filterMetaSla.length + filterMetaRating.length > 0;

  const clearFilters = () => {
    setFilterCodes([]);
    setFilterAttendants([]);
    setFilterRequesters([]);
    setFilterStatus([]);
    setFilterRatings([]);
    setFilterMetaSla([]);
    setFilterMetaRating([]);
  };

  const summary = useMemo(() => {
    const slaEligible = rows.filter((r: any) => r.slaOk !== null);
    const totalSlaOk = slaEligible.filter((r: any) => r.slaOk).length;
    const slaPercent = slaEligible.length > 0 ? (totalSlaOk / slaEligible.length) * 100 : 0;

    const ratedRows = rows.filter((r: any) => r.ratingOk !== null);
    const totalRatingOk = ratedRows.filter((r: any) => r.ratingOk).length;

    const crossMonthCount = rows.filter((r: any) => r.isCrossMonth).length;
    return {
      totalSlaOk,
      slaEligibleCount: slaEligible.length,
      slaPercent,
      slaPercentAdjusted: Math.max(0, slaPercent - crossMonthCount),
      totalRatingOk,
      ratedCount: ratedRows.length,
      crossMonthCount,
    };
  }, [rows]);

  const formatDateTime = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatHours = (h: number) => {
    if (h >= 24) return `${(h / 24).toFixed(2)} d`;
    return `${h.toFixed(2)} h`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={20} className="text-primary" />
          <h3 className="text-[1rem] font-extrabold text-foreground">📋 Extrato da Meta</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <div>
              <p className="text-[0.6875rem] text-muted-foreground font-semibold">Meta SLA (≥ {slaGoalPercent}%)</p>
              <p className="text-[0.875rem] font-black text-foreground">
                {summary.totalSlaOk}/{summary.slaEligibleCount} tickets
                <span className="text-[0.625rem] font-semibold text-muted-foreground ml-1">
                  ({summary.slaPercent.toFixed(1)}%)
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2">
            <CheckCircle2 size={16} className="text-blue-500" />
            <div>
              <p className="text-[0.6875rem] text-muted-foreground font-semibold">Meta Avaliação (≥ {ratingGoal})</p>
              <p className="text-[0.875rem] font-black text-foreground">
                {summary.totalRatingOk}/{summary.ratedCount} avaliados
                <span className="text-[0.625rem] font-semibold text-muted-foreground ml-1">
                  ({summary.ratedCount > 0 ? ((summary.totalRatingOk / summary.ratedCount) * 100).toFixed(0) : 0}%)
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <div>
              <p className="text-[0.6875rem] text-muted-foreground font-semibold">Dedução cross-mês</p>
              <p className="text-[0.875rem] font-black text-foreground">
                {summary.crossMonthCount} tickets
                <span className="text-[0.625rem] font-semibold text-amber-600 ml-1">
                  (−{summary.crossMonthCount}% no SLA mensal)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <MultiSelectFilter
            label="Nº"
            allLabel="Todos os nº"
            options={codeOptions}
            selected={filterCodes}
            onChange={setFilterCodes}
            width="min-w-[8rem]"
          />
          <MultiSelectFilter
            label="Atendente"
            allLabel="Todos atendentes"
            options={attendantOptions}
            selected={filterAttendants}
            onChange={setFilterAttendants}
          />
          <MultiSelectFilter
            label="Solicitante"
            allLabel="Todos solicitantes"
            options={requesterOptions}
            selected={filterRequesters}
            onChange={setFilterRequesters}
          />
          <MultiSelectFilter
            label="Fechamento"
            allLabel="Todos status"
            options={statusOptions}
            selected={filterStatus}
            onChange={setFilterStatus}
            width="min-w-[9rem]"
          />
          <MultiSelectFilter
            label="Avaliação"
            allLabel="Todas avaliações"
            options={ratingOptions}
            selected={filterRatings}
            onChange={setFilterRatings}
            width="min-w-[9rem]"
          />
          <MultiSelectFilter
            label="Meta SLA"
            allLabel="Toda meta SLA"
            options={metaOptions}
            selected={filterMetaSla}
            onChange={setFilterMetaSla}
            width="min-w-[9rem]"
          />
          <MultiSelectFilter
            label="Meta Aval."
            allLabel="Toda meta avaliação"
            options={metaOptions}
            selected={filterMetaRating}
            onChange={setFilterMetaRating}
            width="min-w-[10rem]"
          />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[0.75rem] font-semibold text-primary hover:underline px-2 py-1"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
        <table className="w-full text-[0.75rem]">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground">Nº</th>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground">Atendente</th>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground">Solicitante</th>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground">Abertura</th>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground">Previsão Fechamento</th>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground">Fechamento</th>
              <th className="px-3 py-2 text-right font-bold text-muted-foreground">Tempo Útil</th>
              <th className="px-3 py-2 text-right font-bold text-muted-foreground">SLA Serviço</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground">Avaliação</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground">Meta SLA</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground">Meta Avaliação</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground">Obs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, i: number) => {
              const hasIssue = row.slaOk === false || row.ratingOk === false || row.isCrossMonth;
              return (
                <tr
                  key={row.code}
                  className={`border-b border-border/50 transition-colors ${
                    hasIssue ? 'bg-destructive/5' : i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  }`}
                >
                  <td className="px-3 py-2 font-bold text-foreground">#{row.code}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.attendantName}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.requesterName}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDateTime(row.expectedCloseAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {row.status === 'FECHADO' ? formatDateTime(row.closedAt) : (
                      <span className="text-amber-600 font-semibold">Aberto</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${
                    row.slaOk === null ? 'text-muted-foreground' : row.slaOk ? 'text-green-600' : 'text-destructive'
                  }`}>
                    {formatHours(row.hoursSpent)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {row.hasSla ? formatHours(row.slaHours) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-foreground">
                    {row.score != null ? `${row.score}/5` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.slaOk === null
                      ? <span className="text-muted-foreground">—</span>
                      : row.slaOk
                        ? <CheckCircle2 size={16} className="text-green-500 inline" />
                        : <XCircle size={16} className="text-destructive inline" />
                    }
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.ratingOk === null
                      ? <span className="text-muted-foreground">—</span>
                      : row.ratingOk
                        ? <CheckCircle2 size={16} className="text-green-500 inline" />
                        : <XCircle size={16} className="text-destructive inline" />
                    }
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.isCrossMonth && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[0.625rem] font-bold px-2 py-0.5 rounded-full">
                        <AlertTriangle size={10} /> −{row.crossMonthDeduction}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum ticket encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default ExtratoMeta;
