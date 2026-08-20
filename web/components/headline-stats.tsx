"use client";

import { Store, Package, CircleDollarSign } from "lucide-react";
import CountUp from "@/components/CountUp";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Niche } from "@/lib/api";

function Stat({
  label,
  value,
  prefix = "",
  suffix = "",
  icon: Icon,
  delay,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: typeof Store;
  delay: number;
}) {
  return (
    <Card className="relative overflow-hidden border-border/70 bg-card/70">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="mt-3 flex items-baseline text-4xl font-semibold tracking-tight tabular">
          {prefix}
          <CountUp to={value} duration={1.4} delay={delay} separator="," />
          {suffix}
        </div>
      </CardContent>
    </Card>
  );
}

export function HeadlineStats({ data }: { data: Niche | null }) {
  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[126px] rounded-xl" />
        ))}
      </div>
    );
  }
  const median = data.headline.median_price;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Stat label="Stores in market" value={data.headline.stores} icon={Store} delay={0} />
      <Stat
        label="Products tracked"
        value={data.headline.products}
        icon={Package}
        delay={0.1}
      />
      <Stat
        label="Median price"
        value={median == null ? 0 : Math.round(median)}
        prefix="$"
        icon={CircleDollarSign}
        delay={0.2}
      />
    </div>
  );
}
