"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PlugZap, Store } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { StoreTable } from "@/components/store-table";
import { StatTile, StatTileSkeleton } from "@/components/headline-stats";
import { useApi, storesPath, type StoreRow } from "@/lib/api";
import { num } from "@/lib/format";

/** Median of a numeric column, ignoring the stores that have no price at all. */
function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function StoresView() {
  const query = useSearchParams().get("q") ?? "";
  const { data, error } = useApi<StoreRow[]>(storesPath(query));

  if (!query) {
    return (
      <EmptyState
        icon={Store}
        title="No market selected"
        body="This table lists the stores competing inside one niche. Search for a niche and they appear here."
        action="Open search"
        href="/"
      />
    );
  }

  const matched = data?.reduce((total, row) => total + row.matched, 0) ?? 0;
  const deepest = data?.reduce(
    (best, row) => (row.matched > (best?.matched ?? 0) ? row : best),
    undefined as StoreRow | undefined
  );
  const averages = (data ?? [])
    .map((row) => row.avg_price)
    .filter((value): value is number => value != null);
  const medianAvg = median(averages);
  const withPrices = averages.length;
  // Store depth, biggest first — the shape of the competitive set, and the one
  // real series these tiles can draw.
  const depths = [...(data ?? [])]
    .map((row) => row.matched)
    .sort((a, b) => b - a)
    .slice(0, 40);

  return (
    <div className="mx-auto w-full max-w-[1560px] space-y-4 pb-10">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (
          <>
            <StatTile
              label="Stores competing"
              value={data.length}
              meta={`${num(withPrices)} priced`}
              bar={[
                { label: "priced", value: withPrices, tone: "ink" },
                { label: "unpriced", value: Math.max(0, data.length - withPrices) },
              ]}
              caption="Ranked by products carried in this niche"
            />
            <StatTile
              label="Products in niche"
              value={matched}
              delay={0.06}
              spark={depths}
              meta={
                data.length
                  ? `${num(Math.round(matched / data.length))} per store`
                  : undefined
              }
              caption="Summed across every store below"
            />
            <StatTile
              label="Median store price"
              value={Math.round(medianAvg)}
              prefix="$"
              delay={0.12}
              spark={averages}
              meta="of store averages"
              caption="Half the stores price below this line"
            />
            <StatTile
              label="Deepest catalogue"
              literal={deepest ? num(deepest.matched) : "—"}
              spark={depths}
              meta={deepest ? "products" : undefined}
              caption={deepest ? deepest.domain : "No stores matched"}
            />
          </>
        ) : (
          [0, 1, 2, 3].map((index) => <StatTileSkeleton key={index} />)
        )}
      </div>

      {error ? (
        <EmptyState
          tone="error"
          icon={PlugZap}
          title="The index is not answering"
          body={error}
          action="Back to search"
          href="/"
        />
      ) : (
        <StoreTable rows={data} />
      )}

      <p className="text-[13px] text-muted-foreground">
        Prices are the lowest variant price seen per product. Stores publish in
        their own currency and the crawl does not carry it yet, so figures are
        shown with a bare $.
      </p>
    </div>
  );
}

export default function StoresPage() {
  return (
    <Suspense fallback={<div />}>
      <StoresView />
    </Suspense>
  );
}
