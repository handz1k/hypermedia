import type { Page } from 'puppeteer';

export interface HeapSnapshot {
  label: string;
  jsHeapUsedMb: number;
  jsHeapTotalMb: number;
  domNodeCount: number;
}

export async function takeHeapSnapshot(page: Page, label: string): Promise<HeapSnapshot> {
  const metrics = await page.metrics();

  const domNodeCount: number = await page.evaluate(
    () => document.querySelectorAll('*').length,
  );

  return {
    label,
    jsHeapUsedMb:  parseFloat(((metrics.JSHeapUsedSize  ?? 0) / 1024 / 1024).toFixed(2)),
    jsHeapTotalMb: parseFloat(((metrics.JSHeapTotalSize ?? 0) / 1024 / 1024).toFixed(2)),
    domNodeCount,
  };
}
