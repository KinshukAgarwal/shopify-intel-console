"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeadlineStats } from "@/components/headline-stats";
import { PriceHistogram } from "@/components/price-histogram";
import { GapCallouts } from "@/components/gap-callouts";
import {
  AssortmentBreadth,
  BrandConcentration,
  PriceBands,
  PriceRangeStrip,
} from "@/components/market-panels";
import AnimatedContent from "@/components/AnimatedContent";
import { useApi, nichePath, type Niche } from "@/lib/api";

function NicheView() {
  const query = useSearchParams().get("q") ?? "";
  const { data, error } = useApi<Niche>(nichePath(query));

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
      <div className="mt-24 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
        <h2 className="text-lg font-medium">The index is not answering</h2>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Start the API with <code className="text-foreground">make api</code>, or
          build the index with <code className="text-foreground">make index</code>.
        </p>
      </div>
    );
  }

  const nothing = data && data.headline.products === 0;

  return (
    <div className="pt-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Market overview
          </p>
          <h1 className="mt-2 text-4xl font-semibold capitalize tracking-tight">
            {query}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {data?.took_ms != null && (
            <Badge variant="outline" className="border-border/70 font-normal tabular">
              {data.took_ms} ms
            </Badge>
          )}
          <Button asChild variant="secondary">
            <Link href={`/stores?q=${encodeURIComponent(query)}`}>
              See the {data ? data.headline.stores.toLocaleString() : ""} stores
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {nothing ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 text-center">
          <h2 className="text-lg font-medium">Nothing indexed for “{query}”</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            The crawl is still running, so this niche may simply not be covered
            yet. Try a broader term.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/">Search again</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <HeadlineStats data={data} />

          <AnimatedContent distance={24} duration={0.6} threshold={0}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)]">
              <div className="space-y-2">
                <PriceHistogram data={data} />
                <PriceRangeStrip data={data} />
              </div>
              <GapCallouts data={data} />
            </div>
          </AnimatedContent>

          <div className="grid gap-4 xl:grid-cols-3">
            <PriceBands data={data} />
            <BrandConcentration data={data} />
            <AssortmentBreadth data={data} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function NichePage() {
  return (
    <Suspense fallback={<div className="pt-10" />}>
      <NicheView />
    </Suspense>
  );
}
