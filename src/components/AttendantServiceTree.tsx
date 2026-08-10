import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, User, Wrench, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface Link {
  id: string;
  attendant_id: string;
  service_id: string;
}
interface AttendantLite { user_id: string; name: string; status?: string }
interface ServiceLite { id: string; name: string; code?: string }

interface Props {
  links: Link[];
  attendants: AttendantLite[];
  services: ServiceLite[];
  onDelete?: (link: Link, label: string) => void;
}

type Mode = 'by-attendant' | 'by-service';

interface TreeNode {
  key: string;
  rootLabel: string;
  rootSubtitle?: string;
  children: { link: Link; label: string; subtitle?: string }[];
}

export const AttendantServiceTree: React.FC<Props> = ({ links, attendants, services, onDelete }) => {
  const [mode, setMode] = useState<Mode>('by-attendant');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(true);

  const nodes: TreeNode[] = useMemo(() => {
    if (mode === 'by-attendant') {
      const map = new Map<string, TreeNode>();
      attendants.forEach(a => {
        map.set(a.user_id, {
          key: a.user_id,
          rootLabel: a.name,
          rootSubtitle: a.status === 'Ativo' ? undefined : 'Inativo',
          children: [],
        });
      });
      links.forEach(l => {
        const node = map.get(l.attendant_id);
        const svc = services.find(s => s.id === l.service_id);
        if (node) {
          node.children.push({
            link: l,
            label: svc?.name || '—',
            subtitle: svc?.code,
          });
        }
      });
      return Array.from(map.values())
        .filter(n => n.children.length > 0)
        .sort((a, b) => a.rootLabel.localeCompare(b.rootLabel));
    } else {
      const map = new Map<string, TreeNode>();
      services.forEach(s => {
        map.set(s.id, {
          key: s.id,
          rootLabel: s.name,
          rootSubtitle: s.code,
          children: [],
        });
      });
      links.forEach(l => {
        const node = map.get(l.service_id);
        const att = attendants.find(a => a.user_id === l.attendant_id);
        if (node) {
          node.children.push({
            link: l,
            label: att?.name || '—',
            subtitle: att?.status === 'Ativo' ? undefined : 'Inativo',
          });
        }
      });
      return Array.from(map.values())
        .filter(n => n.children.length > 0)
        .sort((a, b) => a.rootLabel.localeCompare(b.rootLabel));
    }
  }, [mode, links, attendants, services]);

  const filtered = useMemo(() => {
    if (!search.trim()) return nodes;
    const q = search.toLowerCase();
    return nodes
      .map(n => {
        const rootMatch = n.rootLabel.toLowerCase().includes(q);
        const filteredChildren = n.children.filter(c => c.label.toLowerCase().includes(q));
        if (rootMatch) return n;
        if (filteredChildren.length > 0) return { ...n, children: filteredChildren };
        return null;
      })
      .filter(Boolean) as TreeNode[];
  }, [nodes, search]);

  const isOpen = (key: string) => (expanded[key] !== undefined ? expanded[key] : allExpanded);
  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !isOpen(key) }));

  const expandAll = () => { setAllExpanded(true); setExpanded({}); };
  const collapseAll = () => { setAllExpanded(false); setExpanded({}); };

  const totalLinks = filtered.reduce((acc, n) => acc + n.children.length, 0);

  const RootIcon = mode === 'by-attendant' ? User : Wrench;
  const ChildIcon = mode === 'by-attendant' ? Wrench : User;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as Mode)}
          className="border border-border rounded-lg p-1"
        >
          <ToggleGroupItem value="by-attendant" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <User size={14} className="mr-1" /> Por atendente
          </ToggleGroupItem>
          <ToggleGroupItem value="by-service" className="text-xs px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Wrench size={14} className="mr-1" /> Por serviço
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar na árvore..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Button variant="outline" size="sm" onClick={expandAll}>Expandir tudo</Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>Recolher tudo</Button>

        <Badge variant="secondary" className="ml-auto">
          {filtered.length} {mode === 'by-attendant' ? 'atendente(s)' : 'serviço(s)'} • {totalLinks} vínculo(s)
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          Nenhum vínculo encontrado.
        </div>
      ) : (
        <ul className="space-y-1">
          {filtered.map(node => {
            const open = isOpen(node.key);
            return (
              <li key={node.key} className="rounded-lg border border-border/60 bg-background/40">
                <button
                  type="button"
                  onClick={() => toggle(node.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 rounded-lg text-left"
                >
                  {open ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                  <RootIcon size={16} className="text-primary" />
                  <span className="text-sm font-bold text-foreground">{node.rootLabel}</span>
                  {node.rootSubtitle && (
                    <span className="text-[10px] text-muted-foreground">({node.rootSubtitle})</span>
                  )}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {node.children.length}
                  </Badge>
                </button>

                {open && (
                  <ul className="pl-6 pr-3 pb-2 pt-1 space-y-1 border-l-2 border-primary/20 ml-5">
                    {node.children
                      .slice()
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map(child => (
                        <li
                          key={child.link.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 group"
                        >
                          <span className="text-muted-foreground text-xs">└─</span>
                          <ChildIcon size={14} className="text-muted-foreground" />
                          <span className="text-sm text-foreground">{child.label}</span>
                          {child.subtitle && (
                            <span className="text-[10px] text-muted-foreground">({child.subtitle})</span>
                          )}
                          {onDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="ml-auto opacity-0 group-hover:opacity-100 h-7 w-7"
                              onClick={() => onDelete(child.link, `${node.rootLabel} → ${child.label}`)}
                            >
                              <Trash2 size={14} className="text-destructive" />
                            </Button>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
