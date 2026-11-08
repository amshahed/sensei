import { courseContextFor, type CourseContext } from './course-context';
import { checkCourseRules, scriptProblems } from './course-rules';
import type { LessonDraft, TeachBlock } from './lesson-schema';
import { compile, loadOutlineSpec, outlineItemIds } from './outline-compiler';
import type { OutlineItemRow } from './outline-compiler';

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
const skeleton = compile(spec, rows);
const lessons = skeleton.module.chapters.flatMap((c) => c.lessons);
const ctxAt = (n: number): CourseContext =>
  courseContextFor(skeleton, lessons[n - 1].id)!;

function draftWith(
  text: string,
  n: number,
  over: Partial<LessonDraft> = {},
): LessonDraft {
  const lesson = lessons[n - 1];
  return {
    lessonId: lesson.id,
    lessonType: lesson.type,
    title: lesson.title,
    targetItemIds: lesson.itemIds,
    teach: { blocks: [{ type: 'text', text }] },
    practice: {
      templates: [{ targetItemId: lesson.itemIds[0], mode: 'recognition' }],
    },
    check: {
      questions: [
        {
          id: 'q1',
          targetItemId: lesson.itemIds[0],
          prompt: 'Which is it?',
          answerType: 'multiple-choice',
          choices: ['a', 'b', 'c', 'd'],
          correctAnswer: 'a',
        },
      ],
    },
    meta: {
      generatedAt: new Date().toISOString(),
      model: 'm',
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    },
    ...over,
  };
}

const errors = (text: string, n: number) =>
  checkCourseRules(draftWith(text, n), ctxAt(n)).errors;

describe('sounds (P1)', () => {
  it('fails が before lesson 15 and allows it from there', () => {
    expect(errors('かぎ', 14).join()).toMatch(/uses ぎ/);
    expect(errors('かぎ', 15).join()).not.toMatch(/uses/);
  });

  it('fails っ before lesson 19 and allows it from there', () => {
    expect(errors('きって', 18).join()).toMatch(/uses っ/);
    expect(errors('きって', 19).join()).not.toMatch(/uses/);
  });

  it('fails ー before lesson 39 and allows it from there', () => {
    expect(errors('コーヒー', 38).join()).toMatch(/uses ー/);
    expect(errors('コーヒー', 39)).toEqual([]);
  });

  it('checks every field the learner reads, and ignores the middle dot', () => {
    const blocks = draftWith('', 2).teach;
    const draft = draftWith('', 2, {
      teach: {
        blocks: [
          ...blocks.blocks.slice(0, 0),
          { type: 'example', japanese: 'か', reading: 'さ', translation: 'x' },
        ],
      },
    });
    expect(checkCourseRules(draft, ctxAt(2)).errors.join()).toMatch(/uses さ/);
    expect(errors('か・き', 2)).toEqual([]);
  });

  it('warns, never fails, on a long vowel in draft text before lesson 18', () => {
    const { errors: errs, warnings } = checkCourseRules(
      draftWith('おうち', 13),
      ctxAt(13),
    );
    expect(errs).toEqual([]);
    expect(warnings.join()).toMatch(/long vowel/);
    expect(
      checkCourseRules(draftWith('おうち', 18), ctxAt(18)).warnings,
    ).toEqual([]);
  });
});

describe('kanji (P9)', () => {
  it('fails any kanji outside a kanji lesson', () => {
    expect(errors('母', 51).join()).toMatch(/outside a kanji lesson/);
    expect(errors('はは', 51)).toEqual([]);
  });

  it('allows a kanji lesson its own and earlier kanji, and no others', () => {
    expect(errors('人 大 小', 49)).toEqual([]);
    expect(errors('母', 49).join()).toMatch(/not taught/);
    expect(errors('人 母', 54).join()).not.toMatch(/uses kanji 人/);
  });
});

describe('verb endings (P7)', () => {
  it('fails ます before lesson 87 and allows it from there', () => {
    expect(errors('たべます', 86).join()).toMatch(/uses ます/);
    expect(errors('たべます', 87)).toEqual([]);
  });

  it('does not trip on ます inside a phrase already learned', () => {
    expect(errors('おねがいします', 23)).toEqual([]);
    expect(errors('おはようございます', 21)).toEqual([]);
  });

  it('does trip on that phrase before it is learned', () => {
    expect(errors('おはよう ございます', 20).join()).toMatch(/uses ます/);
  });

  it('allows の in the pattern があります before ます is taught', () => {
    expect(errors('ほん が あります', 74)).toEqual([]);
    expect(errors('あります', 73).join()).toMatch(/uses ます/);
  });

  it('fails each later ending until its own lesson', () => {
    expect(errors('いきませんか', 99).join()).toMatch(/ませんか/);
    expect(errors('いきましょう', 100).join()).toMatch(/ましょう/);
    expect(errors('まってください', 102).join()).toMatch(/てください/);
    expect(errors('いきたいです', 116).join()).toMatch(/たいです/);
    expect(errors('いきたいです', 117)).toEqual([]);
  });

  it('fails でした except inside the phrase', () => {
    expect(errors('ごちそうさまでした', 25)).toEqual([]);
    expect(errors('せんせい でした', 95).join()).toMatch(/でした/);
  });

  it('allows ください from lesson 25 while てください waits', () => {
    expect(errors('おちゃ ください', 25)).toEqual([]);
    expect(errors('みて ください', 25).join()).toMatch(/てください/);
  });
});

describe('sound lessons (P2, P3)', () => {
  const lesson = lessons[17];
  const typed = (
    over: Partial<LessonDraft['check']['questions'][number]> = {},
  ) =>
    lesson.itemIds.map((id, i) => ({
      id: `q${i}`,
      targetItemId: id,
      prompt: `How does ${spec.surfaces[id]} sound?`,
      answerType: 'typed' as const,
      correctAnswer: spec.surfaces[id],
      ...over,
    }));
  const check = (questions: LessonDraft['check']['questions']) =>
    checkCourseRules(draftWith('', 18, { check: { questions } }), ctxAt(18))
      .errors;

  it('passes with a typed check per target', () => {
    expect(check(typed())).toEqual([]);
  });

  it('fails when a target has no typed check', () => {
    expect(check(typed().slice(1)).join()).toMatch(/needs a typed check/);
  });

  it('fails when the prompt gives away the rōmaji', () => {
    const questions = typed();
    questions[0].prompt = `${spec.surfaces[lesson.itemIds[0]]} is said okaasan. Type it.`;
    expect(check(questions).join()).toMatch(/needs a typed check/);
  });

  it('fails when the prompt does not show the word', () => {
    const questions = typed();
    questions[0].prompt = 'Type the word for mother.';
    expect(check(questions).join()).toMatch(/needs a typed check/);
  });

  it('fails a sound card carrying an itemId, in a lesson with no kana targets', () => {
    const card = {
      type: 'kana',
      char: 'が',
      romaji: 'ga',
      itemId: 'ja:kana:ka',
    };
    const draft = draftWith('', 15, {
      teach: { blocks: [card as TeachBlock] },
    });
    expect(checkCourseRules(draft, ctxAt(15)).errors.join()).toMatch(/itemId/);
  });

  it('warns when a card the outline wants is missing', () => {
    expect(
      checkCourseRules(draftWith('', 15), ctxAt(15)).warnings.join(),
    ).toMatch(/no card for が/);
  });

  it('keeps an F-Kana lesson free to put an itemId on its cards', () => {
    const draft = draftWith('', 2, {
      teach: {
        blocks: [
          { type: 'kana', char: 'か', romaji: 'ka', itemId: 'ja:kana:ka' },
        ],
      },
    });
    expect(checkCourseRules(draft, ctxAt(2)).errors).toEqual([]);
  });
});

describe('open checks', () => {
  it('fails an open multiple-choice check', () => {
    const draft = draftWith('', 120, {
      check: {
        questions: [
          {
            id: 'q1',
            targetItemId: lessons[119].itemIds[0],
            prompt: 'Write it',
            answerType: 'multiple-choice',
            choices: ['a', 'b', 'c', 'd'],
            correctAnswer: 'a',
            grading: 'open',
          },
        ],
      },
    });
    expect(checkCourseRules(draft, ctxAt(120)).errors.join()).toMatch(
      /open check/,
    );
  });
});

describe('scriptProblems', () => {
  it('reports untaught sounds and kanji in a passage', () => {
    expect(scriptProblems('私', ctxAt(10))).toEqual([
      'uses kanji 私 outside a kanji lesson',
    ]);
  });
});
