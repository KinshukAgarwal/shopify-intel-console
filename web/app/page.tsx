import { NicheCommand } from "@/components/niche-command";
import FadeContent from "@/components/FadeContent";

export default function SearchPage() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 -top-14 h-[560px] aurora" />
      <div className="pointer-events-none absolute inset-x-0 -top-14 h-[560px] grid-lines" />

      <div className="relative mx-auto max-w-3xl pt-24">
        <FadeContent blur duration={700}>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Live Shopify market index
          </p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight">
            Find the price gap
            <br />
            before your client does.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Type a niche in plain English. See how many stores and products are
            in it, where every competitor prices, and which bands nobody is
            selling into.
          </p>
        </FadeContent>

        <FadeContent blur delay={160} duration={700}>
          <div className="mt-10">
            <NicheCommand autoFocus />
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Press{" "}
            <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>{" "}
            from anywhere to search again.
          </p>
        </FadeContent>
      </div>
    </div>
  );
}
