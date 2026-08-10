import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, LabelList, Area, ComposedChart } from 'recharts';
import { motion } from 'framer-motion';

interface Chart3DBarProps {
  title: string;
  subtitle: string;
  data: { name: string; avg: number }[];
  meta: number;
  higherIsBetter?: boolean;
  yDomain?: [number, number];
  icon?: string;
}

const font = "'Nunito', sans-serif";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-lg">
      <p className="text-xs font-bold text-muted-foreground" style={{ fontFamily: font }}>{label}</p>
      <p className="text-xl font-black text-foreground mt-0.5 tabular-nums" style={{ fontFamily: font }}>
        {value}
      </p>
    </div>
  );
};

const Chart3DBar: React.FC<Chart3DBarProps> = ({ title, subtitle, data, meta, higherIsBetter = false, yDomain, icon }) => {
  const hasData = data.length > 0;
  const maxVal = data.length > 0 ? Math.max(...data.map(d => d.avg), meta) : meta;
  const computedDomain: [number, number] = yDomain || [0, Math.ceil(maxVal * 1.3) || 5];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden"
    >
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-xl">{icon}</span>}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-extrabold text-foreground leading-tight" style={{ fontFamily: font }}>
              {title}
            </h3>
            <p className="text-[0.6875rem] font-medium text-muted-foreground mt-0.5" style={{ fontFamily: font }}>
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-destructive" />
            <span className="text-[0.625rem] font-bold text-muted-foreground" style={{ fontFamily: font }}>Meta: {meta}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="text-[0.625rem] font-bold text-muted-foreground" style={{ fontFamily: font }}>{higherIsBetter ? '≥ Meta' : '≤ Meta'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
            <span className="text-[0.625rem] font-bold text-muted-foreground" style={{ fontFamily: font }}>{higherIsBetter ? '< Meta' : '> Meta'}</span>
          </div>
        </div>
      </div>

      <div className="px-3 pb-4">
        <div className="h-60 rounded-xl bg-muted/30 p-1">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 8, left: -4, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradGood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(152, 55%, 52%)" />
                    <stop offset="100%" stopColor="hsl(152, 45%, 42%)" />
                  </linearGradient>
                  <linearGradient id="gradBad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(350, 60%, 60%)" />
                    <stop offset="100%" stopColor="hsl(350, 50%, 48%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 12%, 90%)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fontFamily: font, fontWeight: 700, fill: 'hsl(210, 15%, 45%)' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  dy={4}
                />
                <YAxis
                  domain={computedDomain}
                  tick={{ fontSize: 10, fontFamily: font, fontWeight: 600, fill: 'hsl(210, 12%, 60%)' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(210, 15%, 94%)', radius: 6 }} />
                <ReferenceLine
                  y={meta}
                  stroke="hsl(350, 55%, 55%)"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Meta ${meta}`,
                    position: 'right',
                    fontSize: 10,
                    fontFamily: font,
                    fontWeight: 800,
                    fill: 'hsl(350, 55%, 50%)',
                  }}
                />
                <Bar dataKey="avg" radius={[8, 8, 2, 2]} barSize={32} animationDuration={600}>
                  <LabelList
                    dataKey="avg"
                    position="top"
                    style={{ fontSize: 12, fontFamily: font, fontWeight: 800, fill: 'hsl(210, 18%, 30%)' }}
                    offset={6}
                  />
                  {data.map((entry, index) => {
                    const isGood = higherIsBetter ? entry.avg >= meta : entry.avg <= meta;
                    return <Cell key={index} fill={isGood ? 'url(#gradGood)' : 'url(#gradBad)'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <span className="text-2xl opacity-30">📊</span>
                <p className="text-xs font-semibold text-muted-foreground mt-1.5" style={{ fontFamily: font }}>
                  Sem dados para exibir
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Chart3DBar;
