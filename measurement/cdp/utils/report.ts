import { writeFileSync } from 'fs';
import { join } from 'path';
import type { MeasurementResult } from '../runner.js';

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

  // Markdown summary
  const md = [
    '# CDP Measurement Results\n',
    '| Metric | HDA | SPA |',
    '|---|---|---|',
    ...buildMdRows(results),
  ].join('\n');
  const mdPath = join(outDir, 'cdp-results.md');
  writeFileSync(mdPath, md, 'utf8');
  console.log(`Markdown written: ${mdPath}`);
}

function buildMdRows(results: MeasurementResult[]): string[] {
  const hda = results.find(r => r.app === 'hda');
  const spa = results.find(r => r.app === 'spa');
  if (!hda || !spa) return [];

  const rows: [string, string, string][] = [
    ['FPS mean',              hda.fps.mean.toFixed(1),                  spa.fps.mean.toFixed(1)],
    ['FPS p95',               hda.fps.p95.toFixed(1),                   spa.fps.p95.toFixed(1)],
    ['JS Heap used (steady)', `${hda.heapSnapshots[1]?.jsHeapUsedMb} MB`, `${spa.heapSnapshots[1]?.jsHeapUsedMb} MB`],
    ['DOM nodes (final)',     String(hda.heapSnapshots[2]?.domNodeCount), String(spa.heapSnapshots[2]?.domNodeCount)],
    ['Layout ops',            String(hda.paint.layoutCount),             String(spa.paint.layoutCount)],
    ['Style recalcs',         String(hda.paint.styleRecalcCount),        String(spa.paint.styleRecalcCount)],
    ['Script time (ms)',      String(hda.paint.scriptDurationMs),        String(spa.paint.scriptDurationMs)],
    ['Task time (ms)',        String(hda.paint.taskDurationMs),          String(spa.paint.taskDurationMs)],
  ];

  return rows.map(([name, h, s]) => `| ${name} | ${h} | ${s} |`);
}
