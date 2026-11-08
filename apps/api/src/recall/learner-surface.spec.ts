import { learnerSurface, mayInferMastery } from './learner-surface';

describe('learnerSurface', () => {
  const surface = (
    type: 'KANA' | 'VOCAB' | 'KANJI' | 'GRAMMAR',
    d: string,
    r: string | null,
  ) => learnerSurface({ type, display: d, reading: r });

  it('shows a word spelled with kanji in kana', () => {
    expect(surface('VOCAB', '母', 'はは')).toBe('はは');
  });

  it('leaves a kana word alone', () => {
    expect(surface('VOCAB', 'ノート', 'ノート')).toBe('ノート');
  });

  it('keeps the spelling when a word has no reading to show', () => {
    expect(surface('VOCAB', '母', null)).toBe('母');
    expect(surface('VOCAB', '母', '  ')).toBe('母');
  });

  it('leaves a kanji item and a kana item alone', () => {
    expect(surface('KANJI', '母', 'ボ')).toBe('母');
    expect(surface('KANA', 'あ', 'あ')).toBe('あ');
  });

  it('turns the "stem +" pattern into 〜 and leaves other grammar alone', () => {
    expect(surface('GRAMMAR', 'stem +たいです', null)).toBe('〜たいです');
    expect(surface('GRAMMAR', '～ましょう', null)).toBe('～ましょう');
    expect(surface('GRAMMAR', 'て-form', null)).toBe('て-form');
  });
});

describe('mayInferMastery', () => {
  it.each([
    ['KANA', true],
    ['VOCAB', true],
    ['GRAMMAR', true],
    ['KANJI', false],
  ] as const)('%s → %s', (type, expected) => {
    expect(mayInferMastery({ type })).toBe(expected);
  });
});
