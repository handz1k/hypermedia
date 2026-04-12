import { Response } from 'express';
import { StockTick } from './types.js';
import { sseConnections, messagesSent, bytesTotal, messageSizeBytes, encodeDurationMs } from './metrics.js';

function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class SseBroadcaster {
  private clients: Set<Response> = new Set();
  private tickCount = 0;

  addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    this.clients.add(res);
    sseConnections.labels('sse-stats').set(this.clients.size);

    res.on('close', () => {
      this.clients.delete(res);
      sseConnections.labels('sse-stats').set(this.clients.size);
    });
  }

  broadcast(ticks: StockTick[]): void {
    if (this.clients.size === 0) return;

    this.tickCount++;

    const t0 = performance.now();
    const html = this.renderStats(ticks);
    encodeDurationMs.labels('sse-stats').observe(performance.now() - t0);

    // SSE unnamed data event — htmx SSE extension swaps this into the target
    const event = `data: ${html}\n\n`;
    const payload = Buffer.from(event, 'utf8');
    const byteLen = payload.byteLength;
    messageSizeBytes.labels('sse-stats').observe(byteLen);

    for (const res of this.clients) {
      try {
        res.write(event);
        messagesSent.labels('sse-stats').inc();
        bytesTotal.labels('sse-stats').inc(byteLen);
      } catch {
        this.clients.delete(res);
        sseConnections.labels('sse-stats').set(this.clients.size);
      }
    }
  }

  private renderStats(ticks: StockTick[]): string {
    let up = 0;
    let down = 0;
    for (const t of ticks) {
      if (t.change >= 0) up++; else down++;
    }
    const upPct = ticks.length > 0 ? Math.round((up / ticks.length) * 100) : 0;
    return (
      `<span class="stat">` +
        `<span class="stat-label">↑</span>` +
        `<span class="up">${esc(up)}</span>` +
      `</span>` +
      `<span class="sep">·</span>` +
      `<span class="stat">` +
        `<span class="stat-label">↓</span>` +
        `<span class="down">${esc(down)}</span>` +
      `</span>` +
      `<span class="sep">·</span>` +
      `<span class="stat">` +
        `<span class="stat-label">Breadth</span>` +
        `<span class="${upPct >= 50 ? 'up' : 'down'}">${esc(upPct)}%</span>` +
      `</span>` +
      `<span class="sep">·</span>` +
      `<span class="stat">` +
        `<span class="stat-label">Tick</span>` +
        `<span>${esc(this.tickCount)}</span>` +
      `</span>`
    );
  }
}
