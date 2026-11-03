import type { ReviewableItem } from '../reviews/review-question';
import {
  assessmentQuestionFor,
  sampleAcrossGroups,
} from './assessment-question';

const item = (over: Partial<ReviewableItem>): ReviewableItem => ({
  type: 'VOCAB',
  display: '',
  reading: null,
  meaning: null,
  data: {},
  ...over,
});

describe('assessmentQuestionFor', () => {
  it('kana → rōmaji, plain exact match', () => {
    expect(
      assessmentQuestionFor(
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
      check: 'romaji',
    });
  });

  it('vocab with kanji → kana reading', () => {
    expect(
      assessmentQuestionFor(
        item({ display: '学校', reading: 'がっこう', meaning: 'school' }),
      ),
    ).toMatchObject({ expected: 'がっこう', check: 'reading' });
  });

  it('kana-only vocab asks for the meaning (its reading is the prompt itself)', () => {
    expect(
      assessmentQuestionFor(
        item({ display: 'すし', reading: 'すし', meaning: 'sushi' }),
      ),
    ).toEqual({
      prompt: 'What does 「すし」 mean?',
      expected: 'sushi',
      check: 'meaning',
    });
    expect(
      assessmentQuestionFor(item({ display: 'すし', reading: 'すし' })),
    ).toBeNull();
  });

  it('grammar → meaning, null without one', () => {
    expect(
      assessmentQuestionFor(
        item({ type: 'GRAMMAR', display: '〜ください', meaning: 'please do' }),
      ),
    ).toMatchObject({ expected: 'please do', check: 'meaning' });
    expect(
      assessmentQuestionFor(item({ type: 'GRAMMAR', display: '〜ください' })),
    ).toBeNull();
  });

  it('is null when the expected answer would just echo the prompt', () => {
    expect(
      assessmentQuestionFor(
        item({ type: 'KANJI', display: '日', reading: null }),
      ),
    ).toBeNull();
  });
});

describe('sampleAcrossGroups', () => {
  /** Deterministic LCG in [0, 1). */
  const rng =
    (seed = 1) =>
    () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  const groups = [
    ['a1', 'a2', 'a3'],
    ['b1', 'b2'],
    [],
    ['c1', 'c2', 'c3', 'c4'],
  ];

  it('touches every non-empty group before taking a second from any', () => {
    const out = sampleAcrossGroups(groups, 3, rng());
    expect(new Set(out.map((x) => x[0]))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('returns everything (no duplicates) when size exceeds the pool', () => {
    const out = sampleAcrossGroups(groups, 50, rng(7));
    expect(out).toHaveLength(9);
    expect(new Set(out).size).toBe(9);
  });

  it('caps at size', () => {
    expect(sampleAcrossGroups(groups, 5, rng(3))).toHaveLength(5);
    expect(sampleAcrossGroups([], 5, rng())).toEqual([]);
  });
});
