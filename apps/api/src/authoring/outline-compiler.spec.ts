import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasKanji, hasLongVowel } from '../common/japanese-script';
import {
  assertNotCompiledOutline,
  compile,
  loadOutlineSpec,
  outlineItemIds,
  validateOutline,
  type OutlineItemRow,
  type OutlineSpec,
} from './outline-compiler';
import type { Lesson } from './skeleton-schema';

const real = loadOutlineSpec();
const clone = (): OutlineSpec =>
  JSON.parse(JSON.stringify(real)) as OutlineSpec;
const lessonsOf = (spec: OutlineSpec) =>
  spec.chapters.flatMap((c) => c.lessons);
const lesson = (spec: OutlineSpec, n: number): Lesson => lessonsOf(spec)[n - 1];
/** The numbered lessons 15 to 20: the "sounds that change" chapter. */
const soundLessons = lessonsOf(real).slice(14, 20);

/** Remove lesson `n` and put it after lesson `after` (numbers before the move). */
function moveLesson(spec: OutlineSpec, n: number, after: number): OutlineSpec {
  const moved = lesson(spec, n);
  const anchor = lesson(spec, after);
  for (const c of spec.chapters) {
    c.lessons = c.lessons.filter((l) => l !== moved);
  }
  const home = spec.chapters.find((c) => c.lessons.includes(anchor))!;
  home.lessons.splice(home.lessons.indexOf(anchor) + 1, 0, moved);
  return spec;
}

describe('the committed outline (F.1.b)', () => {
  it('passes every rule', () => {
    expect(validateOutline(real)).toEqual([]);
  });

  it('is 120 lessons in 17 chapters, in appendix order (P11)', () => {
    expect(real.chapters.map((c) => c.lessons.length)).toEqual([
      4, 4, 6, 6, 6, 6, 8, 10, 6, 8, 7, 6, 6, 13, 10, 7, 7,
    ]);
    expect(lessonsOf(real)).toHaveLength(120);
    const titleAt = (n: number) => lesson(real, n).title;
    expect(titleAt(1)).toBe('The five vowels');
    expect(titleAt(15)).toBe('Voiced sounds: が and ざ rows');
    expect(titleAt(21)).toBe('Hello and goodbye');
    expect(titleAt(44)).toBe('Questions with か');
    expect(titleAt(87)).toBe('Polite verbs: ます');
    expect(titleAt(102)).toBe('The て-form');
    expect(titleAt(120)).toBe('Writing your introduction');
  });

  it('reuses the tracer slugs for lesson 1, and numbers every other lesson', () => {
    expect(real.chapters[0].id).toBe('hiragana-vowels');
    expect(lesson(real, 1).id).toBe('the-five-vowels');
    expect(lesson(real, 2).id).toBe('foundation-ja-ch01-l02');
    expect(lesson(real, 15).id).toBe('foundation-ja-ch04-l01');
    expect(real.chapters[1].id).toBe('foundation-ja-ch02');
  });

  it('names the agreed readings, and the two different 人', () => {
    const items = (n: number) => lesson(real, n).itemIds;
    expect(items(41)).toContain('ja:vocab:私:わたし');
    expect(items(42)).toContain('ja:vocab:人:ひと');
    expect(items(45)).toContain('ja:vocab:人:じん');
    expect(items(79)).toEqual(
      expect.arrayContaining(['ja:vocab:中:なか', 'ja:vocab:外:そと']),
    );
    expect(items(98)).toContain('ja:vocab:時:じ');
    for (const n of [116, 118, 119]) {
      expect(items(n)).toContain('ja:grammar:がすきです');
    }
  });

  it('targets words only in the sound lessons, and asks for typed readings there (P2, P3)', () => {
    expect(soundLessons).toHaveLength(6);
    for (const l of soundLessons) {
      expect(l.typedReading).toBe(true);
      expect(l.itemIds.filter((id) => id.startsWith('ja:kana:'))).toEqual([]);
    }
    expect(lessonsOf(real).filter((l) => l.typedReading)).toHaveLength(6);
  });

  it('teaches 25 distinct phrases before lesson 26, each with a note (P5)', () => {
    const phraseLessons = lessonsOf(real).slice(20, 25);
    expect(new Set(phraseLessons.flatMap((l) => l.itemIds)).size).toBe(25);
    for (const l of phraseLessons) {
      expect(l.authorNote).toMatch(/when to say it/);
    }
  });

  it('never shows kanji in a grammar pattern, and never uses 好 (P9)', () => {
    const grammar = Object.entries(real.surfaces).filter(([id]) =>
      id.startsWith('ja:grammar:'),
    );
    expect(grammar).toHaveLength(24);
    for (const [, surface] of grammar) expect(hasKanji(surface)).toBe(false);
    expect(outlineItemIds(real)).not.toContain('ja:grammar:が好きです');
  });

  it('has 41 kanji and 184 distinct spellings', () => {
    const ids = outlineItemIds(real);
    expect(ids.filter((id) => id.startsWith('ja:kanji:'))).toHaveLength(41);
    const spellings = ids
      .filter((id) => id.startsWith('ja:vocab:'))
      .map((id) => id.split(':')[2]);
    expect(new Set(spellings).size).toBe(184);
  });

  it('opens lesson 120 as a free self-introduction (P10)', () => {
    expect(lesson(real, 120).type).toBe('I-Writing');
    expect(lesson(real, 120).authorNote).toMatch(/grading "open"/);
  });
});

describe('validateOutline fails when', () => {
  it('a word needs a sound before its lesson (P1)', () => {
    const spec = moveLesson(clone(), 15, 19);
    expect(validateOutline(spec).join()).toMatch(
      /uses (が|ぎ|ざ|ず|ご).*taught/,
    );
  });

  it('a word needs small っ before its lesson (P1)', () => {
    const spec = clone();
    spec.soundStages.find((s) => s.chars === 'っ')!.lessonId = lesson(
      spec,
      39,
    ).id;
    expect(validateOutline(spec).join()).toMatch(/uses っ/);
  });

  it('a word needs ー before its lesson (P1)', () => {
    const spec = clone();
    spec.soundStages.find((s) => s.chars?.includes('ー'))!.lessonId = lesson(
      spec,
      40,
    ).id;
    expect(validateOutline(spec).join()).toMatch(/uses ー/);
  });

  it('a word has a long vowel before they are taught (P1)', () => {
    const spec = moveLesson(clone(), 18, 21);
    expect(validateOutline(spec).join()).toMatch(/long vowel/);
  });

  it('an F-Vocab lesson targets a base kana (P3)', () => {
    const spec = clone();
    lesson(spec, 15).itemIds.push('ja:kana:ka');
    expect(validateOutline(spec).join()).toMatch(/targets only vocab/);
  });

  it('a sound floor is broken (P4)', () => {
    const spec = clone();
    for (const id of Object.keys(spec.surfaces)) {
      if (spec.surfaces[id].includes('ぴ')) delete spec.surfaces[id];
      if (/[ポパプペピ]/.test(spec.surfaces[id] ?? ''))
        delete spec.surfaces[id];
    }
    expect(validateOutline(spec).join()).toMatch(/Coverage: ぱ row/);
  });

  it('か moves after the lessons that ask questions (P7)', () => {
    const spec = moveLesson(clone(), 44, 64);
    expect(validateOutline(spec).join()).toMatch(/needs ja:grammar:か/);
  });

  it('ます moves after a pattern built on it (P7)', () => {
    const spec = moveLesson(clone(), 87, 101);
    expect(validateOutline(spec).join()).toMatch(/needs ja:grammar:ます/);
  });

  it('an integration lesson uses something not taught yet', () => {
    const spec = moveLesson(clone(), 26, 20);
    expect(validateOutline(spec).join()).toMatch(/not taught yet/);
  });

  it('a surface carries kanji, as 〜が好きです would (P9)', () => {
    const spec = clone();
    spec.surfaces['ja:grammar:がすきです'] = '〜が好きです';
    expect(validateOutline(spec).join()).toMatch(/contains kanji/);
  });

  it('kana display makes a new collision with no context', () => {
    const spec = clone();
    spec.surfaces['ja:vocab:犬'] = 'さん';
    expect(validateOutline(spec).join()).toMatch(/Homophone/);
  });
});

describe('compile', () => {
  const NOW = new Date('2026-11-08T00:00:00.000Z');
  const rows: OutlineItemRow[] = outlineItemIds(real).map((id) => {
    const kind = id.split(':')[1];
    const surface = real.surfaces[id] ?? id.split(':')[2];
    return {
      id,
      type: kind.toUpperCase() as OutlineItemRow['type'],
      display: surface,
      reading: kind === 'grammar' ? null : surface,
    };
  });

  it('writes the skeleton format, marked as compiled, with surfaces and stages', () => {
    const out = compile(real, rows, NOW);
    expect(out.model).toBe('compiled-outline');
    expect(out.tokenUsage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(out.generatedAt).toBe(NOW.toISOString());
    expect(out.surfaces).toEqual(real.surfaces);
    expect(out.soundStages).toEqual(real.soundStages);
    expect(out.module.chapters).toHaveLength(17);
    expect(out.module.chapters[3].lessons[0].kanaCards).toHaveLength(10);
  });

  it('refuses a named item with no row', () => {
    expect(() =>
      compile(
        real,
        rows.filter((r) => r.id !== 'ja:vocab:こんにちは'),
        NOW,
      ),
    ).toThrow(/No item row for ja:vocab:こんにちは/);
  });

  it('refuses a row that would be served differently from the spec', () => {
    const changed = rows.map((r) =>
      r.id === 'ja:vocab:日本'
        ? { ...r, display: '日本', reading: 'にっぽん' }
        : r,
    );
    expect(() => compile(real, changed, NOW)).toThrow(/spec says "にほん"/);
  });
});

describe('assertNotCompiledOutline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-'));

  it('stops authoring:skeleton replacing a compiled outline, even with --force', () => {
    const file = path.join(dir, 'compiled.json');
    fs.writeFileSync(file, JSON.stringify({ model: 'compiled-outline' }));
    expect(() => assertNotCompiledOutline(file)).toThrow(
      /compiled beta outline/,
    );
  });

  it('allows a model-written skeleton, a missing file and an unreadable file', () => {
    const model = path.join(dir, 'ai.json');
    fs.writeFileSync(model, JSON.stringify({ model: 'claude-opus-4-8' }));
    expect(() => assertNotCompiledOutline(model)).not.toThrow();
    expect(() =>
      assertNotCompiledOutline(path.join(dir, 'x.json')),
    ).not.toThrow();
    const broken = path.join(dir, 'broken.json');
    fs.writeFileSync(broken, '{');
    expect(() => assertNotCompiledOutline(broken)).not.toThrow();
  });
});

describe('hasLongVowel', () => {
  it.each([
    ['おかあさん', true],
    ['おにいさん', true],
    ['おねえさん', true],
    ['おとうさん', true],
    ['えいが', true],
    ['コーヒー', true],
    ['かばん', false],
    ['はい', false],
    ['ともだち', false],
    ['トイレ', false],
  ])('%s → %s', (word, expected) => {
    expect(hasLongVowel(word)).toBe(expected);
  });
});
