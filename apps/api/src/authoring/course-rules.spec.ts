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

describe('verbs and endings as whole words (test.md F1, F4)', () => {
  it('allows あります and います after their patterns are taught', () => {
    for (const japanese of [
      'ほん は つくえ の うえ に あります',
      'せんせい は どこ に いますか',
    ]) {
      expect(
        checkCourseRules(draftWith(japanese, 81), ctxAt(81)).errors,
      ).toEqual([]);
    }
  });

  it.each([
    [77, 'ほん が あります。 かばん も あります'],
    [81, 'ほん は つくえ の うえ に あります'],
    [81, 'せんせい は どこ に いますか'],
    [83, 'ぎんこう は えき の みぎ に あります'],
    [75, 'いますか'],
    [74, 'あります'],
    [75, 'います'],
    [21, 'おはよう ございます'],
    [22, 'ありがとう ございます'],
    [23, 'おねがい します'],
    [24, 'よろしく おねがい します'],
    [22, 'すみません かばん'],
    [47, 'がくせい じゃありません か'],
    [88, 'ありません'],
    [88, 'いません'],
    [92, 'ありました'],
    [92, 'いました'],
    [103, 'きて ください'],
    [117, 'たべたい です'],
  ])('lesson %i passes %s', (lesson, japanese) => {
    expect(errors(japanese, lesson)).toEqual([]);
  });

  // Was a pass before F.2.c: で there is the particle, taught at lesson 91.
  it('reads それ で した at lesson 60 as the particle で, never でした', () => {
    const errs = errors('それ で した', 60).join();
    expect(errs).not.toMatch(/uses でした/);
    expect(errs).toContain('uses the particle で before it is taught');
  });

  it.each([
    [73, 'あります', 'ます'],
    [74, 'います', 'ます'],
    [81, 'かいます', 'ます'],
    [81, 'ほん を かいます', 'ます'],
    [81, 'いきますか', 'ます'],
    [86, 'たべ ます', 'ます'],
    [81, 'ありません', 'ません'],
    [87, 'ありません', 'ません'],
    [81, 'いません', 'ません'],
    [87, 'いません', 'ません'],
    [81, 'ありました', 'ました'],
    [91, 'ありました', 'ました'],
    [81, 'いました', 'ました'],
    [91, 'いました', 'ました'],
    [60, 'がくせい でした', 'でした'],
    [102, 'きて ください', 'てください'],
    [116, 'たべたい です', 'たいです'],
  ])('lesson %i rejects %s for %s', (lesson, japanese, marker) => {
    expect(errors(japanese, lesson).join()).toContain(`uses ${marker} `);
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

  it.each(['(okāsan)', '(okaasan)', '(OKĀSAN)', '(oka asan)'])(
    'fails a prompt spelling the rōmaji as %s (F6)',
    (romaji) => {
      const questions = typed();
      const index = lesson.itemIds.findIndex(
        (id) => spec.surfaces[id] === 'おかあさん',
      );
      questions[index].prompt = `おかあさん ${romaji}. Type it.`;
      expect(check(questions).join()).toMatch(/needs a typed check/);
    },
  );

  it('fails a prompt spelling っ and おう with a macron (F6)', () => {
    const gakkou = lessons.find(
      (l) =>
        l.typedReading &&
        l.itemIds.some((id) => spec.surfaces[id] === 'がっこう'),
    )!;
    const n = lessons.indexOf(gakkou) + 1;
    const questions = gakkou.itemIds.map((id, i) => ({
      id: `q${i}`,
      targetItemId: id,
      prompt:
        spec.surfaces[id] === 'がっこう'
          ? 'がっこう (gakkō). Type it.'
          : `How does ${spec.surfaces[id]} sound?`,
      answerType: 'typed' as const,
      correctAnswer: spec.surfaces[id],
    }));
    const draft = draftWith('', n, { check: { questions } });
    expect(checkCourseRules(draft, ctxAt(n)).errors.join()).toMatch(
      /needs a typed check/,
    );
  });

  it('fails when the only typed check asks for the meaning, not the reading', () => {
    const questions = typed();
    questions[0].correctAnswer = 'mother';
    expect(check(questions).join()).toMatch(/needs a typed check/);
  });

  it('fails when the only typed check is open', () => {
    const questions = typed();
    questions[0].grading = 'open';
    expect(check(questions).join()).toMatch(/needs a typed check/);
  });

  it('fails a prompt that adds rōmaji to the pipeline wording', () => {
    const questions = typed();
    const word = spec.surfaces[lesson.itemIds[0]];
    questions[0].prompt = `Read this word and type how it sounds: ${word} (okaasan)`;
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

describe('particles in a typed answer (H.2.a, test.md F3)', () => {
  const typedCheck = (
    correctAnswer: string,
    n: number,
    over: Partial<LessonDraft['check']['questions'][number]> = {},
  ) =>
    checkCourseRules(
      draftWith('', n, {
        check: {
          questions: [
            {
              id: 'q1',
              targetItemId: lessons[n - 1].itemIds[0],
              prompt: 'Type it',
              answerType: 'typed',
              correctAnswer,
              ...over,
            },
          ],
        },
      }),
      ctxAt(n),
    ).errors;

  it('fails a closed typed answer with the particle joined to a word', () => {
    expect(typedCheck('わたしは がくせい です', 43).join()).toMatch(
      /particle in "わたしは"/,
    );
  });

  it.each([
    ['わたし は がくせい です', 43],
    ['ごはん を たべます', 89],
    ['こんにちは', 21],
    ['こんにちは！', 21],
  ])('passes %s', (answer, n) => {
    expect(typedCheck(answer, n)).toEqual([]);
  });

  // test.md N2: no particle exists yet at 14 and 21, and a known word written
  // across spaces has none at any lesson.
  it.each([
    ['はは', 14],
    ['おはな', 14],
    ['おはよう ございます', 21],
    ['おはよう ございます', 60],
  ])('passes %s at lesson %i, where は is part of the word', (answer, n) => {
    expect(typedCheck(answer, n)).toEqual([]);
  });

  it.each([
    ['ごはんを たべます', 89, 'ごはんを'],
    ['ばんは いつ です か', 60, 'ばんは'],
  ])('fails %s at lesson %i', (answer, n, word) => {
    expect(typedCheck(answer, n).join()).toContain(`particle in "${word}"`);
  });

  it('does not check an open typed question', () => {
    expect(
      typedCheck('わたしは がくせい です', 43, { grading: 'open' }),
    ).toEqual([]);
  });

  it('does not check a multiple-choice answer', () => {
    expect(
      typedCheck('わたしは がくせい です', 43, {
        answerType: 'multiple-choice',
        choices: ['わたしは がくせい です', 'b', 'c', 'd'],
      }),
    ).toEqual([]);
  });
});

describe('untaught particles (F.2.c, P2, P7)', () => {
  // Lessons 15 to 20 also want typed checks, which these drafts don't have.
  const onlyParticles = (errs: string[]) =>
    errs.filter((e) => e.includes('the particle'));
  const choiceCheck = (choices: string[], n: number) =>
    checkCourseRules(
      draftWith('', n, {
        check: {
          questions: [
            {
              id: 'q1',
              targetItemId: lessons[n - 1].itemIds[0],
              prompt: 'Which one?',
              answerType: 'multiple-choice',
              choices,
              correctAnswer: choices[0],
            },
          ],
        },
      }),
      ctxAt(n),
    ).errors.filter((e) => e.includes('the particle'));

  it.each([
    ['ともだち と がっこう', 20, 'と'],
    ['ともだち と がっこう。 おかあさん の しゃしん。', 20, 'の'],
    ['おかあさん の しゃしん', 20, 'の'],
    ['あなた は せんせい です か', 43, 'か'],
    ['あなた は せんせい です か？', 43, 'か'],
    ['そう です ね', 24, 'ね'],
    // はい is a known word, but it can't swallow the particle in は いちご.
    ['わたし は いちご', 42, 'は'],
    // にほん is a known word, but no word starts with a lone particle.
    ['ともだち に ほん', 60, 'に'],
    ['がっこう から えき まで', 83, 'から'],
    // F.2.d: the kana reading lessons stay covered.
    ['はな と ひと', 8, 'と'],
    ['ねこ と いぬ', 9, 'と'],
    // Lesson 43's original preview, verbatim: か before 。 ends a sentence.
    [
      "To ask a question, just add か at the end: あなた は いしゃ です か 。 means 'Are you a doctor?' Easy, right?",
      43,
      'か',
    ],
    ['にほん から きました', 49, 'から'],
    // ご (five) is a known word of one kana: "five and six" uses と.
    ['ご と ろく', 70, 'と'],
  ])('rejects %s at lesson %i for %s', (japanese, n, particle) => {
    expect(onlyParticles(errors(japanese, n))).toContainEqual(
      expect.stringMatching(
        new RegExp(
          `^teach\\[0\\]: uses the particle ${particle} before it is taught, in "`,
        ),
      ),
    );
  });

  it('quotes the stretch of Japanese the particle was used in (F.2.d)', () => {
    expect(onlyParticles(errors('ともだち と がっこう', 20))).toEqual([
      'teach[0]: uses the particle と before it is taught, in "ともだち と がっこう"',
    ]);
    expect(
      onlyParticles(
        errors('ともだち と がっこう。 おかあさん の しゃしん。', 20),
      ),
    ).toEqual([
      'teach[0]: uses the particle と before it is taught, in "ともだち と がっこう"',
      'teach[0]: uses the particle の before it is taught, in "おかあさん の しゃしん"',
    ]);
  });

  it.each([
    ['あなた は せんせい です か', 44],
    ['わたし の ほん', 46],
    ['へや に いぬ が います', 83],
    ['か き く け こ', 2],
    ['は ひ ふ へ ほ', 7],
    ['は — はな', 7],
    ['Two small marks turn か into が', 15],
    ["The little words と (and) and の ('s)", 20],
    ['In ちょっと you pause before と.', 20],
    ['おげんき です か', 24],
    ['いち に さん', 65],
    ['ともだちと がっこう', 20],
    ['わたし は いちご', 43],
    ['に ほん', 45],
    ['ろく じ に', 99],
    // Rows still pass once に, し and ご are known words (lesson 65).
    ['な に ぬ ね の', 70],
    ['さ し す せ そ', 70],
    ['いち に さん し ご', 70],
  ])('accepts %s at lesson %i', (japanese, n) => {
    expect(onlyParticles(errors(japanese, n))).toEqual([]);
  });

  // test.md F1: a kana lesson's own sounds, shown next to example words. The
  // first nine are the Tester's reproduction on b16f481, where all nine failed.
  it.each([
    ['た ち つ て と そと くつ', 5], // lesson 2's passage shape: the row, then words
    ['な に ぬ ね の ねこ いぬ', 6],
    ['ま み む め も もも あめ', 9],
    ['や ゆ よ やま ゆき', 10],
    ['と: そと (outside)', 5],
    ['In はな, は says ha.', 7],
    ['かさ (か + さ)', 4],
    ['Two small marks turn か into が: かぎ (key)', 15],
    ['で: でんわ (phone)', 16],
    ['こえ か き く け こ', 2], // a row after a word is a listing
    ['いぬ な に ぬ ね の', 6],
    ['ね ねこ ねずみ', 6],
    ['Words with ね: ね, ねこ', 6],
    ['か: かさ', 2],
    ['名 な, 何 なに', 62], // a kanji ends the stretch
    ['一 いち, 二 に, 三 さん', 50],
    // The PM's gloss in lesson 20, verbatim.
    [
      "The little words と (and), の ('s) and みて (look) come later in the course.",
      20,
    ],
  ])('accepts kana-lesson content %s at lesson %i (F.2.d)', (text, n) => {
    expect(onlyParticles(errors(text, n))).toEqual([]);
  });

  // Known residuals of F.2.d, pinned so a change to them is deliberate.
  it('still rejects a mention written right after a word with no punctuation', () => {
    // The draft prompt asks for a lone kana to be set apart (R1.4).
    expect(onlyParticles(errors('はな は says ha', 7))).toEqual([
      'teach[0]: uses the particle は before it is taught, in "はな は"',
    ]);
  });

  it.each([
    ['ねこ の え', 9], // a particle before a one-kana word
    ['日本 から', 49], // a particle after a kanji
  ])('misses %s at lesson %i, left to review', (text, n) => {
    expect(onlyParticles(errors(text, n))).toEqual([]);
  });

  it('rejects a choice that is only an untaught particle', () => {
    expect(choiceCheck(['です', 'か', 'を', 'は'], 43)).toEqual([
      'check q1: uses the particle か before it is taught',
      'check q1: uses the particle を before it is taught',
    ]);
  });

  it('rejects a closed answer that is only an untaught particle', () => {
    expect(choiceCheck(['か', 'です', 'さん', 'は'], 43)).toEqual([
      'check q1: uses the particle か before it is taught',
    ]);
  });

  it('accepts sound choices in a sound lesson', () => {
    expect(choiceCheck(['が', 'か', 'ざ', 'さ'], 15)).toEqual([]);
  });

  it('accepts a known word of one kana as a choice (に, two)', () => {
    expect(choiceCheck(['に', 'いち', 'さん', 'ご'], 65)).toEqual([]);
  });

  it('accepts a particle once it is taught', () => {
    expect(choiceCheck(['か', 'は', 'です', 'さん'], 44)).toEqual([]);
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
