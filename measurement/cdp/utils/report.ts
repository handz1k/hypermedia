import { writeFileSync } from 'fs';
import { join } from 'path';
import type { MeasurementResult, AppLabel } from '../runner.js';

const APP_ORDER: AppLabel[] = ['hda-stable', 'spa', 'hda-beta', 'hda-sse'];
const APP_LABELS: Record<AppLabel, string> = {
  'hda-stable': 'HDA Stable (htmx 2.x)',
  'spa':        'SPA',
  'hda-beta':   'HDA Beta (htmx 4.x WS)',
  'hda-sse':    'HDA SSE (htmx 4.x SSE)',
};

export function writeReport(results: MeasurementResult[], outDir: string): void {
  // JSON
  const jsonPath = join(outDir, 'cdp-results.json');
  writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Results written: ${jsonPath}`);

  // CSV
  const csvLines = [
    'app,metric,value',
    ...results.flatMap(r => [
      `${r.app},fps_mean,${r.fps.mean.toFixed(2)}`,
      `${r.app},fps_p50,${r.fps.p50.toFixed(2)}`,
      `${r.app},fps_p95,${r.fps.p95.toFixed(2)}`,
      `${r.app},fps_min,${r.fps.min.toFixed(2)}`,
      `${r.app},fps_max,${r.fps.max.toFixed(2)}`,
      `${r.app},heap_used_mb_t0,${r.heapSnapshots[0]?.jsHeapUsedMb ?? 0}`,
      `${r.app},heap_used_mb_steady,${r.heapSnapshots[1]?.jsHeapUsedMb ?? 0}`,
      `${r.app},heap_used_mb_final,${r.heapSnapshots[2]?.jsHeapUsedMb ?? 0}`,
      `${r.app},dom_nodes_t0,${r.heapSnapshots[0]?.domNodeCount ?? 0}`,
      `${r.app},dom_nodes_final,${r.heapSnapshots[2]?.domNodeCount ?? 0}`,
      `${r.app},layout_count,${r.paint.layoutCount}`,
      `${r.app},style_recalc_count,${r.paint.styleRecalcCount}`,
      `${r.app},script_duration_ms,${r.paint.scriptDurationMs}`,
      `${r.app},task_duration_ms,${r.paint.taskDurationMs}`,
      `${r.app},layout_duration_ms,${r.paint.layoutDurationMs}`,
    ]),
  ];
  const csvPath = join(outDir, 'cdp-results.csv');
  writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`CSV written: ${csvPath}`);

  // Markdown — 4-column table
  const header = APP_ORDER.map(a => APP_LABELS[a]).join(' | ');
  const sep    = APP_ORDER.map(() => '---').join(' | ');
  const md = [
    '# CDP Measurement Results\n',
    `| Metric | ${header} |`,
    `|---|${sep}|`,
    ...buildMdRows(results),
  ].join('\n');
  const mdPath = join(outDir, 'cdp-results.md');
  writeFileSync(mdPath, md, 'utf8');
  console.log(`Markdown written: ${mdPath}`);
}

function val(results: MeasurementResult[], app: AppLabel, fn: (r: MeasurementResult) => string): string {
  const r = results.find(x => x.app === app);
  return r ? fn(r) : 'N/A';
}

function buildMdRows(results: MeasurementResult[]): string[] {
  type RowDef = [string, (r: MeasurementResult) => string];
  const rows: RowDef[] = [
    ['FPS mean',                 r => r.fps.mean.toFixed(1)],
    ['FPS p95',                  r => r.fps.p95.toFixed(1)],
    ['JS Heap used MB (steady)', r => `${r.heapSnapshots[1]?.jsHeapUsedMb ?? 'N/A'} MB`],
    ['DOM nodes (final)',        r => String(r.heapSnapshots[2]?.domNodeCount ?? 'N/A')],
    ['Layout ops',               r => String(r.paint.layoutCount)],
    ['Style recalcs',            r => String(r.paint.styleRecalcCount)],
    ['Script time (ms)',         r => String(r.paint.scriptDurationMs)],
    ['Task time (ms)',           r => String(r.paint.taskDurationMs)],
    ['Layout duration (ms)',     r => String(r.paint.layoutDurationMs)],
  ];

  return rows.map(([name, fn]) => {
    const cells = APP_ORDER.map(a => val(results, a, fn)).join(' | ');
    return `| ${name} | ${cells} |`;
  });
}
