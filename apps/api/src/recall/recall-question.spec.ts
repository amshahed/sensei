import {
  kanjiReadings,
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

  it('vocab with kanji → kana reading', () => {
    expect(
      recallQuestionFor(
        item({ display: '猫', reading: 'ねこ', meaning: 'cat' }),
      ),
    ).toEqual({
      prompt: 'Type the reading for 「猫」',
      expected: 'ねこ',
      accepted: ['ねこ'],
      check: 'reading',
    });
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

describe('kanji readings (KANJIDIC2 markers)', () => {
  const ichi = item({
    type: 'KANJI',
    display: '一',
    reading: 'ひと-',
    meaning: 'one',
    data: { on_readings: ['イチ', 'イツ'], kun_readings: ['ひと-', 'ひと.つ'] },
  });

  it('accepts every on/kun reading, with "-" dropped and "." resolved both ways', () => {
    expect(kanjiReadings(ichi)).toEqual({
      accepted: ['イチ', 'イツ', 'ひと', 'ひとつ'],
      shown: 'イチ・イツ・ひと・ひと(つ)',
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
