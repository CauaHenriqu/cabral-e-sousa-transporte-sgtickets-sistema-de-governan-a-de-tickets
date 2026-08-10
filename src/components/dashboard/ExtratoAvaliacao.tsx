import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import MultiSelectFilter from './MultiSelectFilter';

interface ExtratoAvaliacaoProps {
  tickets: any[];
  requesterProfiles?: any[];
  ratingGoal: number;
}

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const ExtratoAvaliacao: React.FC<ExtratoAvaliacaoProps> = ({ tickets, requesterProfiles = [], ratingGoal }) => {
  const requesterMap = useMemo(() => {
    const m: Record<string, { name: string; sector: string }> = {};
    for (const p of requesterProfiles as any[]) {
      if (p?.user_id) m[p.user_id] = { name: p.name || '—', sector: p.sector || 'Sem setor' };
    }
    return m;
  }, [requesterProfiles]);

  const rows = useMemo(() => {
    const data: Record<string, { year: number; month: number; uid: string; total: number; count: number }> = {};

    for (const t of tickets) {
      const score = Array.isArray(t.ticket_ratings) ? t.ticket_ratings[0]?.score : t.ticket_ratings?.score;
      if (score == null) continue;
      const d = new Date(t.created_at);
      const year = d.getFullYear();
      const month = d.getMonth();
      const uid = t.user_id;
      const key = `${year}-${String(month).padStart(2, '0')}-${uid}`;
      if (!data[key]) data[key] = { year, month, uid, total: 0, count: 0 };
      data[key].total += score;
      data[key].count += 1;
    }

    return Object.values(data)
      .map((r) => {
        const profile = requesterMap[r.uid] || { name: '—', sector: 'Sem setor' };
        return {
          year: r.year,
          month: r.month,
          sector: profile.sector,
          name: profile.name,
          avg: r.count > 0 ? r.total / r.count : 0,
          count: r.count,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        if (a.sector !== b.sector) return a.sector.localeCompare(b.sector);
        return a.name.localeCompare(b.name);
      });
  }, [tickets, requesterMap]);

  const [filterSectors, setFilterSectors] = useState<string[]>([]);
  const [filterRequesters, setFilterRequesters] = useState<string[]>([]);

  const sectorOptions = useMemo(() => Array.from(new Set(rows.map(r => r.sector))).sort((a, b) => a.localeCompare(b)), [rows]);
  const requesterOptions = useMemo(() => Array.from(new Set(rows.map(r => r.name))).sort((a, b) => a.localeCompare(b)), [rows]);

  const filteredRows = useMemo(() => rows.filter(r =>
    (filterSectors.length === 0 || filterSectors.includes(r.sector)) &&
    (filterRequesters.length === 0 || filterRequesters.includes(r.name))
  ), [rows, filterSectors, filterRequesters]);

  const cellColor = (v: number | null) => {
    if (v == null) return 'text-muted-foreground';
    if (v >= ratingGoal) return 'text-green-600 font-bold';
    return 'text-destructive font-bold';
  };

  const hasFilters = filterSectors.length > 0 || filterRequesters.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.5 }}
      className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Star size={20} className="text-primary" />
          <h3 className="text-[1rem] font-extrabold text-foreground">⭐ Extrato de Avaliação</h3>
        </div>
        <p className="text-[0.6875rem] text-muted-foreground mt-1">
          Média de avaliação por solicitante (meta: ≥ {ratingGoal})
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <MultiSelectFilter
            label="Setores"
            allLabel="Todos os setores"
            options={sectorOptions.map(s => ({ value: s, label: s }))}
            selected={filterSectors}
            onChange={setFilterSectors}
            width="min-w-[12rem] max-w-[18rem]"
          />
          <MultiSelectFilter
            label="Solicitantes"
            allLabel="Todos os solicitantes"
            options={requesterOptions.map(r => ({ value: r, label: r }))}
            selected={filterRequesters}
            onChange={setFilterRequesters}
            width="min-w-[14rem] max-w-[20rem]"
          />
          {hasFilters && (
            <button
              onClick={() => { setFilterSectors([]); setFilterRequesters([]); }}
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
              <th className="px-3 py-2 text-left font-bold text-muted-foreground whitespace-nowrap">Setor</th>
              <th className="px-3 py-2 text-left font-bold text-muted-foreground whitespace-nowrap">Solicitante</th>
              <th className="px-3 py-2 text-right font-bold text-muted-foreground whitespace-nowrap">Avaliações</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground whitespace-nowrap">Média</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={`${row.year}-${row.month}-${row.name}-${i}`} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.year}</td>
                <td className="px-3 py-2 text-foreground whitespace-nowrap">{monthNames[row.month]}</td>
                <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.sector}</td>
                <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.name}</td>
                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{row.count}</td>
                <td className={`px-3 py-2 text-center ${cellColor(row.avg)}`}>
                  {row.avg.toFixed(2)}
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma avaliação encontrada com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default ExtratoAvaliacao;
