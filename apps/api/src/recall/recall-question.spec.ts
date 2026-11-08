import {
  kanjiReadings,
  recapBackFor,
  type RecallableItem,
  recallQuestionFor,
} from './recall-question';

const item = (over: Partial<RecallableItem>): RecallableItem => ({
  type: 'VOCAB',
  display: '',
  reading: null,
  meaning: null,
  data: {},
  ...over,
});

describe('recallQuestionFor', () => {
  it('kana → rōmaji from data, plain exact match', () => {
    expect(
      recallQuestionFor(
        item({
          type: 'KANA',
          display: 'あ',
          reading: 'あ',
          data: { romaji: 'a' },
        }),
      ),
    ).toEqual({
      prompt: 'Type the rōmaji for 「あ」',
      expected: 'a',
      accepted: ['a'],
      check: 'romaji',
    });
  });

  it('kana without rōmaji is not quizzable (its reading is the prompt)', () => {
    expect(
      recallQuestionFor(item({ type: 'KANA', display: 'あ', reading: 'あ' })),
    ).toBeNull();
  });

  it('vocab with kanji is shown in kana and asks its meaning (G.4.c)', () => {
    expect(
      recallQuestionFor(
        item({ display: '猫', reading: 'ねこ', meaning: 'cat' }),
      ),
    ).toEqual({
      prompt: 'What does 「ねこ」 mean?',
      expected: 'cat',
      accepted: ['cat'],
      check: 'meaning',
    });
  });

  it('never asks a reading for a word, and a word with no meaning is not quizzable', () => {
    expect(
      recallQuestionFor(item({ display: '猫', reading: 'ねこ' })),
    ).toBeNull();
  });

  it('adds context to the words kana display makes identical', () => {
    const prompt = (display: string, reading: string) =>
      recallQuestionFor(item({ display, reading, meaning: 'x' }))?.prompt;
    expect(prompt('さん', 'さん')).toBe(
      'What does 「さん」 mean after a name?',
    );
    expect(prompt('三', 'さん')).toBe('What does 「さん」 mean as a number?');
    expect(prompt('二', 'に')).toBe('What does 「に」 mean as a number?');
    expect(
      recallQuestionFor(item({ type: 'GRAMMAR', display: 'に', meaning: 'x' }))
        ?.prompt,
    ).toBe('What does 「に」 mean?');
  });

  it('grammar prompts use the learner surface', () => {
    const prompt = (display: string) =>
      recallQuestionFor(item({ type: 'GRAMMAR', display, meaning: 'x' }))
        ?.prompt;
    expect(prompt('stem +たいです')).toBe('What does 「〜たいです」 mean?');
    expect(prompt('～ましょう')).toBe('What does 「～ましょう」 mean?');
  });

  it('kana-only vocab asks for the meaning; null without one', () => {
    expect(
      recallQuestionFor(
        item({ display: 'すし', reading: 'すし', meaning: 'sushi' }),
      ),
    ).toEqual({
      prompt: 'What does 「すし」 mean?',
      expected: 'sushi',
      accepted: ['sushi'],
      check: 'meaning',
    });
    expect(
      recallQuestionFor(item({ display: 'すし', reading: 'すし' })),
    ).toBeNull();
  });

  it('grammar → meaning; a shell without one is not quizzable', () => {
    expect(
      recallQuestionFor(
        item({
          type: 'GRAMMAR',
          display: 'です',
          meaning: 'to be (polite copula)',
        }),
      ),
    ).toMatchObject({ expected: 'to be (polite copula)', check: 'meaning' });
    expect(
      recallQuestionFor(item({ type: 'GRAMMAR', display: 'です' })),
    ).toBeNull();
  });
});

describe('recapBackFor (the lesson recap card)', () => {
  it('gives a kana its rōmaji, never the kana again', () => {
    expect(
      recapBackFor(
        item({
          type: 'KANA',
          display: 'あ',
          reading: 'あ',
          data: { romaji: 'a' },
        }),
      ),
    ).toBe('a');
  });

  it('gives a word its meaning, even when its data has a rōmaji', () => {
    expect(
      recapBackFor(
        item({
          display: 'かぎ',
          reading: 'かぎ',
          meaning: 'key',
          data: { romaji: 'kagi' },
        }),
      ),
    ).toBe('key');
  });

  it('gives a grammar point its meaning', () => {
    expect(
      recapBackFor(
        item({ type: 'GRAMMAR', display: 'に', meaning: 'marks where' }),
      ),
    ).toBe('marks where');
  });

  it('gives a kanji its meaning, then its readings with no KANJIDIC markers', () => {
    const back = recapBackFor(
      item({
        type: 'KANJI',
        display: '一',
        reading: 'ひと-',
        meaning: 'one',
        data: {
          on_readings: ['イチ', 'イツ'],
          kun_readings: ['ひと-', 'ひと.つ'],
        },
      }),
    );
    expect(back).toBe('one\nイチ・イツ・ひと・ひと(つ)');
    expect(back).not.toMatch(/[-.]/);
  });

  it('is null for a shell with nothing to show', () => {
    expect(recapBackFor(item({ display: 'かぎ', meaning: ' ' }))).toBeNull();
    expect(recapBackFor(item({ type: 'GRAMMAR', display: 'に' }))).toBeNull();
    expect(
      recapBackFor(item({ type: 'KANA', display: 'あ', reading: 'あ' })),
    ).toBeNull();
    expect(recapBackFor(item({ type: 'KANJI', display: '一' }))).toBeNull();
  });

  it('shows a kanji with readings and no meaning yet', () => {
    expect(
      recapBackFor(item({ type: 'KANJI', display: '日', reading: 'ひ' })),
    ).toBe('ひ');
  });
});

describe('kanji readings (KANJIDIC2 markers)', () => {
  const ichi = item({
    type: 'KANJI',
    display: '一',
    reading: 'ひと-',
    meaning: 'one',
    data: { on_readings: ['イチ', 'イツ'], kun_readings: ['ひと-', 'ひと.つ'] },
  });

  it('accepts every on/kun reading, with "-" dropped and "." joined to its okurigana', () => {
    expect(kanjiReadings(ichi)).toEqual({
      accepted: ['イチ', 'イツ', 'ひと', 'ひとつ'],
      shown: 'イチ・イツ・ひと・ひと(つ)',
    });
  });

  it('never accepts the bare stem of an okurigana reading (生: い.きる ≠ い)', () => {
    const sei = item({
      type: 'KANJI',
      display: '生',
      reading: 'い.きる',
      data: { on_readings: ['セイ'], kun_readings: ['い.きる', 'う.まれる'] },
    });
    expect(kanjiReadings(sei)).toEqual({
      accepted: ['セイ', 'いきる', 'うまれる'],
      shown: 'セイ・い(きる)・う(まれる)',
    });
  });

  it('asks for "a reading" and accepts any of them', () => {
    expect(recallQuestionFor(ichi)).toEqual({
      prompt: 'Type a reading for 「一」',
      expected: 'イチ・イツ・ひと・ひと(つ)',
      accepted: ['イチ', 'イツ', 'ひと', 'ひとつ'],
      check: 'reading',
    });
  });

  it('falls back to the item reading when the data has none; null with nothing', () => {
    expect(
      recallQuestionFor(item({ type: 'KANJI', display: '日', reading: 'ひ' })),
    ).toMatchObject({ accepted: ['ひ'], expected: 'ひ' });
    expect(
      recallQuestionFor(item({ type: 'KANJI', display: '日' })),
    ).toBeNull();
  });
});
