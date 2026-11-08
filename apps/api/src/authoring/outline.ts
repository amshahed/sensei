/**
 * authoring:outline CLI — compiles the committed beta outline (F.1.b).
 *
 * Usage: pnpm --filter api authoring:outline [--output <path>] [--force]
 *
 * Validates data/curriculum/foundation-ja-beta.json, checks every named item
 * against the item table, and writes the same skeleton.json authoring:draft
 * reads. No model call, so it costs nothing and the order can't drift.
 *
 * Prerequisites: ingest:items, including `supplement`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  compile,
  loadOutlineSpec,
  outlineItemIds,
  validateOutline,
} from './outline-compiler';

function parseArgs(): { outputPath: string; force: boolean } {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  const outputPath =
    outputIdx !== -1 && args[outputIdx + 1]
      ? path.resolve(args[outputIdx + 1])
      : path.resolve(
          process.cwd(),
          '../../tools/authoring/output/skeleton.json',
        );
  return { outputPath, force: args.includes('--force') };
}

async function main(): Promise<void> {
  const { outputPath, force } = parseArgs();
  if (fs.existsSync(outputPath) && !force) {
    throw new Error(
      `An outline already exists at ${outputPath}. Drafts are filed under its lesson ids — pass --force to replace it.`,
    );
  }

  const spec = loadOutlineSpec();
  const errors = validateOutline(spec);
  if (errors.length > 0) {
    throw new Error(
      `The outline spec is invalid (${errors.length}):\n  ${errors.join('\n  ')}`,
    );
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.item.findMany({
      where: { id: { in: outlineItemIds(spec) } },
      select: { id: true, type: true, display: true, reading: true },
    });
    const skeleton = compile(spec, rows);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(skeleton, null, 2), 'utf8');
    const lessons = skeleton.module.chapters.flatMap((c) => c.lessons);
    console.log(
      `authoring:outline — ${skeleton.module.chapters.length} chapters, ${lessons.length} lessons, ${rows.length} items → ${outputPath}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
