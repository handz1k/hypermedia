#!/usr/bin/env bash
set -euo pipefail

RUN_DIR="${1:-$(ls -td "$(dirname "$0")/../thesis-data"/run-* 2>/dev/null | head -1)}"
if [ -z "$RUN_DIR" ] || [ ! -d "$RUN_DIR" ]; then
  echo "Usage: $0 <run-dir>"
  exit 1
fi

echo "==> Generating aggregate report for: $RUN_DIR"

REPORT="$RUN_DIR/summary.md"

cat > "$REPORT" <<'HEADER'
# Measurement Run Summary

| | HDA Stable (htmx 2.x) | SPA | HDA Beta (htmx 4.x WS) | HDA SSE (htmx 4.x SSE) |
|---|---|---|---|---|
HEADER

# k6 output is NDJSON — one JSON object per line, not an array.
# jq -rs slurps all lines into an array first, then filters.
if command -v jq &>/dev/null; then
  extract_p95() {
    local file="$1" metric="$2"
    [ -f "$file" ] || { echo "N/A"; return; }
    jq -rs --arg m "$metric" '
      [ .[] | select(.type=="Point" and .metric==$m) | .data.value ]
      | if length > 0
        then sort | .[ (length * 0.95 | ceil) - 1 ] | floor
        else "N/A"
        end
    ' "$file" 2>/dev/null || echo "N/A"
  }
  extract_avg() {
    local file="$1" metric="$2"
    [ -f "$file" ] || { echo "N/A"; return; }
    jq -rs --arg m "$metric" '
      [ .[] | select(.type=="Point" and .metric==$m) | .data.value ]
      | if length > 0
        then (add / length | floor)
        else "N/A"
        end
    ' "$file" 2>/dev/null || echo "N/A"
  }

  S_TTFM=$(extract_p95 "$RUN_DIR/k6-hda-stable.json" hda_stable_time_to_first_msg_ms)
  S_JIT=$(extract_p95  "$RUN_DIR/k6-hda-stable.json" hda_stable_msg_interval_ms)
  S_SZ=$(extract_avg   "$RUN_DIR/k6-hda-stable.json" hda_stable_msg_bytes_received)

  P_TTFM=$(extract_p95 "$RUN_DIR/k6-spa.json" spa_time_to_first_msg_ms)
  P_JIT=$(extract_p95  "$RUN_DIR/k6-spa.json" spa_msg_interval_ms)
  P_SZ=$(extract_avg   "$RUN_DIR/k6-spa.json" spa_msg_bytes_received)

  B_TTFM=$(extract_p95 "$RUN_DIR/k6-hda-beta.json" hda_beta_time_to_first_msg_ms)
  B_JIT=$(extract_p95  "$RUN_DIR/k6-hda-beta.json" hda_beta_msg_interval_ms)
  B_SZ=$(extract_avg   "$RUN_DIR/k6-hda-beta.json" hda_beta_msg_bytes_received)

  E_TTFE=$(extract_p95 "$RUN_DIR/k6-hda-sse.json"  sse_time_to_first_event_ms)
  E_SZ=$(extract_avg   "$RUN_DIR/k6-hda-sse.json"  sse_bytes_received)

  echo "| Time-to-first-msg p95 (ms)   | $S_TTFM | $P_TTFM | $B_TTFM | $E_TTFE (TTFB) |" >> "$REPORT"
  echo "| Msg interval jitter p95 (ms) | $S_JIT  | $P_JIT  | $B_JIT  | N/A (SSE HTTP) |" >> "$REPORT"
  echo "| Avg message size (bytes)     | $S_SZ   | $P_SZ   | $B_SZ   | $E_SZ          |" >> "$REPORT"
else
  echo "| k6 results | jq not installed | — | — | — |" >> "$REPORT"
fi

# CDP results
if [ -f "$RUN_DIR/cdp-results.csv" ]; then
  printf '\n## Client-Side (CDP)\n\n' >> "$REPORT"
  echo "| Metric | HDA Stable | SPA | HDA Beta | HDA SSE |" >> "$REPORT"
  echo "|---|---|---|---|---|" >> "$REPORT"

  for metric in fps_mean fps_p95 heap_used_mb_steady dom_nodes_final layout_count style_recalc_count script_duration_ms task_duration_ms; do
    V_STABLE=$(grep "^hda-stable,$metric," "$RUN_DIR/cdp-results.csv" 2>/dev/null | cut -d',' -f3)
    V_SPA=$(grep    "^spa,$metric,"        "$RUN_DIR/cdp-results.csv" 2>/dev/null | cut -d',' -f3)
    V_BETA=$(grep   "^hda-beta,$metric,"   "$RUN_DIR/cdp-results.csv" 2>/dev/null | cut -d',' -f3)
    V_SSE=$(grep    "^hda-sse,$metric,"    "$RUN_DIR/cdp-results.csv" 2>/dev/null | cut -d',' -f3)
    LABEL=$(echo "$metric" | tr '_' ' ')
    echo "| $LABEL | ${V_STABLE:-N/A} | ${V_SPA:-N/A} | ${V_BETA:-N/A} | ${V_SSE:-N/A} |" >> "$REPORT"
  done
fi

# cloc
if [ -f "$RUN_DIR/cloc-summary.txt" ]; then
  printf '\n## Code Complexity (cloc)\n\n```\n' >> "$REPORT"
  cat "$RUN_DIR/cloc-summary.txt" >> "$REPORT"
  printf '```\n' >> "$REPORT"
fi

echo "Report written: $REPORT"
cat "$REPORT"
