import { EventEmitter } from 'events';
import { StockState, StockTick } from './types.js';

const SYMBOLS = [
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK.B','UNH','JNJ',
  'XOM','JPM','V','PG','MA','HD','CVX','MRK','ABBV','PEP',
  'KO','AVGO','COST','MCD','WMT','DIS','BAC','CSCO','ADBE','CRM',
  'NEE','NFLX','TMO','ACN','TXN','ABT','DHR','LIN','VZ','CMCSA',
  'INTC','PM','RTX','WFC','NKE','QCOM','T','BMY','HON','AMGN',
];

function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export class TickerEngine extends EventEmitter {
  private stocks: Map<string, StockState> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickLock = false;

  constructor(
    private stockCount: number = 50,
    private intervalMs: number = 250,
    private volatility: number = 0.02,
    private drift: number = 0.0001,
    private minPrice: number = 10,
    private maxPrice: number = 500,
  ) {
    super();
    this.initStocks();
  }

  private initStocks(): void {
    const count = Math.min(this.stockCount, SYMBOLS.length);
    for (let i = 0; i < count; i++) {
      const symbol = SYMBOLS[i];
      const price = this.minPrice + Math.random() * (this.maxPrice - this.minPrice);
      this.stocks.set(symbol, {
        symbol,
        price,
        prev: price,
        change: 0,
        volume: Math.floor(Math.random() * 10_000_000),
        open: price,
      });
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.tickLock) return;
      this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const ticks: StockTick[] = [];
    for (const state of this.stocks.values()) {
      const z = randn();
      const newPrice = state.price * Math.exp(this.drift + this.volatility * z);
      const newVolume = state.volume + Math.floor(Math.random() * 50_000);
      const tick: StockTick = {
        symbol: state.symbol,
        price: parseFloat(newPrice.toFixed(2)),
        prev: state.price,
        change: (newPrice - state.price) / state.price,
        volume: newVolume,
      };
      state.prev = state.price;
      state.price = tick.price;
      state.change = tick.change;
      state.volume = newVolume;
      ticks.push(tick);
    }
    this.emit('tick', ticks);
  }

  snapshot(): StockState[] {
    this.tickLock = true;
    const result = Array.from(this.stocks.values()).map(s => ({ ...s }));
    this.tickLock = false;
    return result;
  }
}
