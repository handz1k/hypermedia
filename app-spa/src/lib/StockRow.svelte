<script lang="ts">
  import type { StockState } from '../types.js';

  export let stock: StockState;

  $: dir = stock.change >= 0 ? 'up' : 'down';
  $: priceFormatted  = stock.price.toFixed(2);
  $: changeFormatted = (stock.change >= 0 ? '+' : '') + (stock.change * 100).toFixed(2) + '%';
  $: volumeFormatted = stock.volume.toLocaleString('en-US');
</script>

<tr id="row-{stock.symbol}" class={dir === 'up' ? 'flash-up' : 'flash-down'}>
  <td class="symbol">{stock.symbol}</td>
  <td class="price {dir}">{priceFormatted}</td>
  <td class="change {dir}">{changeFormatted}</td>
  <td class="volume">{volumeFormatted}</td>
</tr>
