"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Search, Store, Package, Sparkles } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useApi, searchPath, type SearchCounts } from "@/lib/api";
import { num, short } from "@/lib/format";

/** Measured on the live index — every one of these returns a real market. */
const SUGGESTED = [
  "sunglasses",
  "supplements",
  "candles",
  "dresses",
  "sneakers",
  "coffee",
  "skincare",
  "jewelry",
];

/**
 * Input + result list only — no cmdk root. Inline use wraps it in `Command`
 * below; the ⌘K dialog wraps it in shadcn's `CommandDialog`, which supplies
 * its own root. Two roots would break keyboard navigation.
 */
export function NicheCommandBody({
  autoFocus = false,
  onNavigate,
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // 120 ms is short enough that the counts feel like they track the keystrokes
  // and long enough that a fast typist fires one request, not eight.
  const { data, loading } = useApi<SearchCounts>(searchPath(query), 120);

  const go = (q: string) => {
    onNavigate?.();
    router.push(`/niche?q=${encodeURIComponent(q)}`);
  };

  const typed = query.trim().length > 0;
  const settled = data && data.query.trim() === query.trim();
  const found = settled && data.products > 0;

  return (
    <>
      <CommandInput
        autoFocus={autoFocus}
        value={query}
        onValueChange={setQuery}
        placeholder="Describe a niche — sunglasses, magnesium supplements, dog beds…"
        className="h-14 text-base"
      />
      <CommandList className="max-h-[420px]">
        {!typed && (
          <CommandGroup heading="Try a market">
            {SUGGESTED.map((name) => (
              <CommandItem key={name} value={name} onSelect={() => setQuery(name)}>
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                <span className="capitalize">{name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {typed && loading && !settled && (
          <div className="space-y-3 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        )}

        {typed && settled && !found && (
          <CommandEmpty className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No products match{" "}
              <span className="font-medium text-foreground">“{query}”</span> yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The crawl is still running — try a broader word, or one of the
              suggested markets.
            </p>
          </CommandEmpty>
        )}

        {typed && found && (
          <>
            <CommandGroup heading="Open this market">
              <CommandItem
                value={`open-${query}`}
                onSelect={() => go(query)}
                className="py-4"
              >
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Search className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-base font-medium">{query}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 tabular">
                    <span className="flex items-center gap-1.5 text-sm">
                      <Store className="h-3.5 w-3.5 text-muted-foreground" />
                      <b className="font-semibold">{num(data.stores)}</b>
                      <span className="text-muted-foreground">stores</span>
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1.5 text-sm">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <b className="font-semibold">{short(data.products)}</b>
                      <span className="text-muted-foreground">products</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CommandItem>
            </CommandGroup>

            {data.types.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Narrow by product type">
                  {data.types.map((type) => (
                    <CommandItem
                      key={type.name}
                      value={`type-${type.name}`}
                      onSelect={() => go(type.name)}
                    >
                      <span className="truncate">{type.name}</span>
                      <Badge variant="secondary" className="ml-auto tabular">
                        {short(type.count)}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </>
  );
}

export function NicheCommand(props: {
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Command
      shouldFilter={false}
      className="rounded-xl border border-border/80 bg-card/60 backdrop-blur"
    >
      <NicheCommandBody {...props} />
    </Command>
  );
}
