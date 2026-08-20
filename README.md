# Shopify Intel Console

A local sales-demo console over the [Shopify Intel](../shopify_intel) crawl.
Type a niche in plain English, see how many stores and products are in it, then
read the market's whole price architecture — including the bands **nobody** is
selling into.

Three screens, in the order a demo runs:

1. **Search** — a ⌘K command palette with live counts as you type
   (*"427 stores · 84,000 products"*), so a weak query can be refined before you
   commit to it.
2. **Niche overview** — price distribution histogram, white-space gaps, price
   clusters, brand concentration, assortment breadth, animated headline counters.
3. **Store list** — every store in the market, sortable and filterable, with a
   stub detail page where the store deep-dive will go.

No auth, no multi-tenancy, no billing, no hosting. It runs on your machine and
makes **zero** outbound requests — every number comes from data already on disk.

---

## How it fits together

```
shopify_intel/                       READ-ONLY. A production crawl owns this.
  data/intel.db                      stores + products (opened mode=ro)
  data/cold/products/**/*.csv.gz     title, vendor, product_type, tags
  data/cold/obs/**/*.csv.gz          price / availability observations
        │
        │  api/indexer.py   (imports shopify_intel.coldstore; writes nothing back)
        ▼
shopify-intel-console/data/console.db
  products      id, store_id, product_id, price, vendor, product_type
  products_fts  contentless FTS5 over title+vendor+product_type+tags
  stores        domain, product counts, median/min/max price
  meta          indexed_at, counts, source fingerprint
        │
        │  api/main.py  (FastAPI, 5 endpoints, in-process LRU cache)
        ▼
web/  Next.js 14 App Router — proxies /api/* to the FastAPI server
```

### Why the index looks like this

- **Contentless FTS5** (`content=''`). No screen displays product text, so
  storing 30M titles a second time would roughly double the file for nothing.
  The FTS rowid *is* `products.id`, so a match joins straight back.
- **One MATCH per request.** The matched rows land in a TEMP table and every
  aggregate reads that. On a 30M-row index the MATCH is the cost; aggregating an
  80k-row temp table afterwards is free.
- **`product_type` is not a taxonomy.** It is free text with 42,207 distinct
  values and 15% of products leave it blank, and tags are 781k values of mostly
  size/colour noise. So search spans title + vendor + product_type + tags rather
  than pretending a clean category tree exists.
- **No cross-store product comparison anywhere.** 99% of products in this data
  appear in exactly one store, so "the same product across stores" is not a
  thing that exists here.

---

## Setup

Requires Python 3.11+, Node 20+, and the crawler repo on disk.

```bash
make setup          # pip install -r api/requirements.txt, npm install in web/
```

If the crawler lives somewhere other than
`/home/kinshuk/Projects/scraping/shopify_intel`, point at it:

```bash
export SHOPIFY_INTEL=/path/to/shopify_intel
```

## Build the search index

```bash
make index          # no-op if no shard has changed since the last build
make reindex        # force a full rebuild
```

The crawl is still running, so the shards grow. Re-run `make index` whenever you
want fresher numbers; the mtime/size fingerprint in `meta` makes a no-change run
instant. The console stamps the index time in the top bar so a demo never claims
a stale total.

**Measured on this machine** (20 cores, crawl running concurrently, ~16% of the
161,208-domain store list covered so far):

| | |
|---|---|
| Source shards | 351 files, 2.4 GB gzipped (one of them a 441 MB migration dump) |
| Observation rows read | ~100M, collapsed to 28.6M product prices |
| Product rows read | 31,170,184, of which **701,948 were duplicates** and removed |
| Products indexed | **30,468,236** (28,639,398 with a price) |
| Stores | **18,403** |
| Build time | ~45 min end to end on 20 cores with the crawl running alongside |
| `data/console.db` | **7.57 GB** |

The exact figures for your build are in the `meta` table and on screen in the
top bar. Duplicates are real and worth removing: `coldstore` warns that a store
retried after a crash re-writes its product metadata, and this crawl survived
two machine reboots.

The build writes to `console.db.building` and renames on success, so an
interrupted run never leaves a half-index in place. It also uses
`journal_mode=OFF` and `synchronous=OFF` — durability buys nothing for a file
that is rebuilt from source.

## Measured latency

Against the finished index, through the API, on this machine:

| query | endpoint | cold | warm |
|---|---|---|---|
| `sunglasses` (prewarmed) | search | **2 ms** | 2 ms |
| `sunglasses` (prewarmed) | niche | **3 ms** | 2 ms |
| `sunglasses` (prewarmed) | stores | **26 ms** | 14 ms |
| `magnesium supplement` (never seen) | search | 462 ms | 1 ms |
| `magnesium supplement` (never seen) | niche | 109 ms | 3 ms |

Two things make that work. The API warms every prefix of the eight suggested
niches on startup (59.5 s in a background thread, while uvicorn already serves),
and short prefix terms are refused: an FTS5 prefix walks most of a 30M-row index,
and cold counts measured **17.8 s for `su`, 5.4 s for `sun`, 538 ms for `sung`**.
Four characters is the floor, enforced on both sides.

## Run it

```bash
make dev            # FastAPI on :8000 and Next.js on :3000, one ^C stops both
```

Then open <http://localhost:3000>. Separately if you prefer:

```bash
make api            # http://127.0.0.1:8000/api/docs
make web            # http://localhost:3000
```

Next proxies `/api/*` to the API (`next.config.mjs`), so the browser only ever
talks to one origin and CORS cannot bite mid-recording.

## Verify

```bash
make check          # query self-check on a synthetic catalogue + frontend typecheck
```

`api/queries.py` builds a 400-product catalogue with a deliberate hole between
$40 and $90 and asserts the gap detector finds it, that a hostile query
(`" OR x NEAR(`) is neutralised into a valid FTS expression, and that an
unmatched query returns the intentional-empty shape instead of raising.

---

## Recording a demo

1. `make index` the morning of the recording so the counts are fresh.
2. `make dev`, then open <http://localhost:3000> at 1920x1080.
3. Land on the search screen with the palette focused. Type a niche one
   character at a time — the counts update as you type, which is the hook.
4. Enter. Let the headline counters finish animating before you speak.
5. Point at the amber bands on the histogram: *"nobody in this market sells
   between $1,547 and $1,785."* That is the money shot; the gap cards on the
   right spell out the same number in words.

   **Pick the niche for this shot.** Mass markets are priced continuously and
   the console correctly reports no white space — measured on sunglasses,
   coffee, candles, mattresses and wedding dresses. Specialist niches are where
   the holes are: `saxophone` and `office chair` both report real ones.
6. Switch the brand-concentration tabs. **By products** and **by stores** are
   different lists — a vendor with 9,000 products in one store is a catalogue, a
   vendor stocked by 300 stores is a brand. Say that out loud.
7. Click through to the store list, sort by a column, click a row.

Suggested niches, all measured to return a real market and all prewarmed by the
API: sunglasses, supplements, candles, dresses, sneakers, coffee, skincare,
jewelry. For the white-space shot specifically, use `saxophone`.

---

## Known ceilings

- **Currency is not modelled.** Prices are rendered with a bare `$`. The crawl's
  shards carry no currency (it lives in `/meta.json`, which is not collected), so
  a market with non-USD stores mixes units. Rendering a wrong ISO code would be
  worse than rendering none.
- **The histogram frames Tukey's fence, not the full range.** `sunglasses` runs
  from $5 at the 1st percentile to $99,900 at the 99th, and one product is
  priced at $28.7M, so a percentile frame puts every real product in one bar.
  The chart shows `Q3 + 1.5 x IQR` and the payload reports how many products
  fall outside it, so the trim is disclosed rather than hidden.
- **Dense markets have no white space, and the console says so.** Measured:
  sunglasses, coffee, candles, mattresses and wedding dresses are all priced
  continuously. Specialist niches are where the gaps live — `saxophone` reports
  real holes at $1,547–$1,785 and $2,022–$2,379. Pick the niche accordingly.
- **Price is the minimum variant price seen for a product** — the "from $X" a
  shopper is quoted — and it ignores `scraped_at`. Every observation currently on
  disk comes from a single crawl day, so the two definitions coincide; when the
  series spans real days, stage `ts` alongside and take the min within `max(ts)`.
  The ceiling is marked with a `ponytail:` comment in `api/indexer.py`.
- **Rebuild, not true incremental.** The crawl appends whole shard days and FTS
  rowid density is what keeps queries fast, so a change means a full rebuild. The
  fingerprint check makes a no-change re-run instant.
- **Store deep dive is deliberately a stub.** Launches, price changes, stock
  events and units sold each need a *second* crawl of the same store, which does
  not exist yet. `web/app/stores/[id]/page.tsx` is the seam.

## Guardrails honoured

- The crawler repo is never written to. `intel.db` is opened `mode=ro` because a
  production crawl holds it open.
- No network requests are made by anything in this repo.
- `data/`, `*.db`, `*.csv.gz` and `.env*` are gitignored — no data or credentials
  are ever committed.
