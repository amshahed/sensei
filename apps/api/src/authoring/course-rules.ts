import { toRomaji } from 'wanakana';
import { hasLongVowel, kanaChars, kanjiChars } from '../common/japanese-script';
import type { CourseContext } from './course-context';
import type { LessonDraft } from './lesson-schema';

export interface CourseRuleResult {
  errors: string[];
  warnings: string[];
}

/**
 * Verb endings the course teaches at a known point. Particles (か, の, は, を,
 * に, で) are not here: in spaced kana they can't be told apart mechanically,
 * so they stay with the prompt, the critic and PM review (F.2.a). でした is
 * never taught; it appears only inside a phrase learned whole.
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

/** H.2.a's particles. Before the first is taught, no answer can contain one. */
const SPOKEN_PARTICLES = new Set([
  'ja:grammar:は',
  'ja:grammar:へ',
  'ja:grammar:を',
]);

const spaceless = (s: string) => s.replace(/\s/g, '');
const romajiOf = (s: string) => toRomaji(s).replace(/\s/g, '').toLowerCase();
const KANA_RUN = /[ぁ-ゖ]+/g;

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

/** Blanks out a known string, including when a draft puts spaces inside it. */
function maskKnown(text: string, known: string): string {
  const pattern = [...known]
    .map((c) => c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'))
    .join('\\s*');
  return text.replace(new RegExp(pattern, 'g'), '|');
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

/** P2: read each target word and type it, with no rōmaji to copy. */
function typedReadingProblems(
  draft: LessonDraft,
  ctx: CourseContext,
): string[] {
  const problems: string[] = [];
  for (const target of ctx.targets) {
    const typed = draft.check.questions.filter(
      (q) => q.targetItemId === target.id && q.answerType === 'typed',
    );
    const fair = typed.filter((q) => {
      const prompt = looseRomaji(q.prompt);
      return (
        spaceless(q.prompt).includes(spaceless(target.surface)) &&
        !prompt.includes(looseRomaji(romajiOf(target.surface))) &&
        !prompt.includes(looseRomaji(romajiOf(q.correctAnswer)))
      );
    });
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

  for (const { where, text } of learnerFields(draft)) {
    for (const p of scriptProblems(text, ctx)) errors.add(`${where}: ${p}`);
    for (const p of markerProblems(text, ctx)) errors.add(`${where}: ${p}`);
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
  for (const q of draft.check.questions) {
    if (q.grading === 'open' && q.answerType === 'multiple-choice') {
      errors.add(`check ${q.id}: an open check can't be multiple-choice`);
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
