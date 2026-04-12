import { Response } from 'express';
import { StockTick } from './types.js';
import { renderRowV4 } from './html-renderer.js'; // <-- Changed to V4
import { sseConnections, messagesSent, bytesTotal, messageSizeBytes, encodeDurationMs } from './metrics.js';

export class SseRowBroadcaster {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.clients.add(res);
    sseConnections.labels('sse-rows').set(this.clients.size);

    res.on('close', () => {
      this.clients.delete(res);
      sseConnections.labels('sse-rows').set(this.clients.size);
    });
  }

  broadcast(ticks: StockTick[]): void {
    if (this.clients.size === 0) return;

    const t0 = performance.now();
    
    // 1. Render using HTMX 4 <hx-partial> syntax
    const rawHtml = ticks.map(renderRowV4).join('');
    
    // 2. Strip newlines to prevent SSE framing errors
    const html = rawHtml.replace(/\n/g, '').trim();
    
    encodeDurationMs.labels('sse-rows').observe(performance.now() - t0);

    // 3. Format as unnamed SSE data
    const event = `data: ${html}\n\n`;
    const payload = Buffer.from(event, 'utf8');
    const byteLen = payload.byteLength;
    messageSizeBytes.labels('sse-rows').observe(byteLen);

    for (const res of this.clients) {
      try {
        res.write(event);
        messagesSent.labels('sse-rows').inc();
        bytesTotal.labels('sse-rows').inc(byteLen);
      } catch {
        this.clients.delete(res);
        sseConnections.labels('sse-rows').set(this.clients.size);
      }
    }
  }
}