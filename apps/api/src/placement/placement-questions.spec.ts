import {
  buildPools,
  PLACEMENT_BUDGET,
  type PlacementItem,
  placementOutcome,
  placementQuestionFor,
  placementTierFor,
  samplePlacement,
  toQuestionDto,
} from './placement-questions';

/** Deterministic "random": cycles through a fixed sequence. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}
const first = () => 0;

const kana = (display: string, romaji: string, script = 'hiragana') =>
  ({
    id: `ja:kana:${display}`,
    type: 'KANA',
    display,
    reading: display,
    meaning: null,
    data: { romaji, script },
  }) satisfies PlacementItem;
const vocab = (display: string, meaning: string, senses: string[] = []) =>
  ({
    id: `ja:vocab:${display}`,
    type: 'VOCAB',
    display,
    reading: display,
    meaning,
    data: { senses: [meaning, ...senses] },
  }) satisfies PlacementItem;
const kanji = (
  display: string,
  reading: string,
  meaning: string,
  on: string[] = [],
  kun: string[] = [],
) =>
  ({
    id: `ja:kanji:${display}`,
    type: 'KANJI',
    display,
    reading,
    meaning,
    data: { on_readings: on, kun_readings: kun, meanings: [meaning] },
  }) satisfies PlacementItem;

const hiragana = [
  kana('あ', 'a'),
  kana('い', 'i'),
  kana('う', 'u'),
  kana('え', 'e'),
  kana('お', 'o'),
];
const words = [
  vocab('食べる', 'to eat', ['to live on']),
  vocab('飲む', 'to drink'),
  vocab('寝る', 'to sleep'),
  vocab('歩く', 'to walk'),
  vocab('生きる', 'to live on'), // a sense of 食べる: never a distractor for it
];
const kanjis = [
  kanji('食', 'ショク', 'eat', ['ショク', 'ジキ'], ['た.べる']),
  kanji('飲', 'イン', 'drink', ['イン'], ['の.む']),
  kanji('週', 'シュウ', 'week', ['シュウ']),
  kanji('駅', 'エキ', 'station', ['エキ']),
  kanji('父', 'ちち', 'father', ['フ'], ['ちち']),
  kanji('一', 'ひと-', 'one', ['イチ'], ['ひと-', 'ひと.つ']),
  kanji('二', 'ふた', 'two', ['ニ'], ['ふた']),
  kanji('三', 'み', 'three', ['サン'], ['み']),
];
const pools = buildPools([
  ...hiragana,
  kana('ア', 'a', 'katakana'),
  ...words,
  ...kanjis,
]);

describe('placementTierFor (I.3.d routing)', () => {
  it('routes by prior experience', () => {
    expect(placementTierFor('NONE')).toBeNull();
    expect(placementTierFor(null)).toBeNull();
    expect(placementTierFor('SOME_KANA')).toBe('KANA');
    expect(placementTierFor('FAIR_AMOUNT')).toBe('FULL');
    expect(placementTierFor('REFRESHER')).toBe('FULL');
  });
});

describe('placementQuestionFor (I.4.b formats)', () => {
  it('kana: names the script, offers same-script characters with other sounds', () => {
    const q = placementQuestionFor(hiragana[0], 'c1', pools, first)!;
    expect(q.prompt).toBe('Which hiragana is read “a”?');
    expect(q.display).toBeNull();
    const [part] = q.parts;
    expect(part.answer).toBe('あ');
    expect(part.choices).toHaveLength(4);
    expect(part.choices).toContain('あ');
    // ア shares the sound but is katakana: never offered for a hiragana question.
    expect(part.choices).not.toContain('ア');
  });

  it('kana: sound-alikes are never distractors (を is pronounced "o")', () => {
    const withWo = buildPools([...hiragana, kana('を', 'wo')]);
    for (let r = 0; r < 1; r += 0.05) {
      const o = placementQuestionFor(hiragana[4], 'c1', withWo, () => r)!;
      expect(o.parts[0].choices).not.toContain('を');
      const wo = placementQuestionFor(kana('を', 'wo'), 'c1', withWo, () => r)!;
      expect(wo.parts[0].choices).not.toContain('お');
    }
  });

  it('vocab: the meaning, with distractors that are not also its senses', () => {
    for (let r = 0; r < 1; r += 0.1) {
      const q = placementQuestionFor(words[0], 'c1', pools, () => r)!;
      expect(q.display).toBe('食べる');
      expect(q.parts[0].answer).toBe('to eat');
      expect(q.parts[0].choices).not.toContain('to live on');
      expect(new Set(q.parts[0].choices).size).toBe(4);
    }
  });

  it('vocab: a word spelled with kanji is shown in kana (G.4.c)', () => {
    const q = placementQuestionFor(
      { ...words[0], reading: 'たべる' },
      'c1',
      pools,
      first,
    )!;
    expect(q.display).toBe('たべる');
  });

  it('kanji: the kanji itself is still shown, since tests check prior knowledge (G.4.d)', () => {
    expect(placementQuestionFor(kanjis[0], 'c1', pools, first)!.display).toBe(
      kanjis[0].display,
    );
  });

  it('kanji: reading + meaning parts; distractor readings share the script and are not its own', () => {
    const q = placementQuestionFor(kanjis[0], 'c1', pools, first)!;
    expect(q.parts.map((p) => p.label)).toEqual(['Reading', 'Meaning']);
    const [reading, meaning] = q.parts;
    expect(reading.answer).toBe('ショク');
    expect(reading.choices.every((c) => /^[゠-ヿ]/.test(c))).toBe(true);
    expect(reading.choices).not.toContain('ジキ');
    expect(meaning.answer).toBe('eat');
  });

  it('kanji: KANJIDIC2 markers are resolved in the shown reading', () => {
    const q = placementQuestionFor(kanjis[5], 'c1', pools, first)!;
    expect(q.parts[0].answer).toBe('ひと');
    expect(q.parts[0].choices).not.toContain('ひと(つ)');
  });

  it('null when there is nothing fair to ask', () => {
    const grammar = {
      ...vocab('は', 'topic marker'),
      type: 'GRAMMAR' as const,
    };
    expect(placementQuestionFor(grammar, 'c1', pools, first)).toBeNull();
    expect(
      placementQuestionFor({ ...hiragana[0], data: {} }, 'c1', pools, first),
    ).toBeNull();
    // Too few distractors.
    const thin = buildPools(hiragana.slice(0, 3));
    expect(placementQuestionFor(hiragana[0], 'c1', thin, first)).toBeNull();
  });

  it('the learner-facing DTO carries no answers or chapter', () => {
    const q = placementQuestionFor(kanjis[0], 'c1', pools, first)!;
    const dto = toQuestionDto(q);
    expect(JSON.stringify(dto)).not.toContain('"answer"');
    expect(dto).not.toHaveProperty('chapterId');
  });
});

describe('samplePlacement (course order, I.4.f)', () => {
  const chapters = [
    { id: 'c1', items: hiragana },
    { id: 'c2', items: [words[0], kanjis[0], words[1]] },
    { id: 'c3', items: [kanjis[1], words[2]] },
  ];

  it('takes up to 2 askable items per chapter, in course and teaching order', () => {
    const qs = samplePlacement(chapters, 'FULL', pools, seq(0.9, 0.1, 0.5));
    const byChapter = qs.map((q) => q.chapterId);
    expect(byChapter).toEqual(['c1', 'c1', 'c2', 'c2', 'c3', 'c3']);
    // Within a chapter, picks keep teaching order.
    const c1 = qs.filter((q) => q.chapterId === 'c1').map((q) => q.itemId);
    const order = hiragana.map((h) => h.id);
    expect(order.indexOf(c1[0])).toBeLessThan(order.indexOf(c1[1]));
  });

  it('the kana tier asks kana only', () => {
    const qs = samplePlacement(chapters, 'KANA', pools, first);
    expect(qs.every((q) => q.type === 'KANA')).toBe(true);
    expect(qs).toHaveLength(2);
  });

  it('the kana quiz covers only the leading run of kana-only chapters', () => {
    // hiragana, then vocab, then katakana: acing kana must not skip the vocab.
    const qs = samplePlacement(
      [
        { id: 'hira', items: hiragana },
        { id: 'words', items: [words[0], words[1]] },
        {
          id: 'kata',
          items: [kana('ア', 'a', 'katakana'), kana('イ', 'i', 'katakana')],
        },
      ],
      'KANA',
      pools,
      first,
    );
    expect(new Set(qs.map((q) => q.chapterId))).toEqual(new Set(['hira']));
  });

  it('stops at the tier budget', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`,
      items: hiragana,
    }));
    expect(samplePlacement(many, 'KANA', pools, first)).toHaveLength(
      PLACEMENT_BUDGET.KANA,
    );
    expect(samplePlacement(many, 'FULL', pools, first)).toHaveLength(
      PLACEMENT_BUDGET.FULL,
    );
  });

  it('skips items it cannot ask and chapters with nothing askable', () => {
    const qs = samplePlacement(
      [
        { id: 'g', items: [{ ...words[0], type: 'GRAMMAR' as const }] },
        { id: 'c1', items: [{ ...hiragana[0], data: {} }, hiragana[1]] },
      ],
      'FULL',
      pools,
      first,
    );
    expect(qs.map((q) => q.itemId)).toEqual(['ja:kana:い']);
  });
});

describe('placementOutcome (first-miss rule, I.4.f)', () => {
  const chapters = ['c1', 'c2', 'c3', 'c4'];
  const qs = [
    { chapterId: 'c1' },
    { chapterId: 'c1' },
    { chapterId: 'c2' },
    { chapterId: 'c3' },
  ];
  const ok = { correct: true };
  const miss = { correct: false };

  it('starts at the chapter of the first miss; earlier chapters are skipped', () => {
    expect(placementOutcome(chapters, qs, [ok, ok, ok, miss])).toEqual({
      startChapterId: 'c3',
      skippedChapterIds: ['c1', 'c2'],
    });
  });

  it('a miss in the first chapter skips nothing', () => {
    expect(placementOutcome(chapters, qs, [ok, miss])).toEqual({
      startChapterId: 'c1',
      skippedChapterIds: [],
    });
  });

  it('no miss: starts after the last chapter the quiz reached', () => {
    expect(placementOutcome(chapters, qs, [ok, ok, ok, ok])).toEqual({
      startChapterId: 'c4',
      skippedChapterIds: ['c1', 'c2', 'c3'],
    });
  });

  it('chapters the quiz never sampled before the miss are skipped too', () => {
    expect(
      placementOutcome(
        chapters,
        [{ chapterId: 'c1' }, { chapterId: 'c4' }],
        [ok, miss],
      ),
    ).toEqual({ startChapterId: 'c4', skippedChapterIds: ['c1', 'c2', 'c3'] });
  });

  it('placing past everything leaves no start chapter', () => {
    expect(placementOutcome(['c1'], [{ chapterId: 'c1' }], [ok])).toEqual({
      startChapterId: null,
      skippedChapterIds: ['c1'],
    });
  });

  it('nothing asked, or the missed chapter is gone: start at the beginning', () => {
    expect(placementOutcome(chapters, [], [])).toEqual({
      startChapterId: 'c1',
      skippedChapterIds: [],
    });
    expect(placementOutcome(chapters, [{ chapterId: 'gone' }], [miss])).toEqual(
      { startChapterId: 'c1', skippedChapterIds: [] },
    );
  });
});
