import WebSocket from 'ws';
import { StockTick } from './types.js';
import { renderRow } from './html-renderer.js';
import { wsConnections, messagesSent, bytesTotal, messageSizeBytes, encodeDurationMs } from './metrics.js';

export class HdaBroadcaster {
  private clients: Set<WebSocket> = new Set();

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    wsConnections.labels('hda').set(this.clients.size);

    ws.on('close', () => {
      this.clients.delete(ws);
      wsConnections.labels('hda').set(this.clients.size);
    });
    ws.on('error', () => {
      this.clients.delete(ws);
      wsConnections.labels('hda').set(this.clients.size);
    });
  }

  broadcast(ticks: StockTick[]): void {
    if (this.clients.size === 0) return;

    const t0 = performance.now();
    const html = ticks.map(renderRow).join('');
    const elapsed = performance.now() - t0;
    encodeDurationMs.labels('hda').observe(elapsed);

    const payload = Buffer.from(html, 'utf8');
    const byteLen = payload.byteLength;
    messageSizeBytes.labels('hda').observe(byteLen);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(html);
        messagesSent.labels('hda').inc();
        bytesTotal.labels('hda').inc(byteLen);
      }
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }
}
