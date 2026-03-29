import WebSocket from 'ws';
import { StockTick, TickPayload } from './types.js';
import { wsConnections, messagesSent, bytesTotal, messageSizeBytes, encodeDurationMs } from './metrics.js';

export class SpaBroadcaster {
  private clients: Set<WebSocket> = new Set();

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    wsConnections.labels('spa').set(this.clients.size);

    ws.on('close', () => {
      this.clients.delete(ws);
      wsConnections.labels('spa').set(this.clients.size);
    });
    ws.on('error', () => {
      this.clients.delete(ws);
      wsConnections.labels('spa').set(this.clients.size);
    });
  }

  broadcast(ticks: StockTick[]): void {
    if (this.clients.size === 0) return;

    const t0 = performance.now();
    const payload: TickPayload = { ts: Date.now(), ticks };
    const json = JSON.stringify(payload);
    const elapsed = performance.now() - t0;
    encodeDurationMs.labels('spa').observe(elapsed);

    const byteLen = Buffer.byteLength(json, 'utf8');
    messageSizeBytes.labels('spa').observe(byteLen);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
        messagesSent.labels('spa').inc();
        bytesTotal.labels('spa').inc(byteLen);
      }
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }
}
