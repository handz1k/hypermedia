import type { Page } from 'puppeteer';

export interface PaintMetrics {
  layoutCount: number;
  styleRecalcCount: number;
  scriptDurationMs: number;
  taskDurationMs: number;
  layoutDurationMs: number;
}

export async function collectPaintMetrics(
  page: Page,
  durationMs: number,
): Promise<PaintMetrics> {
  const before = await page.metrics();

  await new Promise(resolve => setTimeout(resolve, durationMs));

  const after = await page.metrics();

  return {
    layoutCount:      (after.LayoutCount      ?? 0) - (before.LayoutCount      ?? 0),
    styleRecalcCount: (after.RecalcStyleCount  ?? 0) - (before.RecalcStyleCount  ?? 0),
    scriptDurationMs: parseFloat((((after.ScriptDuration  ?? 0) - (before.ScriptDuration  ?? 0)) * 1000).toFixed(2)),
    taskDurationMs:   parseFloat((((after.TaskDuration    ?? 0) - (before.TaskDuration    ?? 0)) * 1000).toFixed(2)),
    layoutDurationMs: parseFloat((((after.LayoutDuration  ?? 0) - (before.LayoutDuration  ?? 0)) * 1000).toFixed(2)),
  };
}
