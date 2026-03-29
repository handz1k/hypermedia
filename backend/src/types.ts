export type ClientType = 'hda' | 'spa';

export interface StockState {
  symbol: string;
  price: number;
  prev: number;
  change: number;   // fractional change: (price - prev) / prev
  volume: number;
  open: number;     // price at start of session, for daily % change
}

export interface StockTick {
  symbol: string;
  price: number;
  prev: number;
  change: number;
  volume: number;
}

export interface SnapshotPayload {
  ts: number;
  stocks: StockState[];
}

export interface TickPayload {
  ts: number;
  ticks: StockTick[];
}
