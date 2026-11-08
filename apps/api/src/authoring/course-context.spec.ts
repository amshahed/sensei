import { courseContextFor } from './course-context';
import { compile, loadOutlineSpec, outlineItemIds } from './outline-compiler';
import type { OutlineItemRow } from './outline-compiler';
import type { Skeleton } from './skeleton-schema';

const spec = loadOutlineSpec();
const rows: OutlineItemRow[] = outlineItemIds(spec).map((id) => {
  const kind = id.split(':')[1];
  const surface = spec.surfaces[id] ?? id.split(':')[2];
  return {
    id,
    type: kind.toUpperCase() as OutlineItemRow['type'],
    display: surface,
    reading: kind === 'grammar' ? null : surface,
  };
});
const skeleton: Skeleton = compile(spec, rows);
const lessonAt = (n: number) =>
  skeleton.module.chapters.flatMap((c) => c.lessons)[n - 1];
const at = (n: number) => courseContextFor(skeleton, lessonAt(n).id)!;

describe('courseContextFor', () => {
  it('is null for a model-written skeleton and an unknown lesson', () => {
    expect(
      courseContextFor({ ...skeleton, surfaces: undefined }, lessonAt(1).id),
    ).toBeNull();
    expect(courseContextFor(skeleton, 'nope')).toBeNull();
  });

  it('knows only the first five kana at lesson 1', () => {
    const ctx = at(1);
    expect(ctx.position).toBe(1);
    expect(ctx.totalLessons).toBe(120);
    expect(ctx.kana).toEqual(['あ', 'い', 'う', 'え', 'お']);
    expect(ctx.words).toEqual([]);
    expect(ctx.grammar).toEqual([]);
  });

  it("counts a lesson's own sound stage and words, but no later ones", () => {
    const ctx = at(15);
    expect(ctx.kana).toContain('が');
    expect(ctx.kana).not.toContain('だ');
    expect(ctx.kana).not.toContain('ゃ');
    expect(ctx.words).toContain('かぎ');
    expect(ctx.words).not.toContain('ともだち');
    expect(ctx.longVowelsTaught).toBe(false);
    expect(ctx.typedReading).toBe(true);
    expect(ctx.kanaCards.map((c) => c.char)).toContain('が');
    expect(ctx.hasKanaTargets).toBe(false);
    expect(ctx.authorNote).toBeTruthy();
  });

  it('turns long vowels on at lesson 18 and っ at lesson 19', () => {
    expect(at(17).longVowelsTaught).toBe(false);
    expect(at(18).longVowelsTaught).toBe(true);
    expect(at(18).kana).not.toContain('っ');
    expect(at(19).kana).toContain('っ');
  });

  it('builds taught grammar in course order', () => {
    expect(at(43).grammar.map((g) => g.surface)).toEqual(['です', 'は']);
    expect(at(44).grammar.map((g) => g.id)).toContain('ja:grammar:か');
    expect(at(87).grammar.map((g) => g.id)).toContain('ja:grammar:ます');
    expect(at(86).grammar.map((g) => g.id)).not.toContain('ja:grammar:ます');
  });

  it('collects kanji only as they are taught', () => {
    expect(at(48).kanji).toEqual([]);
    expect(at(49).kanji).toEqual(['人', '大', '小']);
    expect(at(49).targets).toEqual([]);
  });

  it('shows the たいです pattern as 〜たいです', () => {
    expect(at(117).targets[0].surface).toBe('〜たいです');
  });
});
