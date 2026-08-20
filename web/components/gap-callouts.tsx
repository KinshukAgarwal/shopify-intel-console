"use client";

import { Scan, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { moneyShort, num } from "@/lib/format";
import type { Niche } from "@/lib/api";

/** The money shot: price bands where the market sells (almost) nothing. */
export function GapCallouts({ data }: { data: Niche | null }) {
  if (!data) return <Skeleton className="h-[440px] rounded-xl" />;

  const gaps = data.gaps;

  return (
    <Card className="flex h-full flex-col border-border/70 bg-card/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scan className="h-4 w-4 text-[hsl(var(--chart-2))]" />
          White space
        </CardTitle>
        <CardDescription>
          Price bands the competition has left open.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {gaps.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-6 py-10 text-center">
            <TrendingUp className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">This market is fully covered</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Products are priced continuously across the whole range — there is
              no unserved band to move into here.
            </p>
          </div>
        )}

        {gaps.map((gap, index) => (
          <div
            key={`${gap.lo}-${gap.hi}`}
            className="rounded-lg border border-[hsl(var(--chart-2))]/25 bg-[hsl(var(--chart-2))]/[0.06] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold tracking-tight tabular">
                  {moneyShort(gap.lo)}{" "}
                  <span className="text-muted-foreground">–</span>{" "}
                  {moneyShort(gap.hi)}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {gap.kind === "empty" ? (
                    <>
                      <b className="font-medium text-foreground">Nobody</b> sells
                      in this band.
                    </>
                  ) : (
                    <>
                      Only{" "}
                      <b className="font-medium text-foreground">
                        {num(gap.products)}
                      </b>{" "}
                      products — {gap.share_pct}% of the market.
                    </>
                  )}
                </p>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 border-[hsl(var(--chart-2))]/40 text-[hsl(var(--chart-2))]"
              >
                {index === 0 ? "Widest" : gap.kind === "empty" ? "Empty" : "Thin"}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
