import React, { useMemo, useState } from 'react';
import {
  Workflow, Wrench, User, Search, Pencil, Trash2,
  UserCircle2, Users, CheckCircle2, Headphones, ArrowRight,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ProfileLite { user_id: string; name: string; email?: string; sector?: string }
interface Flow {
  id: string;
  name: string;
  service_id: string;
  sector: string | null;
  active: boolean;
  services?: { name?: string; code?: string } | null;
  approval_flow_approvers?: { approver_id: string }[];
}

interface Props {
  flows: Flow[];
  profiles: ProfileLite[];
  onEdit?: (flow: Flow) => void;
  onDelete?: (id: string) => void;
}

type Mode = 'by-service' | 'by-approver';

/* ---------- Process node ---------- */

interface NodeProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  variant?: 'start' | 'service' | 'gateway' | 'approver' | 'end';
}

const variantStyles: Record<NonNullable<NodeProps['variant']>, string> = {
  start:    'bg-muted/40 border-border',
  service:  'bg-primary/10 border-primary/40',
  gateway:  'bg-amber-500/10 border-amber-500/40',
  approver: 'bg-card border-border',
  end:      'bg-emerald-500/10 border-emerald-500/40',
};

const ProcessNode: React.FC<NodeProps> = ({ icon, title, subtitle, variant = 'service' }) => (
  <div className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 shadow-sm min-w-[160px] ${variantStyles[variant]}`}>
    <div className="shrink-0 text-foreground">{icon}</div>
    <div className="min-w-0">
      <div className="text-xs font-bold text-foreground truncate">{title}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>}
    </div>
  </div>
);

const Arrow: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center px-1">
    {label && <span className="text-[9px] text-muted-foreground mb-0.5 whitespace-nowrap">{label}</span>}
    <ArrowRight size={18} className="text-muted-foreground/70" />
  </div>
);

/* ---------- Flow process diagram ---------- */

const FlowDiagram: React.FC<{
  flow: Flow;
  profiles: ProfileLite[];
}> = ({ flow, profiles }) => {
  const approvers = flow.approval_flow_approvers || [];
  const sectorLabel = flow.sector || 'Todos os setores';

  return (
    <div className="overflow-x-auto">
      <div className="flex items-stretch gap-1 py-3 px-2 min-w-max">
        {/* Solicitante */}
        <ProcessNode
          variant="start"
          icon={<UserCircle2 size={20} className="text-muted-foreground" />}
          title="Solicitante"
          subtitle={sectorLabel}
        />

        <Arrow label="abre ticket" />

        {/* Serviço */}
        <ProcessNode
          variant="service"
          icon={<Wrench size={18} className="text-primary" />}
          title={flow.services?.name || '—'}
          subtitle={flow.services?.code}
        />

        <Arrow label="requer aprovação" />

        {/* Gateway + Aprovadores empilhados */}
        <div className="flex items-center gap-1">
          <ProcessNode
            variant="gateway"
            icon={<Users size={18} className="text-amber-600" />}
            title="Aprovação"
            subtitle={`${approvers.length} aprovador(es) • TODOS (AND)`}
          />

          <div className="flex flex-col justify-center px-1">
            {approvers.length === 0 ? (
              <div className="text-xs text-destructive border border-destructive/40 rounded px-2 py-1 bg-destructive/5">
                Sem aprovadores
              </div>
            ) : (
              <div className="relative flex flex-col gap-1.5">
                {approvers.map((a, idx) => {
                  const prof = profiles.find(p => p.user_id === a.approver_id);
                  return (
                    <div key={a.approver_id} className="flex items-center gap-1">
                      <div className="w-3 h-px bg-border" />
                      <ProcessNode
                        variant="approver"
                        icon={<User size={14} className="text-muted-foreground" />}
                        title={prof?.name || '—'}
                        subtitle={prof?.email}
                      />
                      {idx < approvers.length - 1 && (
                        <span className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <Arrow label="se aprovado" />

        {/* Atendimento */}
        <ProcessNode
          variant="end"
          icon={<Headphones size={18} className="text-emerald-600" />}
          title="Atendimento"
          subtitle="Encaminha ao atendente"
        />

        <Arrow />

        <ProcessNode
          variant="end"
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          title="Resolvido"
        />
      </div>
    </div>
  );
};

/* ---------- Main tree ---------- */

export const ApprovalFlowTree: React.FC<Props> = ({ flows, profiles, onEdit, onDelete }) => {
  const [mode, setMode] = useState<Mode>('by-service');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(true);

  const isOpen = (key: string) => (expanded[key] !== undefined ? expanded[key] : allExpanded);
  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !isOpen(key) }));

  const expandAll = () => { setAllExpanded(true); setExpanded({}); };
  const collapseAll = () => { setAllExpanded(false); setExpanded({}); };

  const nameOf = (id: string) => profiles.find(p => p.user_id === id)?.name || '—';

  const groups = useMemo(() => {
    if (mode === 'by-service') {
      const map = new Map<string, { key: string; label: string; subtitle?: string; flows: Flow[] }>();
      flows.forEach(f => {
        const key = f.service_id;
        const label = f.services?.name || '—';
        const subtitle = f.services?.code;
        if (!map.has(key)) map.set(key, { key, label, subtitle, flows: [] });
        map.get(key)!.flows.push(f);
      });
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    } else {
      const map = new Map<string, { key: string; label: string; subtitle?: string; flows: Flow[] }>();
      flows.forEach(f => {
        (f.approval_flow_approvers || []).forEach(a => {
          const key = a.approver_id;
          const prof = profiles.find(p => p.user_id === a.approver_id);
          const label = prof?.name || '—';
          const subtitle = prof?.email;
          if (!map.has(key)) map.set(key, { key, label, subtitle, flows: [] });
          map.get(key)!.flows.push(f);
        });
      });
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }
  }, [mode, flows, profiles]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map(g => {
        const rootMatch = g.label.toLowerCase().includes(q);
        const flowsMatch = g.flows.filter(f => {
          const apNames = (f.approval_flow_approvers || []).map(a => nameOf(a.approver_id)).join(' ');
          return [
            f.name, f.services?.name || '', f.services?.code || '',
            f.sector || 'Todos', apNames,
          ].join(' ').toLowerCase().includes(q);
        });
        if (rootMatch) return g;
        if (flowsMatch.length > 0) return { ...g, flows: flowsMatch };
        return null;
      })
      .filter(Boolean) as typeof groups;
  }, [groups, search, profiles]);

  const totalFlows = filtered.reduce((acc, g) => acc + g.flows.length, 0);
  const RootIcon = mode === 'by-service' ? Wrench : User;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as Mode)}
          className="border border-border rounded-lg p-1"
        >
          <ToggleGroupItem value="by-service" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Wrench size={14} className="mr-1" /> Por serviço
          </ToggleGroupItem>
          <ToggleGroupItem value="by-approver" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <User size={14} className="mr-1" /> Por aprovador
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar fluxo, serviço ou aprovador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Button variant="outline" size="sm" onClick={expandAll}>Expandir tudo</Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>Recolher tudo</Button>

        <Badge variant="secondary" className="ml-auto">
          {filtered.length} {mode === 'by-service' ? 'serviço(s)' : 'aprovador(es)'} • {totalFlows} fluxo(s)
        </Badge>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground border-t border-border pt-3">
        <span className="font-semibold">Legenda:</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-border bg-muted/40" /> Início</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-primary/40 bg-primary/10" /> Serviço</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-amber-500/40 bg-amber-500/10" /> Gateway de aprovação</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-border bg-card" /> Aprovador</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-emerald-500/40 bg-emerald-500/10" /> Fim</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">Nenhum fluxo encontrado.</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map(group => {
            const open = isOpen(group.key);
            return (
              <li key={group.key} className="rounded-lg border border-border/60 bg-background/40">
                <button
                  type="button"
                  onClick={() => toggle(group.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 rounded-lg text-left"
                >
                  {open ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                  <RootIcon size={16} className="text-primary" />
                  <span className="text-sm font-bold text-foreground">{group.label}</span>
                  {group.subtitle && <span className="text-[10px] text-muted-foreground">({group.subtitle})</span>}
                  <Badge variant="outline" className="ml-auto text-[10px]">{group.flows.length}</Badge>
                </button>

                {open && (
                  <div className="px-3 pb-3 pt-1 space-y-3">
                    {group.flows
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(f => (
                        <div key={f.id} className="rounded-lg border border-border bg-card">
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                            <Workflow size={14} className="text-primary" />
                            <span className="text-sm font-semibold text-foreground">{f.name}</span>
                            {f.active ? (
                              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border border-emerald-500/30">Ativo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                            )}
                            <div className="ml-auto flex items-center gap-1">
                              {onEdit && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(f)}>
                                  <Pencil size={13} />
                                </Button>
                              )}
                              {onDelete && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(f.id)}>
                                  <Trash2 size={13} className="text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <FlowDiagram flow={f} profiles={profiles} />
                        </div>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
