/**
 * authoring:draft CLI — generates a lesson draft using Claude Opus.
 *
 * Usage: pnpm --filter api authoring:draft <lesson-id|chapter-id>
 *          [--skeleton <path>] [--corrections <path>] [--force] [--max-cost <usd>]
 *
 * Reads the skeleton from tools/authoring/output/skeleton.json, finds the
 * lesson(s), generates a draft for each, runs the structural validator and the
 * course rules, and writes the output to tools/authoring/output/<lesson-id>.json.
 *
 * A run never pays twice unless told to (F.2.a): a lesson with a draft or a
 * rejected draft is skipped, so a batch can be resumed after a crash.
 *
 * Prerequisites:
 *   - pnpm --filter api ingest:items (issue #34)
 *   - pnpm --filter api authoring:outline
 *   - ANTHROPIC_API_KEY set in environment
 */
import * as path from 'path';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import type { AnthropicLike } from '../llm/anthropic-llm-client';
import { makeVoyageClient, type VoyageClient } from '../voyage/voyage-client';
import { SkeletonSchema, type Lesson, type Skeleton } from './skeleton-schema';
import { generateDraft } from './lesson-prompter';
import { validateStructure } from './lesson-validator';
import { readCorrections } from './corrections-log';
import { courseContextFor } from './course-context';
import { checkCourseRules } from './course-rules';
import {
  AUTHORING_TIMEOUT_MS,
  authoringModel,
  estimateCost,
  formatCost,
} from './authoring-llm';

const CORRECTIONS_N = 5;

function flagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx === -1 ? undefined : args[idx + 1];
}

export function parseArgs(args: string[] = process.argv.slice(2)): {
  slug: string;
  skeletonPath: string;
  correctionsPath: string | undefined;
  outputDir: string;
  force: boolean;
  maxCostUsd: number | undefined;
} {
  const valued = ['--skeleton', '--corrections', '--max-cost'];
  const values = new Set(valued.map((f) => flagValue(args, f)));
  const slug = args.find((a) => !a.startsWith('--') && !values.has(a)) ?? '';
  if (!slug) throw new Error('Usage: authoring:draft <lesson-id|chapter-id>');

  const maxCostRaw = flagValue(args, '--max-cost');
  const maxCostUsd = maxCostRaw === undefined ? undefined : Number(maxCostRaw);
  if (
    args.includes('--max-cost') &&
    (maxCostUsd === undefined ||
      !Number.isFinite(maxCostUsd) ||
      maxCostUsd <= 0)
  ) {
    throw new Error('--max-cost needs a positive number of US dollars.');
  }

  return {
    slug,
    skeletonPath:
      flagValue(args, '--skeleton') ??
      path.resolve(process.cwd(), '../../tools/authoring/output/skeleton.json'),
    correctionsPath: flagValue(args, '--corrections'),
    outputDir: path.resolve(process.cwd(), '../../tools/authoring/output'),
    force: args.includes('--force'),
    maxCostUsd,
  };
}

function findLessons(
  skeleton: ReturnType<typeof SkeletonSchema.parse>,
  slug: string,
): Lesson[] {
  for (const chapter of skeleton.module.chapters) {
    if (chapter.id === slug) return [...chapter.lessons];
    for (const lesson of chapter.lessons) {
      if (lesson.id === slug) return [lesson];
    }
  }
  throw new Error(
    `Slug "${slug}" not found in skeleton (not a lesson or chapter id).`,
  );
}

export interface DraftRunOptions {
  lessons: Lesson[];
  skeleton: Skeleton;
  outputDir: string;
  correctionsPath?: string;
  force: boolean;
  maxCostUsd?: number;
  anthropic: AnthropicLike;
  prisma: PrismaClient;
  voyage: VoyageClient;
}

export interface DraftRunSummary {
  drafted: number;
  skipped: number;
  rejected: number;
  costUsd: number;
  /** The lesson the run stopped before, when --max-cost was reached. */
  stoppedBefore?: string;
}

/** Drafts each lesson in order, paying only for those that need it (F.2.a). */
export async function runDrafts(
  options: DraftRunOptions,
): Promise<DraftRunSummary> {
  const { lessons, skeleton, outputDir, force, maxCostUsd } = options;
  if (
    maxCostUsd !== undefined &&
    estimateCost(authoringModel(), 0, 0) === null
  ) {
    throw new Error(
      `--max-cost can't be honoured: ${authoringModel()} has no known price.`,
    );
  }

  const summary: DraftRunSummary = {
    drafted: 0,
    skipped: 0,
    rejected: 0,
    costUsd: 0,
  };
  fs.mkdirSync(outputDir, { recursive: true });

  for (const lesson of lessons) {
    const file = (suffix: string) =>
      path.join(outputDir, `${lesson.id}${suffix}`);
    const existing = ['.json', '.rejected.json'].find((s) =>
      fs.existsSync(file(s)),
    );
    if (existing && !force) {
      console.log(`  skipping "${lesson.id}": ${lesson.id}${existing} exists`);
      summary.skipped++;
      continue;
    }
    if (maxCostUsd !== undefined && summary.costUsd >= maxCostUsd) {
      summary.stoppedBefore = lesson.id;
      console.log(
        `  stopping before "${lesson.id}": the estimate has reached --max-cost $${maxCostUsd}`,
      );
      break;
    }

    const corrections = readCorrections(
      lesson.type,
      CORRECTIONS_N,
      options.correctionsPath,
    );
    console.log(
      `  drafting "${lesson.id}" (${lesson.type}, ${lesson.itemIds.length} items, ${corrections.length} corrections)`,
    );

    const ctx = courseContextFor(skeleton, lesson.id);
    const { draft, items, inputTokens, outputTokens } = await generateDraft(
      options.anthropic,
      options.voyage,
      options.prisma,
      lesson,
      corrections,
      ctx,
    );
    summary.costUsd +=
      estimateCost(draft.meta.model, inputTokens, outputTokens) ?? 0;
    const cost = formatCost(draft.meta.model, inputTokens, outputTokens);

    const validation = await validateStructure(draft, options.prisma, items);
    if (!validation.pass) {
      console.warn(`  [validator] FAIL — ${validation.errors.join('; ')}`);
    } else {
      console.log(`  [validator] pass`);
    }

    const rules = ctx ? checkCourseRules(draft, ctx) : null;
    for (const w of rules?.warnings ?? []) {
      console.warn(`  [course rules] warning: ${w}`);
    }
    if (rules && rules.errors.length > 0) {
      // Never <id>.json, so review can't pick up a draft that breaks the rules.
      fs.writeFileSync(
        file('.rejected.json'),
        JSON.stringify({ ...draft, courseRuleErrors: rules.errors }, null, 2),
        'utf8',
      );
      console.warn(
        `  [course rules] REJECTED — ${rules.errors.join('; ')}  (${cost})`,
      );
      summary.rejected++;
      continue;
    }

    if (fs.existsSync(file('.json'))) {
      fs.renameSync(file('.json'), file('.prev.json'));
    }
    fs.rmSync(file('.critique.json'), { force: true });
    fs.rmSync(file('.rejected.json'), { force: true });
    fs.writeFileSync(file('.json'), JSON.stringify(draft, null, 2), 'utf8');
    summary.drafted++;
    console.log(
      `  tokens: ${inputTokens} in / ${outputTokens} out  (${cost})  → ${file('.json')}`,
    );
  }

  return summary;
}

async function main(): Promise<void> {
  const { slug, skeletonPath, correctionsPath, outputDir, force, maxCostUsd } =
    parseArgs();

  const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for authoring:draft.');
  }

  if (!fs.existsSync(skeletonPath)) {
    throw new Error(
      `Skeleton not found at ${skeletonPath}. Run authoring:outline first.`,
    );
  }

  const skeletonRaw = JSON.parse(
    fs.readFileSync(skeletonPath, 'utf8'),
  ) as unknown;
  const skeleton = SkeletonSchema.parse(skeletonRaw);
  const lessons = findLessons(skeleton, slug);

  console.log(
    `authoring:draft — ${lessons.length} lesson(s) for slug "${slug}"`,
  );

  const prisma = new PrismaClient();
  try {
    const summary = await runDrafts({
      lessons,
      skeleton,
      outputDir,
      correctionsPath,
      force,
      maxCostUsd,
      anthropic: new Anthropic({ apiKey, timeout: AUTHORING_TIMEOUT_MS }),
      prisma,
      voyage: makeVoyageClient(),
    });
    console.log(
      `authoring:draft — drafted ${summary.drafted}, skipped ${summary.skipped}, rejected ${summary.rejected}, estimated cost ~$${summary.costUsd.toFixed(4)}${summary.stoppedBefore ? `, stopped before ${summary.stoppedBefore}` : ''}`,
    );
    if (summary.rejected > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error((err as Error).message ?? err);
    process.exit(1);
  });
}
