import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { calcBusinessHoursOpen } from '@/lib/slaUtils';
import MultiSelectFilter from './MultiSelectFilter';

interface ExtratoTempoServicoProps {
  tickets: any[];
  workSchedules: any[];
  services: any[];
}

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatHours = (h: number) => {
  if (Math.abs(h) >= 24) return `${(h / 24).toFixed(2)} d`;
  return `${h.toFixed(2)} h`;
};

const ExtratoTempoServico: React.FC<ExtratoTempoServicoProps> = ({ tickets, workSchedules, services }) => {
  const serviceMap = useMemo(() => {
    const m: Record<string, { name: string; sla: number | null }> = {};
    for (const s of services as any[]) m[s.id] = { name: s.name || '—', sla: s.sla_hours ?? null };
    return m;
  }, [services]);

  const rows = useMemo(() => {
    // key: year-month-serviceId
    const map: Record<string, { year: number; month: number; serviceId: string; total: number; count: number }> = {};
    for (const t of tickets) {
      if (t.status !== 'FECHADO' || !t.closed_at || !t.service_id) continue;
      const hours = calcBusinessHoursOpen(t, t.ticket_lifecycle_events, t.closed_at, workSchedules);
      const d = new Date(t.created_at);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month).padStart(2, '0')}-${t.service_id}`;
      if (!map[key]) map[key] = { year, month, serviceId: t.service_id, total: 0, count: 0 };
      map[key].total += hours;
      map[key].count += 1;
    }
    return Object.values(map)
      .map((r) => {
        const svc = serviceMap[r.serviceId] || { name: '—', sla: null };
        const avg = r.count > 0 ? r.total / r.count : 0;
        const sla = svc.sla;
        const diffHours = sla != null ? avg - sla : null;
        const diffPct = sla != null && sla > 0 ? ((avg - sla) / sla) * 100 : null;
        return {
          year: r.year,
          month: r.month,
          serviceName: svc.name,
          sla,
          avg,
          count: r.count,
          diffHours,
          diffPct,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return a.serviceName.localeCompare(b.serviceName);
      });
  }, [tickets, workSchedules, serviceMap]);

  const [filterServices, setFilterServices] = useState<string[]>([]);

  const serviceOptions = useMemo(() => Array.from(new Set(rows.map(r => r.serviceName))).sort((a, b) => a.localeCompare(b)), [rows]);

  const filteredRows = useMemo(() => rows.filter(r =>
    (filterServices.length === 0 || filterServices.includes(r.serviceName))
  ), [rows, filterServices]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-primary" />
          <h3 className="text-[1rem] font-extrabold text-foreground">⏱️ Extrato de Tempo Médio por Serviço</h3>
        </div>
        <p className="text-[0.6875rem] text-muted-foreground mt-1">
          Tempo útil médio para fechamento por serviço, comparado ao SLA cadastrado
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <MultiSelectFilter
            label="Serviços"
            allLabel="Todos os serviços"
            options={serviceOptions.map(s => ({ value: s, label: s }))}
            selected={filterServices}
            onChange={setFilterServices}
            width="min-w-[14rem] max-w-[18rem]"
          />
          {filterServices.length > 0 && (
            <button
              onClick={() => { setFilterServices([]); }}
              className="text-[0.75rem] font-semibold bg-muted hover:bg-muted/70 border border-border rounded-lg px-2 py-1 text-foreground"
            >
              Limpar
            </button>
          )}
        </div>
      </div>


      <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
        <table className="w-full text-[0.75rem]">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground whitespace-nowrap">Ano</th>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground whitespace-nowrap">Mês</th>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground whitespace-nowrap">Serviço</th>
              <th className="px-3 py-2 text-right font-bold text-muted-foreground whitespace-nowrap">SLA</th>
              <th className="px-3 py-2 text-right font-bold text-muted-foreground whitespace-nowrap">Tempo Médio</th>
              <th className="px-3 py-2 text-right font-bold text-muted-foreground whitespace-nowrap">Tickets</th>
              <th className="px-3 py-2 text-right font-bold text-muted-foreground whitespace-nowrap">Diferença (h)</th>
              <th className="px-3 py-2 text-right font-bold text-muted-foreground whitespace-nowrap">Diferença (%)</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => {
              const above = row.diffHours != null && row.diffHours > 0;
              const below = row.diffHours != null && row.diffHours <= 0;
              return (
                <tr key={`${row.year}-${row.month}-${row.serviceName}-${i}`}
                    className={`border-b border-border/50 ${above ? 'bg-destructive/5' : i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.year}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{monthNames[row.month]}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.serviceName}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                    {row.sla != null ? formatHours(row.sla) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-foreground whitespace-nowrap">
                    {formatHours(row.avg)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{row.count}</td>
                  <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${
                    row.diffHours == null ? 'text-muted-foreground' : above ? 'text-destructive' : 'text-green-600'
                  }`}>
                    {row.diffHours == null ? '—' : `${row.diffHours > 0 ? '+' : ''}${formatHours(row.diffHours)}`}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${
                    row.diffPct == null ? 'text-muted-foreground' : above ? 'text-destructive' : 'text-green-600'
                  }`}>
                    {row.diffPct == null ? '—' : `${row.diffPct > 0 ? '+' : ''}${row.diffPct.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {row.diffHours == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : above ? (
                      <span className="inline-flex items-center gap-1 bg-destructive/15 text-destructive text-[0.625rem] font-bold px-2 py-0.5 rounded-full">
                        Acima do SLA
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-700 text-[0.625rem] font-bold px-2 py-0.5 rounded-full">
                        Dentro do SLA
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum ticket fechado encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default ExtratoTempoServico;
