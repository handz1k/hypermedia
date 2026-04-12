#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "==> Building and starting all services..."
cd "$ROOT"
docker compose up -d --build

echo "==> Waiting for backend health check..."
MAX_WAIT=60
WAITED=0
until curl -sf http://localhost:3000/health > /dev/null; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "ERROR: backend did not become healthy within ${MAX_WAIT}s"
    docker compose logs backend
    exit 1
  fi
  sleep 2
  WAITED=$((WAITED + 2))
done

echo "==> All services ready!"
echo "  HDA Stable (htmx 2.x + ext-ws):   http://localhost:8080"
echo "  SPA (client-side baseline):         http://localhost:8081"
echo "  HDA Beta  (htmx 4.0-beta1 WS ext): http://localhost:8082"
echo "  HDA SSE   (htmx 4.0-beta1 SSE ext):http://localhost:8083"
echo "  Grafana:                            http://localhost:3001"
echo "  Prometheus:                         http://localhost:9090"
echo "  cAdvisor:                           http://localhost:8084"
echo "  Backend:                            http://localhost:3000"
