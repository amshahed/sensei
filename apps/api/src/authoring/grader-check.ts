/**
 * authoring:grader-check CLI — the real AI grader against real exemplars.
 *
 * Usage:
 *   pnpm --filter api authoring:grader-check --source <jmdict.json>
 *   pnpm --filter api authoring:grader-check --open --draft <lesson.json>
 *
 * Recall (default): builds the rows the supplement ingest will write, asks
 * each case's recall question, and grades the case's answer through the
 * runtime Gemini path. Run before the default-branch ingest: a meaning
 * rewritten after that step would never reach the live row.
 *
 * Open (`--open`, B.2.d): grades the labelled answers in
 * open-check-cases.json against an open check in a lesson draft, with the
 * draft's own prompt, model answer and rubric, so the eval can't drift from
 * the lesson. Re-run it on any grading prompt, rubric or model change.
 *
 * No database and no Anthropic spend in either mode.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { GradingService } from '../grading/grading.service';
import type { OpenGradeResult } from '../grading/grading.service';
import { buildGrammarItem, parseGrammarSource } from '../ingest/grammar';
import {
  buildGrammarSupplementRows,
  buildVocabSupplementRows,
  loadGrammarSupplement,
  loadVocabSupplement,
} from '../ingest/supplement';
import type { JmdictFile } from '../ingest/vocab';
import { GeminiLlmClient } from '../llm/gemini-llm-client';
import { LessonDraftSchema, type LessonDraft } from './lesson-schema';
import {
  recallQuestionFor,
  type RecallableItem,
} from '../recall/recall-question';

export interface GraderCase {
  itemId: string;
  answer: string;
  expect: 'accepted' | 'rejected';
}

/** The model isn't deterministic: a case passes only if every run agrees. */
export const RUNS_PER_CASE = 3;
/** Stays under the free tier's 15 requests a minute. */
const PAUSE_MS = 4_500;

const DATA_DIR = path.resolve(__dirname, '../../data');
const CASES_PATH = path.join(DATA_DIR, 'curriculum/grader-cases.json');
const OPEN_CASES_PATH = path.join(DATA_DIR, 'curriculum/open-check-cases.json');
const TANOS_GRAMMAR_PATH = path.join(DATA_DIR, 'jlpt/n5-grammar.json');

export function loadGraderCases(file: string = CASES_PATH): GraderCase[] {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as GraderCase[];
}

/** The rows the check grades against: the supplement's own builders. */
export function buildGraderRows(
  jmdict: JmdictFile,
): Map<string, RecallableItem> {
  const supplement = loadGrammarSupplement();
  const existing = parseGrammarSource(TANOS_GRAMMAR_PATH)
    .map(buildGrammarItem)
    .filter((row) => supplement.meanings[row.id])
    .map((row) => ({ ...row, meaning: supplement.meanings[row.id] }));
  const rows = [
    ...buildVocabSupplementRows(loadVocabSupplement(), jmdict.words),
    ...buildGrammarSupplementRows(supplement),
    ...existing,
  ];
  return new Map(rows.map((row) => [row.id, row]));
}

export interface GraderRun {
  rating: string;
  correct: boolean;
  gradedBy: string;
  feedback: string;
}

export interface GraderOutcome extends GraderCase {
  prompt: string;
  exemplar: string;
  runs: GraderRun[];
  pass: boolean;
  /** Why the case failed, when it did. */
  reason?: string;
}

type Grader = {
  gradeOpen(input: {
    prompt: string;
    answer: string;
    exemplar?: string;
    rubric?: string;
  }): Promise<OpenGradeResult>;
};

type GradeInput = Parameters<Grader['gradeOpen']>[0];

/** One answer graded `RUNS_PER_CASE` times, pausing after each call. */
async function gradeRuns(
  grader: Grader,
  input: GradeInput,
  pauseMs: number,
): Promise<GraderRun[]> {
  const runs: GraderRun[] = [];
  for (let i = 0; i < RUNS_PER_CASE; i++) {
    const result = await grader.gradeOpen(input);
    runs.push({
      rating: result.rating,
      correct: result.correct,
      gradedBy: result.gradedBy,
      feedback: result.feedback,
    });
    if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return runs;
}

/**
 * Why the runs don't count as `expect`, or undefined when they do. A fallback
 * can't count as a verdict, even one that agrees.
 */
function verdictReason(
  runs: GraderRun[],
  expect: GraderCase['expect'],
): string | undefined {
  if (runs.some((r) => r.gradedBy !== 'ai')) {
    return 'fell back: the check could not be evaluated';
  }
  const wanted = expect === 'accepted';
  if (runs.some((r) => r.correct !== wanted)) {
    return `expected ${expect} in all runs`;
  }
  return undefined;
}

/** Grades every case `RUNS_PER_CASE` times. A fallback can't count as a verdict. */
export async function runGraderCheck(
  cases: GraderCase[],
  rows: ReadonlyMap<string, RecallableItem>,
  grader: Grader,
  pauseMs = 0,
): Promise<GraderOutcome[]> {
  const outcomes: GraderOutcome[] = [];
  for (const testCase of cases) {
    const row = rows.get(testCase.itemId);
    const question = row ? recallQuestionFor(row) : null;
    if (!question) {
      outcomes.push({
        ...testCase,
        prompt: '',
        exemplar: '',
        runs: [],
        pass: false,
        reason: 'no recall question for this item',
      });
      continue;
    }

    const runs = await gradeRuns(
      grader,
      {
        prompt: question.prompt,
        answer: testCase.answer,
        exemplar: question.expected,
      },
      pauseMs,
    );
    const reason = verdictReason(runs, testCase.expect);
    outcomes.push({
      ...testCase,
      prompt: question.prompt,
      exemplar: question.expected,
      runs,
      pass: reason === undefined,
      ...(reason ? { reason } : {}),
    });
  }
  return outcomes;
}

/** A labelled answer to one open check in a lesson draft (B.2.d). */
export interface OpenCheckCase {
  lessonId: string;
  /** The question's id in the draft, e.g. "q17". */
  checkId: string;
  name: string;
  answer: string;
  expect: 'accepted' | 'rejected';
  /**
   * Cases with the same pair are the same answer in different scripts (kana,
   * rōmaji, a mix): every run of every one of them must get one verdict (P5).
   */
  pair?: string;
  /** The comment may hold kana or rōmaji, never kanji (brief 3.2). */
  kanaFeedback?: boolean;
}

export interface OpenCheckOutcome extends OpenCheckCase {
  runs: GraderRun[];
  pass: boolean;
  /** Why the case failed, when it did. */
  reason?: string;
}

/** The lesson draft fields the open eval reads. */
export type OpenCheckDraft = Pick<LessonDraft, 'lessonId' | 'check'>;

const KANJI = /\p{Script=Han}/u;

export function loadOpenCheckCases(
  file: string = OPEN_CASES_PATH,
): OpenCheckCase[] {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as OpenCheckCase[];
}

/**
 * Grades every case for the draft's lesson `RUNS_PER_CASE` times, against the
 * draft's prompt, model answer (as exemplar) and rubric. A case passes when
 * every run is the model's and agrees with `expect`, and, with
 * `kanaFeedback`, no comment holds kanji. Then each pair must agree.
 */
export async function runOpenCheckCases(
  cases: OpenCheckCase[],
  draft: OpenCheckDraft,
  grader: Grader,
  pauseMs = 0,
): Promise<OpenCheckOutcome[]> {
  const outcomes: OpenCheckOutcome[] = [];
  for (const testCase of cases.filter((c) => c.lessonId === draft.lessonId)) {
    const question = draft.check.questions.find(
      (q) => q.id === testCase.checkId,
    );
    if (!question || question.grading !== 'open') {
      outcomes.push({
        ...testCase,
        runs: [],
        pass: false,
        reason: `no open check ${testCase.checkId} in the draft`,
      });
      continue;
    }

    const runs = await gradeRuns(
      grader,
      {
        prompt: question.prompt,
        answer: testCase.answer,
        exemplar: question.correctAnswer,
        ...(question.rubric ? { rubric: question.rubric } : {}),
      },
      pauseMs,
    );
    const reason =
      verdictReason(runs, testCase.expect) ??
      (testCase.kanaFeedback && runs.some((r) => KANJI.test(r.feedback))
        ? 'a comment contains kanji'
        : undefined);
    outcomes.push({
      ...testCase,
      runs,
      pass: reason === undefined,
      ...(reason ? { reason } : {}),
    });
  }

  // The same introduction in another script gets the same verdict (P5).
  const pairs = new Map<string, OpenCheckOutcome[]>();
  for (const o of outcomes) {
    if (o.pair) pairs.set(o.pair, [...(pairs.get(o.pair) ?? []), o]);
  }
  for (const [pair, members] of pairs) {
    const verdicts = new Set(
      members.flatMap((m) => m.runs.map((r) => r.correct)),
    );
    if (verdicts.size <= 1) continue;
    for (const m of members) {
      m.pass = false;
      m.reason = m.reason ?? `pair "${pair}" got different verdicts`;
    }
  }
  return outcomes;
}

function requireGeminiKey(): void {
  if (!process.env['GEMINI_API_KEY']) {
    throw new Error('GEMINI_API_KEY is required for authoring:grader-check.');
  }
}

async function mainOpen(args: string[]): Promise<void> {
  const draftIdx = args.indexOf('--draft');
  const draftArg = draftIdx === -1 ? undefined : args[draftIdx + 1];
  if (!draftArg) {
    throw new Error(
      'Usage: authoring:grader-check --open --draft <lesson-draft.json>',
    );
  }
  requireGeminiKey();
  // pnpm runs scripts from apps/api; resolve the path from where it was typed.
  const draftPath = path.resolve(
    process.env['INIT_CWD'] ?? process.cwd(),
    draftArg,
  );
  const draft = LessonDraftSchema.parse(
    JSON.parse(fs.readFileSync(draftPath, 'utf8')),
  );
  const cases = loadOpenCheckCases();
  if (!cases.some((c) => c.lessonId === draft.lessonId)) {
    throw new Error(`No open-check cases for ${draft.lessonId}.`);
  }

  const client = new GeminiLlmClient(new ConfigService(process.env));
  const outcomes = await runOpenCheckCases(
    cases,
    draft,
    new GradingService(client),
    PAUSE_MS,
  );

  // Every comment is printed: "one thing" and "agrees with the verdict" are
  // judged by reading, which no check here can do.
  for (const o of outcomes) {
    const ratings = o.runs.map((r) => r.rating).join('/');
    console.log(
      `${o.pass ? 'PASS' : 'FAIL'}  ${o.checkId}  ${o.name}  want ${o.expect}  ${ratings}`,
    );
    if (!o.pass) console.log(`      ${o.reason}.`);
    for (const r of o.runs) {
      console.log(`      ${r.rating} (${r.gradedBy}): ${r.feedback}`);
    }
  }
  const failed = outcomes.filter((o) => !o.pass).length;
  console.log(
    `authoring:grader-check --open — ${outcomes.length - failed} of ${outcomes.length} cases passed`,
  );
  if (failed > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--open')) return mainOpen(args);

  const sourceIdx = args.indexOf('--source');
  const source = sourceIdx === -1 ? undefined : args[sourceIdx + 1];
  if (!source) {
    throw new Error('Usage: authoring:grader-check --source <jmdict.json>');
  }
  requireGeminiKey();

  const jmdict = JSON.parse(fs.readFileSync(source, 'utf8')) as JmdictFile;
  const client = new GeminiLlmClient(new ConfigService(process.env));
  const outcomes = await runGraderCheck(
    loadGraderCases(),
    buildGraderRows(jmdict),
    new GradingService(client),
    PAUSE_MS,
  );

  for (const o of outcomes) {
    const ratings = o.runs.map((r) => r.rating).join('/');
    console.log(
      `${o.pass ? 'PASS' : 'FAIL'}  ${o.itemId}  "${o.answer}"  want ${o.expect}  ${ratings}`,
    );
    if (!o.pass) {
      console.log(`      ${o.reason}. Exemplar: ${o.exemplar}`);
      for (const r of o.runs) console.log(`      ${r.rating}: ${r.feedback}`);
    }
  }
  const failed = outcomes.filter((o) => !o.pass).length;
  console.log(
    `authoring:grader-check — ${outcomes.length - failed} of ${outcomes.length} cases passed`,
  );
  if (failed > 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error((err as Error).message ?? err);
    process.exit(1);
  });
}
