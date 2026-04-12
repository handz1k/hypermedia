import { StockTick } from './types.js';

// Helper to format raw floats into clean percentages
function formatChange(change: number): string {
  const percent = change * 100;
  const sign = percent > 0 ? '+' : ''; 
  return `${sign}${percent.toFixed(2)}%`;
}

// Helper to match your CSS td color classes
function getChangeClass(change: number): string {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return ''; 
}

// Helper to trigger your CSS row flash animations
function getFlashClass(change: number): string {
  if (change > 0) return 'flash-up';
  if (change < 0) return 'flash-down';
  return '';
}

// HTMX 2.x Broadcast
export function renderRowV2(tick: StockTick): string {
  const changeClass = getChangeClass(tick.change);
  const flashClass = getFlashClass(tick.change); // Add flash to live updates
  
  return `
    <tr id="row-${tick.symbol}" hx-swap-oob="true" class="${flashClass}">
      <td class="symbol">${tick.symbol}</td>
      <td class="price">${tick.price.toFixed(2)}</td>
      <td class="${changeClass}">${formatChange(tick.change)}</td>
      <td class="volume">${tick.volume.toLocaleString()}</td>
    </tr>
  `;
}

// HTMX 4.x Broadcast
export function renderRowV4(tick: StockTick): string {
  const changeClass = getChangeClass(tick.change);
  const flashClass = getFlashClass(tick.change); // Add flash to live updates
  
  return `
    <hx-partial hx-target="#row-${tick.symbol}" hx-swap="outerHTML">
      <tr id="row-${tick.symbol}" class="${flashClass}">
        <td class="symbol">${tick.symbol}</td>
        <td class="price">${tick.price.toFixed(2)}</td>
        <td class="${changeClass}">${formatChange(tick.change)}</td>
        <td class="volume">${tick.volume.toLocaleString()}</td>
      </tr>
    </hx-partial>
  `;
}

// Initial HTTP Page Load
export function renderFullTable(ticks: StockTick[]): string {
  return ticks.map(tick => {
    const changeClass = getChangeClass(tick.change);
    
    // We intentionally DO NOT add the flashClass here, 
    // so the whole table doesn't blink like crazy on initial load!
    return `
      <tr id="row-${tick.symbol}">
        <td class="symbol">${tick.symbol}</td>
        <td class="price">${tick.price.toFixed(2)}</td>
        <td class="${changeClass}">${formatChange(tick.change)}</td>
        <td class="volume">${tick.volume.toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}