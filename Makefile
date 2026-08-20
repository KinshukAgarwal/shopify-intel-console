.PHONY: help setup index reindex resume api web dev check clean

SHELL   := /bin/bash
PY      ?= python3
API_PORT ?= 8000
WEB_PORT ?= 3000
# Where the read-only crawler repo lives. Override if you moved it.
SHOPIFY_INTEL ?= /home/kinshuk/Projects/scraping/shopify_intel
export SHOPIFY_INTEL

help:
	@echo "make setup    install Python and Node dependencies"
	@echo "make index    build data/console.db from the crawl shards (skips if unchanged)"
	@echo "make reindex  force a rebuild"
	@echo "make resume   continue a killed build from its last finished pass"
	@echo "make dev      run the API and the web app together (the demo command)"
	@echo "make api      run only the FastAPI server on :$(API_PORT)"
	@echo "make web      run only the Next.js app on :$(WEB_PORT)"
	@echo "make check    query self-check plus a frontend typecheck"

setup:
	$(PY) -m pip install -r api/requirements.txt
	cd web && npm install

index:
	$(PY) api/indexer.py

reindex:
	$(PY) api/indexer.py --rebuild

# Pick a killed build back up. Whichever passes already committed are skipped;
# a partial file that fails quick_check is thrown away and rebuilt.
resume:
	$(PY) api/indexer.py --rebuild --resume

api:
	cd api && $(PY) -m uvicorn main:app --host 127.0.0.1 --port $(API_PORT)

web:
	cd web && npm run dev -- --port $(WEB_PORT)

# One command for the demo. The API is backgrounded and killed when you ^C the
# web server, so there is never a stray uvicorn holding the port on the next run.
dev:
	@echo "API  http://127.0.0.1:$(API_PORT)/api/docs"
	@echo "Web  http://localhost:$(WEB_PORT)"
	@trap 'kill 0' EXIT INT TERM; \
	  (cd api && $(PY) -m uvicorn main:app --host 127.0.0.1 --port $(API_PORT)) & \
	  cd web && npm run dev -- --port $(WEB_PORT)

check:
	$(PY) api/queries.py
	$(PY) api/indexer.py --self-check
	cd web && npx tsc --noEmit

clean:
	rm -f data/console.db data/console.db.building
