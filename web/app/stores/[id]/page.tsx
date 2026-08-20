"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile, StatTileSkeleton } from "@/components/headline-stats";
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
    <div className="mx-auto w-full max-w-[1560px]">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground">
        <Link href="/stores">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to the store list
        </Link>
      </Button>

      {error && (
        <div className="panel border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-muted-foreground">
          {error}
        </div>
      )}

      {/* The skeleton mirrors the final layout exactly — heading, four tiles,
          two panels — so nothing jumps when the data lands. */}
      {!data && !error && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-72" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <StatTileSkeleton key={index} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-foreground">
              {data.domain}
            </h1>
            <p className="body-text mt-1.5">
              Everything the index holds for this store today.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Products"
              value={data.n_products}
              meta={
                data.n_products
                  ? `${Math.round((data.n_priced / data.n_products) * 100)}% priced`
                  : undefined
              }
              bar={[
                { label: "priced", value: data.n_priced, tone: "ink" },
                {
                  label: "unpriced",
                  value: Math.max(0, data.n_products - data.n_priced),
                },
              ]}
              caption="Whole catalogue, not only this niche"
            />
            <StatTile
              label="With a price"
              value={data.n_priced}
              delay={0.06}
              meta={`${num(data.top_vendors.length)} vendors`}
              caption="Products carrying at least one variant price"
            />
            <StatTile
              label="Median price"
              literal={money(data.median_price)}
              meta="midpoint"
              caption="Half this store's products sit below it"
            />
            <StatTile
              label="Price range"
              literal={`${money(data.min_price, 0)} – ${money(data.max_price, 0)}`}
              meta="low to high"
              caption="Lowest and highest variant price seen"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TagPanel
              title="Top product types"
              description="Free text, exactly as the store publishes it."
              empty="This store leaves product_type blank on every product."
              rows={data.top_types}
            />
            <TagPanel
              title="Top vendors"
              description="Who this store actually stocks."
              empty="No vendor is named on this store's products."
              rows={data.top_vendors}
            />
          </div>

          <Card className="panel border-dashed">
            <CardHeader className="px-6 pb-2 pt-5">
              <h2 className="section-title flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Store deep dive
              </h2>
              <p className="body-text mt-1 max-w-2xl">
                Launch cadence, price moves, sell-outs and units sold need a
                second crawl of this store. The pipeline emits all four — this
                page is where they will land.
              </p>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-3">
              <div className="grid gap-3 sm:grid-cols-4">
                {["Launches", "Price changes", "Stock events", "Units sold"].map(
                  (label) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border bg-secondary/40 px-4 py-6 text-center"
                    >
                      <p className="text-[14px] font-medium text-[hsl(var(--body))]">
                        {label}
                      </p>
                      <p className="stat-label mt-1.5">Coming soon</p>
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

/** A card of "name × count" chips — the same shape twice, so it is one thing. */
function TagPanel({
  title,
  description,
  empty,
  rows,
}: {
  title: string;
  description: string;
  empty: string;
  rows: { name: string; count: number }[];
}) {
  return (
    <Card className="panel">
      <CardHeader className="px-6 pb-2 pt-5">
        <h2 className="section-title">{title}</h2>
        <p className="body-text mt-1">{description}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 px-6 pb-6 pt-3">
        {rows.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{empty}</p>
        ) : (
          rows.map((row) => (
            <span key={row.name} className="pill">
              {row.name}
              <span className="font-semibold text-foreground">{num(row.count)}</span>
            </span>
          ))
        )}
      </CardContent>
    </Card>
  );
}
