"""Build data/console.db from the Shopify Intel crawl's cold shards.

The backend repo is READ-ONLY here. We import its `coldstore` module to read the
gzipped CSV shards (never reimplementing the format) and we open its `intel.db`
with a `mode=ro` URI, because a production crawl is writing to it right now.

What comes out is ONE SQLite file:

    products      id, store_id, product_id, price, vendor, product_type
    products_fts  contentless FTS5 over title+vendor+product_type+tags,
                  rowid == products.id
    stores        id, domain, n_products, n_priced, median/min/max price
    meta          indexed_at, counts, source fingerprint

Contentless FTS5 (`content=''`) because no screen displays product text — the
index answers "which products match", the `products` table answers everything
else. Storing 23M titles twice would roughly double the file for nothing.

Run:  python3 api/indexer.py [--rebuild] [--limit N]
"""
import argparse
import gzip
import os
import re
import sqlite3
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
BACKEND = os.environ.get("SHOPIFY_INTEL",
                         "/home/kinshuk/Projects/scraping/shopify_intel")
DB_PATH = os.environ.get("CONSOLE_DB", os.path.join(REPO, "data", "console.db"))

sys.path.insert(0, BACKEND)
from shopify_intel import coldstore  # noqa: E402  (needs the path above)

COLD_DIR = os.path.join(BACKEND, "data", "cold")
INTEL_DB = os.path.join(BACKEND, "data", "intel.db")

# Tags arrive comma-separated; the tokenizer wants whitespace.
_SPLIT = re.compile(r"[,/|]+")


def log(message):
    print("[index] %s" % message, flush=True)


def shard_files(kind):
    """Every shard path for `kind`, oldest day first. Reuses coldstore's layout."""
    return coldstore._shard_files(kind, COLD_DIR, None)


def fingerprint(paths):
    """Cheap change detector: newest mtime plus total byte size."""
    newest, total = 0.0, 0
    for path in paths:
        stat = os.stat(path)
        newest = max(newest, stat.st_mtime)
        total += stat.st_size
    return "%d:%.0f:%d" % (len(paths), newest, total)


def connect_build(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    # Build-time only. The file is rebuilt from source if a crash corrupts it,
    # so durability buys nothing and costs an order of magnitude.
    conn.executescript("""
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF;
        PRAGMA temp_store = FILE;
        PRAGMA cache_size = -1048576;   -- 1 GiB
    """)
    return conn


# ---------------------------------------------------------------- price pass

def build_price(conn, limit=None):
    """Collapse the observation series to one price per product.

    Definition: **the minimum variant price seen for the product** — the
    "from $X" a shopper is quoted. `min` is associative, which is what lets the
    Python-side reduction flush whenever it likes: memory stays bounded no
    matter how large a single shard is, and one shard here is 441 MB (the
    migration dump, ~41M rows) against 15 MB for the rest.

    ponytail: ignores `scraped_at`, so a product whose price fell keeps the
    lower figure and one that rose keeps the older, lower one. Every row in the
    store today comes from a single crawl day so the two definitions coincide;
    when the series spans real days, stage `ts` alongside and take the min
    within `max(ts)` instead.
    """
    conn.executescript("""
        DROP TABLE IF EXISTS stage;
        CREATE TABLE stage (store_id INT, product_id INT, price REAL);
    """)
    paths = shard_files("obs")
    if limit:
        paths = paths[:limit]
    total_rows = 0
    started = time.time()

    def flush(best):
        nonlocal total_rows
        if not best:
            return
        conn.executemany("INSERT INTO stage VALUES (?,?,?)",
                         ((k[0], k[1], v) for k, v in best.items()))
        total_rows += len(best)
        best.clear()

    for index, path in enumerate(paths, 1):
        best = {}
        with gzip.open(path, "rt", newline="") as handle:
            for line in handle:
                # The csv module is ~2x slower and these columns never quote.
                parts = line.split(",")
                if len(parts) < 8 or parts[0] == "store_id":
                    continue
                try:
                    key = (int(parts[0]), int(parts[1]))
                    price = float(parts[5])
                except ValueError:
                    continue
                previous = best.get(key)
                if previous is None or price < previous:
                    best[key] = price
                if len(best) >= 3_000_000:
                    flush(best)
        flush(best)
        if index % 25 == 0 or index == len(paths):
            log("obs shard %d/%d  staged=%s  %.0fs"
                % (index, len(paths), f"{total_rows:,}", time.time() - started))
    conn.commit()

    log("collapsing %s staged rows to one price per product" % f"{total_rows:,}")
    conn.executescript("""
        DROP TABLE IF EXISTS price;
        CREATE TABLE price (store_id INT, product_id INT, price REAL,
                            PRIMARY KEY (store_id, product_id)) WITHOUT ROWID;
        INSERT INTO price
          SELECT store_id, product_id, min(price)
          FROM stage GROUP BY store_id, product_id;
        DROP TABLE stage;
    """)
    conn.commit()
    return conn.execute("SELECT count(*) FROM price").fetchone()[0]


# ------------------------------------------------------------- product pass

def build_products(conn, limit=None):
    """Stream product shards into `products` and the FTS index in one pass."""
    conn.executescript("""
        DROP TABLE IF EXISTS products;
        DROP TABLE IF EXISTS products_fts;
        CREATE TABLE products (
            id           INTEGER PRIMARY KEY,
            store_id     INT,
            product_id   INT,
            price        REAL,
            vendor       TEXT,
            product_type TEXT
        );
        CREATE VIRTUAL TABLE products_fts USING fts5(
            text, content='', contentless_delete=1,
            tokenize='unicode61 remove_diacritics 2');
    """)
    rows, docs = [], []
    seen = 0
    started = time.time()
    # iter_rows walks every shard for us, oldest day first, so it is driven once
    # over the whole set. `limit` caps rows instead of files, for smoke tests.
    for row in coldstore.iter_rows("products", root=COLD_DIR):
        seen += 1
        text = " ".join(_SPLIT.sub(" ", row[column] or "")
                        for column in ("title", "vendor", "product_type", "tags"))
        rows.append((seen, row["store_id"], row["product_id"], None,
                     (row["vendor"] or "").strip(),
                     (row["product_type"] or "").strip()))
        docs.append((seen, text))
        if len(rows) >= 200_000:
            _flush(conn, rows, docs)
            log("products %s  %.0fs" % (f"{seen:,}", time.time() - started))
        if limit and seen >= limit:
            break
    _flush(conn, rows, docs)
    conn.commit()
    log("products %s indexed in %.0fs" % (f"{seen:,}", time.time() - started))
    return seen


def _flush(conn, rows, docs):
    if not rows:
        return
    conn.executemany("INSERT INTO products VALUES (?,?,?,?,?,?)", rows)
    conn.executemany("INSERT INTO products_fts(rowid, text) VALUES (?,?)", docs)
    rows.clear()
    docs.clear()


# ------------------------------------------------------------------ rollups

def dedupe(conn):
    """Drop repeat rows for the same (store_id, product_id).

    coldstore's own docstring warns of this: a store retried after a crash
    re-writes its product metadata, so a shard can carry the same product
    twice, and this crawl survived two machine reboots. Left in, every
    duplicate would inflate the product count, the store count and the
    histogram. `contentless_delete=1` on the FTS table is what makes the
    matching index rows removable without keeping the text around.
    """
    conn.execute("CREATE INDEX idx_products_key ON products (store_id, product_id)")
    conn.executescript("""
        CREATE TEMP TABLE keep AS
          SELECT min(id) AS id FROM products GROUP BY store_id, product_id;
        CREATE INDEX temp.idx_keep ON keep (id);
        CREATE TEMP TABLE dupes AS
          SELECT p.id FROM products p LEFT JOIN keep k ON k.id = p.id
          WHERE k.id IS NULL;
    """)
    n = conn.execute("SELECT count(*) FROM dupes").fetchone()[0]
    if n:
        conn.execute("DELETE FROM products_fts WHERE rowid IN (SELECT id FROM dupes)")
        conn.execute("DELETE FROM products WHERE id IN (SELECT id FROM dupes)")
    conn.executescript("DROP TABLE keep; DROP TABLE dupes;")
    conn.commit()
    log("deduped %s repeated product rows" % f"{n:,}")
    return n


def attach_prices(conn):
    log("joining prices onto products")
    conn.execute("""
        UPDATE products SET price = (
            SELECT price FROM price
            WHERE price.store_id = products.store_id
              AND price.product_id = products.product_id)
    """)
    conn.execute("DROP TABLE price")
    conn.execute("CREATE INDEX idx_products_store ON products (store_id)")
    conn.commit()


def build_stores(conn):
    log("building store rollups")
    conn.executescript("""
        DROP TABLE IF EXISTS stores;
        CREATE TABLE stores (
            id INTEGER PRIMARY KEY, domain TEXT, n_products INT, n_priced INT,
            median_price REAL, min_price REAL, max_price REAL);
    """)
    source = sqlite3.connect("file:%s?mode=ro" % INTEL_DB, uri=True)
    domains = source.execute("SELECT id, domain FROM stores").fetchall()
    source.close()
    conn.executemany("INSERT INTO stores (id, domain, n_products, n_priced) "
                     "VALUES (?,?,0,0)", domains)
    conn.executescript("""
        CREATE TEMP TABLE agg AS
          SELECT store_id, count(*) AS n, sum(price IS NOT NULL) AS priced,
                 min(price) AS mn, max(price) AS mx
          FROM products GROUP BY store_id;
        CREATE TEMP TABLE med AS
          SELECT store_id, avg(price) AS median FROM (
            SELECT store_id, price,
                   row_number() OVER (PARTITION BY store_id ORDER BY price) AS rn,
                   count(*) OVER (PARTITION BY store_id) AS c
            FROM products WHERE price IS NOT NULL)
          WHERE rn IN ((c + 1) / 2, (c + 2) / 2) GROUP BY store_id;
        UPDATE stores SET
            n_products = coalesce((SELECT n FROM agg WHERE agg.store_id = stores.id), 0),
            n_priced   = coalesce((SELECT priced FROM agg WHERE agg.store_id = stores.id), 0),
            min_price  = (SELECT mn FROM agg WHERE agg.store_id = stores.id),
            max_price  = (SELECT mx FROM agg WHERE agg.store_id = stores.id),
            median_price = (SELECT median FROM med WHERE med.store_id = stores.id);
        DELETE FROM stores WHERE n_products = 0;
        DROP TABLE agg; DROP TABLE med;
    """)
    conn.commit()
    return conn.execute("SELECT count(*) FROM stores").fetchone()[0]


def set_meta(conn, **values):
    conn.execute("CREATE TABLE IF NOT EXISTS meta "
                 "(key TEXT PRIMARY KEY, value TEXT)")
    conn.executemany("INSERT OR REPLACE INTO meta VALUES (?,?)",
                     [(k, str(v)) for k, v in values.items()])
    conn.commit()


def current_fingerprint():
    return fingerprint(shard_files("products") + shard_files("obs"))


def is_current(path):
    if not os.path.exists(path):
        return False
    try:
        conn = sqlite3.connect("file:%s?mode=ro" % path, uri=True)
        row = conn.execute("SELECT value FROM meta WHERE key='fingerprint'").fetchone()
        conn.close()
    except sqlite3.Error:
        return False
    return bool(row) and row[0] == current_fingerprint()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rebuild", action="store_true",
                        help="rebuild even when the shards have not changed")
    parser.add_argument("--limit", type=int, default=None,
                        help="smoke test: read only N obs shards and N product rows")
    parser.add_argument("--out", default=DB_PATH)
    args = parser.parse_args()

    if not args.rebuild and not args.limit and is_current(args.out):
        log("shards unchanged since the last build — nothing to do "
            "(pass --rebuild to force)")
        return

    started = time.time()
    stamp = current_fingerprint()
    tmp = args.out + ".building"
    for suffix in ("", "-journal", "-wal"):
        if os.path.exists(tmp + suffix):
            os.remove(tmp + suffix)
    conn = connect_build(tmp)

    n_prices = build_price(conn, args.limit)
    log("prices: %s products" % f"{n_prices:,}")
    n_products = build_products(conn, args.limit)
    n_duplicates = dedupe(conn)
    n_products -= n_duplicates
    attach_prices(conn)
    n_stores = build_stores(conn)
    set_meta(conn, indexed_at=int(time.time()), fingerprint=stamp,
             n_products=n_products, n_stores=n_stores,
             n_duplicates=n_duplicates,
             build_seconds=round(time.time() - started, 1))
    conn.executescript("PRAGMA journal_mode = DELETE; PRAGMA optimize;")
    conn.close()
    os.replace(tmp, args.out)

    size = os.path.getsize(args.out) / 1e9
    log("done: %s products, %s stores, %.2f GB, %.0f s"
        % (f"{n_products:,}", f"{n_stores:,}", size, time.time() - started))


if __name__ == "__main__":
    main()
