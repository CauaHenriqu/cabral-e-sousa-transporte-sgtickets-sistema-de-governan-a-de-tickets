import React, { useState, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { motion } from 'framer-motion';

interface PieData {
  name: string;
  value: number;
  fill: string;
}

interface Chart3DPieProps {
  title: string;
  subtitle: string;
  data: PieData[];
  icon?: string;
}

const font = "'Nunito', sans-serif";

const COLORS = [
  'hsl(152, 55%, 50%)',
  'hsl(208, 50%, 55%)',
  'hsl(40, 80%, 55%)',
  'hsl(20, 72%, 58%)',
  'hsl(350, 55%, 55%)',
];

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={innerRadius + 2}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text x={cx} y={cy - 10} textAnchor="middle" fill="hsl(210, 18%, 25%)" fontFamily={font} fontWeight={900} fontSize={20}>
        {value}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="hsl(210, 12%, 50%)" fontFamily={font} fontWeight={700} fontSize={11}>
        {(percent * 100).toFixed(0)}%
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-lg">
      <p className="text-xs font-bold text-muted-foreground" style={{ fontFamily: font }}>{payload[0].name}</p>
      <p className="text-xl font-black text-foreground mt-0.5 tabular-nums" style={{ fontFamily: font }}>
        {payload[0].value}
      </p>
    </div>
  );
};

const Chart3DPie: React.FC<Chart3DPieProps> = ({ title, subtitle, data, icon }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

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
            <p className="text-[11px] font-medium text-muted-foreground mt-0.5" style={{ fontFamily: font }}>
              {subtitle}
            </p>
          </div>
          <span
            className="text-[11px] font-extrabold text-primary bg-primary/10 px-3 py-1 rounded-full"
            style={{ fontFamily: font }}
          >
            Total: {total}
          </span>
        </div>
      </div>

      <div className="px-3 pb-4">
        <div className="bg-muted/30 rounded-xl p-2">
          <div className="flex flex-col lg:flex-row items-center gap-2">
            <div className="h-64 flex-1 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                    onMouseEnter={onPieEnter}
                    animationBegin={80}
                    animationDuration={600}
                    stroke="hsl(0, 0%, 100%)"
                    strokeWidth={2}
                  >
                    {data.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-1 w-full lg:min-w-[180px] lg:max-w-[220px] pb-1 lg:pb-0">
              {data.map((d, i) => {
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : '0';
                const isActive = i === activeIndex;
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[12px_1fr_auto_2rem] items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-muted/80 scale-[1.02]' : 'hover:bg-muted/40'}`}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-[11px] font-bold text-foreground leading-tight break-words" style={{ fontFamily: font }}>
                      {d.name}
                    </span>
                    <span className="text-xs font-black text-foreground tabular-nums text-right" style={{ fontFamily: font }}>
                      {d.value}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground tabular-nums text-right" style={{ fontFamily: font }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Chart3DPie;
