"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { NicheCommand } from "@/components/niche-command";
import { StatTile, StatTileSkeleton } from "@/components/headline-stats";
import { Sparkline } from "@/components/chart-kit";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SUGGESTED, useApi, nichePath, type Meta, type Niche } from "@/lib/api";
import { day, moneyShort, num, short, since } from "@/lib/format";

/**
 * One market tile, showing what the console knows about that niche without
 * being asked. A component per tile rather than one batched endpoint: the API
 * prewarms exactly these eight niches on startup, so each of these is a cache
 * hit and a bespoke /api/markets would save nothing.
 */
function MarketCard({ name }: { name: string }) {
  const { data } = useApi<Niche>(nichePath(name));
  const gaps = data?.gaps.length ?? 0;

  return (
    <Link href={`/niche?q=${encodeURIComponent(name)}`} className="group block">
      <Card className="panel h-full transition-shadow group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="stat-label truncate">{name}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>

          {data ? (
            <>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="stat-value">
                    {short(data.headline.products)}
                  </div>
                  <p className="mt-2.5 text-[13px] tabular text-muted-foreground">
                    {num(data.headline.stores)} stores · median{" "}
                    {moneyShort(data.headline.median_price)}
                  </p>
                </div>
                <Sparkline values={data.histogram.map((bar) => bar.count)} />
              </div>
              <div className="mt-5 h-[26px]">
                {gaps > 0 && (
                  <span className="pill" data-tone="signal">
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {gaps} white-space gap{gaps > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-[34px] w-28" />
              <Skeleton className="h-[13px] w-36" />
              <Skeleton className="h-[26px] w-32 rounded-full" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function SearchPage() {
  const { data: meta } = useApi<Meta>("/api/meta");
  const minutes = meta?.build_seconds
    ? Math.max(1, Math.round(Number(meta.build_seconds) / 60))
    : null;

  return (
    <div className="mx-auto w-full max-w-[1560px] space-y-6 pb-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {meta ? (
          <>
            <StatTile
              label="Products indexed"
              value={meta.n_products ?? 0}
              meta="full text"
              caption="Every product the crawl has written to a cold shard"
            />
            <StatTile
              label="Stores indexed"
              value={meta.n_stores ?? 0}
              delay={0.06}
              meta={
                meta.n_products && meta.n_stores
                  ? `${num(Math.round(meta.n_products / meta.n_stores))} products each`
                  : undefined
              }
              caption="Counting only stores with a live catalogue"
            />
            <StatTile
              label="Index built"
              literal={day(meta.indexed_at)}
              meta={minutes ? `${minutes} min build` : undefined}
              caption={`${since(meta.indexed_at)} · from the crawl's cold shards`}
            />
            <StatTile
              label="Query plan"
              literal="1 MATCH"
              meta="FTS5"
              caption="Every panel reads one materialised match, not eight"
            />
          </>
        ) : (
          [0, 1, 2, 3].map((index) => <StatTileSkeleton key={index} />)
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="section-title">Find a market</h2>
          <p className="text-[13px] text-muted-foreground">
            Store and product counts update as you type, before you commit
          </p>
        </div>
        <NicheCommand autoFocus />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="section-title">Popular markets</h2>
          <span className="stat-label">Live from the index</span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {SUGGESTED.map((name) => (
            <MarketCard key={name} name={name} />
          ))}
        </div>
      </section>
    </div>
  );
}
