#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="$ROOT/thesis-data/run-$TIMESTAMP"

mkdir -p "$RUN_DIR"

echo "=== 4-App Measurement Run: $TIMESTAMP ==="
echo "  hda-stable (8080) | spa (8081) | hda-beta (8082) | hda-sse (8083)"

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

# 2. Stabilise
echo "--> Stabilising (10s)..."
sleep 10

COOLDOWN=30

run_k6() {
  local name="$1" script="$2" env_args=("${@:3}")
  echo "--> k6 load test: $name..."
  k6 run \
    --out "json=$RUN_DIR/k6-${name}.json" \
    "${env_args[@]}" \
    --env UPDATE_INTERVAL_MS="${UPDATE_INTERVAL_MS:-250}" \
    "$ROOT/load-tests/k6/$script" \
    2>&1 | tee "$RUN_DIR/k6-${name}.log"
  echo "--> Cooldown (${COOLDOWN}s)..."
  sleep $COOLDOWN
}

# 3. k6 load tests (sequential to avoid cross-contamination)
run_k6 hda-stable  ws-hda-stable-load.js  --env HDA_STABLE_WS_URL=ws://localhost:3000/ws/v2
run_k6 spa         ws-spa-load.js          --env SPA_WS_URL=ws://localhost:3000/ws
run_k6 hda-beta    ws-hda-beta-load.js     --env HDA_BETA_WS_URL=ws://localhost:3000/ws/v4
run_k6 hda-sse     sse-hda-load.js         --env HDA_SSE_URL=http://localhost:8083/api/sse/rows

# 4. CDP client-side measurements (all 4 apps)
echo "--> CDP measurements (all 4 apps)..."
cd "$ROOT/measurement"
CDP_HDA_STABLE_URL=http://localhost:8080 \
CDP_SPA_URL=http://localhost:8081 \
CDP_HDA_BETA_URL=http://localhost:8082 \
CDP_HDA_SSE_URL=http://localhost:8083 \
CDP_DURATION_SECONDS="${CDP_DURATION_SECONDS:-60}" \
npm run measure 2>&1 | tee "$RUN_DIR/cdp.log"
cp "$ROOT/measurement/results/cdp-results."* "$RUN_DIR/" 2>/dev/null || true

# 5. Code complexity (cloc)
echo "--> Running cloc..."
cd "$ROOT"
if command -v cloc &>/dev/null; then
  CLOC_OPTS=(
    --exclude-dir=node_modules,dist,.svelte-kit
    --not-match-f='htmx.*\.js|htmax\.js|ws\.js'
    --exclude-ext=json,lock
  )
  cloc "${CLOC_OPTS[@]}" --by-file --csv \
    --out="$RUN_DIR/cloc-report.csv" \
    backend/src app-hda-stable/public app-hda/public app-hda-sse/public app-spa/src
  cloc "${CLOC_OPTS[@]}" \
    backend/src app-hda-stable/public app-hda/public app-hda-sse/public app-spa/src \
    | tee "$RUN_DIR/cloc-summary.txt"
else
  echo "WARNING: cloc not installed — brew install cloc"
fi

# 6. Generate aggregate report
bash "$SCRIPT_DIR/generate-report.sh" "$RUN_DIR"

echo ""
echo "=== Run complete: $RUN_DIR ==="
