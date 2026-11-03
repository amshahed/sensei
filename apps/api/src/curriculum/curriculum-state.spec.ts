import {
  ChapterInput,
  ChapterMark,
  deriveCurriculumState,
} from './curriculum-state';

// Six chapters of two lessons each: c1 = [c1l1, c1l2], …
const chapters: ChapterInput[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `c${n}`,
  lessonIds: [`c${n}l1`, `c${n}l2`],
}));
const done = (...chapterNums: number[]) =>
  new Set(chapterNums.flatMap((n) => [`c${n}l1`, `c${n}l2`]));

function derive({
  completed = new Set<string>(),
  marks = {},
  relocated = null,
}: {
  completed?: ReadonlySet<string>;
  marks?: Record<string, ChapterMark>;
  relocated?: string | null;
} = {}) {
  return deriveCurriculumState({
    chapters,
    completedLessonIds: completed,
    marks: new Map(Object.entries(marks)),
    relocatedChapterId: relocated,
  });
}
const states = (s: ReturnType<typeof derive>) =>
  chapters.map((c) => s.chapterStates.get(c.id));

describe('deriveCurriculumState — chapter states (I.4.e)', () => {
  it('new learner: first chapter current, the next available, the rest locked', () => {
    const s = derive();
    expect(states(s)).toEqual([
      'current',
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    expect(s.currentChapterId).toBe('c1');
    expect(s.nextLessonId).toBe('c1l1');
  });

  it('matches the locked I.4.e.a example (completed / placement-skipped / current / available / locked)', () => {
    const s = derive({
      completed: done(1),
      marks: { c2: 'SKIPPED_VIA_PLACEMENT' },
    });
    expect(states(s)).toEqual([
      'completed',
      'skipped_via_placement',
      'current',
      'available',
      'locked',
      'locked',
    ]);
  });

  it('a partly-done chapter stays current; its next unfinished lesson is "Continue"', () => {
    const s = derive({ completed: new Set(['c1l1']) });
    expect(s.chapterStates.get('c1')).toBe('current');
    expect(s.lessonStates.get('c1l1')).toBe('completed');
    expect(s.lessonStates.get('c1l2')).toBe('current');
    expect(s.nextLessonId).toBe('c1l2');
  });

  it('passing a skip-test on the lookahead chapter opens the one after it (chain skipping)', () => {
    const s = derive({ marks: { c2: 'PASSED_SKIP_TEST' } });
    expect(states(s)).toEqual([
      'current',
      'completed', // skip-test pass = end-of-chapter Assessment pass
      'available',
      'locked',
      'locked',
      'locked',
    ]);
  });

  it('a non-contiguous placement skip ahead still shows as skipped, not locked', () => {
    const s = derive({ marks: { c5: 'SKIPPED_VIA_PLACEMENT' } });
    expect(s.chapterStates.get('c5')).toBe('skipped_via_placement');
    expect(s.chapterStates.get('c4')).toBe('locked');
  });

  it('everything passed: no current chapter, nothing next', () => {
    const s = derive({ completed: done(1, 2, 3, 4, 5, 6) });
    expect(states(s).every((x) => x === 'completed')).toBe(true);
    expect(s.currentChapterId).toBeNull();
    expect(s.frontierChapterId).toBeNull();
    expect(s.nextLessonId).toBeNull();
  });
});

describe('deriveCurriculumState — lesson states', () => {
  it('lessons of a skipped (non-current) chapter read "skipped"; finished ones stay completed', () => {
    const s = derive({
      completed: new Set(['c2l1']),
      marks: { c1: 'SKIPPED_VIA_PLACEMENT', c2: 'PASSED_SKIP_TEST' },
    });
    expect(s.lessonStates.get('c1l1')).toBe('skipped');
    expect(s.lessonStates.get('c2l1')).toBe('completed');
    expect(s.lessonStates.get('c2l2')).toBe('skipped');
  });

  it('lessons of locked / available chapters are not_started', () => {
    const s = derive();
    expect(s.lessonStates.get('c2l1')).toBe('not_started');
    expect(s.lessonStates.get('c6l2')).toBe('not_started');
  });
});

describe('deriveCurriculumState — relocation ("relocate position here")', () => {
  const placed = {
    c1: 'SKIPPED_VIA_PLACEMENT',
    c2: 'SKIPPED_VIA_PLACEMENT',
  } as const;

  it('relocating to a placement-skipped chapter makes it current; the frontier becomes available', () => {
    const s = derive({ marks: placed, relocated: 'c1' });
    expect(states(s)).toEqual([
      'current',
      'skipped_via_placement',
      'available', // frontier — the learner can come back to it
      'available', // lookahead
      'locked',
      'locked',
    ]);
    expect(s.nextLessonId).toBe('c1l1');
    expect(s.lessonStates.get('c1l1')).toBe('current');
    expect(s.lessonStates.get('c1l2')).toBe('not_started'); // learning it properly now
  });

  it('lapses once the relocated chapter is fully learned (pointer falls back to the frontier)', () => {
    const s = derive({ marks: placed, relocated: 'c1', completed: done(1) });
    expect(s.currentChapterId).toBe('c3');
    expect(s.chapterStates.get('c1')).toBe('completed');
  });

  it('is ignored for chapters at/after the frontier, already learned, or unknown', () => {
    expect(derive({ relocated: 'c4' }).currentChapterId).toBe('c1');
    expect(
      derive({ completed: done(1), relocated: 'c1' }).currentChapterId,
    ).toBe('c2');
    expect(derive({ relocated: 'nope' }).currentChapterId).toBe('c1');
  });
});

describe('deriveCurriculumState — actions', () => {
  it('relocate is offered only on skipped chapters behind the frontier', () => {
    const s = derive({
      completed: done(1),
      marks: { c2: 'SKIPPED_VIA_PLACEMENT' },
    });
    expect(s.chapterActions.get('c1')?.relocate).toBe(false); // learned → Review instead
    expect(s.chapterActions.get('c2')?.relocate).toBe(true);
    expect(s.chapterActions.get('c3')?.relocate).toBe(false); // current
    expect(s.chapterActions.get('c4')?.relocate).toBe(false);
  });

  it('while relocated, the frontier offers "relocate" to go back to it', () => {
    const s = derive({
      marks: { c1: 'SKIPPED_VIA_PLACEMENT' },
      relocated: 'c1',
    });
    expect(s.chapterActions.get('c2')?.relocate).toBe(true);
  });

  it('skip-test on current + available only; review on completed + skipped only', () => {
    const s = derive({
      completed: done(1),
      marks: { c2: 'SKIPPED_VIA_PLACEMENT' },
    });
    const flags = (id: string) => s.chapterActions.get(id);
    expect(flags('c1')).toMatchObject({ skipTest: false, review: true });
    expect(flags('c2')).toMatchObject({ skipTest: false, review: true });
    expect(flags('c3')).toMatchObject({ skipTest: true, review: false });
    expect(flags('c4')).toMatchObject({ skipTest: true, review: false });
    expect(flags('c5')).toMatchObject({
      skipTest: false,
      review: false,
      relocate: false,
    });
  });
});
