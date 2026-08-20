const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const plain = new Intl.NumberFormat("en-US");

export const num = (value: number | null | undefined) =>
  value == null ? "—" : plain.format(Math.round(value));

export const short = (value: number | null | undefined) =>
  value == null ? "—" : compact.format(value);

/**
 * Prices are decimal strings from many stores. The crawl does not carry each
 * store's currency (it lives in /meta.json, which is not in the shards), so the
 * console shows a bare `$` and the README flags mixed currency as a known
 * ceiling. Rendering a wrong ISO code would be worse than showing none.
 */
export const money = (value: number | null | undefined, decimals = 2) =>
  value == null
    ? "—"
    : `$${value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;

export const moneyShort = (value: number | null | undefined) =>
  value == null ? "—" : value >= 1000 ? `$${compact.format(value)}` : money(value, 0);

export const since = (epochSeconds: number | undefined) => {
  if (!epochSeconds) return "unknown";
  return new Date(epochSeconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Just the day. The KPI tile shows this; the full timestamp goes in its note. */
export const day = (epochSeconds: number | undefined) =>
  epochSeconds
    ? new Date(epochSeconds * 1000).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";
