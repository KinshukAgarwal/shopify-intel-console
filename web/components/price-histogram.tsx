"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { moneyShort, num } from "@/lib/format";
import type { Gap, Niche } from "@/lib/api";

const GAP = "hsl(var(--chart-2))";   // orange — reserved for white space alone
const BAR = "hsl(var(--chart-1))";
const GRID = "hsl(var(--border))";
const AXIS = "hsl(var(--muted-foreground))";

/** The one-line verdict a viewer should be able to read off the chart. */
function gapPhrase(gap: Gap) {
  return gap.kind === "empty"
    ? `no products ${moneyShort(gap.lo)}–${moneyShort(gap.hi)}`
    : `only ${num(gap.products)} products ${moneyShort(gap.lo)}–${moneyShort(gap.hi)}`;
}

export function PriceHistogram({ data }: { data: Niche | null }) {
  if (!data) return <Skeleton className="h-[440px] rounded-xl" />;

  if (data.histogram.length === 0) {
    return (
      <Card className="panel flex h-[400px] items-center justify-center border-dashed">
        <CardContent className="p-10 text-center">
          <p className="text-sm font-medium">No priced products in this market</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            The crawl has found the catalogue but not yet an observation with a
            price. Re-run the index once the pass completes.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Which bars fall inside a reported gap. Used to tint the bar AND to place
  // the highlight band, so the two can never drift apart.
  const inGap = data.histogram.map((bar) =>
    data.gaps.some((gap) => bar.lo >= gap.lo - 1e-9 && bar.hi <= gap.hi + 1e-9)
  );
  const rows = data.histogram.map((bar, index) => ({
    label: moneyShort(bar.lo),
    lo: bar.lo,
    hi: bar.hi,
    count: bar.count,
    gap: inGap[index],
  }));

  // Contiguous runs of gap bars, each carrying the gap it came from so the
  // band can be labelled with the same phrase as the callout below it.
  const bands: { from: string; to: string; gap: Gap | undefined }[] = [];
  let start: number | null = null;
  inGap.forEach((flag, index) => {
    if (flag && start === null) start = index;
    if ((!flag || index === inGap.length - 1) && start !== null) {
      const end = flag ? index : index - 1;
      bands.push({
        from: rows[start].label,
        to: rows[end].label,
        gap: data.gaps.find(
          (g) => rows[start!].lo >= g.lo - 1e-9 && rows[end].hi <= g.hi + 1e-9
        ),
      });
      start = null;
    }
  });

  const widest = data.gaps[0];

  return (
    <Card className="panel">
      <CardHeader className="flex-row items-start justify-between gap-6 space-y-0 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Price distribution
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {num(data.headline.priced)} priced products, bucketed. Shaded bands
            are white space — the market is not selling there.
          </p>
        </div>
        {widest && (
          <div className="shrink-0 rounded-lg border border-[hsl(var(--chart-2))]/30 bg-[hsl(var(--chart-2))]/[0.07] px-4 py-2.5 text-right">
            <p className="stat-label text-[hsl(var(--chart-2))]">Widest gap</p>
            <p className="mt-1 text-[20px] font-semibold leading-none tabular tracking-tight text-foreground">
              {moneyShort(widest.lo)} – {moneyShort(widest.hi)}
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="px-2 pb-2 pt-4">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={rows} margin={{ top: 28, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            {bands.map((band) => (
              <ReferenceArea
                key={`${band.from}-${band.to}`}
                x1={band.from}
                x2={band.to}
                fill={GAP}
                fillOpacity={0.09}
                stroke={GAP}
                strokeOpacity={0.35}
                strokeDasharray="4 4"
              >
                {band.gap && (
                  <Label
                    value={gapPhrase(band.gap)}
                    position="top"
                    offset={12}
                    fill={GAP}
                    fontSize={11}
                    fontWeight={600}
                  />
                )}
              </ReferenceArea>
            ))}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              interval="preserveStartEnd"
              minTickGap={26}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickFormatter={(value: number) =>
                value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`
              }
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.6 }}
              contentStyle={{
                background: "#fff",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
              }}
              labelFormatter={(_label, payload) => {
                const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                return row ? `${moneyShort(row.lo)} – ${moneyShort(row.hi)}` : "";
              }}
              formatter={(value) => [num(Number(value ?? 0)), "products"]}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={22}>
              {rows.map((row, index) => (
                <Cell key={index} fill={row.gap ? GAP : BAR} fillOpacity={row.gap ? 0.55 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>

      {data.gaps.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
          {data.gaps.map((gap, index) => (
            <span
              key={`${gap.lo}-${gap.hi}`}
              className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[12px] text-muted-foreground"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: GAP, opacity: index === 0 ? 1 : 0.5 }}
              />
              <span className="font-medium tabular text-foreground">
                {moneyShort(gap.lo)} – {moneyShort(gap.hi)}
              </span>
              {gap.kind === "empty"
                ? "nobody sells here"
                : `${gap.share_pct}% of the market`}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
