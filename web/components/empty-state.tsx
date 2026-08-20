import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The one empty state. Four screens reached for it with slightly different
 * margins and type sizes; a deliberate-looking empty state is the same shape
 * every time, so it is one component rather than four near-copies.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  href,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: string;
  href?: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={`panel flex min-h-[420px] flex-col items-center justify-center border-dashed px-6 text-center ${
        tone === "error" ? "border-destructive/30 bg-destructive/[0.03]" : ""
      }`}
    >
      <span
        className={`mb-4 grid h-11 w-11 place-items-center rounded-full ${
          tone === "error"
            ? "bg-destructive/10 text-destructive"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="section-title">{title}</h2>
      <p className="body-text mt-1.5 max-w-sm">{body}</p>
      {action && href && (
        <Button asChild className="mt-6" size="sm">
          <Link href={href}>{action}</Link>
        </Button>
      )}
    </div>
  );
}
