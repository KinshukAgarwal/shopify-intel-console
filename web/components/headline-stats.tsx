"use client";

import CountUp from "@/components/CountUp";
import { LegendRows, SegmentBar, Sparkline, type Segment } from "@/components/chart-kit";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { moneyShort, num } from "@/lib/format";
import type { Niche } from "@/lib/api";

/**
 * The KPI card, to the reference's anatomy:
 *
 *   label                                  meta
 *   34px figure                        sparkline
 *   ▓▓▓▓▓▓▓▓░░░░░░  6px bar
 *   caption
 *
 * The reference puts a green/red delta beside the figure. This console has
 * none to show: the crawl covers a single day, so a previous value does not
 * exist and every arrow on the screen would be invented — which on a sales
 * call is worse than showing nothing. The `meta` slot carries a real second
 * figure from the same query instead, and the bar carries a real ratio.
 */
export function StatTile({
  label,
  value,
  prefix = "",
  literal,
  meta,
  bar,
  spark,
  caption,
  delay = 0,
}: {
  label: string;
  value?: number;
  prefix?: string;
  literal?: string;
  meta?: string;
  bar?: Segment[];
  spark?: number[];
  caption?: string;
  delay?: number;
}) {
  return (
    <Card className="panel flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="stat-label">{label}</span>
          {meta && (
            <span className="shrink-0 text-[12px] tabular text-muted-foreground">
              {meta}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="stat-value truncate">
            {literal ?? (
              <>
                {prefix}
                <CountUp to={value ?? 0} duration={1} delay={delay} separator="," />
              </>
            )}
          </div>
          {spark && <Sparkline values={spark} />}
        </div>

        <div className="mt-auto pt-5">
          {bar && <SegmentBar segments={bar} />}
          {caption && (
            <p className="mt-3 truncate text-[12px] text-muted-foreground">
              {caption}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The one tinted card on the screen, and the only orange on it. It carries the
 * product's whole argument in one figure: the price band the market has left
 * open. Everything else is greyscale so this reads as the answer rather than as
 * another statistic.
 */
function WhiteSpaceTile({ data }: { data: Niche }) {
  const widest = data.gaps[0];

  if (!widest) {
    const range = data.range;
    return (
      <StatTile
        label="White space"
        literal="None"
        meta={
          range && range.lo > 0 ? `${(range.hi / range.lo).toFixed(1)}× spread` : undefined
        }
        caption="Priced continuously across the whole range"
      />
    );
  }

  const others = data.gaps.length - 1;
  // `share_pct` is the share of PRODUCTS in the band, which is 0 for an empty
  // gap and so says nothing there. How wide the band is against the charted
  // range is the figure that actually reads.
  const span = data.range ? data.range.hi - data.range.lo : 0;
  const width = span > 0 ? Math.round(((widest.hi - widest.lo) / span) * 100) : 0;

  return (
    <div className="panel-signal flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="stat-label text-signal">White space</span>
        <span className="shrink-0 text-[12px] tabular text-signal">
          {width}% of the range
        </span>
      </div>

      <div className="mt-4">
        <div className="hero-value">{moneyShort(widest.lo)}</div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[14px] text-muted-foreground">up to</span>
          <span className="text-[26px] font-semibold tabular leading-none tracking-[-0.01em] text-foreground">
            {moneyShort(widest.hi)}
          </span>
        </div>
      </div>

      <p className="mt-auto pt-5 text-[12px] text-[hsl(var(--body))]">
        {widest.kind === "empty"
          ? "Nobody sells in this band"
          : `Only ${num(widest.products)} products here`}
        {others > 0 && ` · ${others} narrower gap${others > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}

export function StatTileSkeleton() {
  return <Skeleton className="h-[196px] rounded-[14px]" />;
}

export function HeadlineStats({ data }: { data: Niche | null }) {
  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <StatTileSkeleton key={index} />
        ))}
      </div>
    );
  }

  const { stores, products, priced, median_price } = data.headline;
  const range = data.range;
  const shape = data.histogram.map((bar) => bar.count);

  // The single deepest breadth bucket, highlighted against the rest — the same
  // "one mark in ink, the others in grey" rule the charts follow.
  const deepest = data.breadth.reduce(
    (best, row) => (row.stores > best.stores ? row : best),
    data.breadth[0] ?? { label: "", stores: 0 }
  );

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Stores in market"
        value={stores}
        meta={`${num(data.vendors.distinct)} brands`}
        bar={data.breadth.map((row) => ({
          label: row.label,
          value: row.stores,
          tone: row.label === deepest.label ? ("ink" as const) : undefined,
        }))}
        caption={
          deepest.stores > 0
            ? `Most carry ${deepest.label} products in this niche`
            : "No store depth recorded yet"
        }
      />
      <StatTile
        label="Products tracked"
        value={products}
        delay={0.06}
        spark={shape}
        meta={
          products > 0 ? `${Math.round((priced / products) * 100)}% priced` : undefined
        }
        bar={[
          { label: "priced", value: priced, tone: "ink" },
          { label: "unpriced", value: Math.max(0, products - priced) },
        ]}
        caption={`${num(priced)} of ${num(products)} carry a price`}
      />
      <StatTile
        label="Median price"
        value={median_price == null ? 0 : Math.round(median_price)}
        prefix="$"
        delay={0.12}
        spark={shape}
        meta={range ? `${moneyShort(range.lo)}–${moneyShort(range.hi)}` : undefined}
        caption="Midpoint of every priced product"
      />
      <WhiteSpaceTile data={data} />
    </div>
  );
}

/** Assortment breadth as legend rows — the reference's list form, not a legend
 *  hanging off a chart. */
export function BreadthRows({ data }: { data: Niche }) {
  const total = data.breadth.reduce((sum, row) => sum + row.stores, 0) || 1;
  const top = Math.max(...data.breadth.map((row) => row.stores));
  const rows = data.breadth.map((row) => ({
    label: `${row.label} products`,
    value: row.stores,
    share: (row.stores / total) * 100,
    tone: row.stores === top && top > 0 ? ("ink" as const) : undefined,
  }));
  return (
    <div className="space-y-5">
      <SegmentBar
        segments={data.breadth.map((row) => ({
          label: row.label,
          value: row.stores,
          tone: row.stores === top && top > 0 ? ("ink" as const) : undefined,
        }))}
      />
      <LegendRows rows={rows} unit="stores" />
    </div>
  );
}
