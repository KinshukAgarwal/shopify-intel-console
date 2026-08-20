"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Command, LayoutGrid, Search, Store } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SUGGESTED, useApi, type Meta } from "@/lib/api";
import { short, since } from "@/lib/format";

export function AppSidebar() {
  const pathname = usePathname();
  const query = useSearchParams().get("q") ?? "";
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  const { data: meta } = useApi<Meta>("/api/meta");

  const nav = [
    { href: "/", label: "Search", icon: Search, match: (p: string) => p === "/" },
    {
      href: `/niche${suffix}`,
      label: "Niche overview",
      icon: BarChart3,
      match: (p: string) => p.startsWith("/niche"),
    },
    {
      href: `/stores${suffix}`,
      label: "Stores",
      icon: Store,
      match: (p: string) => p.startsWith("/stores"),
    },
  ];

  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-foreground text-background">
            <Command className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            Shopify Intel
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-5">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.match(pathname)}
                    className="h-10 rounded-lg px-3 text-[14px] font-medium data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6 p-0">
          <SidebarGroupLabel className="stat-label px-2">
            Markets
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SUGGESTED.slice(0, 6).map((name) => (
                <SidebarMenuItem key={name}>
                  <SidebarMenuButton
                    asChild
                    isActive={query === name}
                    className="h-9 rounded-lg px-3 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Link href={`/niche?q=${encodeURIComponent(name)}`}>
                      <LayoutGrid className="h-3.5 w-3.5 opacity-50" />
                      <span className="text-[14px] capitalize">{name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-5">
        <div className="space-y-0.5">
          <p className="stat-label">Index</p>
          <p className="text-[20px] font-semibold tabular leading-none tracking-[-0.01em] text-foreground">
            {short(meta?.n_products)}
          </p>
          <p className="pt-1 text-[13px] tabular text-muted-foreground">
            products · {short(meta?.n_stores)} stores
          </p>
          <p className="text-[12px] tabular text-muted-foreground">
            {since(meta?.indexed_at)}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
