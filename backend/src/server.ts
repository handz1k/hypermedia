import express, { Request, Response, NextFunction } from 'express';
import { createServer, IncomingMessage } from 'http';
import { WebSocketServer } from 'ws';
import { TickerEngine } from './ticker-engine.js';
import { HdaBroadcaster } from './hda-broadcaster.js';
import { SpaBroadcaster } from './spa-broadcaster.js';
import { SseBroadcaster } from './sse-broadcaster.js';
import { SseRowBroadcaster } from './sse-row-broadcaster.js';
import { createWsRouter } from './ws-router.js';
import { registry, tickDurationMs } from './metrics.js';
import { renderFullTable, renderRowV2, renderRowV4 } from './html-renderer.js';

const APP_PORT = parseInt(process.env.APP_PORT ?? '3000', 10);
const METRICS_PORT = parseInt(process.env.METRICS_PORT ?? '9091', 10);
const STOCK_COUNT = parseInt(process.env.STOCK_COUNT ?? '50', 10);
const UPDATE_INTERVAL_MS = parseInt(process.env.UPDATE_INTERVAL_MS ?? '250', 10);
const VOLATILITY = parseFloat(process.env.VOLATILITY ?? '0.008');
const DRIFT = parseFloat(process.env.DRIFT ?? '0.0001');

const app = express();
app.use(express.json());
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ 
  server: httpServer, 
  handleProtocols: (protocols: Set<string>, req: IncomingMessage) => {
    if (protocols.has('hda-ticker')) return 'hda-ticker';
    if (protocols.has('spa-ticker')) return 'spa-ticker';
    // Allow htmx WS extension connections (both old and new routes)
    if (protocols.size === 0 && (req.url === '/ws' || req.url === '/ws/beta' || req.url === '/ws/v2' || req.url === '/ws/v4')) return '';
    return false;
  }
});

const engine = new TickerEngine(STOCK_COUNT, UPDATE_INTERVAL_MS, VOLATILITY, DRIFT);

// Initialize both broadcasters with their specific renderers and metric labels
const hdaV2 = new HdaBroadcaster(renderRowV2, 'hda-v2');
const hdaV4 = new HdaBroadcaster(renderRowV4, 'hda-v4');

const spa = new SpaBroadcaster();
const sse = new SseBroadcaster();
const sseRows = new SseRowBroadcaster();

// Wire both HDA broadcasters into the router
createWsRouter(wss, hdaV2, hdaV4, spa);

engine.on('tick', (ticks) => {
  const t0 = performance.now();
  
  // Broadcast to both HTMX endpoints
  hdaV2.broadcast(ticks);
  hdaV4.broadcast(ticks);
  
  spa.broadcast(ticks);
  sse.broadcast(ticks);
  sseRows.broadcast(ticks);
  tickDurationMs.observe(performance.now() - t0);
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: Date.now() });
});

app.get('/api/snapshot', (_req: Request, res: Response) => {
  const stocks = engine.snapshot();
  res.json({ ts: Date.now(), stocks });
});

app.get('/api/snapshot/html', (_req: Request, res: Response) => {
  const stocks = engine.snapshot();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderFullTable(stocks));
});

app.get('/api/sse', (_req: Request, res: Response) => {
  sse.addClient(res);
});

app.get('/api/sse/rows', (_req: Request, res: Response) => {
  sseRows.addClient(res);
});

const metricsApp = express();
metricsApp.get('/metrics', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

metricsApp.listen(METRICS_PORT, () => {
  console.log(`Metrics server listening on :${METRICS_PORT}`);
});

httpServer.listen(APP_PORT, () => {
  console.log(`App server listening on :${APP_PORT}`);
  engine.start();
  console.log(`Ticker engine started — ${STOCK_COUNT} stocks @ ${UPDATE_INTERVAL_MS}ms`);
});

process.on('SIGTERM', () => {
  engine.stop();
  httpServer.close(() => process.exit(0));
});