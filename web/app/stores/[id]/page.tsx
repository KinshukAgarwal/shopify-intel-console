"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useApi, type StoreDetail } from "@/lib/api";
import { money, num } from "@/lib/format";

/**
 * Deliberate stub. The full store deep-dive (launch cadence, price moves,
 * sell-through, inventory) is future scope — it needs the crawl's second pass,
 * which does not exist yet. This page renders everything the index already
 * knows and marks the seam where the deep-dive plugs in.
 */
export default function StoreDetailPage() {
  const id = useParams().id as string;
  const { data, error } = useApi<StoreDetail>(`/api/store/${id}`);

  return (
    <div className="pt-10">
      <Button asChild variant="ghost" className="mb-6 -ml-3 text-muted-foreground">
        <Link href="/stores">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to the store list
        </Link>
      </Button>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="space-y-4">
          <Skeleton className="h-12 w-96" />
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">{data.domain}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything the index holds for this store today.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Products", value: num(data.n_products) },
              { label: "With a price", value: num(data.n_priced) },
              { label: "Median price", value: money(data.median_price) },
              {
                label: "Price range",
                value: `${money(data.min_price, 0)} – ${money(data.max_price, 0)}`,
              },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/70 bg-card/70">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/70 bg-card/70">
              <CardHeader>
                <CardTitle className="text-base">Top product types</CardTitle>
                <CardDescription>Free text, exactly as the store publishes it.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.top_types.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    This store leaves product_type blank on every product.
                  </p>
                )}
                {data.top_types.map((type) => (
                  <Badge key={type.name} variant="secondary" className="font-normal">
                    {type.name}
                    <span className="ml-2 tabular text-muted-foreground">
                      {num(type.count)}
                    </span>
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader>
                <CardTitle className="text-base">Top vendors</CardTitle>
                <CardDescription>Who this store actually stocks.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {data.top_vendors.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No vendor is named on this store&apos;s products.
                  </p>
                )}
                {data.top_vendors.map((vendor) => (
                  <Badge key={vendor.name} variant="secondary" className="font-normal">
                    {vendor.name}
                    <span className="ml-2 tabular text-muted-foreground">
                      {num(vendor.count)}
                    </span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>

          <Separator />

          <Card className="border-dashed border-border/70 bg-card/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Store deep dive
              </CardTitle>
              <CardDescription>
                Launch cadence, price moves, sell-outs and units sold need a
                second crawl of this store. The pipeline emits all four — this
                page is where they will land.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4">
                {["Launches", "Price changes", "Stock events", "Units sold"].map(
                  (label) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border/50 bg-background/40 px-4 py-6 text-center"
                    >
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        Coming soon
                      </p>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
