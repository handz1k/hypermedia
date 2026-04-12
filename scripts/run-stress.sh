#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="$ROOT/thesis-data/stress-$TIMESTAMP"

mkdir -p "$RUN_DIR"

echo "=== Stress Test Run: $TIMESTAMP ==="
echo "  Stages: 50 → 100 → 200 → 500 → 1000 VUs per transport"

# Verify backend is up
if ! curl -sf http://localhost:3000/health > /dev/null; then
  echo "ERROR: Backend not healthy — start with: docker compose up -d"
  exit 1
fi
echo "--> Backend healthy."

COOLDOWN=60   # give the backend time to recover between runs

run_stress() {
  local name="$1"; shift
  local env_args=("$@")
  echo ""
  echo "--> Stress test: $name (~13 min)..."
  k6 run \
    --out "json=$RUN_DIR/stress-${name}.json" \
    --env TARGET="$name" \
    "${env_args[@]}" \
    --env UPDATE_INTERVAL_MS="${UPDATE_INTERVAL_MS:-250}" \
    "$ROOT/load-tests/k6/stress-test.js" \
    2>&1 | tee "$RUN_DIR/stress-${name}.log"
  echo "--> Cooldown ${COOLDOWN}s..."
  sleep $COOLDOWN
}

run_stress hda-stable --env HDA_STABLE_URL=ws://localhost:3000/ws/v2
run_stress spa         --env SPA_URL=ws://localhost:3000/ws
run_stress hda-beta    --env HDA_BETA_URL=ws://localhost:3000/ws/v4
run_stress hda-sse     --env HDA_SSE_URL=http://localhost:8083/api/sse/rows

echo ""
echo "=== Stress run complete: $RUN_DIR ==="
echo "Key question per log: at what VU count does msg_interval p95 exceed 500ms?"
