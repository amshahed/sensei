/**
 * authoring:draft CLI — generates a lesson draft using Claude Opus.
 *
 * Usage: pnpm --filter api authoring:draft <lesson-id|chapter-id> [--skeleton <path>] [--corrections <path>]
 *
 * Reads the skeleton from tools/authoring/output/skeleton.json, finds the
 * lesson(s), generates a draft for each, runs the structural validator, and
 * writes the output to tools/authoring/output/<lesson-id>.json.
 *
 * Prerequisites:
 *   - pnpm --filter api ingest:items (issue #34)
 *   - pnpm --filter api authoring:skeleton (issue #36)
 *   - ANTHROPIC_API_KEY set in environment
 */
import * as path from 'path';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { makeVoyageClient } from '../voyage/voyage-client';
import { SkeletonSchema, type Lesson } from './skeleton-schema';
import { generateDraft } from './lesson-prompter';
import { validateStructure } from './lesson-validator';
import { readCorrections } from './corrections-log';

const CORRECTIONS_N = 5;

function parseArgs(): {
  slug: string;
  skeletonPath: string;
  correctionsPath: string | undefined;
  outputDir: string;
} {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--')) ?? '';
  if (!slug) throw new Error('Usage: authoring:draft <lesson-id|chapter-id>');

  const skeletonIdx = args.indexOf('--skeleton');
  const skeletonPath =
    skeletonIdx !== -1 && args[skeletonIdx + 1]
      ? args[skeletonIdx + 1]
      : path.resolve(
          process.cwd(),
          '../../tools/authoring/output/skeleton.json',
        );

  const correctionsIdx = args.indexOf('--corrections');
  const correctionsPath =
    correctionsIdx !== -1 && args[correctionsIdx + 1]
      ? args[correctionsIdx + 1]
      : undefined;

  const outputDir = path.resolve(process.cwd(), '../../tools/authoring/output');
  return { slug, skeletonPath, correctionsPath, outputDir };
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

async function draftLesson(
  lesson: Lesson,
  anthropic: Anthropic,
  prisma: PrismaClient,
  outputDir: string,
  correctionsPath: string | undefined,
): Promise<void> {
  const voyage = makeVoyageClient();
  const corrections = readCorrections(
    lesson.type,
    CORRECTIONS_N,
    correctionsPath,
  );

  console.log(
    `  drafting "${lesson.id}" (${lesson.type}, ${lesson.itemIds.length} items, ${corrections.length} corrections)`,
  );

  const { draft, inputTokens, outputTokens } = await generateDraft(
    anthropic,
    voyage,
    prisma,
    lesson,
    corrections,
  );

  const validation = await validateStructure(draft, prisma);
  if (!validation.pass) {
    console.warn(`  [validator] FAIL — ${validation.errors.join('; ')}`);
  } else {
    console.log(`  [validator] pass`);
  }

  const outPath = path.join(outputDir, `${lesson.id}.json`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(draft, null, 2), 'utf8');

  const costUsd = (inputTokens * 15 + outputTokens * 75) / 1_000_000;
  console.log(
    `  tokens: ${inputTokens} in / ${outputTokens} out  (~$${costUsd.toFixed(4)})  → ${outPath}`,
  );
}

async function main(): Promise<void> {
  const { slug, skeletonPath, correctionsPath, outputDir } = parseArgs();

  const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for authoring:draft.');
  }

  if (!fs.existsSync(skeletonPath)) {
    throw new Error(
      `Skeleton not found at ${skeletonPath}. Run authoring:skeleton first.`,
    );
  }

  const skeletonRaw = JSON.parse(
    fs.readFileSync(skeletonPath, 'utf8'),
  ) as unknown;
  const skeleton = SkeletonSchema.parse(skeletonRaw);
  const lessons = findLessons(skeleton, slug);

  console.log(
    `authoring:draft — drafting ${lessons.length} lesson(s) for slug "${slug}"`,
  );

  const anthropic = new Anthropic({ apiKey });
  const prisma = new PrismaClient();

  try {
    for (const lesson of lessons) {
      await draftLesson(lesson, anthropic, prisma, outputDir, correctionsPath);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
