import type { Page, CDPSession } from 'puppeteer';

export interface FpsResult {
  mean: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  sampleCount: number;
}

export async function collectFps(page: Page, durationMs: number): Promise<FpsResult> {
  await page.evaluate(`
    window.__fpsFrameTimes = [];
    window.__fpsRunning = true;
    const frame = (ts) => {
      if (!window.__fpsRunning) return;
      window.__fpsFrameTimes.push(ts);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  `);

  await new Promise(resolve => setTimeout(resolve, durationMs));

  await page.evaluate(`window.__fpsRunning = false;`);

  const frameTimes: number[] = await page.evaluate(`window.__fpsFrameTimes`);

  if (frameTimes.length < 2) {
    return { mean: 0, p50: 0, p95: 0, min: 0, max: 0, sampleCount: 0 };
  }

  const deltas: number[] = [];
  for (let i = 1; i < frameTimes.length; i++) {
    deltas.push(frameTimes[i] - frameTimes[i - 1]);
  }
  const fpsSamples = deltas.map(d => 1000 / d);
  fpsSamples.sort((a, b) => a - b);

  const mean = fpsSamples.reduce((s, v) => s + v, 0) / fpsSamples.length;
  const p50  = fpsSamples[Math.floor(fpsSamples.length * 0.50)];
  const p95  = fpsSamples[Math.floor(fpsSamples.length * 0.95)];
  const min  = fpsSamples[0];
  const max  = fpsSamples[fpsSamples.length - 1];

  return { mean, p50, p95, min, max, sampleCount: fpsSamples.length };
}
