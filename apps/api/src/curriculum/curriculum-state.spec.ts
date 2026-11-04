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
const markAll = (kind: ChapterMark, ...chapterNums: number[]) =>
  Object.fromEntries(chapterNums.map((n) => [`c${n}`, kind]));
const assessed = (...n: number[]) => markAll('PASSED_ASSESSMENT', ...n);
const placed = (...n: number[]) => markAll('SKIPPED_VIA_PLACEMENT', ...n);

function derive({
  completed = new Set<string>(),
  skipped = new Set<string>(),
  marks = {},
  relocated = null,
}: {
  completed?: ReadonlySet<string>;
  skipped?: ReadonlySet<string>;
  marks?: Record<string, ChapterMark>;
  relocated?: string | null;
} = {}) {
  return deriveCurriculumState({
    chapters,
    completedLessonIds: completed,
    skippedLessonIds: skipped,
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
    expect(s.next).toEqual({ kind: 'lesson', lessonId: 'c1l1' });
  });

  it('matches the locked I.4.e.a example (completed / placement-skipped / current / available / locked)', () => {
    const s = derive({
      completed: done(1),
      marks: { ...assessed(1), ...placed(2) },
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
    expect(s.next).toEqual({ kind: 'lesson', lessonId: 'c1l2' });
  });

  it('finishing the lessons does not pass the chapter — the exit Assessment is next (I.4.d.a)', () => {
    const s = derive({ completed: done(1) });
    expect(s.chapterStates.get('c1')).toBe('current');
    expect(s.chapterStates.get('c3')).toBe('locked');
    expect(s.next).toEqual({ kind: 'assessment', chapterId: 'c1' });
    expect(s.lessonsDoneChapterIds).toEqual(new Set(['c1']));
    expect(s.chapterActions.get('c1')?.assessment).toBe(true);
  });

  it('passing the exit Assessment completes the chapter and moves on', () => {
    const s = derive({ completed: done(1), marks: assessed(1) });
    expect(states(s).slice(0, 3)).toEqual([
      'completed',
      'current',
      'available',
    ]);
    expect(s.next).toEqual({ kind: 'lesson', lessonId: 'c2l1' });
  });

  it('passing a skip-test on the lookahead chapter opens the one after it (chain skipping)', () => {
    const s = derive({ marks: assessed(2) });
    expect(states(s)).toEqual([
      'current',
      'completed',
      'available',
      'locked',
      'locked',
      'locked',
    ]);
  });

  it('a non-contiguous placement skip ahead still shows as skipped, not locked', () => {
    const s = derive({ marks: placed(5) });
    expect(s.chapterStates.get('c5')).toBe('skipped_via_placement');
    expect(s.chapterStates.get('c4')).toBe('locked');
  });

  it('a placement-skipped chapter learned lesson by lesson reads completed', () => {
    const s = derive({ completed: done(1), marks: placed(1) });
    expect(s.chapterStates.get('c1')).toBe('completed');
  });

  it('everything passed: no current chapter, nothing next', () => {
    const s = derive({ marks: assessed(1, 2, 3, 4, 5, 6) });
    expect(states(s).every((x) => x === 'completed')).toBe(true);
    expect(s.currentChapterId).toBeNull();
    expect(s.frontierChapterId).toBeNull();
    expect(s.next).toBeNull();
  });
});

describe('deriveCurriculumState — lesson states', () => {
  it('lessons of a passed (non-current) chapter read "skipped"; finished ones stay completed', () => {
    const s = derive({
      completed: new Set(['c2l1']),
      marks: { ...placed(1), ...assessed(2) },
    });
    expect(s.lessonStates.get('c1l1')).toBe('skipped');
    expect(s.lessonStates.get('c2l1')).toBe('completed');
    expect(s.lessonStates.get('c2l2')).toBe('skipped');
  });

  it('lessons collapsed by a partial skip-test pass are skipped; Continue goes past them', () => {
    const s = derive({ skipped: new Set(['c1l1']) });
    expect(s.lessonStates.get('c1l1')).toBe('skipped');
    expect(s.lessonStates.get('c1l2')).toBe('current');
    expect(s.next).toEqual({ kind: 'lesson', lessonId: 'c1l2' });

    const all = derive({
      skipped: new Set(['c1l1']),
      completed: new Set(['c1l2']),
    });
    expect(all.next).toEqual({ kind: 'assessment', chapterId: 'c1' });
  });

  it('lessons of locked / available chapters are not_started', () => {
    const s = derive();
    expect(s.lessonStates.get('c2l1')).toBe('not_started');
    expect(s.lessonStates.get('c6l2')).toBe('not_started');
  });
});

describe('deriveCurriculumState — relocation ("relocate position here")', () => {
  it('relocating to a placement-skipped chapter makes it current; the frontier becomes available', () => {
    const s = derive({ marks: placed(1, 2), relocated: 'c1' });
    expect(states(s)).toEqual([
      'current',
      'skipped_via_placement',
      'available', // frontier — the learner can come back to it
      'available', // lookahead
      'locked',
      'locked',
    ]);
    expect(s.relocated).toBe(true);
    expect(s.next).toEqual({ kind: 'lesson', lessonId: 'c1l1' });
    expect(s.lessonStates.get('c1l1')).toBe('current');
    expect(s.lessonStates.get('c1l2')).toBe('not_started'); // learning it properly now
  });

  it('lapses once the relocated chapter’s lessons are all done (pointer falls back to the frontier)', () => {
    const s = derive({
      marks: placed(1, 2),
      relocated: 'c1',
      completed: done(1),
    });
    expect(s.currentChapterId).toBe('c3');
    expect(s.relocated).toBe(false);
    expect(s.chapterStates.get('c1')).toBe('completed');
  });

  it('is ignored (relocated: false) for chapters at/after the frontier, already learned, or unknown', () => {
    for (const [s, current] of [
      [derive({ relocated: 'c4' }), 'c1'],
      [
        derive({ completed: done(1), marks: assessed(1), relocated: 'c1' }),
        'c2',
      ],
      [derive({ relocated: 'nope' }), 'c1'],
    ] as const) {
      expect(s.currentChapterId).toBe(current);
      expect(s.relocated).toBe(false);
    }
    expect(derive().relocated).toBe(false);
  });

  it('still works when every chapter is passed (no frontier to return to)', () => {
    const marks = assessed(1, 2, 3, 4, 5, 6);
    expect(derive({ marks }).currentChapterId).toBeNull();
    const s = derive({ marks, relocated: 'c2' });
    expect(s.relocated).toBe(true);
    expect(s.currentChapterId).toBe('c2');
    expect(s.next).toEqual({ kind: 'lesson', lessonId: 'c2l1' });
    expect(s.chapterActions.get('c3')?.relocate).toBe(true);
  });
});

describe('deriveCurriculumState — actions', () => {
  it('relocate is offered only on passed chapters behind the frontier whose lessons are not all done', () => {
    const s = derive({
      completed: done(1),
      marks: { ...assessed(1), ...placed(2) },
    });
    expect(s.chapterActions.get('c1')?.relocate).toBe(false); // learned → Review instead
    expect(s.chapterActions.get('c2')?.relocate).toBe(true);
    expect(s.chapterActions.get('c3')?.relocate).toBe(false); // current
    expect(s.chapterActions.get('c4')?.relocate).toBe(false);
    // Skip-tested without doing its lessons → can go back and learn it.
    expect(
      derive({ marks: assessed(1) }).chapterActions.get('c1')?.relocate,
    ).toBe(true);
  });

  it('a relocated chapter (already passed) offers no Assessment', () => {
    const s = derive({ marks: placed(1), relocated: 'c1' });
    expect(s.chapterStates.get('c1')).toBe('current');
    expect(s.chapterActions.get('c1')?.assessment).toBe(false);
    expect(s.chapterActions.get('c2')?.assessment).toBe(true); // the frontier
  });

  it('while relocated, the frontier is not a relocate target (relocated flag + relocate(null) instead)', () => {
    const s = derive({ marks: placed(1), relocated: 'c1' });
    expect(s.relocated).toBe(true);
    expect(s.chapterActions.get('c2')?.relocate).toBe(false);
  });

  it('assessment on current + available only', () => {
    const s = derive({
      completed: done(1),
      marks: { ...assessed(1), ...placed(2) },
    });
    const flags = (id: string) => s.chapterActions.get(id);
    expect(flags('c1')).toMatchObject({ assessment: false });
    expect(flags('c2')).toMatchObject({ assessment: false });
    expect(flags('c3')).toMatchObject({ assessment: true });
    expect(flags('c4')).toMatchObject({ assessment: true });
    expect(flags('c5')).toMatchObject({ assessment: false, relocate: false });
  });
});
