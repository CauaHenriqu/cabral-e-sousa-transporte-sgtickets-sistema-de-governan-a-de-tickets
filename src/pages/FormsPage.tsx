import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { logAction } from '@/lib/logAction';
import { ListToolbar, useListToolbar } from '@/components/ListToolbar';
import type { ExportColumn } from '@/lib/exportUtils';

interface FormFieldLocal {
  id?: string;
  label: string;
  field_type: string;
  required: boolean;
  sort_order: number;
  send_to_api: boolean;
  api_param_name: string;
}

const FormsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string; reason?: string }>({ open: false, id: '', name: '' });
  const [formName, setFormName] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [fields, setFields] = useState<FormFieldLocal[]>([]);
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>('POST');
  const [apiUrl, setApiUrl] = useState('');
  const [apiTimeout, setApiTimeout] = useState(15);
  const [apiValuesInPath, setApiValuesInPath] = useState(false);


  const { data: serviceForms = [] } = useQuery({
    queryKey: ['service-forms'],
    queryFn: async () => {
      const { data, error } = await supabase.from('service_forms').select('*, form_fields(*)');
      if (error) throw error;
      return data;
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*');
      if (error) throw error;
      return data;
    },
  });

  const openNew = () => {
    setFormName(''); setFormServiceId(''); setFields([]); setEditingId(null);
    setApiEnabled(false); setApiMethod('POST'); setApiUrl(''); setApiTimeout(15); setApiValuesInPath(false);
    setDialog(true);
  };

  const openEdit = (f: any) => {
    setFormName(f.name);
    setFormServiceId(f.service_id);
    setFields(
      (f.form_fields || [])
        .slice()
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((ff: any) => ({
          id: ff.id, label: ff.label, field_type: ff.field_type, required: ff.required, sort_order: ff.sort_order,
          send_to_api: !!ff.send_to_api, api_param_name: ff.api_param_name || '',
        })),
    );
    setApiEnabled(!!f.api_enabled);
    setApiMethod((f.api_method === 'GET' ? 'GET' : 'POST'));
    setApiUrl(f.api_url || '');
    setApiTimeout(f.api_timeout_seconds ?? 15);
    setApiValuesInPath(!!(f as any).api_values_in_path);
    setEditingId(f.id);
    setDialog(true);
  };


  const handleDeleteClick = async (f: any) => {
    setDeleteConfirm({ open: true, id: f.id, name: f.name });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('form_fields').delete().eq('form_id', id);
      const { error } = await supabase.from('service_forms').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      const d = serviceForms.find((f: any) => f.id === id);
      const qtd = d?.form_fields?.length ?? 0;
      logAction('DELETE', 'service_forms', id, `Formulário "${d?.name || id}" foi excluído (continha ${qtd} campo${qtd === 1 ? '' : 's'}). Esse formulário não estará mais disponível na abertura de tickets.`);
      queryClient.invalidateQueries({ queryKey: ['service-forms'] });
      toast({ title: '🗑️ Formulário excluído!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const addField = () => {
    setFields(prev => [...prev, { label: '', field_type: 'text', required: false, sort_order: prev.length, send_to_api: false, api_param_name: '' }]);
  };


  const updateField = (idx: number, updates: Partial<FormFieldLocal>) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const removeField = (idx: number) => {
    setFields(prev => prev.filter((_, i) => i !== idx));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const apiPayload = {
        api_enabled: apiEnabled,
        api_method: apiMethod,
        api_url: apiEnabled ? apiUrl.trim() : null,
        api_timeout_seconds: apiTimeout,
        api_values_in_path: apiMethod === 'GET' ? apiValuesInPath : false,
      } as any;
      const fieldRows = (formId: string) => fields.map((f, i) => ({
        form_id: formId, label: f.label, field_type: f.field_type, required: f.required, sort_order: i,
        send_to_api: !!f.send_to_api, api_param_name: f.api_param_name?.trim() || null,
      }));
      if (editingId) {
        const { error: uErr } = await supabase.from('service_forms').update({ name: formName, service_id: formServiceId, ...apiPayload }).eq('id', editingId);
        if (uErr) throw uErr;
        await supabase.from('form_fields').delete().eq('form_id', editingId);
        if (fields.length > 0) {
          const { error: fErr } = await supabase.from('form_fields').insert(fieldRows(editingId));
          if (fErr) throw fErr;
        }
        return { action: 'UPDATE' as const, id: editingId };
      } else {
        const { data, error } = await supabase.from('service_forms').insert({ name: formName, service_id: formServiceId, ...apiPayload }).select().single();
        if (error) throw error;
        if (fields.length > 0) {
          const { error: fErr } = await supabase.from('form_fields').insert(fieldRows(data.id));
          if (fErr) throw fErr;
        }
        return { action: 'CREATE' as const, id: data.id };
      }
    },
    onSuccess: (result) => {
      const svc = services?.find((s: any) => s.id === formServiceId);
      const camposResumo = fields.map((f, i) => `${i + 1}. ${f.label || '(sem título)'} [${f.field_type}${f.required ? ', obrigatório' : ''}${f.send_to_api ? ', enviado à API' : ''}]`).join(' | ');
      const apiResumo = apiEnabled ? ` • Integração: ${apiMethod} ${apiUrl.trim()} (timeout ${apiTimeout}s, ${fields.filter(f => f.send_to_api).length} campo(s) enviados)` : ' • Integração: desativada';
      const detalhes = `"${formName}" vinculado ao serviço "${svc?.name || '—'}" • ${fields.length} campo${fields.length === 1 ? '' : 's'}${camposResumo ? ` → ${camposResumo}` : ''}${apiResumo}`;
      logAction(result.action, 'service_forms', result.id, `${result.action === 'CREATE' ? 'Novo formulário criado' : 'Formulário atualizado'}: ${detalhes}.`);
      queryClient.invalidateQueries({ queryKey: ['service-forms'] });
      setDialog(false);
      toast({ title: '✅ Formulário salvo!' });
    },
    onError: (err: any) => { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); },
  });

  const save = () => {
    if (!formName || !formServiceId) { toast({ title: 'Preencha nome e serviço', variant: 'destructive' }); return; }
    if (apiEnabled) {
      const url = apiUrl.trim();
      if (!/^https?:\/\/.+/i.test(url)) {
        toast({ title: 'Informe uma URL válida (http:// ou https://) para a API', variant: 'destructive' });
        return;
      }
      if (!fields.some(f => f.send_to_api)) {
        toast({ title: 'Marque ao menos um campo para enviar à API', variant: 'destructive' });
        return;
      }
    }
    saveMutation.mutate();
  };


  const formsColumns: ExportColumn<any>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'service_name', label: 'Serviço', accessor: r => services.find((s: any) => s.id === r.service_id)?.name || '' },
    { key: 'fields_count', label: 'Qtd. Campos', accessor: r => r.form_fields?.length || 0 },
    { key: 'created_at', label: 'Criado em', accessor: r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '' },
  ];
  const { rows: filteredForms, toolbarProps } = useListToolbar(serviceForms as any[], formsColumns);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{filteredForms.length} de {serviceForms.length} formulários</p>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground font-semibold"><Plus size={16} className="mr-1" /> Novo Formulário</Button>
      </div>
      <ListToolbar title="Formulários" {...toolbarProps} />
      <div className="grid gap-3">
        {filteredForms.map((f: any) => (
          <div key={f.id} className="bg-card border border-border rounded-xl p-4 card-hover flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">{f.name}</p>
              <p className="text-xs text-muted-foreground">Serviço: {services.find((s: any) => s.id === f.service_id)?.name} • {f.form_fields?.length || 0} campos</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Edit2 size={16} /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(f)}><Trash2 size={16} className="text-destructive" /></Button>
            </div>
          </div>
        ))}
        {filteredForms.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum formulário cadastrado</p>}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Novo'} Formulário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-foreground">Nome</label><Input value={formName} onChange={e => setFormName(e.target.value)} className="mt-1" /></div>
            <div>
              <label className="text-xs font-semibold text-foreground">Serviço</label>
              <SearchableSelect
                value={formServiceId}
                onValueChange={setFormServiceId}
                options={services.map((s: any) => ({ value: s.id, label: s.name, description: s.code }))}
                placeholder="Selecione..."
                searchPlaceholder="Buscar serviço..."
                emptyText="Nenhum serviço encontrado"
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-foreground">Campos</label>
                <Button size="sm" variant="outline" onClick={addField}><Plus size={14} className="mr-1" /> Campo</Button>
              </div>
              {fields.map((field, idx) => (
                <div key={idx} className="mb-2 bg-muted p-2 rounded-lg space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><Input placeholder="Label" value={field.label} onChange={e => updateField(idx, { label: e.target.value })} /></div>
                    <Select value={field.field_type} onValueChange={v => updateField(idx, { field_type: v })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="textarea">Área de Texto</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                        <SelectItem value="currency">R$ (Valor)</SelectItem>
                        <SelectItem value="return_reason">Motivo de Devolução</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Checkbox checked={field.required} onCheckedChange={c => updateField(idx, { required: !!c })} />
                      <span className="text-[10px]">Obrig.</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeField(idx)}><Trash2 size={14} /></Button>
                  </div>
                  {apiEnabled && (
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-1">
                        <Checkbox checked={field.send_to_api} onCheckedChange={c => updateField(idx, { send_to_api: !!c })} />
                        <span className="text-[10px]">Enviar na API</span>
                      </div>
                      <Input
                        className="h-8 flex-1"
                        placeholder="Nome do parâmetro (opcional)"
                        value={field.api_param_name}
                        disabled={!field.send_to_api}
                        onChange={e => updateField(idx, { api_param_name: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={apiEnabled} onCheckedChange={c => setApiEnabled(!!c)} />
                <span className="text-xs font-semibold text-foreground">Chamar API ao abrir ticket</span>
              </div>
              {apiEnabled && (
                <>
                  <div className="flex gap-2">
                    <div className="w-28">
                      <label className="text-xs font-semibold text-foreground">Método</label>
                      <Select value={apiMethod} onValueChange={v => setApiMethod(v as 'GET' | 'POST')}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      <label className="text-xs font-semibold text-foreground">Timeout (s)</label>
                      <Input
                        type="number" min={1} max={60} className="mt-1"
                        value={apiTimeout}
                        onChange={e => setApiTimeout(Math.min(60, Math.max(1, Number(e.target.value) || 15)))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">URL da API (http ou https)</label>
                    <Input className="mt-1" placeholder="https://api.exemplo.com/endpoint" value={apiUrl} onChange={e => setApiUrl(e.target.value)} />
                    <p className="text-[10px] text-muted-foreground mt-1">Com http os dados são enviados sem criptografia. Prefira https quando disponível.</p>
                  </div>
                  {apiMethod === 'GET' && (
                    <div className="flex items-center gap-2">
                      <Checkbox checked={apiValuesInPath} onCheckedChange={c => setApiValuesInPath(!!c)} />
                      <span className="text-xs font-semibold text-foreground">Enviar apenas os valores na rota (sem nome do parâmetro)</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Marque acima quais campos serão enviados. Em GET vão como parâmetros na URL (ou na rota, se a opção acima estiver marcada); em POST vão como JSON no corpo. Se a chamada falhar, o ticket não é aberto.
                  </p>
                </>
              )}
            </div>

            <Button onClick={save} disabled={saveMutation.isPending} className="w-full gradient-primary text-primary-foreground font-semibold">
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirm.reason ? 'Exclusão não permitida' : 'Confirmar exclusão'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.reason || `Tem certeza que deseja excluir o formulário "${deleteConfirm.name}"? Os campos associados também serão removidos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            {!deleteConfirm.reason && (
              <AlertDialogAction onClick={() => deleteMutation.mutate(deleteConfirm.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FormsPage;
