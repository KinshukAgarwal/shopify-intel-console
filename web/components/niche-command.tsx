"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Search, Store, Package, Sparkles } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useApi, searchPath, MIN_QUERY, SUGGESTED, type SearchCounts } from "@/lib/api";
import { num, short } from "@/lib/format";

const OPEN_ITEM = "open-market";
const suggestValue = (name: string) => `suggest-${name}`;

function useNicheSearch(onNavigate?: () => void) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // 120 ms is short enough that the counts feel like they track the keystrokes
  // and long enough that a fast typist fires one request, not eight.
  const { data, loading } = useApi<SearchCounts>(searchPath(query), 120);

  const typed = query.trim().length >= MIN_QUERY;
  const settled = Boolean(data && data.query.trim() === query.trim());
  const found = settled && !!data && data.products > 0;

  /**
   * cmdk tracks the highlighted item as a *value string*, and this list swaps
   * wholesale between suggestions and results. Left uncontrolled, that value
   * still points at a suggestion that no longer exists, so Enter matches
   * nothing and silently does nothing — the exact keystroke the demo depends
   * on. Controlling it and re-pointing it whenever the list changes is the fix.
   */
  const [selected, setSelected] = useState(suggestValue(SUGGESTED[0]));
  useEffect(() => {
    setSelected(found ? OPEN_ITEM : suggestValue(SUGGESTED[0]));
  }, [found]);

  const go = (target: string) => {
    onNavigate?.();
    router.push(`/niche?q=${encodeURIComponent(target)}`);
  };

  return {
    query,
    setQuery,
    data,
    loading,
    typed,
    settled,
    found,
    selected,
    setSelected,
    go,
  };
}

type Search = ReturnType<typeof useNicheSearch>;

function Body({ search, autoFocus }: { search: Search; autoFocus?: boolean }) {
  const { query, setQuery, data, loading, typed, settled, found, go } = search;
  return (
    <>
      <CommandInput
        autoFocus={autoFocus}
        value={query}
        onValueChange={setQuery}
        placeholder="Describe a niche — sunglasses, magnesium supplements, dog beds…"
        className="h-12 text-[15px]"
      />
      <CommandList className="max-h-[340px] border-t border-border">
        {!typed && (
          <CommandGroup heading="Try a market">
            <div className="flex flex-wrap gap-2 px-1 py-1">
              {SUGGESTED.map((name) => (
                <CommandItem
                  key={name}
                  value={suggestValue(name)}
                  onSelect={() => setQuery(name)}
                  className="w-auto rounded-full border border-border bg-white px-3 py-1.5 text-[13px] data-[selected=true]:border-primary/40"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  <span className="capitalize">{name}</span>
                </CommandItem>
              ))}
            </div>
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

        {typed && found && data && (
          <>
            <CommandGroup heading="Open this market">
              <CommandItem
                value={OPEN_ITEM}
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

/** Inline palette — the hero of the landing page. */
export function NicheCommand({ autoFocus = false }: { autoFocus?: boolean }) {
  const search = useNicheSearch();
  return (
    <Command
      shouldFilter={false}
      value={search.selected}
      onValueChange={search.setSelected}
      className="panel overflow-hidden"
    >
      <Body search={search} autoFocus={autoFocus} />
    </Command>
  );
}

/** The same palette as a ⌘K modal, available from every screen. */
export function NicheCommandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const search = useNicheSearch(() => onOpenChange(false));
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      commandProps={{
        shouldFilter: false,
        value: search.selected,
        onValueChange: search.setSelected,
      }}
    >
      <Body search={search} autoFocus />
    </CommandDialog>
  );
}
