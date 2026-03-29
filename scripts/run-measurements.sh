#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="$ROOT/thesis-data/run-$TIMESTAMP"

mkdir -p "$RUN_DIR"

echo "=== HDA vs SPA Measurement Run: $TIMESTAMP ==="

# 1. Fresh environment
echo "--> Restarting services (clean state)..."
cd "$ROOT"
docker compose down -v 2>/dev/null || true
docker compose up -d --build

echo "--> Waiting for health check..."
MAX_WAIT=90
WAITED=0
until curl -sf http://localhost:3000/health > /dev/null; do
  [ $WAITED -ge $MAX_WAIT ] && { echo "Health check timeout"; exit 1; }
  sleep 2; WAITED=$((WAITED + 2))
done
echo "    Backend healthy after ${WAITED}s"

# 2. Stabilise (let a few ticks fire before measuring)
echo "--> Stabilising (10s)..."
sleep 10

# 3. k6 load test — HDA
echo "--> k6 load test: HDA..."
k6 run \
  --out "json=$RUN_DIR/k6-hda.json" \
  --env HDA_WS_URL=ws://localhost:8080/ws \
  --env UPDATE_INTERVAL_MS="${UPDATE_INTERVAL_MS:-250}" \
  "$ROOT/load-tests/k6/ws-hda-load.js" \
  2>&1 | tee "$RUN_DIR/k6-hda.log"

echo "--> Cooldown (30s)..."
sleep 30

# 4. k6 load test — SPA
echo "--> k6 load test: SPA..."
k6 run \
  --out "json=$RUN_DIR/k6-spa.json" \
  --env SPA_WS_URL=ws://localhost:8081/ws \
  --env UPDATE_INTERVAL_MS="${UPDATE_INTERVAL_MS:-250}" \
  "$ROOT/load-tests/k6/ws-spa-load.js" \
  2>&1 | tee "$RUN_DIR/k6-spa.log"

echo "--> Cooldown (30s)..."
sleep 30

# 5. CDP client-side measurements
echo "--> CDP measurements (HDA then SPA)..."
cd "$ROOT/measurement"
CDP_HDA_URL=http://localhost:8080 \
CDP_SPA_URL=http://localhost:8081 \
CDP_DURATION_SECONDS="${CDP_DURATION_SECONDS:-60}" \
npm run measure 2>&1 | tee "$RUN_DIR/cdp.log"
cp "$ROOT/measurement/results/cdp-results."* "$RUN_DIR/" 2>/dev/null || true

# 6. Code complexity (cloc)
echo "--> Running cloc..."
cd "$ROOT"
if command -v cloc &>/dev/null; then
  CLOC_OPTS=(
    --exclude-dir=node_modules,dist,.svelte-kit
    --not-match-f='htmx\.min\.js'
    --exclude-ext=json,lock
  )
  cloc "${CLOC_OPTS[@]}" --by-file --csv \
    --out="$RUN_DIR/cloc-report.csv" \
    backend/src app-hda/public app-spa/src
  cloc "${CLOC_OPTS[@]}" \
    backend/src app-hda/public app-spa/src \
    | tee "$RUN_DIR/cloc-summary.txt"
else
  echo "WARNING: cloc not installed — brew install cloc"
fi

# 7. Generate aggregate report
bash "$SCRIPT_DIR/generate-report.sh" "$RUN_DIR"

echo ""
echo "=== Run complete: $RUN_DIR ==="
