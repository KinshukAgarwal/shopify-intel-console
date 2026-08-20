"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Activity, Command as CommandIcon } from "lucide-react";

import { NicheCommandDialog } from "@/components/niche-command";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useApi, type Meta } from "@/lib/api";
import { since, short } from "@/lib/format";

function Links() {
  const pathname = usePathname();
  const query = useSearchParams().get("q") ?? "";
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  const tabs = [
    { href: "/", label: "Search" },
    { href: `/niche${suffix}`, label: "Niche" },
    { href: `/stores${suffix}`, label: "Stores" },
  ];
  return (
    <nav className="flex items-center gap-1">
      {tabs.map((tab) => {
        const root = tab.href.split("?")[0];
        const active = root === "/" ? pathname === "/" : pathname.startsWith(root);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Freshness() {
  const { data } = useApi<Meta>("/api/meta");
  if (!data) return <Skeleton className="h-6 w-44" />;
  return (
    <Badge variant="outline" className="gap-1.5 border-border/70 font-normal">
      <Activity className="h-3 w-3 text-primary" />
      <span className="tabular text-muted-foreground">
        {short(data.n_products)} products · {short(data.n_stores)} stores ·
        indexed {since(data.indexed_at)}
      </span>
    </Badge>
  );
}

export function TopBar() {
  const [open, setOpen] = useState(false);

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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <CommandIcon className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Shopify Intel
          </span>
        </Link>
        <Suspense fallback={null}>
          <Links />
        </Suspense>
        <div className="ml-auto flex items-center gap-3">
          <Freshness />
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border/70 bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Search a niche
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      <NicheCommandDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}
