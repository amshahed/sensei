import type {
  ChapterState,
  CurriculumChapterActionsDto,
  LessonState,
} from '@sensei/types';

export type ChapterMark = 'SKIPPED_VIA_PLACEMENT' | 'PASSED_ASSESSMENT';

/** One chapter in global curriculum order (module position, then chapter position). */
export type ChapterInput = {
  id: string;
  /** Lesson ids in teaching order. */
  lessonIds: string[];
};

export type CurriculumStateInput = {
  chapters: ChapterInput[];
  completedLessonIds: ReadonlySet<string>;
  /** Lessons collapsed by a partial skip-test pass (UserLessonSkip, I.4.d.a). */
  skippedLessonIds: ReadonlySet<string>;
  marks: ReadonlyMap<string, ChapterMark>;
  /** User.currentChapterId — the "relocate position here" override. */
  relocatedChapterId: string | null;
};

/** What "Continue" opens. */
export type NextStep =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'assessment'; chapterId: string };

export type CurriculumState = {
  chapterStates: Map<string, ChapterState>;
  chapterActions: Map<string, CurriculumChapterActionsDto>;
  lessonStates: Map<string, LessonState>;
  /** Chapters whose lessons are all completed or skipped (an Assessment then is EXIT, not SKIP). */
  lessonsDoneChapterIds: Set<string>;
  /** First chapter not passed (null = all passed). */
  frontierChapterId: string | null;
  /** Where the learner is working: a valid relocation, else the frontier. */
  currentChapterId: string | null;
  /** The relocation pointer is honoured (false when unset, lapsed or invalid). */
  relocated: boolean;
  /** The current chapter's first unfinished lesson, else its exit Assessment. */
  next: NextStep | null;
};

/**
 * Derive the Curriculum Outline states (I.4.e) from lesson completions, lesson
 * skips, chapter marks and the relocation pointer. Pure — the service only
 * loads data.
 *
 * Rules (decisions.md I.4.e.a as amended by I.4.d.a):
 *  - A chapter's *lessons are done* when every lesson is completed or was
 *    collapsed by a partial skip-test pass. A chapter is *passed* only by a
 *    mark: an Assessment pass (skip-test or exit) or a placement skip. Lessons
 *    alone never pass it — the exit Assessment is the chapter's last step.
 *  - frontier = first chapter not passed. Without a relocation it is `current`.
 *  - Relocation ("relocate position here") is honoured only for a chapter
 *    before the frontier whose lessons aren't all done — one the learner
 *    skipped and wants to learn properly. It lapses once they are
 *    (`relocated: false` tells the caller to clear the stored pointer).
 *  - Next-chapter lookahead: the frontier (when not current) and the next
 *    unpassed chapter after it are `available`; later unpassed chapters are
 *    `locked`. Passing a skip-test on the lookahead chapter opens the one after.
 *  - `completed` = passed by Assessment, or placement-skipped and since learned
 *    lesson by lesson. Otherwise placement skips read `skipped_via_placement`.
 */
export function deriveCurriculumState(
  input: CurriculumStateInput,
): CurriculumState {
  const {
    chapters,
    completedLessonIds,
    skippedLessonIds,
    marks,
    relocatedChapterId,
  } = input;

  const lessonDone = (l: string) =>
    completedLessonIds.has(l) || skippedLessonIds.has(l);
  const lessonsDone = (c: ChapterInput) =>
    c.lessonIds.length > 0 && c.lessonIds.every(lessonDone);
  const passed = (c: ChapterInput) => marks.has(c.id);

  const frontierIdx = chapters.findIndex((c) => !passed(c));
  // Lookahead = the next *unpassed* chapter after the frontier, so passing a
  // skip-test on it opens the one after (chain skipping, I.4.d).
  const lookaheadIdx =
    frontierIdx === -1
      ? -1
      : chapters.findIndex((c, i) => i > frontierIdx && !passed(c));
  const relocatedIdx = chapters.findIndex((c) => c.id === relocatedChapterId);
  const relocationValid =
    relocatedIdx !== -1 &&
    (frontierIdx === -1 || relocatedIdx < frontierIdx) &&
    !lessonsDone(chapters[relocatedIdx]);
  const currentIdx = relocationValid ? relocatedIdx : frontierIdx;

  const chapterStates = new Map<string, ChapterState>();
  const chapterActions = new Map<string, CurriculumChapterActionsDto>();
  const lessonStates = new Map<string, LessonState>();
  const lessonsDoneChapterIds = new Set<string>();
  let next: NextStep | null = null;

  chapters.forEach((chapter, i) => {
    const mark = marks.get(chapter.id);
    const done = lessonsDone(chapter);
    if (done) lessonsDoneChapterIds.add(chapter.id);

    let state: ChapterState;
    if (i === currentIdx) state = 'current';
    else if (
      mark === 'PASSED_ASSESSMENT' ||
      (mark === 'SKIPPED_VIA_PLACEMENT' && done)
    )
      state = 'completed';
    else if (mark === 'SKIPPED_VIA_PLACEMENT') state = 'skipped_via_placement';
    else if (i === frontierIdx || i === lookaheadIdx) state = 'available';
    else state = 'locked';
    chapterStates.set(chapter.id, state);

    // Relocate: back to a passed chapter whose lessons aren't all done.
    // Returning to the frontier is the top-level `relocated` flag +
    // relocate(null), which also works when every chapter is passed.
    chapterActions.set(chapter.id, {
      relocate:
        i !== currentIdx &&
        passed(chapter) &&
        !done &&
        (frontierIdx === -1 || i < frontierIdx),
      assessment: state === 'current' || state === 'available',
      review: state === 'completed' || state === 'skipped_via_placement',
    });

    for (const lessonId of chapter.lessonIds) {
      let ls: LessonState;
      if (completedLessonIds.has(lessonId)) ls = 'completed';
      else if (skippedLessonIds.has(lessonId) || (i !== currentIdx && mark))
        ls = 'skipped';
      else if (i === currentIdx && next === null) {
        ls = 'current';
        next = { kind: 'lesson', lessonId };
      } else ls = 'not_started';
      lessonStates.set(lessonId, ls);
    }
    // Every lesson of the current chapter is done: its Assessment is next.
    if (i === currentIdx && next === null) {
      next = { kind: 'assessment', chapterId: chapter.id };
    }
  });

  return {
    chapterStates,
    chapterActions,
    lessonStates,
    lessonsDoneChapterIds,
    frontierChapterId: frontierIdx === -1 ? null : chapters[frontierIdx].id,
    currentChapterId: currentIdx === -1 ? null : chapters[currentIdx].id,
    relocated: relocationValid,
    next,
  };
}
