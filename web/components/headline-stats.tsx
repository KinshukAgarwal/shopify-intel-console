"use client";

import { ArrowLeftRight, CircleDollarSign, Package, Store } from "lucide-react";
import CountUp from "@/components/CountUp";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { moneyShort } from "@/lib/format";
import type { Niche } from "@/lib/api";

/**
 * One KPI tile: uppercase label, big tabular number, one line of context.
 * React Bits' CountUp does the number animation — the only thing on this
 * screen that is animated at all, so the eye lands on the figure first.
 */
export function StatTile({
  label,
  value,
  prefix = "",
  icon: Icon,
  note,
  delay = 0,
  literal,
}: {
  label: string;
  value: number;
  prefix?: string;
  icon: typeof Store;
  note?: string;
  delay?: number;
  literal?: string;
}) {
  return (
    <Card className="panel">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="stat-label">{label}</span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
        <div className="mt-3 flex items-baseline">
          {literal ? (
            <span className="stat-value">{literal}</span>
          ) : (
            <span className="stat-value">
              {prefix}
              <CountUp to={value} duration={1.1} delay={delay} separator="," />
            </span>
          )}
        </div>
        {note && (
          <p className="mt-2 truncate text-[12px] text-muted-foreground">{note}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function StatTileSkeleton() {
  return <Skeleton className="h-[118px] rounded-xl" />;
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
  const spread =
    range && range.hi > range.lo ? Math.round(range.hi - range.lo) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Stores in market"
        value={stores}
        icon={Store}
        note="Selling at least one matching product"
      />
      <StatTile
        label="Products tracked"
        value={products}
        icon={Package}
        delay={0.06}
        note={`${priced.toLocaleString()} carry a price`}
      />
      <StatTile
        label="Median price"
        value={median_price == null ? 0 : Math.round(median_price)}
        prefix="$"
        icon={CircleDollarSign}
        delay={0.12}
        note="Midpoint of every priced product"
      />
      <StatTile
        label="Price spread"
        value={spread}
        prefix="$"
        icon={ArrowLeftRight}
        delay={0.18}
        note={
          range
            ? `${moneyShort(range.lo)} – ${moneyShort(range.hi)} (1st–99th pct)`
            : "No priced products yet"
        }
      />
    </div>
  );
}
