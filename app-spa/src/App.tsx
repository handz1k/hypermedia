import { useMemo } from 'react';
import { useTickerStore } from './lib/useTickerStore.js';
import StockTable from './lib/StockTable.js';

const WS_URL       = 'ws://localhost:3000/ws';
const SNAPSHOT_URL = '/api/snapshot';

export default function App() {
  const { stocks, status } = useTickerStore(WS_URL, SNAPSHOT_URL);

  const statusLabel = status === 'connected'    ? 'Live'
                    : status === 'disconnected' ? 'Disconnected'
                    : 'Connecting…';

  const sortedStocks = useMemo(
    () => Array.from(stocks.values()).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [stocks],
  );

  return (
    <>
      <header>
        <h1>Stock Ticker</h1>
        <span className="badge">SPA · React</span>
        <div id="status">
          <span id="status-dot" className={status}></span>
          <span id="status-text">{statusLabel}</span>
        </div>
      </header>
      <main>
        <StockTable stocks={sortedStocks} />
      </main>
    </>
  );
}
