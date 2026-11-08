/**
 * authoring:grader-check CLI — the real AI grader against real exemplars.
 *
 * Usage: pnpm --filter api authoring:grader-check --source <jmdict.json>
 *
 * Builds the rows the supplement ingest will write, asks each case's recall
 * question, and grades the case's answer through the runtime Gemini path. No
 * database and no Anthropic spend. Run before the default-branch ingest: a
 * meaning rewritten after that step would never reach the live row.
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
  }): Promise<OpenGradeResult>;
};

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

    const runs: GraderRun[] = [];
    for (let i = 0; i < RUNS_PER_CASE; i++) {
      const result = await grader.gradeOpen({
        prompt: question.prompt,
        answer: testCase.answer,
        exemplar: question.expected,
      });
      runs.push({
        rating: result.rating,
        correct: result.correct,
        gradedBy: result.gradedBy,
        feedback: result.feedback,
      });
      if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
    }

    const wanted = testCase.expect === 'accepted';
    const unevaluated = runs.some((r) => r.gradedBy !== 'ai');
    const disagrees = runs.some((r) => r.correct !== wanted);
    outcomes.push({
      ...testCase,
      prompt: question.prompt,
      exemplar: question.expected,
      runs,
      pass: !unevaluated && !disagrees,
      ...(unevaluated
        ? { reason: 'fell back: the check could not be evaluated' }
        : disagrees
          ? { reason: `expected ${testCase.expect} in all runs` }
          : {}),
    });
  }
  return outcomes;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf('--source');
  const source = sourceIdx === -1 ? undefined : args[sourceIdx + 1];
  if (!source) {
    throw new Error('Usage: authoring:grader-check --source <jmdict.json>');
  }
  if (!process.env['GEMINI_API_KEY']) {
    throw new Error('GEMINI_API_KEY is required for authoring:grader-check.');
  }

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
