import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { collectFps, type FpsResult } from './utils/fps-collector.js';
import { takeHeapSnapshot, type HeapSnapshot } from './utils/heap-collector.js';
import { collectPaintMetrics, type PaintMetrics } from './utils/paint-collector.js';
import { writeReport } from './utils/report.js';

export type AppLabel = 'hda-stable' | 'spa' | 'hda-beta' | 'hda-sse';

export interface MeasurementResult {
  app: AppLabel;
  url: string;
  startedAt: string;
  fps: FpsResult;
  heapSnapshots: HeapSnapshot[];
  paint: PaintMetrics;
}

const HDA_STABLE_URL    = process.env.CDP_HDA_STABLE_URL ?? 'http://localhost:8080';
const SPA_URL           = process.env.CDP_SPA_URL        ?? 'http://localhost:8081';
const HDA_BETA_URL      = process.env.CDP_HDA_BETA_URL   ?? 'http://localhost:8082';
const HDA_SSE_URL       = process.env.CDP_HDA_SSE_URL    ?? 'http://localhost:8083';
const DURATION_MS       = parseInt(process.env.CDP_DURATION_SECONDS ?? '60', 10) * 1000;
const WARMUP_MS         = 5_000;
const HEAP_INTERVAL_MS  = Math.floor(DURATION_MS / 2);
const OUT_DIR           = join(new URL('.', import.meta.url).pathname, '..', 'results');

async function measureApp(app: AppLabel, url: string): Promise<MeasurementResult> {
  console.log(`\n[${app.toUpperCase()}] Starting measurement at ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--enable-precise-memory-info',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-sandbox',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

    console.log(`  Warming up for ${WARMUP_MS / 1000}s…`);
    await new Promise(resolve => setTimeout(resolve, WARMUP_MS));

    const heap0 = await takeHeapSnapshot(page, 't0');
    console.log(`  Heap T=0: ${heap0.jsHeapUsedMb} MB, ${heap0.domNodeCount} DOM nodes`);

    const fpsPromise   = collectFps(page, DURATION_MS);
    const paintPromise = collectPaintMetrics(page, DURATION_MS);

    await new Promise(resolve => setTimeout(resolve, HEAP_INTERVAL_MS));
    const heapMid = await takeHeapSnapshot(page, 'steady');
    console.log(`  Heap mid: ${heapMid.jsHeapUsedMb} MB, ${heapMid.domNodeCount} DOM nodes`);

    const [fps, paint] = await Promise.all([fpsPromise, paintPromise]);

    const heapFinal = await takeHeapSnapshot(page, 'final');
    console.log(`  Heap final: ${heapFinal.jsHeapUsedMb} MB, ${heapFinal.domNodeCount} DOM nodes`);

    console.log(`  FPS mean=${fps.mean.toFixed(1)} p95=${fps.p95.toFixed(1)}`);
    console.log(`  Layout ops: ${paint.layoutCount}, Style recalcs: ${paint.styleRecalcCount}`);
    console.log(`  Script time: ${paint.scriptDurationMs}ms, Task time: ${paint.taskDurationMs}ms`);

    return {
      app,
      url,
      startedAt: new Date().toISOString(),
      fps,
      heapSnapshots: [heap0, heapMid, heapFinal],
      paint,
    };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const apps: Array<{ label: AppLabel; url: string }> = [
    { label: 'hda-stable', url: HDA_STABLE_URL },
    { label: 'spa',        url: SPA_URL        },
    { label: 'hda-beta',   url: HDA_BETA_URL   },
    { label: 'hda-sse',    url: HDA_SSE_URL    },
  ];

  const results: MeasurementResult[] = [];
  for (const { label, url } of apps) {
    results.push(await measureApp(label, url));
    if (label !== apps[apps.length - 1].label) {
      console.log('\nCooldown 10s…');
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
  }

  writeReport(results, OUT_DIR);
  console.log('\nMeasurement complete.');
}

main().catch(err => {
  console.error('Measurement failed:', err);
  process.exit(1);
});
