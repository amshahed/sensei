import { toRomaji } from 'wanakana';
import { hasLongVowel, kanaChars, kanjiChars } from '../common/japanese-script';
import type { CourseContext } from './course-context';
import type { CheckQuestion, LessonDraft } from './lesson-schema';

export interface CourseRuleResult {
  errors: string[];
  warnings: string[];
}

/**
 * Verb endings the course teaches at a known point. Particles are not here:
 * a particle joined to a word can't be told apart mechanically, so only one
 * standing alone is checked, by PARTICLES below (F.2.c). でした is never
 * taught; it appears only inside a phrase learned whole.
 */
const MARKERS: Array<{
  text: string;
  grammarId: string | null;
  /** Matched across spaces, because drafts space it (きて ください). */
  acrossSpaces?: boolean;
}> = [
  { text: 'じゃありません', grammarId: 'ja:grammar:じゃありません' },
  { text: 'ませんか', grammarId: 'ja:grammar:ませんか' },
  { text: 'ましょう', grammarId: 'ja:grammar:ましょう' },
  { text: 'ました', grammarId: 'ja:grammar:ました' },
  { text: 'ません', grammarId: 'ja:grammar:ません' },
  { text: 'ます', grammarId: 'ja:grammar:ます' },
  {
    text: 'てください',
    grammarId: 'ja:grammar:てください',
    acrossSpaces: true,
  },
  {
    text: 'たいです',
    grammarId: 'ja:grammar:stem-たいです',
    acrossSpaces: true,
  },
  { text: 'でした', grammarId: null },
];

/**
 * Each particle and the grammar items that teach it (F.2.c). A particle counts
 * as taught once any of its items is. The slice never teaches the last five.
 */
const PARTICLES: Record<string, string[]> = {
  は: ['ja:grammar:は'],
  か: ['ja:grammar:か'],
  の: ['ja:grammar:の'],
  も: ['ja:grammar:も'],
  が: ['ja:grammar:があります', 'ja:grammar:がいます', 'ja:grammar:がすきです'],
  に: ['ja:grammar:に', 'ja:grammar:にへ'],
  を: ['ja:grammar:を'],
  へ: ['ja:grammar:にへ'],
  で: ['ja:grammar:で'],
  な: ['ja:grammar:な-adjective'],
  と: ['ja:grammar:と'],
  ね: [],
  よ: [],
  や: [],
  から: [],
  まで: [],
};

/** H.2.a's particles. Before the first is taught, no answer can contain one. */
const SPOKEN_PARTICLES = new Set([
  'ja:grammar:は',
  'ja:grammar:にへ',
  'ja:grammar:を',
]);

export const spaceless = (s: string) => s.replace(/\s/g, '');
const romajiOf = (s: string) => toRomaji(s).replace(/\s/g, '').toLowerCase();
const KANA_RUN = /[ぁ-ゖ]+/g;
const PUNCTUATION = /\p{P}/gu;
/**
 * A stretch of Japanese: kana and the spaces between words. Anything else
 * ends it: punctuation, symbols, Latin letters, digits and kanji (F.2.d).
 */
const STRETCH = /[ぁ-ゖァ-ヺー\s]+/g;
/** One hiragana or katakana: a sound in a row, not a word. */
const LONE_KANA = /^[ぁ-ゖァ-ヺー]$/;

/** Text with no punctuation and no spaces, so がっこう。 equals がっこう. */
export const bare = (s: string) => spaceless(s.replace(PUNCTUATION, ''));

/** Rōmaji with macrons and doubled vowels removed, so okāsan equals okaasan. */
const looseRomaji = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/ou/g, 'o')
    .replace(/([aeiou])\1+/g, '$1');

/** A piece of a draft the learner will read, and where it sits. */
interface Field {
  where: string;
  text: string;
}

function learnerFields(draft: LessonDraft): Field[] {
  const fields: Field[] = [];
  const add = (where: string, text?: string) => {
    if (text) fields.push({ where, text });
  };
  draft.teach.blocks.forEach((b, i) => {
    const where = `teach[${i}]`;
    if (b.type === 'text') add(where, b.text);
    if (b.type === 'mnemonic') add(where, b.text);
    if (b.type === 'audio') add(where, b.label);
    if (b.type === 'passage') {
      add(where, b.text);
      add(where, b.title);
    }
    if (b.type === 'kana') {
      add(where, b.char);
      add(where, b.hint);
    }
    if (b.type === 'example') {
      add(where, b.japanese);
      add(where, b.reading);
      add(where, b.translation);
    }
  });
  draft.practice.templates.forEach((t, i) => add(`practice[${i}]`, t.hint));
  for (const q of draft.check.questions) {
    const where = `check ${q.id}`;
    add(where, q.prompt);
    add(where, q.correctAnswer);
    add(where, q.explanation);
    for (const choice of q.choices ?? []) add(where, choice);
  }
  return fields;
}

/** Strings the learner already has whole, so an ending inside one is fine. */
function knownStrings(ctx: CourseContext): string[] {
  return [
    ...ctx.words,
    ...ctx.grammar.map((g) => g.surface.replace(/^[〜～]/, '')),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

/** Why this text breaks the kana and kanji rules (empty when it doesn't). */
export function scriptProblems(text: string, ctx: CourseContext): string[] {
  const problems: string[] = [];
  const kana = new Set(ctx.kana);
  for (const ch of new Set(kanaChars(text))) {
    if (!kana.has(ch)) problems.push(`uses ${ch} before it is taught`);
  }
  const kanji = new Set(ctx.kanji);
  for (const ch of new Set(kanjiChars(text))) {
    if (ctx.lessonType !== 'F-Kanji') {
      problems.push(`uses kanji ${ch} outside a kanji lesson`);
    } else if (!kanji.has(ch)) {
      problems.push(`uses kanji ${ch}, which is not taught`);
    }
  }
  return problems;
}

/**
 * Taught whole by があります and がいます (lessons 74, 75), so the verb on its
 * own is not an early use of the ます lesson. Exactly these words, with か
 * allowed after them. ありません, いました and the like stay rejected.
 */
const TAUGHT_VERBS = [
  { text: 'あります', grammarId: 'ja:grammar:があります' },
  { text: 'います', grammarId: 'ja:grammar:がいます' },
];

/**
 * A known string as a pattern that also matches it with spaces inside. With
 * `wholeWords`, only where it starts and ends at a space, so the word はい
 * can't swallow the particle in は いしゃ.
 */
function knownPattern(known: string, wholeWords = false): RegExp {
  const pattern = [...known]
    .map((c) => c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'))
    .join('\\s*');
  const edged = wholeWords ? `(?<!\\S)${pattern}(?!\\S)` : pattern;
  return new RegExp(edged, 'g');
}

/** Blanks out a known string, including when a draft puts spaces inside it. */
function maskKnown(text: string, known: string): string {
  return text.replace(knownPattern(known), '|');
}

function markerProblems(text: string, ctx: CourseContext): string[] {
  const taught = new Set(ctx.grammar.map((g) => g.id));
  const known = knownStrings(ctx);
  const verbs = new Set(
    TAUGHT_VERBS.filter((v) => taught.has(v.grammarId)).map((v) => v.text),
  );
  return MARKERS.filter((m) => !m.grammarId || !taught.has(m.grammarId))
    .filter((m) => {
      const rest = known
        .filter((k) => k !== m.text && k.includes(m.text))
        .reduce((t, k) => maskKnown(t, k), text);
      if (m.acrossSpaces) return spaceless(rest).includes(m.text);
      return (rest.match(KANA_RUN) ?? [])
        .filter((run) => !verbs.has(run.replace(/か$/, '')))
        .some((run) => run.includes(m.text));
    })
    .map((m) => `uses ${m.text} before it is taught`);
}

/** What the particle rules need to know about a lesson (F.2.c). */
interface ParticleContext {
  untaught: Set<string>;
  /** Known strings of two characters or more, as whole-word patterns. */
  phrases: RegExp[];
  /** Every known string, so a known word of one kana (に, two) is spared. */
  known: Set<string>;
}

/**
 * The particles not yet taught at this lesson, in the order of PARTICLES. The
 * gate and the draft prompt both take the list from here (F.2.d).
 */
export function untaughtParticles(ctx: CourseContext): string[] {
  const taught = new Set(ctx.grammar.map((g) => g.id));
  return Object.entries(PARTICLES)
    .filter(([, ids]) => !ids.some((id) => taught.has(id)))
    .map(([particle]) => particle);
}

function particleContext(ctx: CourseContext): ParticleContext {
  const known = knownStrings(ctx).map(bare);
  return {
    untaught: new Set(untaughtParticles(ctx)),
    phrases: known
      .filter((k) => k.length > 1)
      .map((k) => knownPattern(k, true)),
    known: new Set(known),
  };
}

/**
 * Rule A (F.2.d, amends F.2.c). A Japanese particle follows the word it marks,
 * and a sentence doesn't run through a colon, a comma, a bracket or English.
 * So each stretch of kana and spaces is read on its own, and a word in it that
 * is exactly an untaught particle is a use (ともだち と がっこう) only when:
 *   - the word before it is a word: two kana or more, or a known phrase;
 *   - the word after it, if any, is not a lone kana, because a row after a
 *     word (こえ か き く け こ) is a listing, not a sentence.
 * A kana pointed out on its own (と: そと, In はな, は says ha) or in a row
 * (た ち つ て と そと) is a mention. Known words and taught grammar count as
 * words, including across spaces (おげんき です か), but no known word starts
 * with a particle standing alone, so に ほん is not にほん. A known word of
 * one kana (に, two) is never a particle. The error quotes the stretch, so a
 * redraft sees the exact phrase to fix.
 */
function particleProblems(text: string, pc: ParticleContext): string[] {
  if (pc.untaught.size === 0) return [];
  const mask = (match: string) => {
    const [first] = match.split(' ');
    return first !== match && pc.untaught.has(first) ? match : '|';
  };
  const isWord = (w?: string) => w === '|' || (w ?? '').length > 1;
  const problems = new Set<string>();
  for (const stretch of text.match(STRETCH) ?? []) {
    const line = stretch.trim().split(/\s+/).join(' ');
    // Masking only ever removes words, so a stretch with no particle in it
    // can't gain one.
    if (!line.split(' ').some((w) => pc.untaught.has(w))) continue;
    const words = pc.phrases
      .reduce((t, pattern) => t.replace(pattern, mask), line)
      .split(' ');
    words.forEach((w, i) => {
      if (!pc.untaught.has(w) || pc.known.has(w)) return;
      const next = words[i + 1];
      if (isWord(words[i - 1]) && !(next && LONE_KANA.test(next))) {
        problems.add(
          `uses the particle ${w} before it is taught, in "${line}"`,
        );
      }
    });
  }
  return [...problems];
}

/**
 * The PM's approved wording for a reading check, from lesson 20. It has no
 * rōmaji in it, so a short reading (いい, ii) can't be found in "this".
 */
export const TYPED_READING_PROMPT = 'Read this word and type how it sounds:';

/**
 * P2: a closed typed check whose answer is the word, and whose prompt shows the
 * word with no rōmaji for it. The gate and the typed-reading transform both
 * judge a check by this, so they can't drift apart (F.2.b). The answer is
 * compared without punctuation, as the grader compares it (H.2.c), so
 * がっこう。 is the word.
 */
export function isFairTypedReading(
  question: CheckQuestion,
  surface: string,
): boolean {
  if (question.answerType !== 'typed' || question.grading === 'open') {
    return false;
  }
  if (bare(question.correctAnswer) !== bare(surface)) return false;
  const prompt = looseRomaji(question.prompt.replace(TYPED_READING_PROMPT, ''));
  return (
    spaceless(question.prompt).includes(spaceless(surface)) &&
    !prompt.includes(looseRomaji(romajiOf(surface)))
  );
}

/** P2: read each target word and type it, with no rōmaji to copy. */
function typedReadingProblems(
  draft: LessonDraft,
  ctx: CourseContext,
): string[] {
  const problems: string[] = [];
  for (const target of ctx.targets) {
    const fair = draft.check.questions.filter(
      (q) =>
        q.targetItemId === target.id && isFairTypedReading(q, target.surface),
    );
    if (fair.length === 0) {
      problems.push(
        `${target.id} needs a typed check showing ${target.surface} with no rōmaji in the prompt`,
      );
    }
  }
  return problems;
}

/**
 * The free deterministic gate (F.2.a), run after every draft and again at
 * publish. Errors reject the draft. A warning is a heuristic, left to review.
 */
export function checkCourseRules(
  draft: LessonDraft,
  ctx: CourseContext,
): CourseRuleResult {
  const errors = new Set<string>();
  const warnings = new Set<string>();
  const pc = particleContext(ctx);

  for (const { where, text } of learnerFields(draft)) {
    for (const p of scriptProblems(text, ctx)) errors.add(`${where}: ${p}`);
    for (const p of markerProblems(text, ctx)) errors.add(`${where}: ${p}`);
    for (const p of particleProblems(text, pc)) errors.add(`${where}: ${p}`);
    if (ctx.longVowelsTaught) continue;
    for (const run of text.match(KANA_RUN) ?? []) {
      if (hasLongVowel(run)) {
        warnings.add(
          `${where}: "${run}" may have a long vowel before they are taught`,
        );
      }
    }
  }

  if (!ctx.hasKanaTargets) {
    draft.teach.blocks.forEach((b, i) => {
      if (b.type === 'kana' && b.itemId) {
        errors.add(`teach[${i}]: card ${b.char} must not carry an itemId`);
      }
    });
  }

  const particlesTaught = ctx.grammar.some((g) => SPOKEN_PARTICLES.has(g.id));
  // Rule B (F.2.c): a choice or closed answer that is only a particle. Kana and
  // sound lessons are left out, because their choices are characters.
  const choicesAreWords = !ctx.hasKanaTargets && ctx.kanaCards.length === 0;
  for (const q of draft.check.questions) {
    if (q.grading === 'open' && q.answerType === 'multiple-choice') {
      errors.add(`check ${q.id}: an open check can't be multiple-choice`);
    }
    if (choicesAreWords) {
      const closed = q.grading === 'open' ? [] : [q.correctAnswer];
      for (const w of [...(q.choices ?? []), ...closed].map(bare)) {
        if (pc.untaught.has(w) && !pc.known.has(w)) {
          errors.add(
            `check ${q.id}: uses the particle ${w} before it is taught`,
          );
        }
      }
    }
    // Rōmaji particles are only accepted as whole words (H.2.a). A known word
    // written across spaces (おはよう ございます) has no particle in it.
    if (particlesTaught && q.answerType === 'typed' && q.grading !== 'open') {
      const parts = q.correctAnswer.split(/[\s、。,.!?！？]+/).filter(Boolean);
      const joined = parts.join('');
      for (const w of parts) {
        if (!/[はへを]/.test(w.slice(1))) continue;
        if (ctx.words.some((k) => k.includes(w) && joined.includes(k)))
          continue;
        errors.add(`check ${q.id}: put the particle in "${w}" in its own word`);
      }
    }
  }

  if (ctx.typedReading) {
    for (const p of typedReadingProblems(draft, ctx)) errors.add(p);
  }

  const cards = draft.teach.blocks.flatMap((b) =>
    b.type === 'kana' ? [b.char] : [],
  );
  for (const card of ctx.kanaCards) {
    if (!cards.includes(card.char)) warnings.add(`no card for ${card.char}`);
  }

  return { errors: [...errors], warnings: [...warnings] };
}
