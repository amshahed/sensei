import type {
  ChapterState,
  CurriculumChapterActionsDto,
  LessonState,
} from '@sensei/types';

export type ChapterMark = 'SKIPPED_VIA_PLACEMENT' | 'PASSED_SKIP_TEST';

/** One chapter in global curriculum order (module position, then chapter position). */
export type ChapterInput = {
  id: string;
  /** Lesson ids in teaching order. */
  lessonIds: string[];
};

export type CurriculumStateInput = {
  chapters: ChapterInput[];
  completedLessonIds: ReadonlySet<string>;
  marks: ReadonlyMap<string, ChapterMark>;
  /** User.currentChapterId — the "relocate position here" override. */
  relocatedChapterId: string | null;
};

export type CurriculumState = {
  chapterStates: Map<string, ChapterState>;
  chapterActions: Map<string, CurriculumChapterActionsDto>;
  lessonStates: Map<string, LessonState>;
  /** First chapter neither completed nor skipped (null = all done). */
  frontierChapterId: string | null;
  /** Where the learner is working: a valid relocation, else the frontier. */
  currentChapterId: string | null;
  /** The relocation pointer is honoured (false when unset, lapsed or invalid). */
  relocated: boolean;
  /** First unfinished lesson of the current chapter. */
  nextLessonId: string | null;
};

/**
 * Derive the Curriculum Outline states (I.4.e) from lesson completions,
 * chapter marks and the relocation pointer. Pure — the service only loads data.
 *
 * Rules:
 *  - A chapter is *learned* when every lesson in it is completed; *passed* when
 *    learned, skip-tested (PASSED_SKIP_TEST) or skipped by placement.
 *  - frontier = first chapter not passed. Without a relocation it is `current`.
 *  - Relocation (I.4.e "relocate position here") is honoured only for a passed
 *    but not-learned chapter before the frontier — i.e. one the learner skipped
 *    and wants to learn properly. It lapses on its own once that chapter's
 *    lessons are all completed (the pointer then falls back to the frontier;
 *    `relocated: false` tells the caller to clear the stored pointer).
 *  - "Prerequisites met" = next-chapter lookahead (decisions.md I.4.e.a): the
 *    frontier (when not current) and the next unpassed chapter after it are
 *    `available`; later unpassed chapters are `locked`. Passing a skip-test on
 *    the lookahead chapter therefore opens the one after it.
 *  - A skip-test pass reads as `completed` (it is the bidirectional end-of-
 *    chapter Assessment, I.4.d); placement skips read `skipped_via_placement`.
 */
export function deriveCurriculumState(
  input: CurriculumStateInput,
): CurriculumState {
  const { chapters, completedLessonIds, marks, relocatedChapterId } = input;

  const learned = (c: ChapterInput) =>
    c.lessonIds.length > 0 &&
    c.lessonIds.every((l) => completedLessonIds.has(l));
  const passed = (c: ChapterInput) => learned(c) || marks.has(c.id);

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
    !learned(chapters[relocatedIdx]);
  const currentIdx = relocationValid ? relocatedIdx : frontierIdx;

  const chapterStates = new Map<string, ChapterState>();
  const chapterActions = new Map<string, CurriculumChapterActionsDto>();
  const lessonStates = new Map<string, LessonState>();
  let nextLessonId: string | null = null;

  chapters.forEach((chapter, i) => {
    const mark = marks.get(chapter.id);
    let state: ChapterState;
    if (i === currentIdx) state = 'current';
    else if (learned(chapter) || mark === 'PASSED_SKIP_TEST')
      state = 'completed';
    else if (mark === 'SKIPPED_VIA_PLACEMENT') state = 'skipped_via_placement';
    else if (i === frontierIdx || i === lookaheadIdx) state = 'available';
    else state = 'locked';
    chapterStates.set(chapter.id, state);

    // Relocate: back to a skipped (passed, not learned) chapter. Returning to
    // the frontier is the top-level `relocated` flag + relocate(null), which
    // also works when every chapter is passed and there is no frontier.
    const skippedBehind =
      i !== currentIdx &&
      passed(chapter) &&
      !learned(chapter) &&
      (frontierIdx === -1 || i < frontierIdx);
    chapterActions.set(chapter.id, {
      relocate: skippedBehind,
      skipTest: state === 'current' || state === 'available',
      review: state === 'completed' || state === 'skipped_via_placement',
    });

    let currentLessonAssigned = false;
    for (const lessonId of chapter.lessonIds) {
      let ls: LessonState;
      if (completedLessonIds.has(lessonId)) ls = 'completed';
      else if (i === currentIdx && !currentLessonAssigned) {
        ls = 'current';
        currentLessonAssigned = true;
        nextLessonId = lessonId;
      } else if (i !== currentIdx && mark) ls = 'skipped';
      else ls = 'not_started';
      lessonStates.set(lessonId, ls);
    }
  });

  return {
    chapterStates,
    chapterActions,
    lessonStates,
    frontierChapterId: frontierIdx === -1 ? null : chapters[frontierIdx].id,
    currentChapterId: currentIdx === -1 ? null : chapters[currentIdx].id,
    relocated: relocationValid,
    nextLessonId,
  };
}
