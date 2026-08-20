"""Every SQL statement the console runs, and the price-architecture maths.

One rule drives the shape of this file: a request performs exactly ONE FTS5
`MATCH`. The matched rows land in a TEMP table and every aggregate — histogram,
gaps, bands, vendors, breadth — reads that table instead of re-matching. On a
23M-row index the MATCH is the expensive part; the aggregates over an 80k-row
temp table are noise.
"""
import re
import sqlite3

BINS = 40           # histogram resolution; 40 bars reads well at 1920x1080
BAND_COUNT = 5      # price clusters = quintiles of the matched catalogue
TOP_VENDORS = 12

_TOKEN = re.compile(r"[^\W_]+", re.UNICODE)

# Breadth buckets: "how many products does a store in this niche carry".
BREADTH_BUCKETS = [(1, 9), (10, 49), (50, 199), (200, 999),
                   (1000, 4999), (5000, None)]


def fts_query(text):
    """Turn free user text into a safe FTS5 prefix-AND expression.

    This is a trust boundary: anything unquoted lets a user type `AND OR "` and
    get a SQLite syntax error, or a `NEAR(` expression that scans forever. We
    keep only word characters, so no FTS operator can survive.

        "men's  sun-glasses" -> '"men"* AND "s"* AND "sun"* AND "glasses"*'

    Returns None when nothing usable is left, which callers treat as "no query".
    """
    tokens = _TOKEN.findall(text or "")
    if not tokens:
        return None
    return " AND ".join('"%s"*' % token.lower() for token in tokens[:8])


def _materialise(conn, match):
    """Run the single MATCH into TEMP m(id, store_id, price, vendor, type)."""
    conn.executescript("DROP TABLE IF EXISTS temp.m;")
    conn.execute("""
        CREATE TEMP TABLE m AS
        SELECT p.id, p.store_id, p.price, p.vendor, p.product_type
        FROM products_fts f JOIN products p ON p.id = f.rowid
        WHERE f.products_fts MATCH ?
    """, (match,))
    conn.execute("CREATE INDEX temp.idx_m_price ON m (price)")
    return conn.execute("SELECT count(*) FROM m").fetchone()[0]


def _quantile(conn, fraction):
    """Value at `fraction` of the priced rows in m. Cheap: one indexed scan."""
    n = conn.execute("SELECT count(*) FROM m WHERE price IS NOT NULL").fetchone()[0]
    if not n:
        return None
    offset = min(n - 1, max(0, int(n * fraction)))
    row = conn.execute("SELECT price FROM m WHERE price IS NOT NULL "
                       "ORDER BY price LIMIT 1 OFFSET ?", (offset,)).fetchone()
    return row[0] if row else None


# ------------------------------------------------------------------ screen 1

def search_counts(conn, text):
    """Live typeahead counts. Must stay well under 300 ms."""
    match = fts_query(text)
    if not match:
        return {"query": text, "stores": 0, "products": 0, "types": []}
    row = conn.execute("""
        SELECT count(*), count(DISTINCT p.store_id)
        FROM products_fts f JOIN products p ON p.id = f.rowid
        WHERE f.products_fts MATCH ?
    """, (match,)).fetchone()
    types = conn.execute("""
        SELECT p.product_type, count(*) AS n
        FROM products_fts f JOIN products p ON p.id = f.rowid
        WHERE f.products_fts MATCH ? AND p.product_type <> ''
        GROUP BY 1 ORDER BY n DESC LIMIT 6
    """, (match,)).fetchall()
    return {"query": text, "products": row[0], "stores": row[1],
            "types": [{"name": t, "count": n} for t, n in types]}


# ------------------------------------------------------------------ screen 2

def _histogram(conn, lo, hi):
    """`BINS` equal-width bars between lo and hi, zero-filled."""
    if lo is None or hi is None or hi <= lo:
        return [], 0.0
    width = (hi - lo) / BINS
    counts = [0] * BINS
    rows = conn.execute("""
        SELECT min(CAST((price - ?) / ? AS INT), ?), count(*)
        FROM m WHERE price IS NOT NULL AND price BETWEEN ? AND ?
        GROUP BY 1
    """, (lo, width, BINS - 1, lo, hi)).fetchall()
    for index, count in rows:
        if index is not None and 0 <= index < BINS:
            counts[index] = count
    return [{"lo": lo + i * width, "hi": lo + (i + 1) * width, "count": c}
            for i, c in enumerate(counts)], width


def _gaps(histogram, total):
    """White space: price bands where the market sells (almost) nothing.

    A truly empty run of bars is the honest, unarguable version of the claim.
    Sparse niches often have none, and an empty panel looks broken on camera, so
    a second pass reports the thinnest wide run instead, labelled `thin` — the
    UI says "barely served" rather than "nobody sells here".
    """
    def runs(predicate, minimum_bars):
        found, start = [], None
        for index, bar in enumerate(histogram + [None]):
            if bar is not None and predicate(bar):
                start = index if start is None else start
            else:
                if start is not None and index - start >= minimum_bars:
                    found.append((start, index - 1))
                start = None
        return found

    empty = runs(lambda bar: bar["count"] == 0, 2)
    kind = "empty"
    if not empty and total:
        empty = runs(lambda bar: bar["count"] <= max(1, total * 0.002), 3)
        kind = "thin"
    out = []
    for start, end in empty:
        span = histogram[start]["lo"], histogram[end]["hi"]
        inside = sum(bar["count"] for bar in histogram[start:end + 1])
        out.append({"lo": span[0], "hi": span[1], "kind": kind,
                    "bars": end - start + 1, "products": inside,
                    "share_pct": round(100.0 * inside / total, 2) if total else 0.0})
    out.sort(key=lambda gap: gap["hi"] - gap["lo"], reverse=True)
    return out[:4]


def _bands(conn):
    """Quintile price clusters with the store and product count in each."""
    rows = conn.execute("""
        SELECT band, min(price), max(price), count(*), count(DISTINCT store_id)
        FROM (SELECT price, store_id,
                     NTILE(?) OVER (ORDER BY price) AS band
              FROM m WHERE price IS NOT NULL)
        GROUP BY band ORDER BY band
    """, (BAND_COUNT,)).fetchall()
    labels = ["Budget", "Value", "Mid-market", "Premium", "Luxury"]
    return [{"label": labels[i] if i < len(labels) else "Band %d" % (i + 1),
             "lo": lo, "hi": hi, "products": n, "stores": s}
            for i, (_, lo, hi, n, s) in enumerate(rows)]


def _vendors(conn):
    """Brand concentration. By products and by stores — they are NOT the same.

    A vendor with 9,000 products in one store is a catalogue; a vendor stocked
    by 300 stores is a brand. Showing only the first ranking hides the second,
    so both go to the client and the UI tabs between them.
    """
    def top(order):
        return [{"vendor": v, "products": n, "stores": s}
                for v, n, s in conn.execute("""
                    SELECT vendor, count(*) AS n, count(DISTINCT store_id) AS s
                    FROM m WHERE vendor <> ''
                    GROUP BY vendor ORDER BY %s DESC LIMIT ?
                """ % order, (TOP_VENDORS,))]
    distinct = conn.execute(
        "SELECT count(DISTINCT vendor) FROM m WHERE vendor <> ''").fetchone()[0]
    return {"by_products": top("n"), "by_stores": top("s"), "distinct": distinct}


def _breadth(conn):
    """How many products a store in this niche carries, in log-ish buckets."""
    per_store = conn.execute(
        "SELECT count(*) FROM m GROUP BY store_id").fetchall()
    counts = [row[0] for row in per_store]
    out = []
    for lo, hi in BREADTH_BUCKETS:
        n = sum(1 for c in counts
                if c >= lo and (hi is None or c <= hi))
        out.append({"label": "%d+" % lo if hi is None else "%d-%d" % (lo, hi),
                    "stores": n})
    return out


def niche(conn, text):
    """Everything screen 2 renders, from one MATCH."""
    match = fts_query(text)
    empty = {"query": text, "headline": {"stores": 0, "products": 0,
                                         "median_price": None, "priced": 0},
             "histogram": [], "gaps": [], "bands": [], "breadth": [],
             "vendors": {"by_products": [], "by_stores": [], "distinct": 0}}
    if not match:
        return empty
    total = _materialise(conn, match)
    if not total:
        return empty
    stores = conn.execute("SELECT count(DISTINCT store_id) FROM m").fetchone()[0]
    priced = conn.execute(
        "SELECT count(*) FROM m WHERE price IS NOT NULL").fetchone()[0]
    lo, hi = _quantile(conn, 0.01), _quantile(conn, 0.99)
    histogram, width = _histogram(conn, lo, hi)
    return {
        "query": text,
        "headline": {"stores": stores, "products": total, "priced": priced,
                     "median_price": _quantile(conn, 0.5)},
        "range": {"lo": lo, "hi": hi, "bin_width": width},
        "histogram": histogram,
        "gaps": _gaps(histogram, priced),
        "bands": _bands(conn) if priced else [],
        "vendors": _vendors(conn),
        "breadth": _breadth(conn),
    }


# ------------------------------------------------------------------ screen 3

def store_rows(conn, text, limit=500):
    """Stores in the niche, ranked by how much of the niche they carry."""
    match = fts_query(text)
    if not match:
        return []
    _materialise(conn, match)
    rows = conn.execute("""
        SELECT s.id, s.domain, count(*) AS matched,
               min(m.price), max(m.price),
               avg(m.price), s.n_products, s.median_price
        FROM m JOIN stores s ON s.id = m.store_id
        GROUP BY s.id ORDER BY matched DESC LIMIT ?
    """, (limit,)).fetchall()
    return [{"id": r[0], "domain": r[1], "matched": r[2], "min_price": r[3],
             "max_price": r[4], "avg_price": r[5], "catalogue": r[6],
             "median_price": r[7]} for r in rows]


def store_detail(conn, store_id):
    """Stub payload for the deep-dive seam: whatever the index already knows."""
    row = conn.execute("""
        SELECT id, domain, n_products, n_priced, median_price, min_price, max_price
        FROM stores WHERE id = ?
    """, (store_id,)).fetchone()
    if not row:
        return None
    types = conn.execute("""
        SELECT product_type, count(*) AS n FROM products
        WHERE store_id = ? AND product_type <> ''
        GROUP BY 1 ORDER BY n DESC LIMIT 10
    """, (store_id,)).fetchall()
    vendors = conn.execute("""
        SELECT vendor, count(*) AS n FROM products
        WHERE store_id = ? AND vendor <> ''
        GROUP BY 1 ORDER BY n DESC LIMIT 10
    """, (store_id,)).fetchall()
    return {"id": row[0], "domain": row[1], "n_products": row[2],
            "n_priced": row[3], "median_price": row[4], "min_price": row[5],
            "max_price": row[6],
            "top_types": [{"name": t, "count": n} for t, n in types],
            "top_vendors": [{"name": v, "count": n} for v, n in vendors]}


def meta(conn):
    values = dict(conn.execute("SELECT key, value FROM meta"))
    for key in ("indexed_at", "n_products", "n_stores"):
        if key in values:
            values[key] = int(float(values[key]))
    return values


# --------------------------------------------------------------- self-check

def _demo():
    """One runnable check: a synthetic catalogue with a KNOWN price gap."""
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE products (id INTEGER PRIMARY KEY, store_id INT,
            product_id INT, price REAL, vendor TEXT, product_type TEXT);
        CREATE TABLE stores (id INTEGER PRIMARY KEY, domain TEXT,
            n_products INT, n_priced INT, median_price REAL,
            min_price REAL, max_price REAL);
        CREATE VIRTUAL TABLE products_fts USING fts5(text, content='');
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    """)
    # 200 cheap sunglasses ($10-$40) and 200 dear ones ($90-$120).
    # Nothing at all between $40 and $90 -> that band must be reported.
    rows, docs, pid = [], [], 0
    for store in range(1, 21):
        for i in range(10):
            for price in (10 + i * 3, 90 + i * 3):
                pid += 1
                rows.append((pid, store, pid, float(price),
                             "Brand%d" % (store % 4), "Sunglasses"))
                docs.append((pid, "Polarised Sunglasses Brand%d Sunglasses uv400"
                             % (store % 4)))
        conn.execute("INSERT INTO stores VALUES (?,?,?,?,?,?,?)",
                     (store, "store%d.com" % store, 20, 20, 50.0, 10.0, 117.0))
    conn.executemany("INSERT INTO products VALUES (?,?,?,?,?,?)", rows)
    conn.executemany("INSERT INTO products_fts(rowid, text) VALUES (?,?)", docs)
    conn.commit()

    assert fts_query("men's  sun-glasses") == '"men"* AND "s"* AND "sun"* AND "glasses"*'
    assert fts_query("   ") is None
    assert fts_query('" OR x NEAR(') == '"or"* AND "x"* AND "near"*'

    counts = search_counts(conn, "sunglasses")
    assert counts["products"] == 400, counts
    assert counts["stores"] == 20, counts
    assert counts["types"][0]["name"] == "Sunglasses", counts

    report = niche(conn, "sunglasses")
    assert report["headline"]["products"] == 400
    assert report["headline"]["stores"] == 20
    assert 45 < report["headline"]["median_price"] < 95, report["headline"]
    gaps = report["gaps"]
    assert gaps, "the $40-$90 white space was not found"
    top = gaps[0]
    assert top["kind"] == "empty" and top["lo"] >= 37 and top["hi"] <= 93, top
    assert len(report["bands"]) == BAND_COUNT
    assert report["vendors"]["distinct"] == 4
    assert sum(b["stores"] for b in report["breadth"]) == 20

    stores = store_rows(conn, "sunglasses")
    assert len(stores) == 20 and stores[0]["matched"] == 20, stores[0]
    assert store_detail(conn, 1)["domain"] == "store1.com"
    assert store_detail(conn, 999) is None

    # An unmatched query must return the intentional-empty shape, not blow up.
    blank = niche(conn, "zzzznope")
    assert blank["headline"]["products"] == 0 and blank["gaps"] == []
    print("queries self-check OK")


if __name__ == "__main__":
    _demo()
