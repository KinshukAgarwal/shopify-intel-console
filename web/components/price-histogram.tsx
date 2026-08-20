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
import { CHART } from "@/components/chart-kit";
import { moneyShort, num } from "@/lib/format";
import type { Gap, Niche } from "@/lib/api";

const GAP = CHART.gap;     // orange — reserved for white space and nothing else
const BAR = CHART.series;

/** The one-line verdict a viewer should be able to read off the chart. */
function gapPhrase(gap: Gap) {
  return gap.kind === "empty"
    ? `No products ${moneyShort(gap.lo)}–${moneyShort(gap.hi)}`
    : `Only ${num(gap.products)} products ${moneyShort(gap.lo)}–${moneyShort(gap.hi)}`;
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
      <CardHeader className="flex-row items-start justify-between gap-6 space-y-0 px-6 pb-2 pt-5">
        <div>
          <h2 className="section-title">Price distribution</h2>
          <p className="body-text mt-1">
            {num(data.headline.priced)} priced products, bucketed. Amber bands
            are white space — the market is not selling there.
          </p>
        </div>
        {widest && (
          <div className="shrink-0 rounded-xl border border-dashed border-[hsl(var(--chart-2))]/40 bg-[hsl(var(--chart-2))]/[0.08] px-4 py-2.5 text-right">
            <p className="stat-label text-[hsl(var(--chart-2))]">Widest gap</p>
            <p className="mt-1.5 text-[20px] font-semibold leading-none tabular tracking-[-0.02em] text-foreground">
              {moneyShort(widest.lo)} – {moneyShort(widest.hi)}
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-4">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={rows} margin={{ top: 30, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            {bands.map((band) => (
              <ReferenceArea
                key={`${band.from}-${band.to}`}
                x1={band.from}
                x2={band.to}
                fill={GAP}
                fillOpacity={0.08}
                stroke={GAP}
                strokeOpacity={0.45}
                strokeDasharray="5 4"
              >
                {band.gap && (
                  <Label
                    value={gapPhrase(band.gap)}
                    position="top"
                    offset={13}
                    fill={GAP}
                    fontSize={12}
                    fontWeight={600}
                  />
                )}
              </ReferenceArea>
            ))}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={26}
              tick={CHART.axis}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={CHART.axis}
              tickFormatter={(value: number) =>
                value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`
              }
            />
            <Tooltip
              cursor={CHART.cursor}
              contentStyle={CHART.tooltip}
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
        <div className="flex flex-wrap gap-2 border-t border-[hsl(var(--divider))] px-6 py-3.5">
          {data.gaps.map((gap, index) => (
            <span key={`${gap.lo}-${gap.hi}`} className="pill" data-tone="gap">
              <span
                className="mr-0.5 h-1.5 w-1.5 rounded-full bg-current"
                style={{ opacity: index === 0 ? 1 : 0.5 }}
              />
              <span className="font-semibold">
                {moneyShort(gap.lo)} – {moneyShort(gap.hi)}
              </span>
              <span className="font-normal opacity-80">
                {gap.kind === "empty"
                  ? "nobody sells here"
                  : `${gap.share_pct}% of the market`}
              </span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
