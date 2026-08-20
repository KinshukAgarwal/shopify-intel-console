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
    <Sidebar collapsible="none" className="border-r border-border">
      <SidebarHeader className="h-16 justify-center border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Command className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            Shopify Intel
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.match(pathname)}
                    className="h-9 data-[active=true]:bg-white data-[active=true]:text-primary data-[active=true]:shadow-[0_1px_2px_rgba(16,24,40,0.06)] data-[active=true]:ring-1 data-[active=true]:ring-border"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="text-[13px]">{item.label}</span>
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
                    className="h-8 data-[active=true]:bg-white data-[active=true]:text-foreground data-[active=true]:ring-1 data-[active=true]:ring-border"
                  >
                    <Link href={`/niche?q=${encodeURIComponent(name)}`}>
                      <LayoutGrid className="h-3.5 w-3.5 opacity-50" />
                      <span className="text-[13px] capitalize">{name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <div className="space-y-1">
          <p className="stat-label">Index</p>
          <p className="text-[13px] font-medium tabular text-foreground">
            {short(meta?.n_products)} products
          </p>
          <p className="text-[12px] tabular text-muted-foreground">
            {short(meta?.n_stores)} stores · {since(meta?.indexed_at)}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
