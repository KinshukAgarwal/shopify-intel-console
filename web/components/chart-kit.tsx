"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

/**
 * The chart tokens, in one place. Recharts wants colours as strings on props
 * rather than classes, so without this every axis and gridline re-declares the
 * palette and they drift apart the first time one is edited.
 */
export const CHART = {
  ink: "hsl(var(--foreground))",     // the ONE emphasised mark in a series
  rest: "hsl(var(--track))",         // #E4E7EC — every other mark
  signal: "hsl(var(--signal))",      // white space, and nothing else
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
 * The micro chart beside a KPI figure: no axes, no labels, pure shape, with a
 * single dot on the final point.
 *
 * The dot is near-black rather than the accent. The references put the accent
 * there, but in this product orange means one thing — a price band nobody is
 * selling into — and spending it on a decorative terminal dot would teach the
 * viewer that it means nothing in particular.
 *
 * The series is always real: the price histogram, or the store-depth
 * distribution. Nothing here invents a trend. The crawl covers a single day, so
 * a time series would have to be fabricated.
 */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-11 w-[88px]" />;
  const data = values.map((value, index) => ({ index, value }));
  const last = data.length - 1;
  return (
    <div className="h-11 w-[88px]" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.ink} stopOpacity={0.1} />
              <stop offset="100%" stopColor={CHART.ink} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            fill="url(#spark)"
            isAnimationActive={false}
            dot={(props) =>
              props.index === last ? (
                <circle
                  key="end"
                  cx={props.cx}
                  cy={props.cy}
                  r={2.5}
                  fill={CHART.ink}
                />
              ) : (
                <g key={props.index} />
              )
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type Segment = { label: string; value: number; tone?: "ink" | "signal" };

const TONE = {
  ink: "bg-foreground",
  signal: "bg-[hsl(var(--signal))]",
  rest: "bg-[hsl(var(--track))]",
} as const;

/**
 * The 6px bar from the reference KPI card, in its one-segment (progress) and
 * many-segment (two-tone) forms.
 *
 * Hand-written, ~15 lines: shadcn's Progress renders a single value against a
 * track and cannot express a bar split into named parts, and pulling in a
 * charting component to draw three divs would cost more than it saves.
 */
export function SegmentBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-[hsl(var(--track))]">
      {segments.map((part) => (
        <span
          key={part.label}
          className={`h-full rounded-full ${TONE[part.tone ?? "rest"]}`}
          style={{ width: `${(part.value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Legend rows, never a chart-attached legend: dot, share, label, then the value
 * right-aligned and tabular so the column of figures lines up.
 */
export function LegendRows({
  rows,
  unit,
}: {
  rows: { label: string; value: number; share: number; tone?: "ink" | "signal" }[];
  unit: string;
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-[13px]">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${TONE[row.tone ?? "rest"]}`}
          />
          <span className="w-10 shrink-0 font-semibold tabular text-foreground">
            {Math.round(row.share)}%
          </span>
          <span className="truncate text-[hsl(var(--body))]">{row.label}</span>
          <span className="ml-auto shrink-0 tabular text-muted-foreground">
            {row.value.toLocaleString("en-US")} {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
