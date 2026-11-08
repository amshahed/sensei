import { WritingEvalService } from './writing-eval.service';

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

/** A check on the kana itself wants its own sound (test.md N1, N5). */
const STRICT_REJECTED: Array<[string, string]> = [
  ['wa', 'は'],
  ['wa', 'ha'],
  ['wa', 'ハ'],
  ['e', 'へ'],
  ['wa.', 'は'],
  ['wa', 'は。'],
  ['o', 'を'],
  ['wana', 'はな'],
];
const STRICT_ACCEPTED: Array<[string, string]> = [
  ['ha', 'は'],
  ['は', 'は'],
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
