"use client";

import CountUp from "@/components/CountUp";
import { Sparkline } from "@/components/chart-kit";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { moneyShort, num } from "@/lib/format";
import type { Niche } from "@/lib/api";

/**
 * One KPI tile: small-caps label, the number as the loudest thing on the card,
 * a tinted pill and a 40px sparkline to its right.
 *
 * The pill is deliberately neutral rather than a green/red delta. A delta needs
 * a previous value and this crawl covers a single day, so every arrow on this
 * screen would be invented. What the pill carries instead is a real second
 * figure derived from the same query.
 */
export function StatTile({
  label,
  value,
  prefix = "",
  literal,
  pill,
  tone,
  spark,
  note,
  delay = 0,
}: {
  label: string;
  value?: number;
  prefix?: string;
  literal?: string;
  pill?: string;
  tone?: "up" | "down" | "gap";
  spark?: number[];
  note?: string;
  delay?: number;
}) {
  return (
    <Card className="panel">
      <CardContent className="p-5">
        <span className="stat-label">{label}</span>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="stat-value truncate">
              {literal ?? (
                <>
                  {prefix}
                  <CountUp
                    to={value ?? 0}
                    duration={1}
                    delay={delay}
                    separator=","
                  />
                </>
              )}
            </div>
            {pill && (
              <span className="pill mt-2.5" data-tone={tone}>
                {pill}
              </span>
            )}
          </div>
          {spark && <Sparkline values={spark} />}
        </div>
        {note && (
          <p className="mt-3 truncate text-[13px] text-[hsl(var(--body))]">
            {note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function StatTileSkeleton() {
  return <Skeleton className="h-[158px] rounded-xl" />;
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
  const spread = range ? Math.round(range.hi - range.lo) : 0;
  const shape = data.histogram.map((bar) => bar.count);
  const breadth = data.breadth.map((row) => row.stores);
  const gaps = data.gaps.length;
  const multiple = range && range.lo > 0 ? range.hi / range.lo : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            ? `${Math.round((priced / products) * 100)}% priced`
            : undefined
        }
        note={`${num(priced)} carry a price`}
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
      <StatTile
        label="Price spread"
        value={spread}
        prefix="$"
        delay={0.18}
        spark={shape}
        pill={
          gaps > 0
            ? `${gaps} white-space gap${gaps > 1 ? "s" : ""}`
            : multiple
              ? `${multiple.toFixed(1)}× low to high`
              : undefined
        }
        tone={gaps > 0 ? "gap" : undefined}
        note="1st to 99th percentile of the catalogue"
      />
    </div>
  );
}
