#!/usr/bin/env bash
# Migrates and seeds, then starts the API, the worker and (once it exists) the web app.
# Ctrl-C stops them all.
set -euo pipefail
cd "$(dirname "$0")"
trap 'kill 0' EXIT
(cd api && .venv/bin/alembic upgrade head && .venv/bin/python -m app.seed)
(cd api && .venv/bin/uvicorn app.main:app --reload --port 8000) &
(cd api && .venv/bin/python -m app.worker) &
if [ -d web ]; then (cd web && npm run dev); else wait; fi
