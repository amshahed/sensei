import { WritingEvalService } from './writing-eval.service';
import { answerWords, typedAnswersMatch } from '../common/answer-romaji';
import { ALL_TYPED_ANSWERS, type TypedAnswer } from '../testing/typed-answers';

/**
 * Build a WritingEvalService with the kuromoji tokenizer loaded (onModuleInit
 * called), or fall back to the no-tokenizer path when `skipInit` is true.
 */
async function buildService({
  skipInit = false,
} = {}): Promise<WritingEvalService> {
  const svc = new WritingEvalService();
  if (!skipInit) await svc.onModuleInit();
  return svc;
}

const SPOKEN_ACCEPTED: Array<[string, string]> = [
  ['konnichiwa', 'こんにちは'],
  ['Konnichiwa', 'こんにちは'],
  ['konnichi wa', 'こんにちは'],
  ['konnichiwa!', 'こんにちは'],
  ['konbanwa', 'こんばんは'],
  ['watashi wa gakusei desu', 'わたし は がくせい です'],
  ['watashi ha gakusei desu', 'わたし は がくせい です'],
  ['kore o kudasai', 'これ を ください'],
  ['kore wo kudasai', 'これ を ください'],
  ['eki e ikimasu', 'えき へ いきます'],
  ['watashi wa hon wo yomimasu', 'わたし は ほん を よみます'],
  ['konnichiwa', 'こんにちは！'],
  ['watashi wa gakusei desu ka', 'わたし は がくせい です か？'],
  ['watashi wa gakusei desu ka?', 'わたし は がくせい です か？'],
];

const SPOKEN_REJECTED: Array<[string, string]> = [
  ['wana', 'はな'],
  ['wai', 'はい'],
  ['eya', 'へや'],
  ['こんにちわ', 'こんにちは'],
  ['watashi ga gakusei desu', 'わたし は がくせい です'],
  ['watashi ga gakusei desu ka', 'わたし は がくせい です か？'],
  // The whole answer has to match, at both ends (test.md N3).
  ['watashi wa gakusei desu ka', 'わたし は がくせい です'],
  ['ano watashi wa gakusei desu', 'わたし は がくせい です'],
];

/** Punctuation is not part of the answer (N6, H.2.c). */
const PUNCTUATION_ACCEPTED: Array<[string, string]> = [
  ['ともだちはいしゃです。', 'ともだち は いしゃ です'],
  ['ともだち は いしゃ です', 'ともだちはいしゃです。'],
  ['わたしはがくせいですか', 'わたし は がくせい です か？'],
  ['わたし は がくせい です か?', 'わたし は がくせい です か'],
  ['こんにちは!', 'こんにちは！'],
  ['こんにちは', 'こんにちは！'],
  ['はい、そうです', 'はい そうです'],
];

/** A check on the kana itself wants its own sound (test.md N1, N5). */
const STRICT_REJECTED: Array<[string, string]> = [
  ['wa', 'は'],
  ['wa', 'ha'],
  ['wa', 'ハ'],
  ['e', 'へ'],
  ['wa.', 'は'],
  ['wa', 'は。'],
  ['わ。', 'は'],
  ['o', 'を'],
  ['wana', 'はな'],
];
const STRICT_ACCEPTED: Array<[string, string]> = [
  ['ha', 'は'],
  ['は', 'は'],
  ['は。', 'は'],
  ['ha', 'ハ'],
  ['he', 'へ'],
  ['ha.', 'は'],
  ['ha!', 'は'],
  ['wo', 'を'],
  ['hana', 'はな。'],
  ['konnichiwa', 'こんにちは'],
  ['konnichiwa', 'こんにちは！'],
  ['konbanwa', 'こんばんは'],
  ['wa o', 'は を'],
];

describe('WritingEvalService — normalizeJapanese', () => {
  let svc: WritingEvalService;
  beforeAll(async () => {
    svc = await buildService();
  });

  it('converts romaji to hiragana', () => {
    expect(svc.normalizeJapanese('neko')).toBe('ねこ');
  });

  it('converts katakana to hiragana', () => {
    expect(svc.normalizeJapanese('ネコ')).toBe('ねこ');
  });

  it('leaves hiragana unchanged', () => {
    expect(svc.normalizeJapanese('ねこ')).toBe('ねこ');
  });

  it('trims leading/trailing whitespace', () => {
    expect(svc.normalizeJapanese('  ねこ  ')).toBe('ねこ');
  });

  it('collapses internal whitespace', () => {
    expect(svc.normalizeJapanese('ねこ  が  いる')).toBe('ねこ が いる');
  });

  it('converts mixed romaji + kana', () => {
    expect(svc.normalizeJapanese('neko ga iru')).toBe('ねこ が いる');
  });

  it.each([
    ['ノート', 'のおと'],
    ['コーヒー', 'こおひい'],
    ['ゲーム', 'げえむ'],
    ['ラーメン', 'らあめん'],
    ['スポーツ', 'すぽおつ'],
    ['シャーベット', 'しゃあべっと'],
    ['のーと', 'のおと'],
    ['no-to', 'のおと'],
  ])('spells the ー in %s as the vowel it holds: %s (H.2.d)', (text, norm) => {
    expect(svc.normalizeJapanese(text)).toBe(norm);
  });

  it('leaves a ー with no vowel before it alone', () => {
    expect(svc.normalizeJapanese('ンー')).toBe('んー');
  });
});

describe('WritingEvalService — katakana long vowels (H.2.d)', () => {
  let svc: WritingEvalService;
  beforeAll(async () => {
    svc = await buildService();
  }, 10_000);

  it.each([
    ['nooto', 'ノート'],
    ['no-to', 'ノート'],
    ['のーと', 'ノート'],
    ['ノート', 'ノート'],
    ['のおと', 'ノート'],
    ['koohii', 'コーヒー'],
    ['ko-hi-', 'コーヒー'],
    ['geemu', 'ゲーム'],
    ['raamen', 'ラーメン'],
    ['supootsu', 'スポーツ'],
    ['ノート', 'nooto'],
    ['スポーツ', 'supootsu'],
  ])('accepts %s for %s', (typed, answer) => {
    expect(svc.exactMatch(typed, answer)).toBe(true);
  });

  it.each([
    ['nouto', 'ノート'],
    ['kouhii', 'コーヒー'],
    ['supoutsu', 'スポーツ'],
    ['noto', 'ノート'],
  ])('rejects %s for %s, which spells another word', (typed, answer) => {
    expect(svc.exactMatch(typed, answer)).toBe(false);
  });

  it.each([
    ['gakkoo', 'がっこう'],
    ['arigato', 'ありがとう'],
  ])('leaves hiragana as it was: %s is still wrong for %s', (typed, answer) => {
    expect(svc.exactMatch(typed, answer)).toBe(false);
  });
});

describe('WritingEvalService — exactMatch (with tokenizer)', () => {
  let svc: WritingEvalService;
  beforeAll(async () => {
    svc = await buildService();
  }, 10_000);

  it.each([
    ['okaasan', 'おかあさん'],
    ['kitte', 'きって'],
    ['chotto', 'ちょっと'],
  ])('accepts the typed sound %s for %s (P2)', (typed, word) => {
    expect(svc.exactMatch(typed, word)).toBe(true);
  });

  it.each(SPOKEN_ACCEPTED)('accepts %s for %s (H.2.a)', (typed, answer) => {
    expect(svc.exactMatch(typed, answer)).toBe(true);
  });

  it.each(SPOKEN_REJECTED)('rejects %s for %s (H.2.a)', (typed, answer) => {
    expect(svc.exactMatch(typed, answer)).toBe(false);
  });

  it.each(PUNCTUATION_ACCEPTED)(
    'accepts %s for %s, ignoring punctuation (N6)',
    (typed, answer) => {
      expect(svc.exactMatch(typed, answer)).toBe(true);
    },
  );

  it.each(STRICT_REJECTED)(
    'rejects %s for %s on a kana target',
    (typed, answer) => {
      expect(svc.exactMatch(typed, answer, { kanaTarget: true })).toBe(false);
    },
  );

  it.each(STRICT_ACCEPTED)(
    'accepts %s for %s on a kana target',
    (typed, answer) => {
      expect(svc.exactMatch(typed, answer, { kanaTarget: true })).toBe(true);
    },
  );

  it('matches identical hiragana strings', () => {
    expect(svc.exactMatch('ねこ', 'ねこ')).toBe(true);
  });

  it('matches romaji learner input against hiragana exemplar', () => {
    expect(svc.exactMatch('neko', 'ねこ')).toBe(true);
  });

  it('matches katakana learner input against hiragana exemplar', () => {
    expect(svc.exactMatch('ネコ', 'ねこ')).toBe(true);
  });

  it('ignores spacing differences between answer and exemplar', () => {
    expect(svc.exactMatch('ねこ が いる', 'ねこがいる')).toBe(true);
  });

  it('returns false for wrong answer', () => {
    expect(svc.exactMatch('いぬ', 'ねこ')).toBe(false);
  });

  it('returns false when answer is empty', () => {
    expect(svc.exactMatch('', 'ねこ')).toBe(false);
  });
});

describe('WritingEvalService — exactMatch (tokenizer not loaded)', () => {
  let svc: WritingEvalService;
  beforeAll(async () => {
    svc = await buildService({ skipInit: true });
  });

  it.each(SPOKEN_ACCEPTED)('accepts %s for %s (H.2.a)', (typed, answer) => {
    expect(svc.exactMatch(typed, answer)).toBe(true);
  });

  it.each(SPOKEN_REJECTED)('rejects %s for %s (H.2.a)', (typed, answer) => {
    expect(svc.exactMatch(typed, answer)).toBe(false);
  });

  it.each(PUNCTUATION_ACCEPTED)(
    'accepts %s for %s, ignoring punctuation (N6)',
    (typed, answer) => {
      expect(svc.exactMatch(typed, answer)).toBe(true);
    },
  );

  it.each(STRICT_REJECTED)(
    'rejects %s for %s on a kana target',
    (typed, answer) => {
      expect(svc.exactMatch(typed, answer, { kanaTarget: true })).toBe(false);
    },
  );

  it.each(STRICT_ACCEPTED)(
    'accepts %s for %s on a kana target',
    (typed, answer) => {
      expect(svc.exactMatch(typed, answer, { kanaTarget: true })).toBe(true);
    },
  );

  it('still matches via whitespace-removal fallback', () => {
    expect(svc.exactMatch('ねこ が いる', 'ねこがいる')).toBe(true);
  });

  it('still converts romaji via wanakana', () => {
    expect(svc.exactMatch('neko', 'ねこ')).toBe(true);
  });

  it('still returns false for wrong answer', () => {
    expect(svc.exactMatch('いぬ', 'ねこ')).toBe(false);
  });
});

describe('WritingEvalService — answerForms (B.2.b, P3)', () => {
  let svc: WritingEvalService;
  beforeAll(async () => {
    svc = await buildService();
  }, 10_000);

  const formsOf = ({ answer, prompt, targetItemId }: TypedAnswer) =>
    svc.answerForms(answer, {
      prompt,
      kanaTarget: targetItemId.startsWith('ja:kana:'),
    });

  it.each(ALL_TYPED_ANSWERS.map((t) => [t.source, t] as const))(
    '%s has both forms, and the grader accepts each',
    (_source, t) => {
      const forms = formsOf(t);
      expect(forms).not.toBeNull();
      const kanaTarget = t.targetItemId.startsWith('ja:kana:');
      expect(svc.exactMatch(forms!.romaji, t.answer, { kanaTarget })).toBe(
        true,
      );
      expect(svc.exactMatch(forms!.kana, t.answer, { kanaTarget })).toBe(true);
    },
  );

  it('never spells the particle は as ha, nor こんにちは as konnichiha', () => {
    for (const t of ALL_TYPED_ANSWERS) {
      const kanaTarget = t.targetItemId.startsWith('ja:kana:');
      const { romaji } = formsOf(t)!;
      const words = answerWords(t.answer);
      if (words.join('') !== 'は' || !kanaTarget) {
        words.forEach((w, i) => {
          if (w === 'は') expect(romaji.split(' ')[i]).toBe('wa');
        });
      }
      expect(romaji).not.toMatch(/konnichiha|konbanha/);
    }
  });

  it.each([
    ['きっぷ', 'kippu'],
    ['ともだち は いしゃ です', 'tomodachi wa isha desu'],
    ['こんにちは', 'konnichiwa'],
    ['ノート', 'nooto'],
  ])('shows %s as itself and %s', (answer, romaji) => {
    expect(svc.answerForms(answer, { prompt: '' })).toEqual({
      kana: answer,
      romaji,
    });
  });

  it('shows the kana は on a kana check as ha (H.2.b)', () => {
    expect(svc.answerForms('は', { kanaTarget: true })).toEqual({
      kana: 'は',
      romaji: 'ha',
    });
  });

  it('takes the kana of an answer stored in rōmaji from its prompt', () => {
    expect(
      svc.answerForms('ao', {
        kanaTarget: true,
        prompt: 'Read this word and type how it sounds: あお',
      }),
    ).toEqual({ kana: 'あお', romaji: 'ao' });
    expect(
      svc.answerForms(' Nooto ', { prompt: 'Type ノート in rōmaji.' }),
    ).toEqual({ kana: 'ノート', romaji: 'nooto' });
  });

  it('picks the word in the prompt that is the answer, not the first kana', () => {
    expect(
      svc.answerForms('kasa', {
        prompt: 'In そら は あお, read かさ: type it.',
      }),
    ).toEqual({ kana: 'かさ', romaji: 'kasa' });
  });

  it.each([
    ['cat', 'What does ねこ mean? Type it in English.'],
    ['ao', 'Type the word for blue.'],
    ['日本', 'Type it: にほん'],
  ])('has no forms for %s with the prompt %j', (answer, prompt) => {
    expect(svc.answerForms(answer, { prompt })).toBeNull();
  });

  it('has no forms when the grader would not accept the rōmaji', () => {
    const spy = jest
      .spyOn(svc, 'exactMatch')
      .mockImplementation((typed) => typed !== 'kippu');
    expect(svc.answerForms('きっぷ', {})).toBeNull();
    spy.mockRestore();
  });
});

describe('typedAnswersMatch, the gate’s matcher, agrees with the grader', () => {
  let svc: WritingEvalService;
  beforeAll(async () => {
    svc = await buildService();
  }, 10_000);

  const cases: Array<[string, string, boolean]> = [
    ...SPOKEN_ACCEPTED.map(
      ([a, b]) => [a, b, false] as [string, string, boolean],
    ),
    ...SPOKEN_REJECTED.map(
      ([a, b]) => [a, b, false] as [string, string, boolean],
    ),
    ...PUNCTUATION_ACCEPTED.map(
      ([a, b]) => [a, b, false] as [string, string, boolean],
    ),
    ...STRICT_ACCEPTED.map(
      ([a, b]) => [a, b, true] as [string, string, boolean],
    ),
    ...STRICT_REJECTED.map(
      ([a, b]) => [a, b, true] as [string, string, boolean],
    ),
    ['nooto', 'ノート', false],
    ['nouto', 'ノート', false],
    ['raamen', 'らーめん', false],
  ];

  it.each(cases)(
    '%s against %s (kana check: %s)',
    (typed, stored, kanaTarget) => {
      expect(typedAnswersMatch(typed, stored, { kanaTarget })).toBe(
        svc.exactMatch(typed, stored, { kanaTarget }),
      );
    },
  );

  it('shows らーめん as raamen, which the grader accepts', () => {
    expect(svc.answerForms('らーめん', {})).toEqual({
      kana: 'らーめん',
      romaji: 'raamen',
    });
  });
});
