"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART } from "@/components/chart-kit";
import { BreadthRows } from "@/components/headline-stats";
import { moneyShort, num } from "@/lib/format";
import type { Niche } from "@/lib/api";

function Panel({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="panel flex h-full flex-col">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 px-6 pb-0 pt-6">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="body-text mt-1.5">{description}</p>
        </div>
        {aside}
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-5 pt-4">{children}</CardContent>
    </Card>
  );
}

/**
 * Top brands as horizontal bars. Recharts draws them; the only hand-written
 * part is the tick formatter that truncates a long vendor name, which no
 * library setting covers.
 */
export function BrandConcentration({ data }: { data: Niche | null }) {
  if (!data) return <Skeleton className="h-[380px] rounded-xl" />;
  const { by_products, by_stores, distinct } = data.vendors;

  // Same selective-colour rule as the histogram: the leader in ink, the rest in
  // the flat track grey.
  const chart = (
    list: { vendor: string; products: number; stores: number }[],
    key: "products" | "stores"
  ) => {
    if (list.length === 0) {
      return <Empty>No vendor is named on these products.</Empty>;
    }
    const rows = list.slice(0, 8);
    const top = Math.max(...rows.map((row) => row[key]));
    return (
      <ResponsiveContainer width="100%" height={Math.max(232, rows.length * 34)}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 44, bottom: 0, left: 8 }}
        >
          <XAxis type="number" hide domain={[0, top * 1.12]} />
          <YAxis
            type="category"
            dataKey="vendor"
            width={130}
            tickLine={false}
            axisLine={false}
            tick={{ ...CHART.axis, fontSize: 12 }}
            tickFormatter={(value: string) =>
              value.length > 18 ? `${value.slice(0, 17)}…` : value
            }
          />
          <Tooltip
            cursor={CHART.cursor}
            contentStyle={CHART.tooltip}
            formatter={(value) => [num(Number(value ?? 0)), key]}
          />
          <Bar dataKey={key} radius={[0, 3, 3, 0]} barSize={12}>
            <LabelList
              dataKey={key}
              position="right"
              offset={8}
              formatter={(value: number) => num(value)}
              style={{
                fill: "hsl(var(--body))",
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            />
            {rows.map((_row, index) => (
              <Cell key={index} fill={index === 0 ? CHART.ink : CHART.rest} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Panel
      title="Top brands"
      description="Deep catalogues and widely stocked brands are different lists."
      aside={
        <span className="pill shrink-0">{num(distinct)} vendors</span>
      }
    >
      <Tabs defaultValue="products">
        <TabsList className="mx-2 mb-2 h-8">
          <TabsTrigger value="products" className="h-6 text-[12px]">
            By products
          </TabsTrigger>
          <TabsTrigger value="stores" className="h-6 text-[12px]">
            By stores
          </TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          {chart(by_products, "products")}
        </TabsContent>
        <TabsContent value="stores">
          {chart(by_stores, "stores")}
        </TabsContent>
      </Tabs>
    </Panel>
  );
}

export function AssortmentBreadth({ data }: { data: Niche | null }) {
  if (!data) return <Skeleton className="h-[380px] rounded-[14px]" />;
  const any = data.breadth.some((row) => row.stores > 0);
  return (
    <Panel
      title="Assortment breadth"
      description="How many products each store carries inside this niche."
      aside={<span className="pill shrink-0">{num(data.headline.stores)} stores</span>}
    >
      {!any ? (
        <Empty>No stores matched.</Empty>
      ) : (
        <div className="px-2 pt-2">
          <BreadthRows data={data} />
        </div>
      )}
    </Panel>
  );
}

export function PriceRangeStrip({ data }: { data: Niche | null }) {
  if (!data?.range) return null;
  return (
    <p className="text-[12px] text-muted-foreground">
      Chart spans the 1st to 99th percentile ({moneyShort(data.range.lo)} –{" "}
      {moneyShort(data.range.hi)}) so a handful of outliers cannot flatten the
      distribution.
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-3 flex h-52 items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
