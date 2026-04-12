#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_DIR="$ROOT/thesis-data/cdp-$TIMESTAMP"

mkdir -p "$RUN_DIR"

echo "=== CDP-only Measurement Run: $TIMESTAMP ==="
echo "  hda-stable (8080) | spa (8081) | hda-beta (8082) | hda-sse (8083)"

# Verify backends are up
echo "--> Checking health..."
if ! curl -sf http://localhost:3000/health > /dev/null; then
  echo "ERROR: Backend not healthy at localhost:3000 — start with: docker compose up -d"
  exit 1
fi
echo "    Backend healthy."

cd "$ROOT/measurement"

CDP_HDA_STABLE_URL=http://localhost:8080 \
CDP_SPA_URL=http://localhost:8081 \
CDP_HDA_BETA_URL=http://localhost:8082 \
CDP_HDA_SSE_URL=http://localhost:8083 \
CDP_DURATION_SECONDS="${CDP_DURATION_SECONDS:-60}" \
npm run measure 2>&1 | tee "$RUN_DIR/cdp.log"

cp "$ROOT/measurement/results/cdp-results."* "$RUN_DIR/" 2>/dev/null || true

echo ""
echo "=== CDP run complete: $RUN_DIR ==="
echo "  cdp-results.json / .csv / .md"
