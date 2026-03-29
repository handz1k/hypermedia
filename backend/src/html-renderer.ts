import { StockState, StockTick } from './types.js';

function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(p: number): string {
  return p.toFixed(2);
}

function formatChange(c: number): string {
  const pct = (c * 100).toFixed(2);
  return (c >= 0 ? '+' : '') + pct + '%';
}

function formatVolume(v: number): string {
  return v.toLocaleString('en-US');
}

export function renderRow(tick: StockTick): string {
  const dir = tick.change >= 0 ? 'up' : 'down';
  return `<tr id="row-${esc(tick.symbol)}" hx-swap-oob="true">` +
    `<td class="symbol">${esc(tick.symbol)}</td>` +
    `<td class="price ${dir}">${esc(formatPrice(tick.price))}</td>` +
    `<td class="change ${dir}">${esc(formatChange(tick.change))}</td>` +
    `<td class="volume">${esc(formatVolume(tick.volume))}</td>` +
    `</tr>`;
}

export function renderFullTable(stocks: StockState[]): string {
  const rows = stocks.map(s => {
    const dir = s.price >= s.open ? 'up' : 'down';
    const change = s.open > 0 ? (s.price - s.open) / s.open : 0;
    return `<tr id="row-${esc(s.symbol)}">` +
      `<td class="symbol">${esc(s.symbol)}</td>` +
      `<td class="price ${dir}">${esc(formatPrice(s.price))}</td>` +
      `<td class="change ${dir}">${esc(formatChange(change))}</td>` +
      `<td class="volume">${esc(formatVolume(s.volume))}</td>` +
      `</tr>`;
  });
  return rows.join('');
}
