"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { money, moneyShort, num } from "@/lib/format";
import type { Niche } from "@/lib/api";

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PriceBands({ data }: { data: Niche | null }) {
  if (!data) return <Skeleton className="h-[340px] rounded-xl" />;
  const widest = Math.max(1, ...data.bands.map((band) => band.products));
  return (
    <Panel
      title="Price clusters"
      description="Where the catalogue actually sits, split into equal fifths."
    >
      {data.bands.length === 0 ? (
        <Empty>No priced products to cluster yet.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Band</TableHead>
              <TableHead>Range</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">Stores</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.bands.map((band) => (
              <TableRow key={band.label} className="border-border/50">
                <TableCell className="font-medium">{band.label}</TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {money(band.lo, 0)} – {money(band.hi, 0)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className="h-1.5 rounded-full bg-primary/70"
                      style={{ width: `${(band.products / widest) * 60}px` }}
                    />
                    <span className="tabular">{num(band.products)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular">{num(band.stores)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

export function BrandConcentration({ data }: { data: Niche | null }) {
  if (!data) return <Skeleton className="h-[340px] rounded-xl" />;
  const { by_products, by_stores, distinct } = data.vendors;

  const rows = (list: typeof by_products, metric: "products" | "stores") =>
    list.length === 0 ? (
      <Empty>No vendor is named on these products.</Empty>
    ) : (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Vendor</TableHead>
            <TableHead className="text-right">Products</TableHead>
            <TableHead className="text-right">Stores</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((vendor) => (
            <TableRow key={vendor.vendor} className="border-border/50">
              <TableCell className="max-w-[240px] truncate font-medium">
                {vendor.vendor}
              </TableCell>
              <TableCell
                className={`text-right tabular ${
                  metric === "products" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {num(vendor.products)}
              </TableCell>
              <TableCell
                className={`text-right tabular ${
                  metric === "stores" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {num(vendor.stores)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Brand concentration</CardTitle>
          <CardDescription>
            Deep catalogues and widely stocked brands are different lists.
          </CardDescription>
        </div>
        <Badge variant="outline" className="shrink-0 border-border/70 font-normal tabular">
          {num(distinct)} vendors
        </Badge>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="products">
          <TabsList className="mb-3">
            <TabsTrigger value="products">By products</TabsTrigger>
            <TabsTrigger value="stores">By stores</TabsTrigger>
          </TabsList>
          <TabsContent value="products">{rows(by_products, "products")}</TabsContent>
          <TabsContent value="stores">{rows(by_stores, "stores")}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function AssortmentBreadth({ data }: { data: Niche | null }) {
  if (!data) return <Skeleton className="h-[340px] rounded-xl" />;
  const rows = data.breadth;
  const any = rows.some((row) => row.stores > 0);
  return (
    <Panel
      title="Assortment breadth"
      description="How many products each store carries inside this niche."
    >
      {!any ? (
        <Empty>No stores matched.</Empty>
      ) : (
        <ResponsiveContainer width="100%" height={232}>
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value) => [num(Number(value ?? 0)), "stores"]}
            />
            <Bar
              dataKey="stores"
              fill="hsl(var(--chart-3))"
              fillOpacity={0.85}
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
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
    <p className="text-xs text-muted-foreground">
      Chart spans the 1st to 99th percentile ({moneyShort(data.range.lo)} –{" "}
      {moneyShort(data.range.hi)}) so a handful of outliers cannot flatten the
      distribution.
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border/70 px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
