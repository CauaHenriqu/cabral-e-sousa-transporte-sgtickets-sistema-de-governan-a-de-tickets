import React, { useState } from 'react';
import { Filter, X, ChevronDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

interface FilterValues {
  dateFrom: string;
  dateTo: string;
  attendantIds: string[];
  userIds: string[];
  sectors: string[];
}

interface DashboardFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  attendants: { user_id: string; name: string; sector?: string | null; function?: string | null }[];
  users: { user_id: string; name: string; sector?: string | null; function?: string | null }[];
  sectors: string[];
}

const formatPersonLabel = (name: string, sector?: string | null, func?: string | null) => {
  const parts = [name];
  if (sector) parts.push(sector);
  if (func) parts.push(func);
  return parts.join(' — ');
};

interface MultiSelectFieldProps<T> {
  label: string;
  placeholder: string;
  emptyText: string;
  items: T[];
  selected: string[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  onChange: (next: string[]) => void;
  selectedSingleLabel?: (id: string) => string;
}

function MultiSelectField<T>({ label, placeholder, emptyText, items, selected, getId, getLabel, onChange, selectedSingleLabel }: MultiSelectFieldProps<T>) {
  const toggle = (id: string) => {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange(Array.from(set));
  };

  const triggerLabel = selected.length === 0
    ? 'Todos'
    : selected.length === 1
      ? (selectedSingleLabel ? selectedSingleLabel(selected[0]) : getLabel(items.find(i => getId(i) === selected[0]) as T) || '1 selecionado')
      : `${selected.length} selecionados`;

  return (
    <div>
      <label className="text-xs text-muted-foreground font-bold mb-1.5 block">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-10 w-full px-3 text-sm rounded-xl border border-border/60 bg-background flex items-center justify-between gap-2 hover:bg-accent/40 transition-colors"
          >
            <span className={`truncate ${selected.length === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
              {triggerLabel}
            </span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-[min(420px,90vw)] rounded-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-bold text-muted-foreground">{placeholder}</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {items.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">{emptyText}</div>
            )}
            {items.map((item) => {
              const id = getId(item);
              const checked = selected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 text-left"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(id)} />
                  <span className="flex-1 break-words whitespace-normal leading-snug">{getLabel(item)}</span>
                  {checked && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({ filters, onFiltersChange, attendants, users, sectors }) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open === null ? !isMobile : open;

  const activeCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.attendantIds.length > 0 ? '1' : '',
    filters.userIds.length > 0 ? '1' : '',
    filters.sectors.length > 0 ? '1' : '',
  ].filter(Boolean).length;
  const hasFilters = activeCount > 0;

  const clearFilters = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onFiltersChange({ dateFrom: '', dateTo: '', attendantIds: [], userIds: [], sectors: [] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl p-5 bg-card border border-border shadow-card"
    >
      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-2 w-full text-left">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Filter size={15} className="text-primary" />
            </div>
            <span className="text-sm font-extrabold text-foreground">Filtros</span>
            {hasFilters && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {activeCount} ativo{activeCount > 1 ? 's' : ''}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {hasFilters && (
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive rounded-xl">
                  <span onClick={clearFilters} role="button"><X size={14} /> Limpar</span>
                </Button>
              )}
              <ChevronDown
                size={18}
                className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[160px_160px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 mt-4">
            <div>
              <label className="text-xs text-muted-foreground font-bold mb-1.5 block">📅 Data Início</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                className="h-10 text-sm rounded-xl border-border/60 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-bold mb-1.5 block">📅 Data Fim</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                className="h-10 text-sm rounded-xl border-border/60"
              />
            </div>
            <MultiSelectField
              label="👤 Atendente"
              placeholder="Selecione atendentes"
              emptyText="Nenhum atendente"
              items={attendants}
              selected={filters.attendantIds}
              getId={(a) => a.user_id}
              getLabel={(a) => formatPersonLabel(a.name, a.sector, a.function)}
              onChange={(ids) => onFiltersChange({ ...filters, attendantIds: ids })}
            />
            <MultiSelectField
              label="🙋 Usuário"
              placeholder="Selecione usuários"
              emptyText="Nenhum usuário"
              items={users}
              selected={filters.userIds}
              getId={(u) => u.user_id}
              getLabel={(u) => formatPersonLabel(u.name, u.sector, u.function)}
              onChange={(ids) => onFiltersChange({ ...filters, userIds: ids })}
            />
            <MultiSelectField
              label="🏢 Setor"
              placeholder="Selecione setores"
              emptyText="Nenhum setor"
              items={sectors}
              selected={filters.sectors}
              getId={(s) => s}
              getLabel={(s) => s}
              onChange={(values) => onFiltersChange({ ...filters, sectors: values })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
};

export default DashboardFilters;
