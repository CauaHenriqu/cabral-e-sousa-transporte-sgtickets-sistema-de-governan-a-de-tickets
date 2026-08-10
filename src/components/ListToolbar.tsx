import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUpDown, FileDown, FileSpreadsheet } from 'lucide-react';
import { ExportColumn, exportToPDF, exportToXLSX, applyTextFilter, applySort } from '@/lib/exportUtils';

interface Props<T> {
  /** Title used for PDF/XLSX file names and PDF header. */
  title: string;
  /** Already filtered + sorted rows that will be exported. */
  rows: T[];
  /** Columns metadata used for filter, sort and export. */
  columns: ExportColumn<T>[];
  search: string;
  onSearchChange: (v: string) => void;
  sortKey: string | null;
  onSortKeyChange: (v: string | null) => void;
  sortDir: 'asc' | 'desc';
  onSortDirChange: (v: 'asc' | 'desc') => void;
  /** Optional extra controls rendered before the export buttons. */
  extra?: React.ReactNode;
}

export function ListToolbar<T>({
  title, rows, columns, search, onSearchChange,
  sortKey, onSortKeyChange, sortDir, onSortDirChange, extra,
}: Props<T>) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar em todos os campos..."
          className="pl-9 h-9"
        />
      </div>

      <Select value={sortKey ?? '__none'} onValueChange={v => onSortKeyChange(v === '__none' ? null : v)}>
        <SelectTrigger className="h-9 w-[180px]">
          <ArrowUpDown size={14} className="mr-1" />
          <SelectValue placeholder="Ordenar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">Ordem padrão</SelectItem>
          {columns.map(c => (
            <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sortDir} onValueChange={v => onSortDirChange(v as 'asc' | 'desc')}>
        <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="asc">Crescente</SelectItem>
          <SelectItem value="desc">Decrescente</SelectItem>
        </SelectContent>
      </Select>

      {extra}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => exportToPDF(title, rows, columns)}
        disabled={rows.length === 0}
        title="Exportar PDF dos registros filtrados"
      >
        <FileDown size={14} className="mr-1" /> PDF
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => exportToXLSX(title, rows, columns)}
        disabled={rows.length === 0}
        title="Exportar XLSX dos registros filtrados"
      >
        <FileSpreadsheet size={14} className="mr-1" /> XLS
      </Button>
    </div>
  );
}

/** Hook utility: returns filtered+sorted rows and toolbar state setters. */
export function useListToolbar<T>(rawRows: T[], columns: ExportColumn<T>[]) {
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const processed = React.useMemo(() => {
    const filtered = applyTextFilter(rawRows, search, columns);
    return applySort(filtered, sortKey, sortDir, columns);
  }, [rawRows, search, sortKey, sortDir, columns]);

  return {
    rows: processed as T[],
    toolbarProps: {
      rows: processed as T[],
      columns,
      search, onSearchChange: setSearch,
      sortKey, onSortKeyChange: setSortKey,
      sortDir, onSortDirChange: setSortDir,
    },
  };
}
