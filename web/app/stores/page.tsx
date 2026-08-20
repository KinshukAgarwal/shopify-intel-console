"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StoreTable } from "@/components/store-table";
import { useApi, storesPath, type StoreRow } from "@/lib/api";
import { num } from "@/lib/format";

function StoresView() {
  const query = useSearchParams().get("q") ?? "";
  const { data, error } = useApi<StoreRow[]>(storesPath(query));

  if (!query) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Store className="mb-4 h-6 w-6 text-muted-foreground" />
        <h2 className="text-lg font-medium">No market selected</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Search a niche to see the stores competing in it.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Open search</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Competitive set
          </p>
          <h1 className="mt-2 text-4xl font-semibold capitalize tracking-tight">
            {query}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data
              ? `${num(data.length)} stores selling into this market. Click any row for the store view.`
              : "Loading the competitive set…"}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/niche?q=${encodeURIComponent(query)}`}>
            Back to market overview
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : (
        <StoreTable rows={data} />
      )}
    </div>
  );
}

export default function StoresPage() {
  return (
    <Suspense fallback={<div className="pt-10" />}>
      <StoresView />
    </Suspense>
  );
}
