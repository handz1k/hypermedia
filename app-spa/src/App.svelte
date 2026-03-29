<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { statusStore, connect } from './lib/ws-store.js';
  import StockTable from './lib/StockTable.svelte';

  const WS_URL       = `ws://${location.host}/ws`;
  const SNAPSHOT_URL = '/api/snapshot';

  let cleanup: () => void;

  onMount(() => {
    cleanup = connect(WS_URL, SNAPSHOT_URL);
  });

  onDestroy(() => {
    cleanup?.();
  });

  $: statusClass = $statusStore;
  $: statusLabel = $statusStore === 'connected'
    ? 'Live'
    : $statusStore === 'disconnected'
    ? 'Disconnected'
    : 'Connecting…';
</script>

<header>
  <h1>Stock Ticker</h1>
  <span class="badge">SPA · Svelte</span>
  <div id="status">
    <span id="status-dot" class={statusClass}></span>
    <span id="status-text">{statusLabel}</span>
  </div>
</header>

<main>
  <StockTable />
</main>
