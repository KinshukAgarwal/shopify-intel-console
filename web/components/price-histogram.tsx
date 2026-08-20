"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { moneyShort, num } from "@/lib/format";
import type { Niche } from "@/lib/api";

const GAP = "hsl(var(--chart-2))";
const BAR = "hsl(var(--chart-1))";

export function PriceHistogram({ data }: { data: Niche | null }) {
  if (!data) {
    return <Skeleton className="h-[440px] rounded-xl" />;
  }
  if (data.histogram.length === 0) {
    return (
      <Card className="flex h-[440px] items-center justify-center border-dashed border-border/70 bg-card/40">
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

  // Which bars fall inside a reported gap. Used both to tint the bar and to
  // place the highlight band, so the two can never drift apart.
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

  const bands: { from: string; to: string }[] = [];
  let start: number | null = null;
  inGap.forEach((flag, index) => {
    if (flag && start === null) start = index;
    if ((!flag || index === inGap.length - 1) && start !== null) {
      const end = flag ? index : index - 1;
      bands.push({ from: rows[start].label, to: rows[end].label });
      start = null;
    }
  });

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Price distribution</CardTitle>
          <CardDescription>
            Every product in the market, bucketed by price. Amber bands are white
            space — the market is not selling there.
          </CardDescription>
        </div>
        <Badge variant="outline" className="shrink-0 border-border/70 font-normal tabular">
          {num(data.headline.priced)} priced products
        </Badge>
      </CardHeader>
      <CardContent className="pl-0">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            {bands.map((band) => (
              <ReferenceArea
                key={`${band.from}-${band.to}`}
                x1={band.from}
                x2={band.to}
                fill={GAP}
                fillOpacity={0.14}
                stroke={GAP}
                strokeOpacity={0.35}
                strokeDasharray="4 4"
              />
            ))}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(value: number) =>
                value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`
              }
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
                fontSize: 12,
              }}
              labelFormatter={(_label, payload) => {
                const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                return row ? `${moneyShort(row.lo)} – ${moneyShort(row.hi)}` : "";
              }}
              formatter={(value) => [num(Number(value ?? 0)), "products"]}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={26}>
              {rows.map((row, index) => (
                <Cell key={index} fill={row.gap ? GAP : BAR} fillOpacity={row.gap ? 0.5 : 0.9} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
