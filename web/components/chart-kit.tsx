"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

/**
 * The chart tokens, in one place. Recharts wants colours as strings on props
 * rather than classes, so without this every axis and gridline re-declares the
 * palette and they drift apart the first time one is edited.
 */
export const CHART = {
  series: "hsl(var(--chart-1))",
  signal: "hsl(var(--signal))",
  grid: "hsl(var(--grid))",
  axis: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tooltip: {
    background: "#fff",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    padding: "10px 14px",
  },
  cursor: { fill: "hsl(var(--muted))", fillOpacity: 0.6 },
};

/**
 * The 40px sparkline the KPI tiles carry beside their number: a 2px line over
 * an 8-12% fill, per the spec's chart treatment.
 *
 * It is always a real series — the price histogram, or the stores-per-bucket
 * distribution. Nothing here invents a trend: the crawl covers a single day, so
 * a time series would have to be fabricated, and a fabricated one on a sales
 * call is worse than none.
 */
export function Sparkline({
  values,
  colour = CHART.series,
}: {
  values: number[];
  colour?: string;
}) {
  if (values.length < 2) return <div className="h-10 w-[84px]" />;
  const data = values.map((value, index) => ({ index, value }));
  const id = `spark-${colour.replace(/\W/g, "")}`;
  return (
    <div className="h-10 w-[84px]" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity={0.1} />
              <stop offset="100%" stopColor={colour} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={colour}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
