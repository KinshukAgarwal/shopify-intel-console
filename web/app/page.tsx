"use client";

import Link from "next/link";
import { ArrowUpRight, Database, Package, Store, Timer } from "lucide-react";

import { NicheCommand } from "@/components/niche-command";
import { StatTile, StatTileSkeleton } from "@/components/headline-stats";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SUGGESTED, useApi, searchPath, type Meta, type SearchCounts } from "@/lib/api";
import { num, short, since } from "@/lib/format";

/**
 * One market tile with its live counts. A component per tile rather than one
 * batched endpoint: the API prewarms exactly these eight niches on startup, so
 * every one of these is a cache hit and a bespoke /api/markets would be a new
 * endpoint that saves nothing.
 */
function MarketCard({ name }: { name: string }) {
  const { data } = useApi<SearchCounts>(searchPath(name));
  return (
    <Link href={`/niche?q=${encodeURIComponent(name)}`} className="group">
      <Card className="panel h-full transition-colors group-hover:border-primary/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[14px] font-medium capitalize text-foreground">
              {name}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
          </div>
          {data ? (
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-[22px] font-semibold leading-none tabular tracking-tight text-foreground">
                {short(data.products)}
              </span>
              <span className="text-[12px] text-muted-foreground">products</span>
            </div>
          ) : (
            <Skeleton className="mt-3 h-[22px] w-20" />
          )}
          <p className="mt-2 text-[12px] tabular text-muted-foreground">
            {data ? `${num(data.stores)} stores` : " "}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function SearchPage() {
  const { data: meta } = useApi<Meta>("/api/meta");

  return (
    <div className="mx-auto w-full max-w-[1560px] space-y-6 pb-10">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {meta ? (
          <>
            <StatTile
              label="Products indexed"
              value={meta.n_products ?? 0}
              icon={Package}
              note="Searchable full-text right now"
            />
            <StatTile
              label="Stores indexed"
              value={meta.n_stores ?? 0}
              icon={Store}
              delay={0.06}
              note="Every store with a live catalogue"
            />
            <StatTile
              label="Index built"
              literal={since(meta.indexed_at)}
              value={0}
              icon={Database}
              note="Rebuilt from the crawl's cold shards"
            />
            <StatTile
              label="Build time"
              literal={
                meta.build_seconds
                  ? `${Math.round(Number(meta.build_seconds) / 60)} min`
                  : "—"
              }
              value={0}
              icon={Timer}
              delay={0.18}
              note="Resumable — re-run as the crawl grows"
            />
          </>
        ) : (
          [0, 1, 2, 3].map((index) => <StatTileSkeleton key={index} />)
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Find a market
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Store and product counts update as you type, before you commit
          </p>
        </div>
        <NicheCommand autoFocus />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Popular markets
          </h2>
          <span className="stat-label">Live counts</span>
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
