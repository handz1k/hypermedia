# HDA vs SPA — Stock ticker

Empirical comparison of **Hypermedia-Driven Applications (HDA)** and **Single-Page Applications (SPA)** for real-time web development. Both apps display a live stock ticker fed by the same backend over WebSockets. The only variable is what travels over the wire and who renders the UI.

| | App A — HDA | App B — SPA |
|---|---|---|
| Framework | HTMX | Svelte |
| WS payload | HTML snippets | JSON |
| Rendering | Server (Node.js) | Client (browser) |
| JS shipped | ~60 lines custom + htmx.min.js | Compiled Svelte bundle |
| Port | `8080` | `8081` |

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Docker + Docker Compose | v24+ | Run all services |
| k6 | v0.51+ | WebSocket load tests |
| Node.js | v22+ | CDP measurement scripts |
| cloc | any | Lines-of-code count |

Install on macOS:
```bash
brew install k6 cloc node
```

---

## Quickstart — Just run the apps

```bash
# 1. Copy and optionally edit environment variables
cp .env.example .env

# 2. Build images and start all services
./scripts/start-all.sh
```

| Service | URL | What it is |
|---|---|---|
| HDA app | http://localhost:8080 | HTMX stock ticker |
| SPA app | http://localhost:8081 | Svelte stock ticker |
| Grafana | http://localhost:3001 | Live metrics dashboard (no login) |
| Prometheus | http://localhost:9090 | Raw metrics explorer |
| cAdvisor | http://localhost:8082 | Container CPU/memory |
| Backend API | http://localhost:3000 | REST + WebSocket server |

Open both apps side by side. They should look identical and update in sync — this is the fairness baseline for the experiment.

---

## Quickstart — Full measurement run

This runs the complete pipeline: load tests, client-side CDP measurements, cloc, and a summary report.

```bash
# Install CDP measurement dependencies once
cd measurement && npm install && cd ..

# Run everything — takes ~15 minutes
./scripts/run-measurements.sh
```

Results are written to `thesis-data/run-YYYYMMDD-HHMMSS/`:

| File | Contents |
|---|---|
| `k6-hda.json` | Raw k6 metrics for the HDA WebSocket load test |
| `k6-spa.json` | Raw k6 metrics for the SPA WebSocket load test |
| `k6-hda.log` | k6 terminal output (pass/fail thresholds) |
| `k6-spa.log` | k6 terminal output (pass/fail thresholds) |
| `cdp-results.json` | Full structured CDP results for both apps |
| `cdp-results.csv` | Flat CSV — easy to import into Excel / R / Python |
| `cdp-results.md` | Markdown comparison table |
| `cloc-report.csv` | Per-file line counts |
| `cloc-summary.txt` | Aggregate LOC by language |
| `summary.md` | Combined report: k6 + CDP + cloc |

Run the pipeline three times on different days and average the results for thesis-grade repeatability.

---

## Running individual measurement tools

### Load tests only (k6)

```bash
# HDA
k6 run --out json=load-tests/k6/results/hda.json load-tests/k6/ws-hda-load.js

# SPA
k6 run --out json=load-tests/k6/results/spa.json load-tests/k6/ws-spa-load.js
```

Each script runs four scenarios in sequence: ramp-up → 5-min steady state → spike (200 VUs) → ramp-down. Both scripts are structurally identical so the load profile is the same.

### Client-side measurements only (CDP)

```bash
cd measurement
npm run measure          # measures both apps, writes to measurement/results/
npm run measure:hda      # HDA only
npm run measure:spa      # SPA only
```

Requires the Docker stack to be running (`./scripts/start-all.sh`).

### Code complexity only (cloc)

```bash
cloc --exclude-list-file=cloc/.clocignore --by-file backend/src app-hda/public app-spa/src
```

---

## Project layout

```
hypermedia/
│
├── backend/                    Shared Node.js/TypeScript server
│   └── src/
│       ├── server.ts           Express HTTP + WebSocket server entrypoint
│       ├── ticker-engine.ts    Stock price simulation (geometric Brownian motion)
│       ├── ws-router.ts        Routes WS connections by subprotocol header
│       ├── hda-broadcaster.ts  Renders HTML snippets, fans out to HDA clients
│       ├── spa-broadcaster.ts  Serialises JSON, fans out to SPA clients
│       ├── html-renderer.ts    Pure-function HTML template (no template engine)
│       ├── metrics.ts          Prometheus counters/histograms (prom-client)
│       └── types.ts            Shared TypeScript types
│
├── app-hda/                    App A: HTMX hypermedia app
│   ├── public/
│   │   ├── index.html          Static shell — table skeleton, hidden OOB sink
│   │   ├── ws-connect.js       ~60-line WS adapter — the only custom JS
│   │   └── style.css           Identical to app-spa/public/style.css
│   ├── nginx.conf              Proxies /ws and /api to backend
│   └── Dockerfile
│
├── app-spa/                    App B: Svelte SPA
│   ├── src/
│   │   ├── App.svelte          Root component, manages WS lifecycle
│   │   ├── lib/
│   │   │   ├── StockTable.svelte  Renders sorted table from store
│   │   │   ├── StockRow.svelte    Single row, reactive to store updates
│   │   │   └── ws-store.ts        Svelte writable store + WS connection
│   │   └── types.ts
│   ├── nginx.conf
│   └── Dockerfile
│
├── observability/
│   ├── prometheus/
│   │   └── prometheus.yml      Scrape configs (backend :9091, cAdvisor :8080)
│   └── grafana/
│       ├── provisioning/       Auto-wires Prometheus datasource + dashboard
│       └── dashboards/
│           └── hda-vs-spa.json Pre-built 8-panel dashboard
│
├── load-tests/k6/
│   ├── ws-hda-load.js          k6 script: ramp/steady/spike against HDA endpoint
│   └── ws-spa-load.js          k6 script: identical scenarios against SPA endpoint
│
├── measurement/cdp/
│   ├── runner.ts               Orchestrates both apps sequentially, writes results
│   └── utils/
│       ├── fps-collector.ts    requestAnimationFrame timing → FPS mean/p50/p95
│       ├── heap-collector.ts   page.metrics() → JS heap used/total, DOM node count
│       ├── paint-collector.ts  Chrome Performance metrics → layout ops, style recalcs, script time
│       └── report.ts           Writes JSON, CSV, and Markdown from results
│
├── scripts/
│   ├── start-all.sh            docker compose up + health check
│   ├── run-measurements.sh     Full pipeline: load tests → CDP → cloc → report
│   └── generate-report.sh      Aggregates result files into summary.md
│
├── cloc/.clocignore            Excludes node_modules, dist, minified files
├── docker-compose.yml          6-service stack
└── .env.example                All tunable parameters with defaults
```

---

## How the backend works

The backend is the fixed point of the experiment. Both apps receive data from the same engine instance at the same wall-clock time.

### Ticker engine

Simulates 50 stocks (configurable via `STOCK_COUNT`) updating every 250 ms (configurable via `UPDATE_INTERVAL_MS`). Price movement uses geometric Brownian motion:

```
newPrice = prevPrice × exp((drift − 0.5σ²)Δt + σ√Δt × Z)
```

where Z is a standard-normal random variable. This produces realistic-looking price series with configurable volatility (`VOLATILITY`) and drift (`DRIFT`).

On each tick the engine emits a `tick` event with an array of all updated stocks. Both broadcasters subscribe to this event independently.

### WebSocket routing

Client type is determined at the WebSocket handshake by the `Sec-WebSocket-Protocol` header — no separate URLs needed:

- `hda-ticker` → HDA broadcaster → HTML snippets
- `spa-ticker` → SPA broadcaster → JSON

### What travels over the wire

**HDA — one frame per tick, all changed rows concatenated:**
```html
<tr id="row-AAPL" hx-swap-oob="true">
  <td class="symbol">AAPL</td>
  <td class="price up">182.34</td>
  <td class="change up">+0.23%</td>
  <td class="volume">1,204,321</td>
</tr>
<tr id="row-MSFT" hx-swap-oob="true">...
```

HTMX reads `hx-swap-oob="true"` and replaces the matching `id` in the DOM with no JavaScript logic needed in the app.

**SPA — one frame per tick, all stocks as a JSON array:**
```json
{
  "ts": 1711700000000,
  "ticks": [
    { "symbol": "AAPL", "price": 182.34, "prev": 181.92, "change": 0.0023, "volume": 1204321 },
    ...
  ]
}
```

The Svelte store updates the reactive `Map<symbol, StockState>` and Svelte re-renders only the changed rows.

### Fairness constraints

These are enforced in code, not just documented:

- **One frame per tick** — both broadcasters send exactly one WS frame per engine tick regardless of how many stocks changed.
- **Same starting state** — both apps call `GET /api/snapshot` before opening their WebSocket. A `tickLock` flag prevents a tick from firing mid-snapshot.
- **Same DOM structure** — the Svelte table renders the same `<table><thead><tbody><tr><td>` structure as the server-side HTML renderer. Same number of elements, same CSS class names.
- **Same CSS** — `app-hda/public/style.css` and `app-spa/public/style.css` are identical files.

---

## Metrics collected

### Server-side (Prometheus — scraped every 5s)

| Metric | Type | Labels | What it measures |
|---|---|---|---|
| `ticker_ws_connections_total` | Gauge | `client_type` | Live connection count per app |
| `ticker_messages_sent_total` | Counter | `client_type` | Total frames sent |
| `ticker_message_bytes_total` | Counter | `client_type` | Total bytes sent — captures HTML vs JSON payload size difference |
| `ticker_message_size_bytes` | Histogram | `client_type` | Per-frame size distribution (p50/p95/p99) |
| `ticker_encode_duration_ms` | Histogram | `client_type` | Time to render HTML vs `JSON.stringify` |
| `ticker_tick_duration_ms` | Histogram | — | Full broadcast cycle time |
| `container_cpu_usage_seconds_total` | Counter | container name | Per-container CPU via cAdvisor |
| `container_memory_usage_bytes` | Gauge | container name | Per-container memory via cAdvisor |

### Load test (k6)

| Metric | What it measures |
|---|---|
| `hda_time_to_first_msg_ms` | Latency from WS open to first received frame |
| `hda_msg_interval_ms` | Inter-frame interval jitter (expected ~250ms) |
| `hda_msg_bytes_received` | Per-frame byte size as seen by the client |
| `ws_connecting` | WS handshake duration |

SPA metrics are identical with `spa_` prefix. Thresholds: time-to-first-msg p95 < 500ms, jitter p95 < 3× tick interval.

### Client-side (Chrome DevTools Protocol via Puppeteer)

| Metric | What it measures |
|---|---|
| FPS mean / p50 / p95 | Rendering smoothness during live updates |
| JS heap used (MB) | Memory consumed by the page at T=0, steady-state, final |
| DOM node count | Total elements in the document |
| Layout count | Number of reflow operations triggered during the window |
| Style recalc count | Number of CSS recalculations (lower expected for HDA — styles pre-applied server-side) |
| Script duration (ms) | Total main-thread JS execution time |
| Task duration (ms) | Total main-thread task time |

---

## Grafana dashboard

Open http://localhost:3001 — the dashboard loads automatically with no login required.

Eight panels, all showing HDA and SPA side by side:

1. **WS Connections** — live gauge of connected clients per app
2. **Messages/sec** — broadcast throughput rate
3. **Network Throughput (bytes/sec)** — bandwidth: HTML consistently larger than JSON
4. **Message Size Distribution** — p50/p95 histograms — the core payload comparison
5. **Encode Latency p95** — server cost of HTML rendering vs `JSON.stringify`
6. **Full Tick Duration p95** — end-to-end broadcast cycle
7. **Container CPU** — backend vs HDA nginx vs SPA nginx
8. **Container Memory** — per-container RSS

---

## Configuration

All parameters are in `.env` (copy from `.env.example`):

| Variable | Default | Effect |
|---|---|---|
| `STOCK_COUNT` | `50` | Number of stocks simulated |
| `UPDATE_INTERVAL_MS` | `250` | Tick frequency (4 Hz) |
| `VOLATILITY` | `0.02` | Price movement magnitude |
| `DRIFT` | `0.0001` | Long-term price trend |
| `CDP_DURATION_SECONDS` | `60` | CDP measurement window per app |

To run a higher-frequency test (e.g. 10 Hz):
```bash
UPDATE_INTERVAL_MS=100 docker compose up -d --build
```

---

## Measurement protocol

1. Run `./scripts/run-measurements.sh` three times on different days (different Docker daemon state, different thermal conditions).
2. Average the numeric results across runs.
3. Use the Grafana dashboard during load tests to visually verify the Prometheus series look stable before trusting the k6 output.
4. For the cloc comparison, count only `backend/src`, `app-hda/public`, and `app-spa/src` — exclude the shared observability and measurement scaffolding, which is not part of either application.
