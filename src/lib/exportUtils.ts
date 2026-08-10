import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportColumn<T = any> {
  key: string;
  label: string;
  /** Optional accessor for derived/formatted values. Defaults to row[key]. */
  accessor?: (row: T) => any;
}

const formatValue = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (v instanceof Date) return v.toLocaleString('pt-BR');
  return String(v);
};

const buildRows = <T,>(rows: T[], columns: ExportColumn<T>[]): string[][] =>
  rows.map(row => columns.map(c => formatValue(c.accessor ? c.accessor(row) : (row as any)[c.key])));

const sanitizeFileName = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '_').toLowerCase();

const todayStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

export function exportToPDF<T>(title: string, rows: T[], columns: ExportColumn<T>[]) {
  const orientation = columns.length > 5 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} • ${rows.length} registro(s)`, 40, 56);

  autoTable(doc, {
    startY: 70,
    head: [columns.map(c => c.label)],
    body: buildRows(rows, columns),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [0, 112, 150], textColor: 255 },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${sanitizeFileName(title)}_${todayStamp()}.pdf`);
}

export function exportToXLSX<T>(title: string, rows: T[], columns: ExportColumn<T>[]) {
  const data = [columns.map(c => c.label), ...buildRows(rows, columns)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31) || 'Dados');
  XLSX.writeFile(wb, `${sanitizeFileName(title)}_${todayStamp()}.xlsx`);
}

/** Generic full-text filter across selected fields. */
export function applyTextFilter<T>(rows: T[], query: string, columns: ExportColumn<T>[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(row =>
    columns.some(c => formatValue(c.accessor ? c.accessor(row) : (row as any)[c.key]).toLowerCase().includes(q))
  );
}

/** Generic sort by column key. */
export function applySort<T>(rows: T[], sortKey: string | null, dir: 'asc' | 'desc', columns: ExportColumn<T>[]): T[] {
  if (!sortKey) return rows;
  const col = columns.find(c => c.key === sortKey);
  if (!col) return rows;
  const arr = [...rows];
  arr.sort((a, b) => {
    const va = col.accessor ? col.accessor(a) : (a as any)[sortKey];
    const vb = col.accessor ? col.accessor(b) : (b as any)[sortKey];
    const sa = formatValue(va);
    const sb = formatValue(vb);
    // numeric compare when both numeric
    const na = Number(sa), nb = Number(sb);
    let cmp: number;
    if (!isNaN(na) && !isNaN(nb) && sa !== '' && sb !== '') cmp = na - nb;
    else cmp = sa.localeCompare(sb, 'pt-BR', { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
  return arr;
}
