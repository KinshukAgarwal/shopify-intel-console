"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, PlugZap, Search, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
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
      <EmptyState
        icon={Search}
        title="Pick a market first"
        body="Every panel on this screen is scoped to one niche. Search for one and the price architecture follows."
        action="Open search"
        href="/"
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        tone="error"
        icon={PlugZap}
        title="The index is not answering"
        body={`${error}. Start the API with \u201cmake api\u201d, or build the index with \u201cmake index\u201d.`}
        action="Back to search"
        href="/"
      />
    );
  }

  if (data && data.headline.products === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={`Nothing indexed for \u201c${query}\u201d`}
        body="The crawl is still running, so this niche may simply not be covered yet. A broader word usually finds it."
        action="Search again"
        href="/"
      />
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
