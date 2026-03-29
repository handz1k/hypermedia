<script lang="ts">
  import { stockStore } from './ws-store.js';
  import StockRow from './StockRow.svelte';

  $: stocks = Array.from($stockStore.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );
</script>

<div class="table-wrap">
  <table id="stock-table">
    <thead>
      <tr>
        <th>Symbol</th>
        <th>Price</th>
        <th>Change</th>
        <th>Volume</th>
      </tr>
    </thead>
    <tbody id="stocks">
      {#each stocks as stock (stock.symbol)}
        <StockRow {stock} />
      {/each}
    </tbody>
  </table>
</div>
