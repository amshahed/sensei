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
];

const SPOKEN_REJECTED: Array<[string, string]> = [
  ['wana', 'はな'],
  ['wai', 'はい'],
  ['eya', 'へや'],
  ['こんにちわ', 'こんにちは'],
  ['watashi ga gakusei desu', 'わたし は がくせい です'],
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
