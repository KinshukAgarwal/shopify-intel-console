"use client";

import CountUp from "@/components/CountUp";
import { Sparkline } from "@/components/chart-kit";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { moneyShort, num } from "@/lib/format";
import type { Niche } from "@/lib/api";

/**
 * One KPI tile: a 10px label over a 34px figure, a neutral pill and a micro
 * chart with no axes. The card is airy — the density belongs to the grid, not
 * to what is inside a card.
 *
 * The pill is deliberately not a green/red delta. A delta needs a previous
 * value, and this crawl covers a single day; every arrow on this screen would
 * be invented, and an invented one on a sales call is worse than none. What it
 * carries instead is a real second figure from the same query.
 */
export function StatTile({
  label,
  value,
  prefix = "",
  literal,
  pill,
  spark,
  note,
  delay = 0,
}: {
  label: string;
  value?: number;
  prefix?: string;
  literal?: string;
  pill?: string;
  spark?: number[];
  note?: string;
  delay?: number;
}) {
  return (
    <Card className="panel">
      <CardContent className="p-6">
        <span className="stat-label">{label}</span>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="stat-value truncate">
              {literal ?? (
                <>
                  {prefix}
                  <CountUp to={value ?? 0} duration={1} delay={delay} separator="," />
                </>
              )}
            </div>
            {pill && <span className="pill mt-4">{pill}</span>}
          </div>
          {spark && <Sparkline values={spark} />}
        </div>
        {note && (
          <p className="mt-4 truncate text-[13px] text-muted-foreground">{note}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The one tinted card on the screen, and the only orange on it. It carries the
 * product's whole argument in one figure: the price band the market has left
 * open. Everything else on the niche overview is greyscale so that this reads
 * as the answer rather than as another statistic.
 */
function WhiteSpaceTile({ data }: { data: Niche }) {
  const widest = data.gaps[0];
  const gaps = data.gaps.length;

  if (!widest) {
    const range = data.range;
    return (
      <StatTile
        label="White space"
        literal="None"
        pill={
          range && range.lo > 0
            ? `${(range.hi / range.lo).toFixed(1)}× low to high`
            : undefined
        }
        note="Priced continuously across the whole range"
      />
    );
  }

  return (
    <div className="panel-signal p-6">
      <span className="stat-label text-signal">White space</span>
      <div className="mt-4">
        <div className="hero-value">{moneyShort(widest.lo)}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[15px] text-muted-foreground">to</span>
          <span className="text-[28px] font-semibold tabular tracking-[-0.01em] text-foreground">
            {moneyShort(widest.hi)}
          </span>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-[hsl(var(--body))]">
        {widest.kind === "empty"
          ? "Nobody sells in this band"
          : `Only ${num(widest.products)} products — ${widest.share_pct}% of the market`}
        {gaps > 1 && ` · ${gaps - 1} more gap${gaps > 2 ? "s" : ""}`}
      </p>
    </div>
  );
}

export function StatTileSkeleton() {
  return <Skeleton className="h-[192px] rounded-[14px]" />;
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
  const breadth = data.breadth.map((row) => row.stores);

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Stores in market"
        value={stores}
        spark={breadth}
        pill={`${num(data.vendors.distinct)} brands`}
        note="Selling at least one matching product"
      />
      <StatTile
        label="Products tracked"
        value={products}
        delay={0.06}
        spark={shape}
        pill={
          products > 0
            ? `${Math.round((priced / products) * 100)}% carry a price`
            : undefined
        }
        note={`${num(priced)} priced of ${num(products)}`}
      />
      <StatTile
        label="Median price"
        value={median_price == null ? 0 : Math.round(median_price)}
        prefix="$"
        delay={0.12}
        spark={shape}
        pill={range ? `${moneyShort(range.lo)}–${moneyShort(range.hi)}` : undefined}
        note="Midpoint of every priced product"
      />
      <WhiteSpaceTile data={data} />
    </div>
  );
}
