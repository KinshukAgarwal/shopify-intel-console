"""FastAPI over the console index. Read-only, local-only, no auth by design.

Every endpoint is a thin wrapper over `queries.py`. The only two things this
module owns are the connection pool (one SQLite handle per thread, because the
query layer writes TEMP tables) and the result cache, which is what makes a
repeated demo query feel instant on camera.
"""
import os
import sqlite3
import threading
import time
from collections import OrderedDict

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import queries

DB_PATH = os.environ.get(
    "CONSOLE_DB",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 "data", "console.db"))

app = FastAPI(title="Shopify Intel Console", docs_url="/api/docs")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

_local = threading.local()
_cache = OrderedDict()
_cache_lock = threading.Lock()
CACHE_MAX = 256


def db():
    """One read-only handle per worker thread.

    Not `lru_cache`d and not shared: `queries` materialises the match into a
    TEMP table, and TEMP tables are per connection. Sharing one handle across
    threads would let two requests overwrite each other's `m`.
    """
    conn = getattr(_local, "conn", None)
    if conn is None:
        if not os.path.exists(DB_PATH):
            raise HTTPException(
                503, "No index at %s. Build it with `make index`." % DB_PATH)
        conn = sqlite3.connect("file:%s?mode=ro" % DB_PATH, uri=True,
                               check_same_thread=False)
        conn.execute("PRAGMA temp_store = MEMORY")
        conn.execute("PRAGMA cache_size = -262144")   # 256 MiB
        _local.conn = conn
    return conn


def cached(key, produce):
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    value = produce()
    with _cache_lock:
        _cache[key] = value
        _cache.move_to_end(key)
        while len(_cache) > CACHE_MAX:
            _cache.popitem(last=False)
    return value


@app.get("/api/meta")
def api_meta():
    """Index freshness. The crawl is still running, so counts move between
    builds — the UI stamps this on screen so a demo never claims a stale total."""
    return queries.meta(db())


@app.get("/api/search")
def api_search(q: str = Query("", max_length=120)):
    return cached(("search", q), lambda: queries.search_counts(db(), q))


@app.get("/api/niche")
def api_niche(q: str = Query("", max_length=120)):
    started = time.time()
    payload = cached(("niche", q), lambda: queries.niche(db(), q))
    return dict(payload, took_ms=round((time.time() - started) * 1000, 1))


@app.get("/api/stores")
def api_stores(q: str = Query("", max_length=120), limit: int = 500):
    limit = max(1, min(limit, 2000))
    return cached(("stores", q, limit),
                  lambda: queries.store_rows(db(), q, limit))


@app.get("/api/store/{store_id}")
def api_store(store_id: int):
    detail = queries.store_detail(db(), store_id)
    if detail is None:
        raise HTTPException(404, "no such store in the index")
    return detail
