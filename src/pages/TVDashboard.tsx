import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import MetricCards from '@/components/dashboard/MetricCards';
import Chart3DBar from '@/components/dashboard/Chart3DBar';
import Chart3DPie from '@/components/dashboard/Chart3DPie';
import ExtratoMeta from '@/components/dashboard/ExtratoMeta';
import ExtratoAvaliacao from '@/components/dashboard/ExtratoAvaliacao';
import ExtratoTempoServico from '@/components/dashboard/ExtratoTempoServico';
import { motion } from 'framer-motion';
import { calcBusinessHoursOpen } from '@/lib/slaUtils';
import { Tv, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const REFRESH_INTERVAL_MS = 60_000;

function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0');
}

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

const TVDashboard: React.FC = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);

  // Janela do mês corrente
  const monthRange = useMemo(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }, [now.getMonth(), now.getFullYear()]);

  // Auto-refresh: invalida queries a cada 60s + atualiza relógio a cada 1s
  useEffect(() => {
    const tick = setInterval(() => {
      setNow(new Date());
      setSecondsUntilRefresh((s) => {
        if (s <= 1) {
          queryClient.invalidateQueries();
          return 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [queryClient]);

  const { data: tickets = [] } = useQuery({
    queryKey: ['tv-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('*, ticket_ratings(score, reason), ticket_lifecycle_events(event_type,event_at)');
      if (error) throw error;
      return data;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['tv-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name, sector, status');
      if (error) throw error;
      return data;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const { data: attendantRoles = [] } = useQuery({
    queryKey: ['tv-attendant-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id').eq('role', 'attendant');
      if (error) throw error;
      return data;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const { data: workSchedules = [] } = useQuery({
    queryKey: ['tv-work-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('work_schedules').select('*');
      if (error) throw error;
      return data;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['tv-services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('id, name, sla_hours');
      if (error) throw error;
      return data;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const { data: appSettings } = useQuery({
    queryKey: ['tv-app-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('sla_goal_percent, rating_goal, rating_justification_threshold').eq('id', 1).maybeSingle();
      return data;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  // Auth gating (após hooks para não quebrar regra de hooks)
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  const slaGoalPercent = Number(appSettings?.sla_goal_percent ?? 90);
  const ratingGoal = Number(appSettings?.rating_goal ?? 3);
  const ratingJustifyThreshold = Number(appSettings?.rating_justification_threshold ?? 3);

  const serviceSlaMap: Record<string, number> = {};
  for (const s of services as any[]) serviceSlaMap[s.id] = s.sla_hours;

  const attendantIds = new Set(attendantRoles.map((r: any) => r.user_id));
  const attendantProfiles = allProfiles.filter((p: any) => attendantIds.has(p.user_id) && p.status === 'Ativo');

  // Filtra apenas tickets do mês corrente
  const filteredTickets = tickets.filter((t: any) => {
    const created = new Date(t.created_at);
    return created >= monthRange.from && created <= monthRange.to;
  });

  const totalTickets = filteredTickets.length;
  const openTickets = filteredTickets.filter((t: any) => t.status === 'ABERTO').length;
  const closedTickets = filteredTickets.filter((t: any) => t.status === 'FECHADO').length;
  const ratedTickets = filteredTickets.filter((t: any) => Array.isArray(t.ticket_ratings) ? t.ticket_ratings.length > 0 : !!t.ticket_ratings);
  const avgRating = ratedTickets.length > 0
    ? ratedTickets.reduce((sum: number, t: any) => {
      const score = Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
      return sum + (score || 0);
    }, 0) / ratedTickets.length : 0;

  const nowIso = now.toISOString();
  const slaEligibleTickets = filteredTickets.filter((t: any) => t.created_at && serviceSlaMap[t.service_id] != null);
  const isWithinSla = (t: any) => {
    const endDate = t.status === 'FECHADO' && t.closed_at ? t.closed_at : nowIso;
    const hoursSpent = calcBusinessHoursOpen(t, t.ticket_lifecycle_events, endDate, workSchedules);
    return hoursSpent <= (serviceSlaMap[t.service_id] ?? Infinity);
  };
  const overallSlaPercent = slaEligibleTickets.length > 0
    ? (slaEligibleTickets.filter(isWithinSla).length / slaEligibleTickets.length) * 100
    : 0;

  const attendantSlaPercent = attendantProfiles.map((att: any) => {
    const attTickets = slaEligibleTickets.filter((t: any) => t.attendant_id === att.user_id);
    const within = attTickets.filter(isWithinSla).length;
    const pct = attTickets.length > 0 ? (within / attTickets.length) * 100 : 0;
    return { name: att.name.split(' ')[0], avg: parseFloat(pct.toFixed(1)), count: attTickets.length };
  });

  const attendantNPS = attendantProfiles.map((att: any) => {
    const attRated = ratedTickets.filter((t: any) => t.attendant_id === att.user_id);
    const avg = attRated.length > 0
      ? attRated.reduce((sum: number, t: any) => {
        const score = Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
        return sum + (score || 0);
      }, 0) / attRated.length : 0;
    return { name: att.name.split(' ')[0], avg: parseFloat(avg.toFixed(1)) };
  });

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Para gráficos mensais, considera todos os tickets (não só do mês corrente)
  const allSlaEligible = tickets.filter((t: any) => t.created_at && serviceSlaMap[t.service_id] != null);
  const allRated = tickets.filter((t: any) => Array.isArray(t.ticket_ratings) ? t.ticket_ratings.length > 0 : !!t.ticket_ratings);

  const monthlySlaPercent = (() => {
    const map: Record<string, { within: number; total: number; crossMonth: number }> = {};
    for (const t of allSlaEligible) {
      const refDate = new Date(t.status === 'FECHADO' && t.closed_at ? t.closed_at : t.created_at);
      const key = `${refDate.getFullYear()}-${String(refDate.getMonth()).padStart(2, '0')}`;
      if (!map[key]) map[key] = { within: 0, total: 0, crossMonth: 0 };
      map[key].total += 1;
      if (isWithinSla(t)) map[key].within += 1;
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
  })();

  const monthlyNPS = (() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const t of allRated) {
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
  })();

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

  const profileSectorMap: Record<string, string> = {};
  for (const p of allProfiles as any[]) profileSectorMap[p.user_id] = p.sector || 'Sem setor';

  const sectorSlaPercent = (() => {
    const map: Record<string, { within: number; total: number }> = {};
    for (const t of slaEligibleTickets) {
      const sector = profileSectorMap[t.user_id] || 'Sem setor';
      if (!map[sector]) map[sector] = { within: 0, total: 0 };
      map[sector].total += 1;
      if (isWithinSla(t)) map[sector].within += 1;
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, avg: parseFloat(((v.within / v.total) * 100).toFixed(1)) }))
      .sort((a, b) => b.avg - a.avg);
  })();

  const sectorNPS = (() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const t of ratedTickets) {
      const sector = profileSectorMap[t.user_id] || 'Sem setor';
      if (!map[sector]) map[sector] = { total: 0, count: 0 };
      const score = Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
      map[sector].total += score || 0;
      map[sector].count += 1;
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, avg: parseFloat((v.total / v.count).toFixed(1)) }))
      .sort((a, b) => b.avg - a.avg);
  })();

  const sectorPalette = ['hsl(152, 55%, 50%)', 'hsl(208, 50%, 55%)', 'hsl(40, 80%, 55%)', 'hsl(20, 72%, 58%)', 'hsl(350, 55%, 55%)', 'hsl(270, 50%, 60%)', 'hsl(190, 60%, 50%)'];
  const npsDistributionBySector = (() => {
    const map: Record<string, number> = {};
    for (const t of ratedTickets) {
      const sector = profileSectorMap[t.user_id] || 'Sem setor';
      map[sector] = (map[sector] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({ name, value, fill: sectorPalette[i % sectorPalette.length] }));
  })();

  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header da TV */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Tv size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">📺 Painel Transporte - SGTickets</h1>
            <p className="text-xs text-muted-foreground font-semibold capitalize">Mês de referência: {monthLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-black text-foreground tabular-nums leading-none">{timeLabel}</p>
            <p className="text-[0.6875rem] text-muted-foreground font-semibold mt-1">
              {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-xl px-3 py-2">
            <RefreshCw size={14} className={secondsUntilRefresh === 60 ? 'animate-spin' : ''} />
            <span className="text-xs font-bold tabular-nums">{secondsUntilRefresh}s</span>
          </div>
          {user?.role !== 'tv' && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/dashboard">
                <ArrowLeft size={14} />
                Voltar ao Dashboard
              </Link>
            </Button>
          )}
        </div>
      </motion.div>

      {/* Cards de métricas */}
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

      {/* Gráficos por atendente */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-primary to-primary/50" />
        <h2 className="text-lg font-extrabold text-foreground">👥 Por Atendente</h2>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart3DBar icon="🎯" title="% SLA por Atendente" subtitle={`Meta: ≥ ${slaGoalPercent}%`} data={attendantSlaPercent} meta={slaGoalPercent} higherIsBetter yDomain={[0, 100]} />
        <Chart3DBar icon="⭐" title="Avaliação Média (NPS)" subtitle={`Meta: ≥ ${ratingGoal}`} data={attendantNPS} meta={ratingGoal} higherIsBetter yDomain={[0, 5]} />
      </div>

      {/* Gráficos por mês */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-secondary to-secondary/50" />
        <h2 className="text-lg font-extrabold text-foreground">📆 Por Mês</h2>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart3DBar icon="🎯" title="% SLA Mensal" subtitle={`Meta: ≥ ${slaGoalPercent}% | Dedução de 1% por ticket fechado fora do mês de criação`} data={monthlySlaPercent} meta={slaGoalPercent} higherIsBetter yDomain={[0, 100]} />
        <Chart3DBar icon="📊" title="Avaliação Média Mensal (NPS)" subtitle={`Meta: ≥ ${ratingGoal} | 5=Muito Satisfeito → 1=Muito Insatisfeito`} data={monthlyNPS} meta={ratingGoal} higherIsBetter yDomain={[0, 5]} />
      </div>

      {/* Distribuição NPS + por setor lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {npsDistribution.length > 0 && (
          <Chart3DPie
            icon="📈"
            title="Distribuição de Avaliações NPS"
            subtitle={`Avaliações ≤ ${ratingJustifyThreshold} exigem justificativa obrigatória`}
            data={npsDistribution}
          />
        )}

        {npsDistributionBySector.length > 0 && (
          <Chart3DPie icon="🏢" title="Distribuição de Quantidade de Avaliações por Setor Solicitante" subtitle="Quantidade de avaliações recebidas por setor" data={npsDistributionBySector} />
        )}

        {sectorNPS.length > 0 && (
          <Chart3DPie
            icon="⭐"
            title="Média de Avaliação por Setor Solicitante"
            subtitle="Nota média (0 a 5) recebida por setor"
            data={sectorNPS.map((s, i) => ({ name: s.name, value: s.avg, fill: sectorPalette[i % sectorPalette.length] }))}
          />
        )}
      </div>

      {/* Gráficos por setor solicitante */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full bg-gradient-to-b from-amber-500 to-amber-500/50" />
        <h2 className="text-lg font-extrabold text-foreground">🏢 Por Setor Solicitante</h2>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart3DBar icon="🎯" title="% SLA por Setor" subtitle={`Meta: ≥ ${slaGoalPercent}% | Tickets dentro do SLA do serviço`} data={sectorSlaPercent} meta={slaGoalPercent} higherIsBetter yDomain={[0, 100]} />
        <Chart3DBar icon="📊" title="Avaliação Média por Setor (NPS)" subtitle={`Meta: ≥ ${ratingGoal} | 5=Muito Satisfeito → 1=Muito Insatisfeito`} data={sectorNPS} meta={ratingGoal} higherIsBetter yDomain={[0, 5]} />
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

export default TVDashboard;
