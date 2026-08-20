"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { moneyShort, num } from "@/lib/format";
import type { Niche } from "@/lib/api";

const GRID = "hsl(var(--border))";
const AXIS = "hsl(var(--muted-foreground))";

const TOOLTIP = {
  background: "#fff",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
};

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
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        </div>
        {aside}
      </CardHeader>
      <CardContent className="flex-1 px-2 py-4">{children}</CardContent>
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

  const chart = (
    list: { vendor: string; products: number; stores: number }[],
    key: "products" | "stores",
    colour: string
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
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" hide domain={[0, top * 1.12]} />
          <YAxis
            type="category"
            dataKey="vendor"
            width={130}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS, fontSize: 12 }}
            tickFormatter={(value: string) =>
              value.length > 18 ? `${value.slice(0, 17)}…` : value
            }
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.6 }}
            contentStyle={TOOLTIP}
            formatter={(value) => [num(Number(value ?? 0)), key]}
          />
          <Bar dataKey={key} radius={[0, 4, 4, 0]} barSize={14}>
            <LabelList
              dataKey={key}
              position="right"
              offset={8}
              formatter={(value: number) => num(value)}
              style={{
                fill: "hsl(var(--foreground))",
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            />
            {rows.map((_row, index) => (
              <Cell key={index} fill={colour} fillOpacity={1 - index * 0.075} />
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
        <span className="shrink-0 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[12px] tabular text-muted-foreground">
          {num(distinct)} vendors
        </span>
      }
    >
      <Tabs defaultValue="products">
        <TabsList className="mx-3 mb-2 h-8">
          <TabsTrigger value="products" className="h-6 text-[12px]">
            By products
          </TabsTrigger>
          <TabsTrigger value="stores" className="h-6 text-[12px]">
            By stores
          </TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          {chart(by_products, "products", "hsl(var(--chart-1))")}
        </TabsContent>
        <TabsContent value="stores">
          {chart(by_stores, "stores", "hsl(var(--chart-3))")}
        </TabsContent>
      </Tabs>
    </Panel>
  );
}

export function AssortmentBreadth({ data }: { data: Niche | null }) {
  if (!data) return <Skeleton className="h-[380px] rounded-xl" />;
  const rows = data.breadth;
  const any = rows.some((row) => row.stores > 0);
  return (
    <Panel
      title="Assortment breadth"
      description="How many products each store carries inside this niche."
      aside={
        <span className="shrink-0 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[12px] tabular text-muted-foreground">
          {num(data.headline.stores)} stores
        </span>
      }
    >
      {!any ? (
        <Empty>No stores matched.</Empty>
      ) : (
        <ResponsiveContainer width="100%" height={272}>
          <BarChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.6 }}
              contentStyle={TOOLTIP}
              formatter={(value) => [num(Number(value ?? 0)), "stores"]}
            />
            <Bar
              dataKey="stores"
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
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
