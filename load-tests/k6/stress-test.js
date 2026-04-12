/**
 * Stress test — find the breaking point for all 4 transports.
 *
 * Ramps VUs in stages: 50 → 100 → 200 → 500 → 1000
 * At each stage, measures whether the server keeps up with the 250ms tick.
 * "Breaking" = msg_interval p95 exceeds 2× target (500ms), or connections fail.
 *
 * Run a single transport at a time via TARGET env var:
 *   k6 run --env TARGET=hda-stable stress-test.js
 *   k6 run --env TARGET=hda-beta   stress-test.js
 *   k6 run --env TARGET=spa        stress-test.js
 *   k6 run --env TARGET=hda-sse    stress-test.js
 *
 * Or run all via scripts/run-stress.sh
 */
import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ── Per-target config ──────────────────────────────────────────────────────
const TARGETS = {
  'hda-stable': {
    protocol: 'ws',
    url: __ENV.HDA_STABLE_URL || 'ws://localhost:3000/ws/v2',
    subprotocol: '',
  },
  'hda-beta': {
    protocol: 'ws',
    url: __ENV.HDA_BETA_URL   || 'ws://localhost:3000/ws/v4',
    subprotocol: '',
  },
  'spa': {
    protocol: 'ws',
    url: __ENV.SPA_URL        || 'ws://localhost:3000/ws',
    subprotocol: 'spa-ticker',
  },
  'hda-sse': {
    protocol: 'sse',
    url: __ENV.HDA_SSE_URL    || 'http://localhost:8083/api/sse/rows',
    subprotocol: '',
  },
};

const TARGET_NAME   = __ENV.TARGET || 'hda-stable';
const cfg           = TARGETS[TARGET_NAME];
if (!cfg) throw new Error(`Unknown TARGET: ${TARGET_NAME}`);
const METRIC_PREFIX = TARGET_NAME.replace(/-/g, '_');

const UPDATE_INTERVAL_MS = parseInt(__ENV.UPDATE_INTERVAL_MS || '250', 10);

// ── Metrics ────────────────────────────────────────────────────────────────
const msgInterval  = new Trend(`${METRIC_PREFIX}_msg_interval_ms`,      true);
const timeToFirst  = new Trend(`${METRIC_PREFIX}_time_to_first_msg_ms`, true);
const msgBytes     = new Trend(`${METRIC_PREFIX}_msg_bytes`,             false);
const totalMsgs    = new Counter(`${METRIC_PREFIX}_total_messages`);
const connFailed   = new Rate(`${METRIC_PREFIX}_conn_failed`);

// ── Scenario: progressive stages, 90s hold per VU ─────────────────────────
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50   },   // baseline
        { duration: '90s', target: 50   },   // hold — gather clean data
        { duration: '30s', target: 100  },
        { duration: '90s', target: 100  },
        { duration: '30s', target: 200  },
        { duration: '90s', target: 200  },
        { duration: '30s', target: 500  },
        { duration: '90s', target: 500  },
        { duration: '30s', target: 1000 },
        { duration: '90s', target: 1000 },
        { duration: '60s', target: 0    },   // ramp down
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // Flag, but don't abort — we want to capture degradation not stop early
    [`${METRIC_PREFIX}_conn_failed`]:           ['rate<0.10'],   // <10% conn failures
    [`${METRIC_PREFIX}_msg_interval_ms`]:       ['p(95)<' + (UPDATE_INTERVAL_MS * 4)],
    [`${METRIC_PREFIX}_time_to_first_msg_ms`]:  ['p(95)<2000'],
  },
};

// ── VU logic ───────────────────────────────────────────────────────────────
export default function () {
  if (cfg.protocol === 'ws') {
    runWs();
  } else {
    runSse();
  }
}

function runWs() {
  const params = cfg.subprotocol
    ? { headers: { 'Sec-WebSocket-Protocol': cfg.subprotocol } }
    : {};

  const res = ws.connect(cfg.url, params, function (socket) {
    let connectedAt = Date.now();
    let firstMsgAt  = null;
    let lastMsgAt   = null;

    socket.on('open', () => { connectedAt = Date.now(); });

    socket.on('message', (data) => {
      const now = Date.now();
      msgBytes.add(data.length);
      totalMsgs.add(1);

      if (firstMsgAt === null) {
        firstMsgAt = now;
        timeToFirst.add(now - connectedAt);
      } else {
        msgInterval.add(now - lastMsgAt);
      }
      lastMsgAt = now;
    });

    socket.on('error', (e) => console.error(`[${TARGET_NAME}] WS error:`, e));
    socket.setTimeout(() => socket.close(), 25000);
  });

  const ok = res && res.status === 101;
  connFailed.add(!ok);
  check(res, { 'WS connected (101)': (r) => r && r.status === 101 });

  sleep(1);
}

function runSse() {
  const res = http.get(cfg.url, {
    headers: { 'Accept': 'text/event-stream', 'Cache-Control': 'no-cache' },
    timeout: '27s',
    responseCallback: http.expectedStatuses(200),
  });

  const ok = res.status === 200;
  connFailed.add(!ok);
  check(res, {
    'SSE connected (200)': (r) => r.status === 200,
    'content-type event-stream': (r) =>
      (r.headers['Content-Type'] || '').includes('text/event-stream'),
  });

  if (ok && res.body) {
    const events = (res.body.toString().match(/^data:/gm) || []).length;
    if (events > 0) {
      timeToFirst.add(res.timings.waiting);
      totalMsgs.add(events);
      msgBytes.add(res.body.length);
    }
  }

  sleep(1);
}
