/**
 * k6 load test — HDA Beta (htmx 4.0.0-beta1 WS extension)
 * WebSocket via /ws, no subprotocol (hx-ws:connect default)
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter, Gauge } from 'k6/metrics';

const timeToFirstMsg = new Trend('hda_beta_time_to_first_msg_ms', true);
const msgIntervalMs  = new Trend('hda_beta_msg_interval_ms',       true);
const msgBytesRecv   = new Trend('hda_beta_msg_bytes_received',    false);
const totalMsgsRecv  = new Counter('hda_beta_total_messages_received');
const activeConns    = new Gauge('hda_beta_active_connections');

const TARGET_URL         = __ENV.HDA_BETA_WS_URL    || 'ws://localhost:3000/ws/v4';
const UPDATE_INTERVAL_MS = parseInt(__ENV.UPDATE_INTERVAL_MS || '250', 10);

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [{ duration: '30s', target: 50 }],
      gracefulRampDown: '10s',
    },
    steady: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '30s',
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
      gracefulRampDown: '10s',
    },
    ramp_down: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [{ duration: '30s', target: 0 }],
      startTime: '7m',
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'hda_beta_time_to_first_msg_ms': ['p(95)<500'],
    'hda_beta_msg_interval_ms':      ['p(95)<' + (UPDATE_INTERVAL_MS * 3)],
    'ws_connecting':                 ['p(95)<100'],
  },
};

export default function () {
  const res = ws.connect(TARGET_URL, {}, function (socket) {
    activeConns.add(1);

    let connectedAt = Date.now();
    let firstMsgAt  = null;
    let lastMsgAt   = null;

    socket.on('open',    () => { connectedAt = Date.now(); });

    socket.on('message', (data) => {
      const now = Date.now();
      msgBytesRecv.add(data.length);
      totalMsgsRecv.add(1);

      if (firstMsgAt === null) {
        firstMsgAt = now;
        timeToFirstMsg.add(now - connectedAt);
      } else {
        msgIntervalMs.add(now - lastMsgAt);
      }
      lastMsgAt = now;
    });

    socket.on('error', (e) => console.error('WS error:', e));
    socket.setTimeout(() => socket.close(), 60000);
  });

  check(res, { 'WS connected (101)': (r) => r && r.status === 101 });
  activeConns.add(-1);
}
