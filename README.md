# HDA vs SPA — Stock Ticker Thesis

Empirical comparison of **Hypermedia-Driven Applications (HDA)** and **Single-Page Applications (SPA)** for real-time web development, using a live stock ticker as the workload. Four variants of the same application run simultaneously against the same backend, with the only variable being what travels over the wire and who renders the UI.

---

## The four apps

| | HDA Stable | SPA | HDA Beta | HDA SSE |
|---|---|---|---|---|
| Framework | htmx 2.x + htmx-ext-ws | React 18 | htmx 4.x (beta) WS | htmx 4.x (beta) SSE |
| Transport | WebSocket | WebSocket | WebSocket | Server-Sent Events |
| WS payload | HTML (`hx-swap-oob`) | JSON | HTML (`<hx-partial>`) | — |
| SSE payload | — | — | — | HTML (`<hx-partial>`) |
| Rendering | Server (Node.js) | Client (browser) | Server (Node.js) | Server (Node.js) |
| Port | `8080` | `8081` | `8082` | `8083` |
| Metric label | `hda-v2` | `spa` | `hda-v4` | `sse-rows` |

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Docker + Docker Compose | v24+ | Run all services |
| k6 | v0.51+ | Load and stress tests |
| Node.js | v22+ | CDP measurement scripts |
| cloc | any | Lines-of-code count |

```bash
brew install k6 cloc node
```

---

## Quickstart

```bash
# Build and start all services
docker compose up -d --build
```

| Service | URL |
|---|---|
| HDA Stable (htmx 2.x) | http://localhost:8080 |
| SPA (React) | http://localhost:8081 |
| HDA Beta (htmx 4.x WS) | http://localhost:8082 |
| HDA SSE (htmx 4.x SSE) | http://localhost:8083 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| cAdvisor | http://localhost:8084 |
| Backend API | http://localhost:3000 |

All four apps should show the same stock prices updating live at 4 Hz. This is the fairness baseline.

---

## Measurement scripts

### Full pipeline (load tests + CDP + cloc)

```bash
cd measurement && npm install && cd ..   # once
bash scripts/run-measurements.sh
```

Runs sequentially: k6 load test for each transport → CDP client-side measurements → cloc. Takes ~35 minutes. Results in `thesis-data/run-YYYYMMDD-HHMMSS/`.

### CDP only (client-side metrics)

```bash
bash scripts/run-cdp.sh
# Custom duration:
CDP_DURATION_SECONDS=120 bash scripts/run-cdp.sh
```

Measures FPS, JS heap, DOM nodes, script time, layout ops for all 4 apps. Results in `thesis-data/cdp-YYYYMMDD-HHMMSS/`.

### Stress test (find breaking point)

```bash
bash scripts/run-stress.sh
```

Ramps all 4 transports from 50 → 100 → 200 → 500 → 1000 VUs in 90-second hold stages. Measures at what VU count message delivery degrades beyond 2× the tick interval. Takes ~1 hour total. Results in `thesis-data/stress-YYYYMMDD-HHMMSS/`.

Run a single transport:
```bash
k6 run --env TARGET=spa load-tests/k6/stress-test.js
# Targets: hda-stable | spa | hda-beta | hda-sse
```

### k6 load tests only

```bash
k6 run load-tests/k6/ws-hda-stable-load.js
k6 run load-tests/k6/ws-spa-load.js
k6 run load-tests/k6/ws-hda-beta-load.js
k6 run load-tests/k6/sse-hda-load.js
```

Each runs: ramp-up (30s) → steady 50 VUs (5m) → spike 200 VUs (45s) → ramp-down.

---

## Output files

`thesis-data/run-YYYYMMDD-HHMMSS/`:

| File | Contents |
|---|---|
| `k6-hda-stable.json/log` | k6 metrics for HDA Stable WS |
| `k6-spa.json/log` | k6 metrics for SPA WS |
| `k6-hda-beta.json/log` | k6 metrics for HDA Beta WS |
| `k6-hda-sse.json/log` | k6 metrics for HDA SSE |
| `cdp-results.json/csv/md` | CDP measurements — all 4 apps |
| `cloc-report.csv` | Per-file line counts |
| `cloc-summary.txt` | Aggregate LOC by language |
| `summary.md` | Combined report |

---

## Project layout

```
hypermedia/
│
├── backend/src/
│   ├── server.ts               Express + WebSocket entrypoint
│   ├── ticker-engine.ts        Stock price simulation (geometric Brownian motion)
│   ├── ws-router.ts            Routes WS connections by protocol header and path
│   ├── hda-broadcaster.ts      Generic HTML broadcaster (render fn + metric label)
│   ├── spa-broadcaster.ts      JSON broadcaster for SPA clients
│   ├── sse-broadcaster.ts      SSE broadcaster for market stats widget
│   ├── sse-row-broadcaster.ts  SSE broadcaster for row updates (hx-partial)
│   ├── html-renderer.ts        renderRowV2 (htmx 2.x OOB), renderRowV4 (hx-partial)
│   ├── metrics.ts              Prometheus counters/histograms (prom-client)
│   └── types.ts
│
├── app-hda-stable/public/      htmx 2.x — ws-connect via /ws/v2, hx-swap-oob
├── app-spa/src/                React 18 — WebSocket JSON, useTickerStore hook
├── app-hda/public/             htmx 4.x WS — hx-ws:connect via /ws/v4, hx-partial
├── app-hda-sse/public/         htmx 4.x SSE — hx-sse:connect /api/sse/rows, hx-partial
│
├── observability/
│   ├── prometheus/prometheus.yml
│   └── grafana/dashboards/hda-vs-spa.json   8-panel dashboard, all 4 client types
│
├── load-tests/k6/
│   ├── ws-hda-stable-load.js   Steady + spike load test for HDA Stable
│   ├── ws-spa-load.js          Steady + spike load test for SPA
│   ├── ws-hda-beta-load.js     Steady + spike load test for HDA Beta
│   ├── sse-hda-load.js         Steady + spike load test for HDA SSE
│   └── stress-test.js          Progressive ramp to 1000 VUs, all transports
│
├── measurement/cdp/
│   ├── runner.ts               Measures all 4 apps sequentially via Puppeteer
│   └── utils/
│       ├── fps-collector.ts    requestAnimationFrame → FPS mean/p50/p95
│       ├── heap-collector.ts   JS heap used, DOM node count
│       ├── paint-collector.ts  Script time, task time, layout ops, style recalcs
│       └── report.ts           JSON, CSV, Markdown output
│
├── scripts/
│   ├── run-measurements.sh     Full pipeline: k6 → CDP → cloc → report
│   ├── run-cdp.sh              CDP measurements only
│   ├── run-stress.sh           Stress test all 4 transports to 1000 VUs
│   └── generate-report.sh      Aggregates results into summary.md
│
└── docker-compose.yml          8-service stack (4 apps + backend + Prometheus + Grafana + cAdvisor)
```

---

## How the backend works

The backend is the fixed point of the experiment. All four apps receive data from the same engine instance at the same wall-clock time.

### Ticker engine

Simulates 50 stocks (configurable via `STOCK_COUNT`) updating every 250 ms (`UPDATE_INTERVAL_MS`). Price movement uses geometric Brownian motion:

```
newPrice = prevPrice × exp((drift − 0.5σ²)Δt + σ√Δt × Z)
```

On each tick, all broadcasters are called simultaneously so every app receives its message in the same event loop iteration.

### WebSocket routing

Path and subprotocol determine the broadcaster:

| Path | Subprotocol | Broadcaster | Payload |
|---|---|---|---|
| `/ws/v2` | — | HdaBroadcaster (renderRowV2) | HTML, `hx-swap-oob` |
| `/ws/v4` | — | HdaBroadcaster (renderRowV4) | HTML, `<hx-partial>` |
| `/ws` | `spa-ticker` | SpaBroadcaster | JSON |
| `/api/sse/rows` | — | SseRowBroadcaster | SSE, `<hx-partial>` |

Protocol-based routing takes priority over path so the SPA's `spa-ticker` subprotocol is matched before the `/ws` path.

### Fairness constraints

- **One frame per tick** — all broadcasters send exactly one frame per engine tick.
- **Same starting state** — all apps call `GET /api/snapshot` on load.
- **Same DOM structure** — all four apps render the same `<table><thead><tbody><tr><td>` structure with the same CSS class names.
- **Same CSS** — all four `style.css` files are identical.

---

## Metrics

### Server-side (Prometheus, scraped every 5s)

| Metric | Type | Labels | What it measures |
|---|---|---|---|
| `ticker_ws_connections_total` | Gauge | `client_type` | Live WS connections |
| `ticker_sse_connections_total` | Gauge | `client_type` | Live SSE connections |
| `ticker_messages_sent_total` | Counter | `client_type` | Total frames sent |
| `ticker_message_bytes_total` | Counter | `client_type` | Total bytes sent |
| `ticker_message_size_bytes` | Histogram | `client_type` | Per-frame size (p50/p95) |
| `ticker_encode_duration_ms` | Histogram | `client_type` | Render time per tick |
| `ticker_tick_duration_ms` | Histogram | — | Full broadcast cycle time |

### Load test (k6)

| Metric prefix | Transport | What it measures |
|---|---|---|
| `hda_stable_` | WS | HDA Stable connection and message metrics |
| `spa_` | WS | SPA connection and message metrics |
| `hda_beta_` | WS | HDA Beta connection and message metrics |
| `sse_` | SSE | SSE connection, TTFB, bytes received |

Common suffixes: `_time_to_first_msg_ms`, `_msg_interval_ms`, `_msg_bytes_received`, `_total_messages_received`.

Stress test adds `_conn_failed` rate and `_msg_bytes` per target.

### Client-side (CDP via Puppeteer)

| Metric | What it measures |
|---|---|
| FPS mean / p95 | Rendering smoothness during live updates |
| JS heap used MB | Runtime memory at T=0, steady-state, final |
| DOM node count | Total elements in the document |
| Layout count / duration | Reflow operations triggered |
| Style recalc count | CSS recalculations |
| Script duration (ms) | Total main-thread V8 execution time — key HDA vs SPA metric |
| Task duration (ms) | Total main-thread task time including rendering pipeline |

---

## Grafana dashboard

Open http://localhost:3001 — loads automatically, no login.

| Panel | What to look for |
|---|---|
| WS / SSE Connections | All four variants connected |
| Messages/sec | All four at ~4/s per client |
| Network Throughput | SPA lowest; HDA Beta highest |
| Message Size p50/p95 | JSON ~4.7 KB vs HTML 11–14 KB |
| Encode Latency p95 | HTML rendering cost vs JSON.stringify |
| Full Tick Duration p95 | End-to-end broadcast cycle |
| Container CPU | Backend dominates; nginx containers minimal |
| Container Memory | React/htmx runtime size differences |

---

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `STOCK_COUNT` | `50` | Stocks simulated |
| `UPDATE_INTERVAL_MS` | `250` | Tick frequency (4 Hz) |
| `VOLATILITY` | `0.008` | Price movement magnitude |
| `DRIFT` | `0.0001` | Long-term price trend |
| `CDP_DURATION_SECONDS` | `60` | CDP measurement window per app |

Higher-frequency test:
```bash
UPDATE_INTERVAL_MS=100 docker compose up -d --build
```
