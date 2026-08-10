import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { logAction } from '@/lib/logAction';
import { Settings as SettingsIcon } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [slaGoal, setSlaGoal] = useState<string>('');
  const [ratingGoal, setRatingGoal] = useState<string>('');
  const [ratingJustifyThreshold, setRatingJustifyThreshold] = useState<string>('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings' as any)
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (settings?.sla_goal_percent != null) {
      setSlaGoal(String(settings.sla_goal_percent));
    }
    if (settings?.rating_goal != null) {
      setRatingGoal(String(settings.rating_goal));
    }
    if (settings?.rating_justification_threshold != null) {
      setRatingJustifyThreshold(String(settings.rating_justification_threshold));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const slaValue = parseFloat(slaGoal.replace(',', '.'));
      const ratingValue = parseInt(ratingGoal, 10);
      const justifyValue = parseInt(ratingJustifyThreshold, 10);
      const { error } = await supabase
        .from('app_settings' as any)
        .update({
          sla_goal_percent: slaValue,
          rating_goal: ratingValue,
          rating_justification_threshold: justifyValue,
        } as any)
        .eq('id', 1);
      if (error) throw error;
      return { slaValue, ratingValue, justifyValue };
    },
    onSuccess: ({ slaValue, ratingValue, justifyValue }) => {
      logAction(
        'UPDATE',
        'app_settings',
        '1',
        `Configurações gerais atualizadas • Meta de SLA: ${slaValue}% (percentual mínimo de tickets que devem ser atendidos dentro do prazo) • Meta de avaliação: ${ratingValue} estrelas (média mínima esperada) • Justificativa obrigatória quando avaliação for menor ou igual a ${justifyValue} estrelas.`
      );
      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      toast({ title: '✅ Configurações salvas!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const save = () => {
    const slaValue = parseFloat(slaGoal.replace(',', '.'));
    if (isNaN(slaValue) || slaValue < 0 || slaValue > 100) {
      toast({
        title: 'Meta % SLA inválida',
        description: 'Informe um percentual entre 0 e 100.',
        variant: 'destructive',
      });
      return;
    }
    const ratingValue = parseInt(ratingGoal, 10);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      toast({
        title: 'Meta de Avaliação inválida',
        description: 'Informe um número inteiro entre 1 e 5.',
        variant: 'destructive',
      });
      return;
    }
    const justifyValue = parseInt(ratingJustifyThreshold, 10);
    if (isNaN(justifyValue) || justifyValue < 1 || justifyValue > 5) {
      toast({
        title: 'Justificativa inválida',
        description: 'Informe um número inteiro entre 1 e 5.',
        variant: 'destructive',
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground">
            <SettingsIcon size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Configurações Gerais</h2>
            <p className="text-xs text-muted-foreground">Parâmetros globais do sistema</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-6">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground">
                Meta % SLA <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={slaGoal}
                  onChange={(e) => setSlaGoal(e.target.value)}
                  placeholder="Ex.: 90"
                  className="max-w-[160px]"
                />
                <span className="text-sm font-semibold text-muted-foreground">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Percentual mínimo de tickets que devem ser fechados dentro do SLA definido por serviço.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">
                Meta de Avaliação <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={1}
                  value={ratingGoal}
                  onChange={(e) => setRatingGoal(e.target.value.replace(/[^1-5]/g, '').slice(0, 1))}
                  placeholder="Ex.: 3"
                  className="max-w-[160px]"
                />
                <span className="text-sm font-semibold text-muted-foreground">⭐ (1 a 5)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Nota mínima esperada na avaliação dos tickets (número inteiro de 1 a 5).
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">
                Justificar avaliação quando for menor ou igual a <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={1}
                  value={ratingJustifyThreshold}
                  onChange={(e) =>
                    setRatingJustifyThreshold(e.target.value.replace(/[^1-5]/g, '').slice(0, 1))
                  }
                  placeholder="Ex.: 3"
                  className="max-w-[160px]"
                />
                <span className="text-sm font-semibold text-muted-foreground">⭐ (1 a 5)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Quando a nota da avaliação for menor ou igual a este valor, será obrigatório informar uma justificativa.
              </p>
            </div>

            <Button
              onClick={save}
              disabled={saveMutation.isPending}
              className="gradient-primary text-primary-foreground font-semibold"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
