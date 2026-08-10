import React, { useState } from 'react';
import { ClipboardList, Clock, Star, CheckCircle2, Info, X, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MetricCardsProps {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  avgRating: number;
  slaPercent?: number;
  slaGoalPercent?: number;
  ratingGoal?: number;
  ratingJustifyThreshold?: number;
}

const SLA_PERCENT_RULE_TEXT = [
  '📌 Regra de Cálculo da Meta de % SLA',
  '',
  '🎯 Meta: deve ser ≥ ao % definido em "Meta % SLA" (Configurações).',
  '',
  '🔢 Como é calculado:',
  '• Tickets FECHADOS: horas entre a abertura e o fechamento.',
  '• Tickets ABERTOS: horas entre a abertura e a data/hora atual.',
  '• Apenas horas dentro do expediente do atendente são contadas (work_schedules).',
  '• O horário de almoço é descontado.',
  '• Sem horários cadastrados → usa tempo corrido (calendário).',
  '',
  '📊 % SLA = (tickets com horas gastas ≤ SLA do serviço ÷ total) × 100.',
  '',
  '📅 Dedução cross-mês: cada ticket fechado em mês diferente do mês de criação deduz 1% do % SLA do mês em que foi fechado.',
  '',
  '✅ Dentro da meta: % SLA ≥ Meta % SLA',
  '🔴 Abaixo da meta: % SLA < Meta % SLA',
];

const buildRatingRuleText = (goal: number, threshold: number) => [
  '📌 Regra de Cálculo da Meta de Avaliação Média',
  '',
  `🎯 Meta: ≥ ${goal} (configurável em "Meta de Avaliação")`,
  '',
  '🔢 Como é calculado:',
  '• Considera apenas tickets que possuem avaliação (nota) registrada.',
  '• A nota varia de 1 a 5 estrelas.',
  '• A média é calculada somando todas as notas e dividindo pelo total de tickets avaliados.',
  '',
  '📊 Fórmula: soma das notas ÷ quantidade de tickets avaliados.',
  '',
  `📝 Justificativa obrigatória: avaliações ≤ ${threshold} exigem justificativa do usuário (configurável em "Justificar avaliação quando for menor ou igual a").`,
  '',
  `✅ Dentro da meta: média ≥ ${goal}`,
  `🔴 Abaixo da meta: média < ${goal}`,
];

const MetricCards: React.FC<MetricCardsProps> = ({ totalTickets, openTickets, closedTickets, avgRating, slaPercent = 0, slaGoalPercent = 90, ratingGoal = 3, ratingJustifyThreshold = 3 }) => {
  const [showRatingRule, setShowRatingRule] = useState(false);
  const [showSlaRule, setShowSlaRule] = useState(false);
  const ratingOk = avgRating >= ratingGoal;
  const slaOk = slaPercent >= slaGoalPercent;
  const RATING_RULE_TEXT = buildRatingRuleText(ratingGoal, ratingJustifyThreshold);

  const cards = [
    {
      label: 'Total de Tickets',
      value: totalTickets,
      icon: <ClipboardList size={26} strokeWidth={1.8} />,
      gradient: 'bg-gradient-to-br from-[hsl(205,70%,55%)] to-[hsl(215,65%,65%)]',
      glow: 'shadow-[0_8px_30px_-6px_hsl(205,70%,55%,0.45)]',
      emoji: '📋',
      indicator: null,
      hasInfoButton: false,
    },
    {
      label: 'Tickets Abertos',
      value: openTickets,
      icon: <Clock size={26} strokeWidth={1.8} />,
      gradient: 'bg-gradient-to-br from-[hsl(28,80%,60%)] to-[hsl(20,75%,70%)]',
      glow: 'shadow-[0_8px_30px_-6px_hsl(28,80%,62%,0.45)]',
      emoji: '🔔',
      indicator: null,
      hasInfoButton: false,
    },
    {
      label: 'Tickets Fechados',
      value: closedTickets,
      icon: <CheckCircle2 size={26} strokeWidth={1.8} />,
      gradient: 'bg-gradient-to-br from-[hsl(152,45%,48%)] to-[hsl(160,40%,58%)]',
      glow: 'shadow-[0_8px_30px_-6px_hsl(152,45%,48%,0.45)]',
      emoji: '✅',
      indicator: null,
      hasInfoButton: false,
    },
    {
      label: '% SLA',
      value: `${Math.trunc(slaPercent)}%`,
      icon: <Target size={26} strokeWidth={1.8} />,
      gradient: slaOk
        ? 'bg-gradient-to-br from-[hsl(152,45%,48%)] to-[hsl(160,40%,58%)]'
        : 'bg-gradient-to-br from-[hsl(0,65%,55%)] to-[hsl(10,60%,65%)]',
      glow: slaOk
        ? 'shadow-[0_8px_30px_-6px_hsl(152,45%,48%,0.45)]'
        : 'shadow-[0_8px_30px_-6px_hsl(0,65%,55%,0.45)]',
      emoji: slaOk ? '🎯' : '⚠️',
      indicator: `Meta: ≥ ${slaGoalPercent}% — ${slaOk ? '✅ Dentro da meta!' : '🔴 Abaixo da meta!'}`,
      hasInfoButton: true,
      onInfoClick: () => setShowSlaRule(true),
    },
    {
      label: 'Avaliação Média',
      value: avgRating.toFixed(1),
      icon: <Star size={26} strokeWidth={1.8} />,
      gradient: ratingOk
        ? 'bg-gradient-to-br from-[hsl(205,70%,55%)] to-[hsl(215,65%,65%)]'
        : 'bg-gradient-to-br from-[hsl(0,65%,55%)] to-[hsl(10,60%,65%)]',
      glow: ratingOk
        ? 'shadow-[0_8px_30px_-6px_hsl(205,70%,55%,0.45)]'
        : 'shadow-[0_8px_30px_-6px_hsl(0,65%,55%,0.45)]',
      emoji: ratingOk ? '⭐' : '⚠️',
      indicator: `Meta: ≥ ${ratingGoal} — ${ratingOk ? '✅ Dentro da meta!' : '🔴 Abaixo da meta!'}`,
      hasInfoButton: true,
      onInfoClick: () => setShowRatingRule(true),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5, type: 'spring', stiffness: 120 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className={`relative overflow-hidden rounded-3xl p-5 ${card.gradient} ${card.glow} text-white cursor-default`}
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-md" />
            <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/5" />
            <div className="absolute top-3 right-4 text-2xl opacity-30 select-none">{card.emoji}</div>

            {card.hasInfoButton && card.onInfoClick && (
              <button
                onClick={card.onInfoClick}
                className="absolute top-3 left-3 z-20 w-6 h-6 rounded-full bg-white/25 hover:bg-white/40 flex items-center justify-center transition-colors cursor-pointer"
                title="Ver regra de cálculo"
              >
                <Info size={14} />
              </button>
            )}

            <div className="relative z-10 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                {card.icon}
              </div>
              <div>
                <p className="text-[1.875rem] font-black tracking-tight leading-none">{card.value}</p>
                <p className="text-[0.75rem] font-semibold opacity-90 mt-1">{card.label}</p>
              </div>
            </div>
            {card.indicator && (
              <p className="relative z-10 text-[0.625rem] font-bold mt-2 bg-white/15 rounded-lg px-2 py-1 backdrop-blur-sm">
                {card.indicator}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showRatingRule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowRatingRule(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-[0.9375rem] font-extrabold text-foreground">ℹ️ Regra de Cálculo</h3>
                <button
                  onClick={() => setShowRatingRule(false)}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-1">
                {RATING_RULE_TEXT.map((line, i) => (
                  <p
                    key={i}
                    className={`text-[0.8125rem] leading-relaxed ${
                      i === 0
                        ? 'font-extrabold text-foreground text-[0.9375rem]'
                        : line === ''
                          ? 'h-2'
                          : line.startsWith('•')
                            ? 'text-muted-foreground pl-2'
                            : line.startsWith('✅') || line.startsWith('🔴')
                              ? 'font-bold text-foreground'
                              : 'font-semibold text-foreground'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSlaRule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowSlaRule(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-[0.9375rem] font-extrabold text-foreground">ℹ️ Regra de Cálculo</h3>
                <button
                  onClick={() => setShowSlaRule(false)}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-1">
                {SLA_PERCENT_RULE_TEXT.map((line, i) => (
                  <p
                    key={i}
                    className={`text-[0.8125rem] leading-relaxed ${
                      i === 0
                        ? 'font-extrabold text-foreground text-[0.9375rem]'
                        : line === ''
                          ? 'h-2'
                          : line.startsWith('•')
                            ? 'text-muted-foreground pl-2'
                            : line.startsWith('✅') || line.startsWith('🔴')
                              ? 'font-bold text-foreground'
                              : 'font-semibold text-foreground'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MetricCards;
