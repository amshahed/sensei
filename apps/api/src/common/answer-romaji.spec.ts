import {
  answerRomaji,
  answerWords,
  isRomajiAnswer,
  SPOKEN,
} from './answer-romaji';

describe('answerRomaji (B.2.b)', () => {
  it.each([
    ['きっぷ', 'kippu'],
    ['がっこう', 'gakkou'],
    ['おかあさん', 'okaasan'],
    ['しゃしん', 'shashin'],
    ['ちょっと', 'chotto'],
    ['ごはん', 'gohan'],
    ['はは', 'haha'],
    ['おはよう ございます', 'ohayou gozaimasu'],
    ['ノート', 'nooto'],
    ['コーヒー', 'koohii'],
    ['ゲーム', 'geemu'],
  ])('spells the word %s as %s', (answer, romaji) => {
    expect(answerRomaji(answer)).toBe(romaji);
  });

  it.each([
    ['ともだち は いしゃ です', 'tomodachi wa isha desu'],
    ['えき へ いきます', 'eki e ikimasu'],
    ['ほん を よみます', 'hon o yomimasu'],
    ['こんにちは', 'konnichiwa'],
    ['こんばんは', 'konbanwa'],
    ['こんにちは！', 'konnichiwa'],
    ['わたし は がくせい です か？', 'watashi wa gakusei desu ka'],
  ])(
    'spells the particles in %s as they sound: %s (H.2.a)',
    (answer, romaji) => {
      expect(answerRomaji(answer)).toBe(romaji);
    },
  );

  it.each([
    ['は', 'ha'],
    ['へ', 'he'],
    ['を', 'wo'],
    ['は。', 'ha'],
    ['ハ', 'ha'],
  ])(
    'gives the kana %s its own sound on a kana check: %s (H.2.b)',
    (answer, romaji) => {
      expect(answerRomaji(answer, { kanaTarget: true })).toBe(romaji);
    },
  );

  it('still spells the particle as it sounds in a sentence on a kana check', () => {
    expect(answerRomaji('こんにちは', { kanaTarget: true })).toBe('konnichiwa');
    expect(answerRomaji('は を', { kanaTarget: true })).toBe('wa o');
  });

  it('spells a lone particle as it sounds on a check of the grammar', () => {
    expect(answerRomaji('は')).toBe('wa');
  });

  it.each(['日本', 'Tシャツ', 'cat', '', '   ', '。'])(
    'has no rōmaji for %j, which is not all kana',
    (answer) => {
      expect(answerRomaji(answer)).toBeNull();
    },
  );

  it('splits an answer into words as grading does', () => {
    expect(answerWords('はい、そう です。')).toEqual(['はい', 'そう', 'です']);
  });

  it('has a grading pattern and a spelling for every spoken word', () => {
    for (const [word, { pattern, romaji }] of Object.entries(SPOKEN)) {
      expect(new RegExp(`^${pattern}$`).test(word)).toBe(true);
      expect(romaji).toMatch(/^[a-z]+$/);
    }
  });
});

describe('isRomajiAnswer', () => {
  it.each(['ao', 'Kasa', 'tomodachi wa isha desu', "kin'you", 'school'])(
    'takes %j for an answer stored in Latin letters',
    (answer) => {
      expect(isRomajiAnswer(answer)).toBe(true);
    },
  );

  it.each(['あお', 'ノート', 'Tシャツ', '日本', '。', ''])(
    'does not take %j for one',
    (answer) => {
      expect(isRomajiAnswer(answer)).toBe(false);
    },
  );
});
