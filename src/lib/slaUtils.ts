// Cálculo de horas úteis (mesma lógica do Dashboard) compartilhado
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function calcBusinessHours(
  createdAt: string,
  endAt: string,
  schedules: any[],
  attendantId: string,
): number {
  const start = new Date(createdAt);
  const end = new Date(endAt);
  if (end <= start) return 0;
  const attSchedules = schedules.filter((s: any) => s.attendant_id === attendantId);
  if (attSchedules.length === 0) return (end.getTime() - start.getTime()) / (1000 * 60 * 60);

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

  let totalMinutes = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const dow = current.getDay();
    const slots = dayMap[dow];
    if (slots) {
      for (const slot of slots) {
        const dayStart = new Date(current); dayStart.setHours(0, 0, 0, 0);
        const workStart = new Date(dayStart); workStart.setMinutes(slot.startMin);
        const workEnd = new Date(dayStart); workEnd.setMinutes(slot.endMin);
        const lunchStart = new Date(dayStart); lunchStart.setMinutes(slot.lunchStartMin);
        const lunchEnd = new Date(dayStart); lunchEnd.setMinutes(slot.lunchEndMin);
        const effectiveStart = start > workStart ? start : workStart;
        const effectiveEnd = end < workEnd ? end : workEnd;
        if (effectiveStart < effectiveEnd) {
          let minutes = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);
          const lo = effectiveStart > lunchStart ? effectiveStart : lunchStart;
          const le = effectiveEnd < lunchEnd ? effectiveEnd : lunchEnd;
          if (lo < le) minutes -= (le.getTime() - lo.getTime()) / (1000 * 60);
          totalMinutes += Math.max(0, minutes);
        }
      }
    }
    current.setDate(current.getDate() + 1);
    if (current > end) break;
  }
  return totalMinutes / 60;
}

export type SlaRisk = 'ok' | 'medium' | 'high' | 'overdue';
export interface SlaStatus { remainingMinutes: number; level: SlaRisk; slaMinutes: number; }

export interface LifecycleEvent { event_type: 'closed' | 'reopened'; event_at: string; }

/**
 * Soma horas úteis considerando apenas os períodos em que o ticket esteve ABERTO.
 * Usa `ticket_lifecycle_events` para reconstruir os intervalos abertos/fechados
 * (ticket reaberto não deve "recontar" o SLA já consumido antes do fechamento).
 */
export function calcBusinessHoursOpen(
  ticket: any,
  events: LifecycleEvent[] | undefined,
  endAt: string,
  schedules: any[],
): number {
  const sorted = (events || [])
    .slice()
    .sort((a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime());
  const endTs = new Date(endAt).getTime();

  const intervals: Array<[string, string]> = [];
  let openStart: string | null = ticket.created_at;
  for (const ev of sorted) {
    if (ev.event_type === 'closed' && openStart) {
      const evTs = new Date(ev.event_at).getTime();
      if (evTs > new Date(openStart).getTime()) {
        intervals.push([openStart, ev.event_at]);
      }
      openStart = null;
    } else if (ev.event_type === 'reopened' && !openStart) {
      openStart = ev.event_at;
    }
  }
  if (openStart) {
    const startTs = new Date(openStart).getTime();
    if (endTs > startTs) intervals.push([openStart, endAt]);
  }

  let total = 0;
  for (const [s, e] of intervals) {
    total += calcBusinessHours(s, e, schedules, ticket.attendant_id);
  }
  return total;
}

export function getSlaStatus(
  ticket: any,
  workSchedules: any[],
  nowIso: string,
  events?: LifecycleEvent[],
): SlaStatus | null {
  const slaHours = ticket?.services?.sla_hours;
  if (!slaHours || slaHours <= 0) return null;
  if (ticket?.status !== 'ABERTO') return null;
  const slaMinutes = slaHours * 60;
  const elapsedH = calcBusinessHoursOpen(ticket, events, nowIso, workSchedules || []);
  const remainingMinutes = Math.round(slaMinutes - elapsedH * 60);
  let level: SlaRisk;
  if (remainingMinutes <= 0) level = 'overdue';
  else if (remainingMinutes / slaMinutes <= 0.10) level = 'high';
  else if (remainingMinutes / slaMinutes <= 0.30) level = 'medium';
  else level = 'ok';
  return { remainingMinutes, level, slaMinutes };
}


export function formatRemainingMinutes(min: number): string {
  const abs = Math.abs(min);
  const days = Math.floor(abs / (60 * 24));
  const h = Math.floor((abs % (60 * 24)) / 60);
  const m = abs % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}
