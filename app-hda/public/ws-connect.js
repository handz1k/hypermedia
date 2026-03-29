(function () {
  const BACKEND_WS = `ws://${location.host}/ws`;
  const PROTOCOL   = 'hda-ticker';
  const MAX_RETRIES = 5;
  const BACKOFF_BASE_MS = 1000;

  const statusDot  = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const oobSink    = document.getElementById('oob-sink');

  let retries = 0;
  let ws;

  function setStatus(state) {
    statusDot.className = state;
    statusText.textContent = state === 'connected' ? 'Live' : state === 'disconnected' ? 'Disconnected' : 'Connecting…';
  }

  function connect() {
    setStatus('connecting');
    ws = new WebSocket(BACKEND_WS, PROTOCOL);

    ws.addEventListener('open', () => {
      retries = 0;
      setStatus('connected');
    });

    ws.addEventListener('message', ({ data }) => {
      const sink = document.createElement('tbody');
      sink.innerHTML = data;
      const stocksTbody = document.getElementById('stocks');

      sink.querySelectorAll('tr[id]').forEach(newRow => {
        const existing = document.getElementById(newRow.id);
        if (!existing) {
          stocksTbody.appendChild(newRow);
          return;
        }

        const newCells = newRow.querySelectorAll('td');
        const oldCells = existing.querySelectorAll('td');
        newCells.forEach((newTd, i) => {
          const oldTd = oldCells[i];
          if (!oldTd) return;
          if (oldTd.className !== newTd.className) oldTd.className = newTd.className;
          if (oldTd.textContent !== newTd.textContent) oldTd.textContent = newTd.textContent;
        });

        const newDir = newRow.querySelector('.price.up') ? 'flash-up' : 'flash-down';
        if (existing.dataset.dir !== newDir) {
          existing.classList.remove('flash-up', 'flash-down');
          existing.classList.add(newDir);
          existing.addEventListener('animationend', () => existing.classList.remove(newDir), { once: true });
          existing.dataset.dir = newDir;
        }
      });
    });

    ws.addEventListener('close', () => {
      setStatus('disconnected');
      if (retries < MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, retries);
        retries++;
        setTimeout(connect, delay);
      }
    });

    ws.addEventListener('error', () => ws.close());
  }

  async function init() {
    try {
      const res = await fetch('/api/snapshot/html');
      const html = await res.text();
      document.getElementById('stocks').innerHTML = html;
    } catch (e) {
      console.warn('Snapshot fetch failed, table will populate on first tick', e);
    }
    connect();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
