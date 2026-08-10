import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import MetricCards from '@/components/dashboard/MetricCards';
import Chart3DBar from '@/components/dashboard/Chart3DBar';
import Chart3DPie from '@/components/dashboard/Chart3DPie';
import ExtratoMeta from '@/components/dashboard/ExtratoMeta';
import ExtratoAvaliacao from '@/components/dashboard/ExtratoAvaliacao';
import ExtratoTempoServico from '@/components/dashboard/ExtratoTempoServico';
import { motion } from 'framer-motion';
import { calcBusinessHoursOpen } from '@/lib/slaUtils';

const SLA_META = 1.5;

function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
}

function calcBusinessDays(createdAt: string, closedAt: string, schedules: any[], attendantId: string): number {
  const start = new Date(createdAt);
  const end = new Date(closedAt);
  if (end <= start) return 0;
  const attSchedules = schedules.filter((s: any) => s.attendant_id === attendantId);
  if (attSchedules.length === 0) return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  const dayMap: Record<number, { startMin: number; endMin: number; lunchStartMin: number; lunchEndMin: number }[]> = {};
  for (const s of attSchedules) {
    const dow = s.day_of_week;
    if (!dayMap[dow]) dayMap[dow] = [];
    dayMap[dow].push({
      startMin: timeToMinutes(s.start_time), endMin: timeToMinutes(s.end_time),
      lunchStartMin: timeToMinutes(s.lunch_start || '12:00'), lunchEndMin: timeToMinutes(s.lunch_end || '14:00'),
    });
  }

  let totalMinutes = 0;
  const current = new Date(start); current.setHours(0, 0, 0, 0);
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

  let totalDailyMinutes = 0;
  for (const s of attSchedules) {
    totalDailyMinutes += (timeToMinutes(s.end_time) - timeToMinutes(s.start_time)) -
      (timeToMinutes(s.lunch_end || '14:00') - timeToMinutes(s.lunch_start || '12:00'));
  }
  const avgDailyMinutes = attSchedules.length > 0 ? totalDailyMinutes / attSchedules.length : 480;
  const result = avgDailyMinutes > 0 ? totalMinutes / avgDailyMinutes : 0;
  // Se houve tempo real transcorrido mas caiu fora do expediente, garantir valor mínimo
  if (result === 0 && end > start) return 0.01;
  return result;
}

// Calcula horas úteis (expediente do atendente, descontando almoço). Sem schedules => tempo corrido em horas.
function calcBusinessHours(createdAt: string, endAt: string, schedules: any[], attendantId: string): number {
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
      startMin: timeToMinutes(s.start_time), endMin: timeToMinutes(s.end_time),
      lunchStartMin: timeToMinutes(s.lunch_start || '12:00'), lunchEndMin: timeToMinutes(s.lunch_end || '14:00'),
    });
  }

  let totalMinutes = 0;
  const current = new Date(start); current.setHours(0, 0, 0, 0);
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

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

  const [filters, setFilters] = useState<{ dateFrom: string; dateTo: string; attendantIds: string[]; userIds: string[]; sectors: string[] }>({ dateFrom: firstDayOfMonth, dateTo: lastDayOfMonth, attendantIds: [], userIds: [], sectors: [] });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('*, ticket_ratings(score, reason), ticket_lifecycle_events(event_type,event_at)');
      if (error) throw error;
      return data;
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name, sector, function, status');
      if (error) throw error;
      return data;
    },
  });

  const { data: attendantRoles = [] } = useQuery({
    queryKey: ['attendant-role-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id').eq('role', 'attendant');
      if (error) throw error;
      return data;
    },
  });

  const { data: workSchedules = [] } = useQuery({
    queryKey: ['work-schedules-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('work_schedules').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('id, name, sla_hours');
      if (error) throw error;
      return data;
    },
  });

  const { data: appSettings } = useQuery({
    queryKey: ['app-settings-dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('sla_goal_percent, rating_goal, rating_justification_threshold').eq('id', 1).maybeSingle();
      return data;
    },
  });

  const slaGoalPercent = Number(appSettings?.sla_goal_percent ?? 90);
  const ratingGoal = Number(appSettings?.rating_goal ?? 3);
  const ratingJustifyThreshold = Number(appSettings?.rating_justification_threshold ?? 3);

  const serviceSlaMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of services as any[]) m[s.id] = s.sla_hours;
    return m;
  }, [services]);

  const attendantIds = new Set(attendantRoles.map((r: any) => r.user_id));
  const attendantProfiles = allProfiles.filter((p: any) => attendantIds.has(p.user_id) && p.status === 'Ativo');
  const userProfiles = allProfiles.filter((p: any) => !attendantIds.has(p.user_id));
  const sectors = useMemo(() => {
    const set = new Set(allProfiles.map((p: any) => p.sector).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [allProfiles]);

  const profileMap = useMemo(() => {
    const map: Record<string, { name: string; sector: string }> = {};
    for (const p of allProfiles) map[p.user_id] = { name: p.name, sector: p.sector };
    return map;
  }, [allProfiles]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t: any) => {
      if (filters.dateFrom) {
        const from = new Date(`${filters.dateFrom}T00:00:00`);
        if (new Date(t.created_at) < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(`${filters.dateTo}T23:59:59.999`);
        if (new Date(t.created_at) > to) return false;
      }
      if (filters.attendantIds.length > 0 && !filters.attendantIds.includes(t.attendant_id)) return false;
      if (filters.userIds.length > 0 && !filters.userIds.includes(t.user_id)) return false;
      if (filters.sectors.length > 0) {
        const profile = profileMap[t.user_id];
        if (!profile || !filters.sectors.includes(profile.sector)) return false;
      }
      return true;
    });
  }, [tickets, filters, profileMap]);

  const totalTickets = filteredTickets.length;
  const openTickets = filteredTickets.filter((t: any) => t.status === 'ABERTO').length;
  const closedTickets = filteredTickets.filter((t: any) => t.status === 'FECHADO').length;
  const ratedTickets = filteredTickets.filter((t: any) => Array.isArray(t.ticket_ratings) ? t.ticket_ratings.length > 0 : !!t.ticket_ratings);
  const avgRating = ratedTickets.length > 0
    ? ratedTickets.reduce((sum: number, t: any) => {
      const score = Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
      return sum + (score || 0);
    }, 0) / ratedTickets.length : 0;
  const now = new Date().toISOString();

  // ===== % SLA: proporção de tickets com horas úteis gastas <= sla_hours do serviço =====
  const slaEligibleTickets = useMemo(
    () => filteredTickets.filter((t: any) => t.created_at && serviceSlaMap[t.service_id] != null),
    [filteredTickets, serviceSlaMap]
  );

  const isWithinSla = (t: any) => {
    const endDate = t.status === 'FECHADO' && t.closed_at ? t.closed_at : now;
    const hoursSpent = calcBusinessHoursOpen(t, t.ticket_lifecycle_events, endDate, workSchedules);
    return hoursSpent <= (serviceSlaMap[t.service_id] ?? Infinity);
  };

  const overallSlaPercent = slaEligibleTickets.length > 0
    ? (slaEligibleTickets.filter(isWithinSla).length / slaEligibleTickets.length) * 100
    : 0;

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const attendantSlaPercent = useMemo(() => {
    return attendantProfiles.map((att: any) => {
      const attTickets = slaEligibleTickets.filter((t: any) => t.attendant_id === att.user_id);
      const within = attTickets.filter(isWithinSla).length;
      const pct = attTickets.length > 0 ? (within / attTickets.length) * 100 : 0;
      return { name: att.name.split(' ')[0], avg: parseFloat(pct.toFixed(1)), count: attTickets.length };
    });
  }, [attendantProfiles, slaEligibleTickets, workSchedules, serviceSlaMap, now]);

  const monthlySlaPercent = useMemo(() => {
    const map: Record<string, { within: number; total: number; crossMonth: number }> = {};
    for (const t of slaEligibleTickets) {
      const refDate = new Date(t.status === 'FECHADO' && t.closed_at ? t.closed_at : t.created_at);
      const key = `${refDate.getFullYear()}-${String(refDate.getMonth()).padStart(2, '0')}`;
      if (!map[key]) map[key] = { within: 0, total: 0, crossMonth: 0 };
      map[key].total += 1;
      if (isWithinSla(t)) map[key].within += 1;
      // dedução cross-mês: ticket fechado em mês diferente do mês de criação
      if (t.status === 'FECHADO' && t.closed_at) {
        const created = new Date(t.created_at);
        if (created.getFullYear() !== refDate.getFullYear() || created.getMonth() !== refDate.getMonth()) {
          map[key].crossMonth += 1;
        }
      }
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => {
      const [year, mon] = key.split('-');
      const rawPct = v.total > 0 ? (v.within / v.total) * 100 : 0;
      const adjusted = Math.max(0, rawPct - v.crossMonth);
      return { name: `${monthNames[parseInt(mon)]}/${year.slice(2)}`, avg: parseFloat(adjusted.toFixed(1)) };
    });
  }, [slaEligibleTickets, workSchedules, serviceSlaMap, now]);

  const attendantNPS = attendantProfiles.map((att: any) => {
    const attRated = ratedTickets.filter((t: any) => t.attendant_id === att.user_id);
    const avg = attRated.length > 0
      ? attRated.reduce((sum: number, t: any) => {
        const score = Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
        return sum + (score || 0);
      }, 0) / attRated.length : 0;
    return { name: att.name.split(' ')[0], avg: parseFloat(avg.toFixed(1)) };
  });

  const monthlyNPS = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const t of ratedTickets) {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += (Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score) || 0;
      map[key].count += 1;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => {
      const [year, mon] = key.split('-');
      return { name: `${monthNames[parseInt(mon)]}/${year.slice(2)}`, avg: parseFloat((v.total / v.count).toFixed(1)) };
    });
  }, [ratedTickets]);

  const sectorSlaPercent = useMemo(() => {
    const map: Record<string, { within: number; total: number }> = {};
    for (const t of slaEligibleTickets) {
      const sector = profileMap[t.user_id]?.sector || 'Sem setor';
      if (!map[sector]) map[sector] = { within: 0, total: 0 };
      map[sector].total += 1;
      if (isWithinSla(t)) map[sector].within += 1;
    }
    return Object.entries(map).map(([sector, v]) => ({
      name: sector,
      avg: parseFloat(((v.within / v.total) * 100).toFixed(1)),
    })).sort((a, b) => b.avg - a.avg);
  }, [slaEligibleTickets, profileMap, workSchedules, serviceSlaMap, now]);

  const sectorNPS = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const t of ratedTickets) {
      const sector = profileMap[t.user_id]?.sector || 'Sem setor';
      const score = (Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score) || 0;
      if (!map[sector]) map[sector] = { total: 0, count: 0 };
      map[sector].total += score;
      map[sector].count += 1;
    }
    return Object.entries(map).map(([sector, v]) => ({
      name: sector,
      avg: parseFloat((v.total / v.count).toFixed(1)),
    })).sort((a, b) => b.avg - a.avg);
  }, [ratedTickets, profileMap]);

  const npsDistribution = (() => {
    const getScore = (t: any) => Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
    return [
      { name: '⭐ Muito Satisfeito (5)', value: ratedTickets.filter((t: any) => getScore(t) === 5).length, fill: 'hsl(152, 55%, 55%)' },
      { name: '😊 Satisfeito (4)', value: ratedTickets.filter((t: any) => getScore(t) === 4).length, fill: 'hsl(180, 40%, 52%)' },
      { name: '😐 Parcial (3)', value: ratedTickets.filter((t: any) => getScore(t) === 3).length, fill: 'hsl(40, 85%, 58%)' },
      { name: '😞 Insatisfeito (2)', value: ratedTickets.filter((t: any) => getScore(t) === 2).length, fill: 'hsl(20, 75%, 62%)' },
      { name: '😡 Muito Insatisfeito (1)', value: ratedTickets.filter((t: any) => getScore(t) === 1).length, fill: 'hsl(350, 55%, 58%)' },
    ].filter(d => d.value > 0);
  })();

  const npsDistributionBySector = useMemo(() => {
    const palette = ['hsl(152, 55%, 50%)', 'hsl(208, 50%, 55%)', 'hsl(40, 80%, 55%)', 'hsl(20, 72%, 58%)', 'hsl(350, 55%, 55%)', 'hsl(270, 45%, 60%)', 'hsl(120, 40%, 50%)', 'hsl(0, 50%, 55%)', 'hsl(45, 60%, 50%)', 'hsl(190, 55%, 50%)'];
    const map: Record<string, number> = {};
    for (const t of ratedTickets) {
      const sector = profileMap[t.user_id]?.sector || 'Sem setor';
      map[sector] = (map[sector] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({ name, value, fill: palette[i % palette.length] }));
  }, [ratedTickets, profileMap]);

  const avgRatingBySector = useMemo(() => {
    const palette = ['hsl(152, 55%, 50%)', 'hsl(208, 50%, 55%)', 'hsl(40, 80%, 55%)', 'hsl(20, 72%, 58%)', 'hsl(350, 55%, 55%)', 'hsl(270, 45%, 60%)', 'hsl(120, 40%, 50%)', 'hsl(0, 50%, 55%)', 'hsl(45, 60%, 50%)', 'hsl(190, 55%, 50%)'];
    return sectorNPS.map((s, i) => ({ name: s.name, value: s.avg, fill: palette[i % palette.length] }));
  }, [sectorNPS]);


  return (
    <div className="space-y-7">
      <DashboardFilters filters={filters} onFiltersChange={setFilters} attendants={attendantProfiles} users={userProfiles} sectors={sectors} />

      <MetricCards
        totalTickets={totalTickets}
        openTickets={openTickets}
        closedTickets={closedTickets}
        avgRating={avgRating}
        slaPercent={overallSlaPercent}
        slaGoalPercent={slaGoalPercent}
        ratingGoal={ratingGoal}
        ratingJustifyThreshold={ratingJustifyThreshold}
      />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-primary to-primary/50" />
        <h2 className="text-lg font-extrabold text-foreground">👥 Por Atendente</h2>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart3DBar icon="🎯" title="% SLA por Atendente" subtitle={`Meta: ≥ ${slaGoalPercent}% | Tickets dentro do SLA do serviço`} data={attendantSlaPercent} meta={slaGoalPercent} higherIsBetter yDomain={[0, 100]} />
        <Chart3DBar icon="⭐" title="Avaliação Média por Atendente (NPS)" subtitle={`Meta: ≥ ${ratingGoal} | 5=Muito Satisfeito → 1=Muito Insatisfeito`} data={attendantNPS} meta={ratingGoal} higherIsBetter yDomain={[0, 5]} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-secondary to-secondary/50" />
        <h2 className="text-lg font-extrabold text-foreground">📆 Por Mês</h2>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart3DBar icon="🎯" title="% SLA Mensal" subtitle={`Meta: ≥ ${slaGoalPercent}% | Dedução de 1% por ticket fechado fora do mês de criação`} data={monthlySlaPercent} meta={slaGoalPercent} higherIsBetter yDomain={[0, 100]} />
        <Chart3DBar icon="📊" title="Avaliação Média Mensal (NPS)" subtitle={`Meta: ≥ ${ratingGoal} | 5=Muito Satisfeito → 1=Muito Insatisfeito`} data={monthlyNPS} meta={ratingGoal} higherIsBetter yDomain={[0, 5]} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-accent to-accent/50" />
        <h2 className="text-lg font-extrabold text-foreground">🏢 Por Setor Solicitante</h2>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart3DBar icon="🎯" title="% SLA por Setor" subtitle={`Meta: ≥ ${slaGoalPercent}% | Tickets dentro do SLA do serviço`} data={sectorSlaPercent} meta={slaGoalPercent} higherIsBetter yDomain={[0, 100]} />
        <Chart3DBar icon="📊" title="Avaliação Média por Setor (NPS)" subtitle={`Meta: ≥ ${ratingGoal} | 5=Muito Satisfeito → 1=Muito Insatisfeito`} data={sectorNPS} meta={ratingGoal} higherIsBetter yDomain={[0, 5]} />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {npsDistribution.length > 0 && (
          <Chart3DPie icon="📈" title="Distribuição de Avaliações NPS" subtitle={`Avaliações ≤ ${ratingJustifyThreshold} exigem justificativa obrigatória`} data={npsDistribution} />
        )}

        {npsDistributionBySector.length > 0 && (
          <Chart3DPie icon="🏢" title="Distribuição de Quantidade de Avaliações por Setor Solicitante" subtitle="Quantidade de avaliações recebidas por setor" data={npsDistributionBySector} />
        )}

        {avgRatingBySector.length > 0 && (
          <Chart3DPie icon="⭐" title="Média de Avaliação por Setor Solicitante" subtitle="Nota média (0 a 5) recebida por setor" data={avgRatingBySector} />
        )}
      </div>

      <ExtratoTempoServico
        tickets={filteredTickets}
        workSchedules={workSchedules}
        services={services}
      />

      <ExtratoAvaliacao
        tickets={filteredTickets}
        requesterProfiles={allProfiles}
        ratingGoal={ratingGoal}
      />

      <ExtratoMeta
        tickets={filteredTickets}
        workSchedules={workSchedules}
        serviceSlaMap={serviceSlaMap}
        slaGoalPercent={slaGoalPercent}
        ratingGoal={ratingGoal}
        attendantProfiles={attendantProfiles}
        requesterProfiles={allProfiles}
      />
    </div>
  );
};

export default Dashboard;
