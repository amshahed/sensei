/**
 * Closed typed checks to test the answer line against (B.2.b). The drafts are
 * gitignored, so this is a committed copy, taken 2026-11-15. A miss on any of
 * them must show a kana and a rōmaji form the grader accepts.
 */
export interface TypedAnswer {
  /** Where it comes from: lesson and question id. */
  source: string;
  targetItemId: string;
  prompt: string;
  answer: string;
}

/** Every typed check live on 2026-11-15 (Neon): lessons 19, 20 and 43. */
export const LIVE_TYPED_ANSWERS: TypedAnswer[] = [
  {
    source: 'ch04-l05 q2',
    targetItemId: 'ja:vocab:学校',
    prompt: 'Read this word and type how it sounds: がっこう',
    answer: 'がっこう',
  },
  {
    source: 'ch04-l05 q4',
    targetItemId: 'ja:vocab:一緒',
    prompt: 'Read this word and type how it sounds: いっしょ',
    answer: 'いっしょ',
  },
  {
    source: 'ch04-l05 q6',
    targetItemId: 'ja:vocab:ちょっと',
    prompt: 'Read this word and type how it sounds: ちょっと',
    answer: 'ちょっと',
  },
  {
    source: 'ch04-l05 q8',
    targetItemId: 'ja:vocab:切符',
    prompt: 'Read this word and type how it sounds: きっぷ',
    answer: 'きっぷ',
  },
  {
    source: 'ch04-l05 q10',
    targetItemId: 'ja:vocab:雑誌',
    prompt: 'Read this word and type how it sounds: ざっし',
    answer: 'ざっし',
  },
  {
    source: 'ch04-l06 q2',
    targetItemId: 'ja:vocab:友達',
    prompt: 'Read this word and type how it sounds: ともだち',
    answer: 'ともだち',
  },
  {
    source: 'ch04-l06 q4',
    targetItemId: 'ja:vocab:学校',
    prompt: 'Read this word and type how it sounds: がっこう',
    answer: 'がっこう',
  },
  {
    source: 'ch04-l06 q6',
    targetItemId: 'ja:vocab:お母さん',
    prompt: 'Read this word and type how it sounds: おかあさん',
    answer: 'おかあさん',
  },
  {
    source: 'ch04-l06 q8',
    targetItemId: 'ja:vocab:写真',
    prompt: 'Read this word and type how it sounds: しゃしん',
    answer: 'しゃしん',
  },
  {
    source: 'ch04-l06 q10',
    targetItemId: 'ja:vocab:ちょっと',
    prompt: 'Read this word and type how it sounds: ちょっと',
    answer: 'ちょっと',
  },
  {
    source: 'ch08-l03 q4',
    targetItemId: 'ja:grammar:は',
    prompt:
      "Type this sentence in Japanese (rōmaji is fine): 'My friend is a doctor.' (friend = ともだち, doctor = いしゃ)",
    answer: 'ともだち は いしゃ です',
  },
];

/** Every closed typed check in the 22c wave 1 drafts, rejected ones included. */
export const WAVE1_TYPED_ANSWERS: TypedAnswer[] = [
  {
    source: 'ch01-l04 q2',
    targetItemId: 'ja:kana:a',
    prompt: 'Read this word and type how it sounds: あお',
    answer: 'ao',
  },
  {
    source: 'ch01-l04 q5',
    targetItemId: 'ja:kana:ka',
    prompt: 'Read this word and type how it sounds: かさ',
    answer: 'kasa',
  },
  {
    source: 'ch01-l04 q8',
    targetItemId: 'ja:kana:ko',
    prompt: 'Read this word and type how it sounds: そこ',
    answer: 'soko',
  },
  {
    source: 'ch01-l04 q10',
    targetItemId: 'ja:kana:sa',
    prompt: 'Read this word and type how it sounds: さか',
    answer: 'saka',
  },
  {
    source: 'ch02-l04 q1',
    targetItemId: 'ja:kana:na',
    prompt: 'Read this word and type how it sounds: なに',
    answer: 'nani',
  },
  {
    source: 'ch02-l04 q5',
    targetItemId: 'ja:kana:ha',
    prompt: 'Read this word and type how it sounds: はな',
    answer: 'hana',
  },
  {
    source: 'ch02-l04 q7',
    targetItemId: 'ja:kana:hi',
    prompt: 'Read this word and type how it sounds: ひと',
    answer: 'hito',
  },
  {
    source: 'ch02-l04 q11',
    targetItemId: 'ja:kana:to',
    prompt: 'Read this word and type how it sounds: そと',
    answer: 'soto',
  },
  {
    source: 'ch03-l05 q1',
    targetItemId: 'ja:kana:ya',
    prompt: 'Read this word and type how it sounds: やま',
    answer: 'yama',
  },
  {
    source: 'ch03-l05 q4',
    targetItemId: 'ja:kana:ma',
    prompt: 'Read this word and type how it sounds: やま',
    answer: 'yama',
  },
  {
    source: 'ch03-l05 q5',
    targetItemId: 'ja:kana:ri',
    prompt: 'Read this word and type how it sounds: とり',
    answer: 'tori',
  },
  {
    source: 'ch03-l05 q7',
    targetItemId: 'ja:kana:wa',
    prompt: 'Read this word and type how it sounds: わに',
    answer: 'wani',
  },
  {
    source: 'ch03-l05 q9',
    targetItemId: 'ja:kana:no',
    prompt: 'Read this word and type how it sounds: のり',
    answer: 'nori',
  },
  {
    source: 'ch03-l05 q11',
    targetItemId: 'ja:kana:n',
    prompt: 'Read this word and type how it sounds: ほん',
    answer: 'hon',
  },
  {
    source: 'ch03-l06 q4',
    targetItemId: 'ja:kana:ka',
    prompt: "Type the kana that reads 'ka'.",
    answer: 'か',
  },
  {
    source: 'ch03-l06 q8',
    targetItemId: 'ja:kana:ta',
    prompt: "Type the kana that reads 'ta'.",
    answer: 'た',
  },
  {
    source: 'ch03-l06 q12',
    targetItemId: 'ja:kana:ha',
    prompt: "Type the kana that reads 'ha'.",
    answer: 'は',
  },
  {
    source: 'ch03-l06 q16',
    targetItemId: 'ja:kana:ra',
    prompt: "Type the kana that reads 'ra'.",
    answer: 'ら',
  },
  {
    source: 'ch04-l01 q2',
    targetItemId: 'ja:vocab:鍵',
    prompt: 'Type this word in rōmaji: かぎ',
    answer: 'かぎ',
  },
  {
    source: 'ch04-l01 q4',
    targetItemId: 'ja:vocab:家族',
    prompt: 'Type this word in rōmaji: かぞく',
    answer: 'かぞく',
  },
  {
    source: 'ch04-l01 q6',
    targetItemId: 'ja:vocab:御飯',
    prompt: 'Type this word in rōmaji: ごはん',
    answer: 'ごはん',
  },
  {
    source: 'ch04-l01 q8',
    targetItemId: 'ja:vocab:水',
    prompt: 'Type this word in rōmaji: みず',
    answer: 'みず',
  },
  {
    source: 'ch04-l01 q10',
    targetItemId: 'ja:vocab:地図',
    prompt: 'Type this word in rōmaji: ちず',
    answer: 'ちず',
  },
  {
    source: 'ch04-l02 q2',
    targetItemId: 'ja:vocab:友達',
    prompt: 'Type this word in rōmaji: ともだち',
    answer: 'ともだち',
  },
  {
    source: 'ch04-l02 q4',
    targetItemId: 'ja:vocab:電話',
    prompt: 'Type this word in rōmaji: でんわ',
    answer: 'でんわ',
  },
  {
    source: 'ch04-l02 q6',
    targetItemId: 'ja:vocab:子供',
    prompt: 'Type this word in rōmaji: こども',
    answer: 'こども',
  },
  {
    source: 'ch04-l02 q8',
    targetItemId: 'ja:vocab:かばん',
    prompt: 'Type this word in rōmaji: かばん',
    answer: 'かばん',
  },
  {
    source: 'ch04-l02 q10',
    targetItemId: 'ja:vocab:鉛筆',
    prompt: 'Type this word in rōmaji: えんぴつ',
    answer: 'えんぴつ',
  },
  {
    source: 'ch04-l03 q2',
    targetItemId: 'ja:vocab:医者',
    prompt: 'Read this word and type how it sounds: いしゃ',
    answer: 'いしゃ',
  },
  {
    source: 'ch04-l03 q4',
    targetItemId: 'ja:vocab:お茶',
    prompt: 'Read this word and type how it sounds: おちゃ',
    answer: 'おちゃ',
  },
  {
    source: 'ch04-l03 q6',
    targetItemId: 'ja:vocab:辞書',
    prompt: 'Read this word and type how it sounds: じしょ',
    answer: 'じしょ',
  },
  {
    source: 'ch04-l03 q8',
    targetItemId: 'ja:vocab:写真',
    prompt: 'Read this word and type how it sounds: しゃしん',
    answer: 'しゃしん',
  },
  {
    source: 'ch04-l03 q10',
    targetItemId: 'ja:vocab:図書館',
    prompt: 'Read this word and type how it sounds: としょかん',
    answer: 'としょかん',
  },
  {
    source: 'ch04-l04 q2',
    targetItemId: 'ja:vocab:お母さん',
    prompt: 'Type the word you see: おかあさん',
    answer: 'おかあさん',
  },
  {
    source: 'ch04-l04 q4',
    targetItemId: 'ja:vocab:お父さん',
    prompt: 'Type the word you see: おとうさん',
    answer: 'おとうさん',
  },
  {
    source: 'ch04-l04 q6',
    targetItemId: 'ja:vocab:お兄さん',
    prompt: 'Type the word you see: おにいさん',
    answer: 'おにいさん',
  },
  {
    source: 'ch04-l04 q8',
    targetItemId: 'ja:vocab:お姉さん',
    prompt: 'Type the word you see: おねえさん',
    answer: 'おねえさん',
  },
  {
    source: 'ch04-l04 q10',
    targetItemId: 'ja:vocab:映画',
    prompt: 'Type the word you see: えいが',
    answer: 'えいが',
  },
  {
    source: 'ch05-l05 q8',
    targetItemId: 'ja:vocab:ください',
    prompt: 'Type in kana how you would ask for tea (おちゃ), please.',
    answer: 'おちゃ ください',
  },
  {
    source: 'ch05-l05 q10',
    targetItemId: 'ja:vocab:もういちど',
    prompt: "Type in kana the word that means 'once more'.",
    answer: 'もういちど',
  },
  {
    source: 'ch07-l06 q2',
    targetItemId: 'ja:kana:kata-ha',
    prompt: 'Read this word and type how it sounds: ハン',
    answer: 'han',
  },
  {
    source: 'ch07-l06 q3',
    targetItemId: 'ja:kana:kata-ma',
    prompt: 'Read this word and type how it sounds: マラ',
    answer: 'mara',
  },
  {
    source: 'ch07-l06 q6',
    targetItemId: 'ja:kana:kata-ra',
    prompt: 'Read this word and type how it sounds: ラム',
    answer: 'ramu',
  },
  {
    source: 'ch07-l06 q7',
    targetItemId: 'ja:kana:kata-ru',
    prompt: 'Read this word and type how it sounds: ルン',
    answer: 'run',
  },
  {
    source: 'ch07-l06 q10',
    targetItemId: 'ja:kana:kata-n',
    prompt: 'Read this word and type how it sounds: ルン',
    answer: 'run',
  },
  {
    source: 'ch07-l07 q2',
    targetItemId: 'ja:vocab:ノート',
    prompt: 'Type ノート in rōmaji.',
    answer: 'nooto',
  },
  {
    source: 'ch07-l07 q6',
    targetItemId: 'ja:vocab:スポーツ',
    prompt: 'Type スポーツ in rōmaji.',
    answer: 'supootsu',
  },
  {
    source: 'ch07-l07 q10',
    targetItemId: 'ja:vocab:ポケット',
    prompt: 'Type ポケット in rōmaji.',
    answer: 'poketto',
  },
];

/** A typed reading check on a word, as the pipeline writes it (F.2.b). */
const reading = (word: string): TypedAnswer => ({
  source: `outline ${word}`,
  targetItemId: `ja:vocab:${word}`,
  prompt: `Read this word and type how it sounds: ${word}`,
  answer: word,
});

/** Katakana outline words, with and without ー (H.2.d). */
export const KATAKANA_WORDS: TypedAnswer[] = [
  'ノート',
  'コーヒー',
  'スポーツ',
  'シャツ',
  'ポケット',
  'テレビ',
  'ラジオ',
  'カメラ',
  'ホテル',
  'レストラン',
  'アメリカ',
  'トイレ',
  'ゼロ',
].map(reading);

/** Outline words spelling は inside a word, and the two said "wa" (H.2.a). */
export const SPOKEN_WORDS: TypedAnswer[] = [
  'こんにちは',
  'こんばんは',
  'おはよう ございます',
  'ごはん',
  'はは',
].map(reading);

export const ALL_TYPED_ANSWERS: TypedAnswer[] = [
  ...LIVE_TYPED_ANSWERS,
  ...WAVE1_TYPED_ANSWERS,
  ...KATAKANA_WORDS,
  ...SPOKEN_WORDS,
];
