"use client";

import { useEffect, useRef, useState } from "react";

export type SearchCounts = {
  query: string;
  stores: number;
  products: number;
  types: { name: string; count: number }[];
};

export type Gap = {
  lo: number;
  hi: number;
  kind: "empty" | "thin";
  bars: number;
  products: number;
  share_pct: number;
};

export type Niche = {
  query: string;
  headline: {
    stores: number;
    products: number;
    priced: number;
    median_price: number | null;
  };
  range?: { lo: number; hi: number; bin_width: number };
  histogram: { lo: number; hi: number; count: number }[];
  gaps: Gap[];
  bands: { label: string; lo: number; hi: number; products: number; stores: number }[];
  vendors: {
    by_products: { vendor: string; products: number; stores: number }[];
    by_stores: { vendor: string; products: number; stores: number }[];
    distinct: number;
  };
  breadth: { label: string; stores: number }[];
  took_ms?: number;
};

export type StoreRow = {
  id: number;
  domain: string;
  matched: number;
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
  catalogue: number;
  median_price: number | null;
};

export type StoreDetail = {
  id: number;
  domain: string;
  n_products: number;
  n_priced: number;
  median_price: number | null;
  min_price: number | null;
  max_price: number | null;
  top_types: { name: string; count: number }[];
  top_vendors: { name: string; count: number }[];
};

export type Meta = {
  indexed_at?: number;
  n_products?: number;
  n_stores?: number;
  build_seconds?: string;
};

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch-on-change with abort, plus a debounce. Deliberately not SWR or React
 * Query: three screens, no mutations, no cache invalidation to speak of — the
 * API already caches, and a dependency here would earn nothing.
 */
export function useApi<T>(path: string | null, debounceMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const ticket = ++latest.current;
    setLoading(true);
    const timer = setTimeout(() => {
      get<T>(path, controller.signal)
        .then((value) => {
          if (ticket === latest.current) {
            setData(value);
            setError(null);
          }
        })
        .catch((cause: Error) => {
          if (cause.name !== "AbortError" && ticket === latest.current) {
            setError(cause.message);
          }
        })
        .finally(() => {
          if (ticket === latest.current) setLoading(false);
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, debounceMs]);

  return { data, error, loading };
}

// A one-character prefix query makes FTS5 walk essentially the whole term
// dictionary. Two characters is where it stops being pathological, and nobody
// picks a market from one letter anyway.
export const MIN_QUERY = 2;

export const searchPath = (q: string) =>
  q.trim().length >= MIN_QUERY
    ? `/api/search?q=${encodeURIComponent(q.trim())}`
    : null;
export const nichePath = (q: string) =>
  q.trim() ? `/api/niche?q=${encodeURIComponent(q.trim())}` : null;
export const storesPath = (q: string) =>
  q.trim() ? `/api/stores?q=${encodeURIComponent(q.trim())}&limit=1000` : null;
