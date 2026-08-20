"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeadlineStats } from "@/components/headline-stats";
import { PriceHistogram } from "@/components/price-histogram";
import {
  AssortmentBreadth,
  BrandConcentration,
  PriceRangeStrip,
} from "@/components/market-panels";
import { StoreTable } from "@/components/store-table";
import { useApi, nichePath, storesPath, type Niche, type StoreRow } from "@/lib/api";
import { num } from "@/lib/format";

function NicheView() {
  const query = useSearchParams().get("q") ?? "";
  const { data, error } = useApi<Niche>(nichePath(query));
  const { data: stores } = useApi<StoreRow[]>(storesPath(query));

  if (!query) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Search className="mb-4 h-6 w-6 text-muted-foreground" />
        <h2 className="text-lg font-medium">Pick a market first</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Search a niche to see its price architecture.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Open search</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel mt-8 border-destructive/30 bg-destructive/5 p-8 text-center">
        <h2 className="text-lg font-medium">The index is not answering</h2>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Start the API with <code className="text-foreground">make api</code>, or
          build the index with <code className="text-foreground">make index</code>.
        </p>
      </div>
    );
  }

  if (data && data.headline.products === 0) {
    return (
      <div className="panel flex min-h-[50vh] flex-col items-center justify-center border-dashed text-center">
        <h2 className="text-lg font-medium">Nothing indexed for “{query}”</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          The crawl is still running, so this niche may simply not be covered
          yet. Try a broader term.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/">Search again</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1560px] space-y-4 pb-10">
      {/* Row 1 — KPIs. Nothing decorative sits above them, so the first thing
          on screen at any scroll position is a number. */}
      <HeadlineStats data={data} />

      {/* Row 2 — the price architecture, full width. */}
      <div className="space-y-2">
        <PriceHistogram data={data} />
        <PriceRangeStrip data={data} />
      </div>

      {/* Row 3 — who is selling, and how much of it. */}
      <div className="grid gap-4 xl:grid-cols-2">
        <BrandConcentration data={data} />
        <AssortmentBreadth data={data} />
      </div>

      {/* Row 4 — the competitive set itself. */}
      <section className="space-y-3 pt-2">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Stores in this market
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {stores
                ? `${num(stores.length)} stores, sortable. Click a row for the store view.`
                : "Loading the competitive set…"}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/stores?q=${encodeURIComponent(query)}`}>
              Full store view
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <StoreTable rows={stores} compact />
      </section>
    </div>
  );
}

export default function NichePage() {
  return (
    <Suspense fallback={<div />}>
      <NicheView />
    </Suspense>
  );
}
