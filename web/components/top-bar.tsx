"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

import { NicheCommandDialog } from "@/components/niche-command";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, type Meta } from "@/lib/api";
import { since, short } from "@/lib/format";

const TITLES: [string, string][] = [
  ["/niche", "Niche overview"],
  ["/stores", "Stores"],
  ["/", "Search"],
];

function Freshness() {
  const { data } = useApi<Meta>("/api/meta");
  if (!data) return <Skeleton className="h-7 w-56" />;
  return (
    <span className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] tabular text-[hsl(var(--body))]">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
      </span>
      <Activity className="h-3 w-3" />
      Index live · {short(data.n_products)} products · {short(data.n_stores)}{" "}
      stores · {since(data.indexed_at)}
    </span>
  );
}

export function TopBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const query = useSearchParams().get("q") ?? "";
  const title = TITLES.find(([prefix]) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)
  )?.[1];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-6">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="section-title truncate">
          {title}
        </h1>
        {query && (
          <>
            <span className="text-border">/</span>
            <span className="truncate text-[16px] capitalize text-muted-foreground">
              {query}
            </span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Freshness />
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-6 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Search a niche
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <NicheCommandDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}
