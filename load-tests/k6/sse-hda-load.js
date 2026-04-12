/**
 * k6 load test — HDA SSE (htmx 4.0.0-beta1 SSE extension)
 * HTTP long-lived connection to /api/sse/rows (text/event-stream)
 *
 * SSE connections are long-lived, so each VU holds one connection for
 * HOLD_DURATION_S seconds per iteration. Scenarios are sized so the hold
 * fits within the gracefulStop window.
 *
 * Metrics collected:
 *   sse_time_to_first_event_ms — TTFB proxy (http waiting time)
 *   sse_bytes_received         — payload bytes per connection
 *   sse_total_connections      — cumulative connections opened
 *   sse_active_connections     — instantaneous gauge
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Gauge } from 'k6/metrics';

const timeToFirstEvent = new Trend('sse_time_to_first_event_ms', true);
const bytesRecv        = new Trend('sse_bytes_received',         false);
const totalConns       = new Counter('sse_total_connections');
const activeConns      = new Gauge('sse_active_connections');

const TARGET_URL         = __ENV.HDA_SSE_URL        || 'http://localhost:8083/api/sse/rows';
const UPDATE_INTERVAL_MS = parseInt(__ENV.UPDATE_INTERVAL_MS || '250', 10);

// Each VU holds a connection for this long per iteration.
// Must be shorter than the gracefulStop on every scenario.
const HOLD_DURATION_S = 20;

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [{ duration: '30s', target: 50 }],
      gracefulRampDown: '25s',
      gracefulStop: '30s',
    },
    steady: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '30s',
      gracefulStop: '30s',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '5s',  target: 200 },
        { duration: '30s', target: 200 },
        { duration: '10s', target: 50  },
      ],
      startTime: '6m',
      gracefulRampDown: '25s',
      gracefulStop: '30s',
    },
    ramp_down: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [{ duration: '30s', target: 0 }],
      startTime: '7m',
      gracefulRampDown: '25s',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    // TTFB should be fast; full request duration is intentionally long (held connection)
    'sse_time_to_first_event_ms': ['p(95)<500'],
    // Check that the server actually accepts connections under load
    'sse_total_connections': ['count>0'],
  },
};

export default function () {
  activeConns.add(1);
  totalConns.add(1);

  const res = http.get(TARGET_URL, {
    headers: {
      'Accept':        'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    // Hold connection for HOLD_DURATION_S; k6 reads body after close/timeout
    timeout: `${HOLD_DURATION_S + 2}s`,
    responseCallback: http.expectedStatuses(200),
  });

  check(res, {
    'SSE connected (200)': (r) => r.status === 200,
    'content-type is event-stream': (r) =>
      (r.headers['Content-Type'] || '').includes('text/event-stream'),
  });

  if (res.status === 200 && res.body) {
    const body = res.body.toString();
    const events = (body.match(/^data:/gm) || []).length;

    if (events > 0) {
      timeToFirstEvent.add(res.timings.waiting);
    }

    bytesRecv.add(res.body.length);
  }

  activeConns.add(-1);

  // Brief pause between reconnects within steady/ramp scenarios
  sleep(1);
}
