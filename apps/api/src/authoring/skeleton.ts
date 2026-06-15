/**
 * authoring:skeleton CLI — generates the Module/Chapter/Lesson skeleton for Foundation Japanese.
 *
 * Usage: pnpm --filter api authoring:skeleton [--module foundation-ja] [--output <path>]
 *
 * Reads ingested items from the Postgres DB, calls Claude Opus to produce a
 * curriculum skeleton, validates it with Zod, and writes it to disk.
 *
 * Prerequisites: run `pnpm --filter api ingest:items` first (issue #34).
 */
import * as path from 'path';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { loadItemData, generateSkeleton } from './skeleton-prompter';

function parseArgs(): { moduleId: string; outputPath: string } {
  const args = process.argv.slice(2);
  const moduleIdx = args.indexOf('--module');
  const moduleId =
    moduleIdx !== -1 && args[moduleIdx + 1]
      ? args[moduleIdx + 1]
      : 'foundation-ja';
  const outputIdx = args.indexOf('--output');
  const outputPath =
    outputIdx !== -1 && args[outputIdx + 1]
      ? args[outputIdx + 1]
      : path.resolve(
          process.cwd(),
          '../../tools/authoring/output/skeleton.json',
        );
  return { moduleId, outputPath };
}

async function main(): Promise<void> {
  const { moduleId, outputPath } = parseArgs();

  const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for authoring:skeleton.');
  }

  const prisma = new PrismaClient();
  const anthropic = new Anthropic({ apiKey });

  try {
    console.log(
      `authoring:skeleton — loading item data for module "${moduleId}"...`,
    );
    const data = await loadItemData(prisma);

    const total =
      data.kana.length +
      data.grammar.length +
      data.vocab.length +
      data.kanji.length;
    if (total === 0) {
      throw new Error(
        'No items found in DB. Run `pnpm --filter api ingest:items` first (issue #34).',
      );
    }

    console.log(
      `  kana=${data.kana.length} grammar=${data.grammar.length} vocab=${data.vocab.length} kanji=${data.kanji.length}`,
    );
    console.log(
      `  calling ${process.env['LLM_AUTHORING_MODEL'] ?? 'claude-opus-4-8'}...`,
    );

    const { skeleton, inputTokens, outputTokens } = await generateSkeleton(
      anthropic,
      moduleId,
      data,
    );

    const lessonCount = skeleton.module.chapters.reduce(
      (sum, ch) => sum + ch.lessons.length,
      0,
    );
    const chapterCount = skeleton.module.chapters.length;

    console.log(
      `  generated: ${chapterCount} chapters, ${lessonCount} lessons`,
    );
    console.log(`  tokens: ${inputTokens} in / ${outputTokens} out`);

    const costUsd = (inputTokens * 15 + outputTokens * 75) / 1_000_000;
    console.log(`  estimated cost: ~$${costUsd.toFixed(4)}`);

    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(skeleton, null, 2), 'utf8');
    console.log(`  wrote skeleton → ${outputPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
