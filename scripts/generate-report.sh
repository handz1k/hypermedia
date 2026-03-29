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

| | HDA (HTMX) | SPA (Svelte) |
|---|---|---|
HEADER

# k6 output is NDJSON — one JSON object per line, not an array.
# jq -rs slurps all lines into an array first, then filters.
if command -v jq &>/dev/null; then
  extract_p95() {
    local file="$1" metric="$2"
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
    jq -rs --arg m "$metric" '
      [ .[] | select(.type=="Point" and .metric==$m) | .data.value ]
      | if length > 0
        then (add / length | floor)
        else "N/A"
        end
    ' "$file" 2>/dev/null || echo "N/A"
  }

  if [ -f "$RUN_DIR/k6-hda.json" ] && [ -f "$RUN_DIR/k6-spa.json" ]; then
    echo "| Time-to-first-msg p95 (ms)   | $(extract_p95 "$RUN_DIR/k6-hda.json" hda_time_to_first_msg_ms) | $(extract_p95 "$RUN_DIR/k6-spa.json" spa_time_to_first_msg_ms) |" >> "$REPORT"
    echo "| Msg interval jitter p95 (ms) | $(extract_p95 "$RUN_DIR/k6-hda.json" hda_msg_interval_ms) | $(extract_p95 "$RUN_DIR/k6-spa.json" spa_msg_interval_ms) |" >> "$REPORT"
    echo "| Avg message size (bytes)      | $(extract_avg  "$RUN_DIR/k6-hda.json" hda_msg_bytes_received) | $(extract_avg  "$RUN_DIR/k6-spa.json" spa_msg_bytes_received) |" >> "$REPORT"
  else
    echo "| k6 results | missing | missing |" >> "$REPORT"
  fi
else
  echo "| k6 results | jq not installed | jq not installed |" >> "$REPORT"
fi

# CDP results
if [ -f "$RUN_DIR/cdp-results.csv" ]; then
  printf '\n## Client-Side (CDP)\n\n' >> "$REPORT"
  echo "| Metric | HDA | SPA |" >> "$REPORT"
  echo "|---|---|---|" >> "$REPORT"

  for metric in fps_mean fps_p95 heap_used_mb_steady dom_nodes_final layout_count style_recalc_count script_duration_ms task_duration_ms; do
    HDA_VAL=$(grep "^hda,$metric," "$RUN_DIR/cdp-results.csv" | cut -d',' -f3)
    SPA_VAL=$(grep "^spa,$metric," "$RUN_DIR/cdp-results.csv" | cut -d',' -f3)
    LABEL=$(echo "$metric" | tr '_' ' ')
    echo "| $LABEL | ${HDA_VAL:-N/A} | ${SPA_VAL:-N/A} |" >> "$REPORT"
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
