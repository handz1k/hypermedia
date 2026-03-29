import { writable } from 'svelte/store';
import type { StockState, TickPayload, SnapshotPayload } from '../types.js';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export const stockStore = writable<Map<string, StockState>>(new Map());
export const statusStore = writable<ConnectionStatus>('connecting');

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 1000;

export function connect(wsUrl: string, snapshotUrl: string): () => void {
  let ws: WebSocket | null = null;
  let retries = 0;
  let stopped = false;

  async function loadSnapshot(): Promise<void> {
    try {
      const res = await fetch(snapshotUrl);
      const data: SnapshotPayload = await res.json();
      const map = new Map<string, StockState>();
      data.stocks.forEach(s => map.set(s.symbol, s));
      stockStore.set(map);
    } catch (e) {
      console.warn('Snapshot fetch failed, store will populate on first tick', e);
    }
  }

  function openWs(): void {
    if (stopped) return;
    statusStore.set('connecting');
    ws = new WebSocket(wsUrl, 'spa-ticker');

    ws.addEventListener('open', () => {
      retries = 0;
      statusStore.set('connected');
    });

    ws.addEventListener('message', ({ data }) => {
      const payload: TickPayload = JSON.parse(data as string);
      stockStore.update(map => {
        payload.ticks.forEach(t => map.set(t.symbol, t));
        return map;
      });
    });

    ws.addEventListener('close', () => {
      statusStore.set('disconnected');
      if (!stopped && retries < MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, retries);
        retries++;
        setTimeout(openWs, delay);
      }
    });

    ws.addEventListener('error', () => ws?.close());
  }

  loadSnapshot().then(() => openWs());

  return () => {
    stopped = true;
    ws?.close();
  };
}
