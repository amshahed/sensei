import {
  isTargetJlpt,
  getJlptLevel,
  buildVocabItem,
  JmdictWord,
} from './vocab';

const makeWord = (tags: string[], id = '1234567'): JmdictWord => ({
  id,
  kanji: [{ text: '猫', tags, common: true }],
  kana: [{ text: 'ねこ', tags: [], common: true, appliesToKanji: ['*'] }],
  sense: [{ gloss: [{ lang: 'en', text: 'cat' }] }],
});

describe('isTargetJlpt', () => {
  it('accepts N5 words', () => {
    expect(isTargetJlpt(makeWord(['jlpt-n5']))).toBe(true);
  });

  it('accepts N4 words', () => {
    expect(isTargetJlpt(makeWord(['jlpt-n4']))).toBe(true);
  });

  it('rejects N3 and above', () => {
    expect(isTargetJlpt(makeWord(['jlpt-n3']))).toBe(false);
    expect(isTargetJlpt(makeWord(['jlpt-n1']))).toBe(false);
    expect(isTargetJlpt(makeWord([]))).toBe(false);
  });

  it('detects JLPT tag on kana entry when kanji has none', () => {
    const word: JmdictWord = {
      id: '9999',
      kanji: [],
      kana: [
        {
          text: 'ねこ',
          tags: ['jlpt-n5'],
          common: true,
          appliesToKanji: ['*'],
        },
      ],
      sense: [{ gloss: [{ lang: 'en', text: 'cat' }] }],
    };
    expect(isTargetJlpt(word)).toBe(true);
  });
});

describe('getJlptLevel', () => {
  it('returns N5 for jlpt-n5 tag', () => {
    expect(getJlptLevel(makeWord(['jlpt-n5']))).toBe('N5');
  });

  it('returns N4 for jlpt-n4 tag', () => {
    expect(getJlptLevel(makeWord(['jlpt-n4']))).toBe('N4');
  });

  it('returns undefined for untagged word', () => {
    expect(getJlptLevel(makeWord([]))).toBeUndefined();
  });
});

describe('buildVocabItem', () => {
  it('maps a jmdict word to Item shape', () => {
    const word = makeWord(['jlpt-n5']);
    const item = buildVocabItem(word);
    expect(item).toMatchObject({
      id: 'ja:vocab:猫',
      language: 'ja',
      type: 'VOCAB',
      display: '猫',
      reading: 'ねこ',
      meaning: 'cat',
    });
    expect(item.data).toMatchObject({
      writing_forms: ['猫'],
      readings: ['ねこ'],
      senses: ['cat'],
      jmdict_id: '1234567',
      jlpt: 'N5',
    });
  });

  it('falls back to kana form when no kanji', () => {
    const word: JmdictWord = {
      id: '9999',
      kanji: [],
      kana: [
        {
          text: 'ねこ',
          tags: ['jlpt-n5'],
          common: true,
          appliesToKanji: ['*'],
        },
      ],
      sense: [{ gloss: [{ lang: 'en', text: 'cat' }] }],
    };
    const item = buildVocabItem(word);
    expect(item.id).toBe('ja:vocab:ねこ');
    expect(item.display).toBe('ねこ');
  });

  it('limits senses to 3 glosses', () => {
    const word: JmdictWord = {
      id: '111',
      kanji: [{ text: '犬', tags: ['jlpt-n5'], common: true }],
      kana: [{ text: 'いぬ', tags: [], common: true, appliesToKanji: ['*'] }],
      sense: [
        {
          gloss: [
            { lang: 'en', text: 'dog' },
            { lang: 'en', text: 'canine' },
            { lang: 'en', text: 'hound' },
            { lang: 'en', text: 'mutt' },
          ],
        },
      ],
    };
    const item = buildVocabItem(word);
    expect((item.data as { senses: string[] }).senses).toHaveLength(3);
  });
});
