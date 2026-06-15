import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { readCorrections, appendCorrection } from './corrections-log';
import type { CorrectionEntry, LessonDraft } from './lesson-schema';

function tmpLog(): string {
  return path.join(os.tmpdir(), `corrections-test-${Date.now()}.jsonl`);
}

function makeEntry(overrides: Partial<CorrectionEntry> = {}): CorrectionEntry {
  return {
    lesson_type: 'F-Kana',
    original_draft: { lessonId: 'test' } as unknown as LessonDraft,
    notes: 'The mnemonic was unclear.',
    regenerated_version: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('readCorrections', () => {
  it('returns [] when file does not exist', () => {
    expect(readCorrections('F-Kana', 5, '/nonexistent/path.jsonl')).toEqual([]);
  });

  it('returns all matching entries up to n', () => {
    const logPath = tmpLog();
    appendCorrection(
      makeEntry({ lesson_type: 'F-Kana', notes: 'note 1' }),
      logPath,
    );
    appendCorrection(
      makeEntry({ lesson_type: 'F-Vocab', notes: 'vocab note' }),
      logPath,
    );
    appendCorrection(
      makeEntry({ lesson_type: 'F-Kana', notes: 'note 2' }),
      logPath,
    );
    appendCorrection(
      makeEntry({ lesson_type: 'F-Kana', notes: 'note 3' }),
      logPath,
    );

    const results = readCorrections('F-Kana', 2, logPath);
    expect(results).toHaveLength(2);
    // Most recent 2 F-Kana entries
    expect(results[0].notes).toBe('note 2');
    expect(results[1].notes).toBe('note 3');

    fs.unlinkSync(logPath);
  });

  it('filters by lesson_type', () => {
    const logPath = tmpLog();
    appendCorrection(
      makeEntry({ lesson_type: 'F-Vocab', notes: 'vocab' }),
      logPath,
    );
    appendCorrection(
      makeEntry({ lesson_type: 'F-Kana', notes: 'kana' }),
      logPath,
    );

    const results = readCorrections('F-Vocab', 5, logPath);
    expect(results).toHaveLength(1);
    expect(results[0].notes).toBe('vocab');

    fs.unlinkSync(logPath);
  });

  it('returns [] when no entries match the lesson type', () => {
    const logPath = tmpLog();
    appendCorrection(makeEntry({ lesson_type: 'F-Vocab' }), logPath);

    expect(readCorrections('F-Grammar', 5, logPath)).toEqual([]);
    fs.unlinkSync(logPath);
  });

  it('returns n most recent entries (not more)', () => {
    const logPath = tmpLog();
    for (let i = 1; i <= 8; i++) {
      appendCorrection(makeEntry({ notes: `note ${i}` }), logPath);
    }

    const results = readCorrections('F-Kana', 3, logPath);
    expect(results).toHaveLength(3);
    expect(results[0].notes).toBe('note 6');
    expect(results[2].notes).toBe('note 8');

    fs.unlinkSync(logPath);
  });
});

describe('appendCorrection', () => {
  it('creates the file if it does not exist', () => {
    const logPath = tmpLog();
    expect(fs.existsSync(logPath)).toBe(false);

    appendCorrection(makeEntry(), logPath);
    expect(fs.existsSync(logPath)).toBe(true);
    fs.unlinkSync(logPath);
  });

  it('appends entries as newline-delimited JSON', () => {
    const logPath = tmpLog();
    appendCorrection(makeEntry({ notes: 'first' }), logPath);
    appendCorrection(makeEntry({ notes: 'second' }), logPath);

    const lines = fs
      .readFileSync(logPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim());
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]) as CorrectionEntry;
    const second = JSON.parse(lines[1]) as CorrectionEntry;
    expect(first.notes).toBe('first');
    expect(second.notes).toBe('second');

    fs.unlinkSync(logPath);
  });
});
