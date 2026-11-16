/**
 * authoring:draft CLI — generates a lesson draft using Claude Opus.
 *
 * Usage: pnpm --filter api authoring:draft <lesson-id|chapter-id>
 *          [--skeleton <path>] [--corrections <path>] [--force | --recheck]
 *          [--max-cost <usd>]
 *
 * Reads the skeleton from tools/authoring/output/skeleton.json, finds the
 * lesson(s), generates a draft for each, runs the structural validator and the
 * course rules, and writes the output to tools/authoring/output/<lesson-id>.json.
 *
 * A run never pays twice unless told to (F.2.a): a lesson with a draft, a
 * rejected draft or a failed reply is skipped, so a batch can be resumed after
 * a crash.
 *
 * A paid reply is never thrown away (F.2.f): one that can't be read as a draft
 * is saved to <id>.failed.json, its cost counts, and the batch goes on.
 *
 * --recheck makes no model call (F.2.b): it re-reads each <id>.failed.json,
 * then reruns the typed-reading transform, the validator and the gate on it or
 * on <id>.rejected.json, so a draft already paid for is recovered when a code
 * fix cures it.
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
import {
  DraftReplyError,
  generateDraft,
  parseDraftReply,
  replyErrorMessage,
  type GenerateDraftResult,
  type RawItem,
  type ReceivedReply,
} from './lesson-prompter';
import { validateStructure } from './lesson-validator';
import { readCorrections } from './corrections-log';
import { courseContextFor, type CourseContext } from './course-context';
import { checkCourseRules } from './course-rules';
import { addTypedReadingChecks } from './typed-reading';
import { LessonDraftSchema, type LessonDraft } from './lesson-schema';
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
  recheck: boolean;
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
  const force = args.includes('--force');
  const recheck = args.includes('--recheck');
  if (force && recheck) {
    throw new Error(
      '--recheck makes no model call and --force pays for a redraft: pick one.',
    );
  }

  return {
    slug,
    skeletonPath:
      flagValue(args, '--skeleton') ??
      path.resolve(process.cwd(), '../../tools/authoring/output/skeleton.json'),
    correctionsPath: flagValue(args, '--corrections'),
    outputDir: path.resolve(process.cwd(), '../../tools/authoring/output'),
    force,
    recheck,
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
  /** Rerun the gate on each <id>.rejected.json, with no model call (F.2.b). */
  recheck?: boolean;
  maxCostUsd?: number;
  anthropic: AnthropicLike;
  prisma: PrismaClient;
  voyage: VoyageClient;
}

export interface DraftRunSummary {
  drafted: number;
  /** Rejected drafts that pass on --recheck, saved as drafts at $0. */
  rechecked: number;
  skipped: number;
  rejected: number;
  /** Paid replies that couldn't be read as a draft, kept in <id>.failed.json. */
  failed: number;
  costUsd: number;
  /** The lesson the run stopped before, when --max-cost was reached. */
  stoppedBefore?: string;
}

/** Why the gate rejected the last draft, told to the redraft (F.2.c). */
function rejectionReasons(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  const { courseRuleErrors } = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    courseRuleErrors?: unknown;
  };
  return Array.isArray(courseRuleErrors)
    ? courseRuleErrors.filter((e): e is string => typeof e === 'string')
    : [];
}

/**
 * A rejected draft, without the verdict the gate gave it last time: the schema
 * drops keys it doesn't know, courseRuleErrors among them.
 */
function readRejectedDraft(file: string): LessonDraft {
  return LessonDraftSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** <id>.failed.json: a paid reply that couldn't be read as a draft (F.2.f). */
type FailedReply = ReceivedReply & {
  lessonId: string;
  costUsd: number | null;
  error: string;
};

/**
 * Saves a paid reply that couldn't be read as a draft. A paid reply is never
 * overwritten, so an older one is kept as <id>.failed.prev.json.
 */
function saveFailedReply(
  file: (suffix: string) => string,
  lessonId: string,
  received: ReceivedReply,
  error: string,
): void {
  const { model, inputTokens, outputTokens } = received;
  const failed: FailedReply = {
    lessonId,
    receivedAt: received.receivedAt,
    model,
    inputTokens,
    outputTokens,
    costUsd: estimateCost(model, inputTokens, outputTokens),
    stopReason: received.stopReason,
    error,
    ...(received.reply !== undefined ? { reply: received.reply } : {}),
    ...(received.raw !== undefined ? { raw: received.raw } : {}),
  };
  keepPrevious(file, '.failed.json', '.failed.prev.json');
  fs.writeFileSync(
    file('.failed.json'),
    JSON.stringify(failed, null, 2),
    'utf8',
  );
  console.warn(
    `  [reply] FAILED — ${error}  (tokens: ${inputTokens} in / ${outputTokens} out  (${formatCost(model, inputTokens, outputTokens)})) → ${file('.failed.json')}`,
  );
}

/** Moves a file aside before it is replaced, so nothing paid for is lost. */
function keepPrevious(
  file: (suffix: string) => string,
  from: string,
  to: string,
): void {
  if (fs.existsSync(file(from))) fs.renameSync(file(from), file(to));
}

function readFailedReply(file: string): FailedReply {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as FailedReply;
}

/**
 * The one path every draft takes, fresh or rechecked (F.2.b): the typed-reading
 * transform, the structural validator, then the course rules. A draft that
 * breaks a rule goes to <id>.rejected.json, never <id>.json, so review can't
 * pick it up. Returns whether the draft was saved.
 */
async function gateAndSave(
  generated: LessonDraft,
  ctx: CourseContext | null,
  file: (suffix: string) => string,
  prisma: PrismaClient,
  items: RawItem[] | undefined,
  spent: string,
): Promise<boolean> {
  const draft = ctx ? addTypedReadingChecks(generated, ctx) : generated;

  const validation = await validateStructure(draft, prisma, items);
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
    fs.writeFileSync(
      file('.rejected.json'),
      JSON.stringify({ ...draft, courseRuleErrors: rules.errors }, null, 2),
      'utf8',
    );
    console.warn(
      `  [course rules] REJECTED — ${rules.errors.join('; ')}  (${spent})`,
    );
    return false;
  }

  if (fs.existsSync(file('.json'))) {
    fs.renameSync(file('.json'), file('.prev.json'));
    console.log(`  the draft it replaces is kept as ${file('.prev.json')}`);
  }
  fs.rmSync(file('.critique.json'), { force: true });
  fs.rmSync(file('.rejected.json'), { force: true });
  fs.writeFileSync(file('.json'), JSON.stringify(draft, null, 2), 'utf8');
  console.log(`  ${spent}  → ${file('.json')}`);
  return true;
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
    rechecked: 0,
    skipped: 0,
    rejected: 0,
    failed: 0,
    costUsd: 0,
  };
  fs.mkdirSync(outputDir, { recursive: true });

  for (const lesson of lessons) {
    const file = (suffix: string) =>
      path.join(outputDir, `${lesson.id}${suffix}`);
    const ctx = courseContextFor(skeleton, lesson.id);

    if (options.recheck) {
      const failed = fs.existsSync(file('.failed.json'));
      if (!failed && !fs.existsSync(file('.rejected.json'))) {
        console.log(
          `  skipping "${lesson.id}": no rejected draft or failed reply to recheck`,
        );
        summary.skipped++;
        continue;
      }
      if (!ctx) {
        // Without course context there is no gate, so nothing to recheck it by.
        console.warn(
          `  skipping "${lesson.id}": this skeleton has no course context, so the gate can't run`,
        );
        summary.skipped++;
        continue;
      }
      console.log(`  rechecking "${lesson.id}" (no model call)`);
      if (failed) {
        // Before the rejected draft: it is the newer paid reply.
        const outcome = await recheckFailedReply(lesson, ctx, file, options);
        summary[outcome]++;
        continue;
      }
      const saved = await gateAndSave(
        readRejectedDraft(file('.rejected.json')),
        ctx,
        file,
        options.prisma,
        undefined,
        'recheck, no model call, $0',
      );
      if (saved) summary.rechecked++;
      else summary.rejected++;
      continue;
    }

    const existing = ['.json', '.rejected.json', '.failed.json'].find((s) =>
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
    // Only a --force redraft gets here with a rejected draft on disk.
    const previousErrors = rejectionReasons(file('.rejected.json'));
    console.log(
      `  drafting "${lesson.id}" (${lesson.type}, ${lesson.itemIds.length} items, ${corrections.length} corrections${previousErrors.length > 0 ? `, ${previousErrors.length} rejection reasons` : ''})`,
    );

    let generated: GenerateDraftResult;
    try {
      generated = await generateDraft(
        options.anthropic,
        options.voyage,
        options.prisma,
        lesson,
        corrections,
        ctx,
        previousErrors,
      );
    } catch (err) {
      // Anything else failed before or during the call, so nothing was paid.
      if (!(err instanceof DraftReplyError)) throw err;
      const { model, inputTokens, outputTokens } = err.received;
      summary.costUsd += estimateCost(model, inputTokens, outputTokens) ?? 0;
      saveFailedReply(file, lesson.id, err.received, err.message);
      summary.failed++;
      continue;
    }
    const { draft, items, inputTokens, outputTokens } = generated;
    summary.costUsd +=
      estimateCost(draft.meta.model, inputTokens, outputTokens) ?? 0;
    const cost = formatCost(draft.meta.model, inputTokens, outputTokens);

    try {
      const saved = await gateAndSave(
        draft,
        ctx,
        file,
        options.prisma,
        items,
        `tokens: ${inputTokens} in / ${outputTokens} out  (${cost})`,
      );
      // A redraft supersedes an older failed reply, which is kept aside so a
      // later --recheck can't put it back over this one.
      keepPrevious(file, '.failed.json', '.failed.prev.json');
      if (saved) summary.drafted++;
      else summary.rejected++;
    } catch (err) {
      // Environmental (the database, the disk): keep the reply, then stop.
      saveFailedReply(
        file,
        lesson.id,
        {
          model: draft.meta.model,
          inputTokens,
          outputTokens,
          stopReason: null,
          receivedAt: draft.meta.generatedAt,
          reply: draft,
        },
        replyErrorMessage(err),
      );
      throw err;
    }
  }

  return summary;
}

/**
 * --recheck of <id>.failed.json, at $0: the saved reply is read with today's
 * code, then gated as a fresh draft is. Once it is a draft or a rejected
 * draft, the failed reply lives there and its file goes. A reply that still
 * can't be read keeps its file, with the error brought up to date.
 */
async function recheckFailedReply(
  lesson: Lesson,
  ctx: CourseContext,
  file: (suffix: string) => string,
  options: DraftRunOptions,
): Promise<'rechecked' | 'rejected' | 'failed'> {
  const stored = readFailedReply(file('.failed.json'));
  let draft: LessonDraft;
  try {
    draft = parseDraftReply(stored, lesson);
  } catch (err) {
    const error = replyErrorMessage(err);
    fs.writeFileSync(
      file('.failed.json'),
      JSON.stringify({ ...stored, error }, null, 2),
      'utf8',
    );
    console.warn(`  [reply] still FAILED — ${error}  (recheck, $0)`);
    return 'failed';
  }
  const saved = await gateAndSave(
    draft,
    ctx,
    file,
    options.prisma,
    undefined,
    'recheck of a failed reply, no model call, $0',
  );
  fs.rmSync(file('.failed.json'));
  return saved ? 'rechecked' : 'rejected';
}

/** --recheck never calls the model, and this makes it so by construction. */
const NO_MODEL: AnthropicLike = {
  messages: {
    create: () => Promise.reject(new Error('--recheck makes no model call.')),
  },
};

async function main(): Promise<void> {
  const {
    slug,
    skeletonPath,
    correctionsPath,
    outputDir,
    force,
    recheck,
    maxCostUsd,
  } = parseArgs();

  const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey && !recheck) {
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
      recheck,
      maxCostUsd,
      anthropic: recheck
        ? NO_MODEL
        : new Anthropic({ apiKey, timeout: AUTHORING_TIMEOUT_MS }),
      prisma,
      voyage: makeVoyageClient(),
    });
    console.log(
      `authoring:draft — drafted ${summary.drafted}, rechecked ${summary.rechecked}, skipped ${summary.skipped}, rejected ${summary.rejected}, failed ${summary.failed}, estimated cost ~$${summary.costUsd.toFixed(4)}${summary.stoppedBefore ? `, stopped before ${summary.stoppedBefore}` : ''}`,
    );
    if (summary.rejected > 0 || summary.failed > 0) process.exitCode = 1;
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
