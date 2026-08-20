# Shopify Intel Console — Implementation Plan

> **For agentic workers:** implement task by task, one commit per task.

**Goal:** A local, no-auth sales-demo console over the Shopify Intel crawl: a ⌘K niche
search with live counts, a niche price-architecture overview with white-space gaps, and a
sortable store list.

**Architecture:** A Python indexer reads the backend's gzipped CSV shards (via
`shopify_intel.coldstore`, imported read-only) and builds ONE SQLite file inside this repo
containing a contentless FTS5 index plus a narrow per-product table with price. A thin
FastAPI server answers four endpoints against that single file. A Next.js 14 App Router
frontend renders three screens using shadcn/ui, Recharts and TanStack Table.

**Tech Stack:** Python 3.13 + FastAPI + uvicorn; SQLite FTS5; Next.js 14 (App Router),
TypeScript, Tailwind, shadcn/ui (cmdk, table, card, tabs, sheet, skeleton, button, badge),
Recharts, TanStack Table, React Bits (animated counters / reveals).

## Global Constraints

- **NEVER** write to `/home/kinshuk/Projects/scraping/shopify_intel/`. Read-only. A
  production crawl holds `data/intel.db` open — open it with `mode=ro` URIs only.
- No auth, no multi-tenancy, no billing. Local only.
- Zero outbound requests to any store. The indexer reads local files only.
- `.gitignore` must cover `data/`, `*.db*`, `*.csv.gz`, `.env*`, `node_modules/`, `.next/`.
- **Do not hand-write UI a library provides.** No custom modal, table, dropdown, command
  palette, chart or skeleton. Any exception gets a comment naming why.
- Dark theme default. Skeletons on every async surface. Intentional empty states.
- Search endpoint target: < 300 ms warm.

## Measured backend facts (2026-08-20)

- `stores`: 15,723 rows. `products`: 23,085,034 rows. Crawl ~9.5% done, still running, so
  every count grows between index runs. The UI must show an "indexed at" stamp.
- Shards: `data/cold/products/<day>/part-*.csv.gz` (158 files, 1.3 GB),
  `data/cold/obs/<day>/part-*.csv.gz` (193 files, 1.1 GB, ≈100M rows).
- `product_type` free text, 42,207 distinct, 85% populated. Tags 781,186 distinct, mostly
  size/colour noise. So search must span title+vendor+product_type+tags.
- 99% of products live in exactly one store → **no cross-store product comparison exists**.
  Do not build one.
- Machine has 31 GB RAM but the live crawl holds ~18 GB. The indexer must not hold a
  23M-key dict; it aggregates in SQLite with an on-disk sort. 80 GB free on `/`.

## File structure

```
shopify-intel-console/
  Makefile                     # make index / make api / make web / make dev
  README.md
  .gitignore
  docs/plans/2026-08-20-shopify-intel-console.md
  api/
    requirements.txt
    indexer.py                 # shards -> data/console.db (FTS5 + products + stores)
    queries.py                 # all SQL: search counts, niche aggregates, store list
    main.py                    # FastAPI app, 4 endpoints, in-process cache
    test_queries.py            # one assert-based check on a synthetic db
  web/
    app/layout.tsx  app/page.tsx  app/niche/page.tsx  app/stores/page.tsx
    app/stores/[id]/page.tsx     # stub detail — clean seam, not built out
    components/…                 # thin wrappers over shadcn/Recharts/TanStack only
    lib/api.ts                   # typed fetch helpers
  data/                        # gitignored; console.db lives here
```

---

### Task 1: Repo skeleton, gitignore, plan commit

**Files:** Create `.gitignore`, `README.md` (stub), `docs/plans/…md` (this file).

- [ ] Step 1: `.gitignore` with `data/`, `*.db`, `*.db-*`, `*.csv.gz`, `.env*`,
      `node_modules/`, `.next/`, `__pycache__/`, `*.pyc`, `.venv/`.
- [ ] Step 2: Commit plan + gitignore. `git commit -m "docs: implementation plan"`.

---

### Task 2: Indexer — build `data/console.db`

**Files:** Create `api/indexer.py`, `api/requirements.txt`.

**Interfaces produced:** `data/console.db` with schema

```sql
stores(id INTEGER PRIMARY KEY, domain TEXT, n_products INT, median_price REAL,
       min_price REAL, max_price REAL)
products(id INTEGER PRIMARY KEY,        -- dense rowid, == products_fts rowid
         store_id INT, price REAL, vendor TEXT, product_type TEXT)
products_fts USING fts5(text, content='', tokenize='unicode61', detail='full')
meta(key TEXT PRIMARY KEY, value TEXT)  -- indexed_at, n_products, n_stores, shards json
```

Contentless FTS5 (`content=''`) because no screen displays product text; it roughly halves
index size. `products.id` is assigned in shard-read order and reused as the FTS rowid, so
`MATCH` results join straight back.

- [ ] Step 1: Read shards with `shopify_intel.coldstore.iter_rows("products")` — import the
      backend package by adding its path to `sys.path`; never copy its code.
- [ ] Step 2: Price pass. Stream `iter_rows("obs")` into an unindexed staging table
      `o(store_id, product_id, variant_id, ts, price)` (sequential appends, `PRAGMA
      synchronous=OFF`, `journal_mode=OFF`, 1 GB cache). Then collapse with two GROUP BYs —
      latest observation per variant via SQLite's documented `max()` bare-column rule, then
      the minimum variant price per product:
      ```sql
      CREATE TABLE price AS
        SELECT store_id, product_id, min(price) AS price FROM (
          SELECT store_id, product_id, variant_id, max(ts) AS ts, price
          FROM o GROUP BY store_id, product_id, variant_id
        ) GROUP BY store_id, product_id;
      ```
      Drop `o` afterwards. This is the whole reason we never hold a 23M-key dict.
- [ ] Step 3: Join price onto `products`, compute per-store rollups into `stores`
      (median via `NTILE`-free `ORDER BY price LIMIT 1 OFFSET n/2`).
- [ ] Step 4: `--rebuild` flag drops and rebuilds; default is a no-op if `meta.indexed_at`
      is newer than every shard mtime (cheap incremental check — full rebuild otherwise,
      because FTS rowid density makes true incremental append not worth the code).
- [ ] Step 5: Print elapsed time and file size. Commit.

---

### Task 3: Query layer + self-check

**Files:** Create `api/queries.py`, `api/test_queries.py`.

**Interfaces produced:**
- `fts_query(q: str) -> str` — sanitises free text into an FTS5 prefix-AND expression.
- `search_counts(conn, q) -> {"stores": int, "products": int, "types": [str]}`
- `niche(conn, q) -> {headline, histogram, gaps, bands, vendors, breadth}`
- `store_rows(conn, q) -> [{id, domain, n_products, median_price, min_price, max_price}]`

- [ ] Step 1: `fts_query`: split on non-word chars, drop empties, wrap each token in double
      quotes and append `*` → `"sunglass"* AND "polar"*`. Prevents FTS syntax errors from
      user input (a trust boundary — do not skip).
- [ ] Step 2: Aggregates over the matched product set: 40-bin histogram between the 1st and
      99th price percentile (clips the long tail that would flatten the chart);
      **white-space gaps** = runs of ≥2 consecutive empty bins, returned as
      `{lo, hi, width_pct}` sorted by width; bands = quintile clusters with store+product
      counts; vendors ranked separately by product count and by distinct-store count;
      breadth = histogram of products-per-store.
- [ ] Step 3: `test_queries.py` builds a tiny synthetic db in a temp dir, asserts a known
      gap is found and that `fts_query("men's  sun-glasses")` produces a valid MATCH.
      Run it. Commit.

---

### Task 4: FastAPI server

**Files:** Create `api/main.py`.

- [ ] Step 1: Endpoints `/api/search`, `/api/niche`, `/api/stores`, `/api/store/{id}`,
      `/api/meta`. Read-only connection, `check_same_thread=False`, `functools.lru_cache`
      on the aggregate endpoints keyed by query string.
- [ ] Step 2: CORS for `http://localhost:3000`. Return 503 with a clear message if
      `data/console.db` is missing, so the UI can show "run make index".
- [ ] Step 3: Time each endpoint with curl, record latency in the README. Commit.

---

### Task 5: Next.js scaffold + shadcn/ui

**Files:** `web/` via `create-next-app`, then `npx shadcn@latest init` and add
`command dialog table card tabs sheet skeleton button badge separator input scroll-area`.

- [ ] Step 1: Scaffold with `--typescript --tailwind --app --no-src-dir`.
- [ ] Step 2: Force dark theme on `<html class="dark">`; premium palette in `globals.css`.
- [ ] Step 3: `next.config` rewrite `/api/:path*` → `http://127.0.0.1:8000/api/:path*` so
      the browser makes same-origin calls and CORS never bites on camera.
- [ ] Step 4: Commit the scaffold on its own so later diffs stay readable.

---

### Task 6: Screen 1 — ⌘K search

**Files:** `web/app/page.tsx`, `web/components/niche-search.tsx`, `web/lib/api.ts`.

- [ ] Step 1: shadcn `CommandDialog` (cmdk), open by default on the landing page and on ⌘K.
- [ ] Step 2: Debounce 120 ms, call `/api/search`, render live counts
      *"427 stores · 84,000 products"* as a `CommandItem` before commit. Suggested niches
      as static `CommandItem`s so the operator can click instead of typing.
- [ ] Step 3: `Skeleton` while in flight, intentional empty state when 0 hits.
      Enter → `/niche?q=`. Commit.

---

### Task 7: Screen 2 — niche overview

**Files:** `web/app/niche/page.tsx`, `web/components/{headline-stats,price-histogram,
gap-callouts,price-bands,brand-concentration,assortment-breadth}.tsx`.

- [ ] Step 1: Headline counters — React Bits `CountUp` for stores / products / median price.
- [ ] Step 2: Recharts `BarChart` histogram with `ReferenceArea` overlays painting each
      white-space gap, plus a dedicated gap callout card:
      *"Nobody sells between $45 and $80."* This is the money shot; give it the most space.
- [ ] Step 3: Price bands table, brand concentration (two tabs: by products / by stores —
      shadcn `Tabs`), assortment breadth chart.
- [ ] Step 4: `Skeleton` cards during load; empty state when the niche is sparse. Commit.

---

### Task 8: Screen 3 — store list + stub detail

**Files:** `web/app/stores/page.tsx`, `web/components/store-table.tsx`,
`web/app/stores/[id]/page.tsx`.

- [ ] Step 1: TanStack Table over shadcn `Table` primitives: domain, products, price band,
      median price. Sorting + a filter input, both from TanStack.
- [ ] Step 2: Row click → `/stores/[id]` stub page rendering what the API already knows,
      with an explicit "Deep dive — coming soon" panel. Leave the seam; build no more.
- [ ] Step 3: Commit.

---

### Task 9: Makefile, README, push

- [ ] Step 1: `Makefile`: `index`, `api`, `web`, `dev` (both servers, one command).
- [ ] Step 2: README: prerequisites, index build (time + size measured), run commands,
      measured search latency, demo-recording script for the 90-second Loom.
- [ ] Step 3: `gh repo set-default` / push to
      `https://github.com/KinshukAgarwal/shopify-intel-console`. Verify `git status` clean
      and that no data file was committed.

## Decisions taken without asking

1. **One SQLite file, not two.** Search index and aggregates share `data/console.db`.
   A second file would need a cross-database ATTACH for every query for no benefit.
2. **Contentless FTS5.** No screen shows product text, so storing it twice is waste.
   If a future product-level drilldown needs titles, switch to `content='products'`.
3. **Product price = minimum variant price of the latest observation.** Matches how a
   shopper sees a "from" price and keeps one row per product.
4. **Full rebuild over true incremental.** The crawl appends whole new shard days; a
   rebuild is minutes and the density of FTS rowids is what keeps queries fast. The
   mtime check makes re-running cheap when nothing changed.
5. **Prices are treated as one currency.** `/meta.json` currency is not in the shards, so
   mixed-currency stores are a known ceiling, flagged in the README.
