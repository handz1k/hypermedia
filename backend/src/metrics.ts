import * as promClient from 'prom-client';

promClient.collectDefaultMetrics({ prefix: 'ticker_node_' });

export const wsConnections = new promClient.Gauge({
  name: 'ticker_ws_connections_total',
  help: 'Current live WebSocket connections',
  labelNames: ['client_type'] as const,
});

export const messagesSent = new promClient.Counter({
  name: 'ticker_messages_sent_total',
  help: 'Total WebSocket messages sent',
  labelNames: ['client_type'] as const,
});

export const bytesTotal = new promClient.Counter({
  name: 'ticker_message_bytes_total',
  help: 'Total bytes sent over WebSocket',
  labelNames: ['client_type'] as const,
});

export const messageSizeBytes = new promClient.Histogram({
  name: 'ticker_message_size_bytes',
  help: 'Per-message byte size distribution',
  labelNames: ['client_type'] as const,
  buckets: [512, 1024, 2048, 4096, 8192, 16384, 32768, 65536],
});

export const tickDurationMs = new promClient.Histogram({
  name: 'ticker_tick_duration_ms',
  help: 'Time to compute and broadcast one full engine tick (ms)',
  buckets: [1, 2, 5, 10, 20, 50, 100, 200],
});

export const encodeDurationMs = new promClient.Histogram({
  name: 'ticker_encode_duration_ms',
  help: 'Time to encode payload per client type (ms)',
  labelNames: ['client_type'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50],
});

export const registry = promClient.register;
