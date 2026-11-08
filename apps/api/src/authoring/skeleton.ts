/**
 * authoring:skeleton CLI — generates the Module/Chapter/Lesson skeleton for Foundation Japanese.
 *
 * Usage: pnpm --filter api authoring:skeleton [--module foundation-ja] [--output <path>] [--force]
 *
 * Reads ingested items from the Postgres DB, calls Claude Opus to produce a
 * curriculum skeleton, validates it with Zod, and writes it to disk.
 *
 * Generated once, then kept: drafts are filed under its lesson ids, and a
 * re-run gives a different skeleton (Opus 4.8 takes no temperature), so an
 * existing file is only replaced with --force.
 *
 * Prerequisites: run `pnpm --filter api ingest:items` first (issue #34).
 */
import * as path from 'path';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { loadItemData, generateSkeleton } from './skeleton-prompter';
import {
  AUTHORING_TIMEOUT_MS,
  authoringModel,
  formatCost,
} from './authoring-llm';

function parseArgs(): {
  moduleId: string;
  outputPath: string;
  force: boolean;
} {
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
  return { moduleId, outputPath, force: args.includes('--force') };
}

async function main(): Promise<void> {
  const { moduleId, outputPath, force } = parseArgs();
  if (fs.existsSync(outputPath) && !force) {
    throw new Error(
      `A skeleton already exists at ${outputPath}. Drafts are filed under its lesson ids, and a new run produces different ones — pass --force to replace it anyway.`,
    );
  }

  const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for authoring:skeleton.');
  }

  const prisma = new PrismaClient();
  const anthropic = new Anthropic({ apiKey, timeout: AUTHORING_TIMEOUT_MS });

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
    const model = authoringModel();
    console.log(`  calling ${model}...`);

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

    console.log(
      `  estimated cost: ${formatCost(model, inputTokens, outputTokens)}`,
    );

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
