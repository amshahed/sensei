import * as fs from 'fs';
import * as path from 'path';
import type { CorrectionEntry } from './lesson-schema';

const DEFAULT_LOG_PATH = path.resolve(
  __dirname,
  '../../../../tools/authoring/corrections.jsonl',
);

/**
 * Read the N most recent corrections for a given lesson type.
 * Returns [] when the log doesn't exist or has no matching entries.
 */
export function readCorrections(
  lessonType: string,
  n: number,
  logPath: string = DEFAULT_LOG_PATH,
): CorrectionEntry[] {
  if (!fs.existsSync(logPath)) return [];
  const raw = fs.readFileSync(logPath, 'utf8');
  const entries: CorrectionEntry[] = raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as CorrectionEntry)
    .filter((e) => e.lesson_type === lessonType);
  return entries.slice(-n);
}

/**
 * Append a correction entry to the log (creates the file if absent).
 */
export function appendCorrection(
  entry: CorrectionEntry,
  logPath: string = DEFAULT_LOG_PATH,
): void {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
}
