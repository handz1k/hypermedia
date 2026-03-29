export interface StockState {
  symbol: string;
  price: number;
  prev: number;
  change: number;
  volume: number;
}

export interface TickPayload {
  ts: number;
  ticks: StockState[];
}

export interface SnapshotPayload {
  ts: number;
  stocks: StockState[];
}
