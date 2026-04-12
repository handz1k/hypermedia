import { useState, useEffect, useRef } from 'react';
import type { StockState, TickPayload, SnapshotPayload } from '../types.js';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 1000;

export function useTickerStore(wsUrl: string, snapshotUrl: string) {
  const [stocks, setStocks] = useState<Map<string, StockState>>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const stoppedRef = useRef(false);
  const retriesRef = useRef(0);

  useEffect(() => {
    stoppedRef.current = false;
    retriesRef.current = 0;

    async function loadSnapshot(): Promise<void> {
      try {
        const res = await fetch(snapshotUrl);
        const data: SnapshotPayload = await res.json();
        setStocks(new Map(data.stocks.map(s => [s.symbol, s])));
      } catch (e) {
        console.warn('Snapshot fetch failed, will populate on first tick', e);
      }
    }

    function openWs(): void {
      if (stoppedRef.current) return;
      setStatus('connecting');
      const ws = new WebSocket(wsUrl, 'spa-ticker');

      ws.addEventListener('open', () => {
        retriesRef.current = 0;
        setStatus('connected');
      });

      ws.addEventListener('message', ({ data }) => {
        const payload: TickPayload = JSON.parse(data as string);
        setStocks(prev => {
          const next = new Map(prev);
          payload.ticks.forEach(t => next.set(t.symbol, t));
          return next;
        });
      });

      ws.addEventListener('close', () => {
        setStatus('disconnected');
        if (!stoppedRef.current && retriesRef.current < MAX_RETRIES) {
          const delay = BACKOFF_BASE_MS * Math.pow(2, retriesRef.current++);
          setTimeout(openWs, delay);
        }
      });

      ws.addEventListener('error', () => ws.close());
    }

    loadSnapshot().then(() => openWs());

    return () => {
      stoppedRef.current = true;
    };
  }, [wsUrl, snapshotUrl]);

  return { stocks, status };
}
