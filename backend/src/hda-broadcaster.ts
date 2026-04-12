import WebSocket from 'ws';
import { StockTick } from './types.js';
// Removed: import { renderRow } from './html-renderer.js'; 
import { wsConnections, messagesSent, bytesTotal, messageSizeBytes, encodeDurationMs } from './metrics.js';

export class HdaBroadcaster {
  private clients: Set<WebSocket> = new Set();

  // Accept the render function and metric label dynamically
  constructor(
    private renderFn: (tick: StockTick) => string,
    private metricLabel: string
  ) {}

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    wsConnections.labels(this.metricLabel).set(this.clients.size);

    ws.on('close', () => {
      this.clients.delete(ws);
      wsConnections.labels(this.metricLabel).set(this.clients.size);
    });
    ws.on('error', () => {
      this.clients.delete(ws);
      wsConnections.labels(this.metricLabel).set(this.clients.size);
    });
  }

  broadcast(ticks: StockTick[]): void {
    if (this.clients.size === 0) return;

    const t0 = performance.now();
    // Use the specific render function for this instance
    const html = ticks.map(this.renderFn).join('');
    const elapsed = performance.now() - t0;
    encodeDurationMs.labels(this.metricLabel).observe(elapsed);

    const payload = Buffer.from(html, 'utf8');
    const byteLen = payload.byteLength;
    messageSizeBytes.labels(this.metricLabel).observe(byteLen);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(html);
        messagesSent.labels(this.metricLabel).inc();
        bytesTotal.labels(this.metricLabel).inc(byteLen);
      }
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }
}