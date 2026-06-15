/**
 * authoring:publish CLI — writes an approved lesson draft to the database.
 *
 * Usage: pnpm --filter api authoring:publish <lesson-id> [--skeleton <path>]
 *
 * Reads the approved draft from tools/authoring/published/<lesson-id>.json,
 * then writes Module → Chapter → Lesson → LessonItem → Check rows
 * transactionally. Re-publishing is idempotent (upserts by slug).
 *
 * Prerequisites:
 *   - Draft approved via authoring:review (published/ file must exist)
 *   - DATABASE_URL set in environment
 */
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { SkeletonSchema } from './skeleton-schema';
import { LessonDraftSchema } from './lesson-schema';
import { publishLesson } from './lesson-publisher';

function parseArgs(): {
  lessonId: string;
  skeletonPath: string;
  publishedDir: string;
} {
  const args = process.argv.slice(2);
  const lessonId = args.find((a) => !a.startsWith('--')) ?? '';
  if (!lessonId) throw new Error('Usage: authoring:publish <lesson-id>');

  const skeletonIdx = args.indexOf('--skeleton');
  const skeletonPath =
    skeletonIdx !== -1 && args[skeletonIdx + 1]
      ? args[skeletonIdx + 1]
      : path.resolve(
          process.cwd(),
          '../../tools/authoring/output/skeleton.json',
        );

  const publishedDir = path.resolve(
    process.cwd(),
    '../../tools/authoring/published',
  );

  return { lessonId, skeletonPath, publishedDir };
}

async function main(): Promise<void> {
  const { lessonId, skeletonPath, publishedDir } = parseArgs();

  if (!fs.existsSync(skeletonPath)) {
    throw new Error(
      `Skeleton not found at ${skeletonPath}. Run authoring:skeleton first.`,
    );
  }

  const publishedPath = path.join(publishedDir, `${lessonId}.json`);
  if (!fs.existsSync(publishedPath)) {
    throw new Error(
      `Approved draft not found at ${publishedPath}. Run authoring:review ${lessonId} first.`,
    );
  }

  const skeletonRaw = JSON.parse(
    fs.readFileSync(skeletonPath, 'utf8'),
  ) as unknown;
  const skeleton = SkeletonSchema.parse(skeletonRaw);

  const draftRaw = JSON.parse(
    fs.readFileSync(publishedPath, 'utf8'),
  ) as unknown;
  const draft = LessonDraftSchema.parse(draftRaw);

  console.log(
    `authoring:publish — writing "${draft.lessonId}" (${draft.lessonType}) to DB`,
  );

  const prisma = new PrismaClient();
  try {
    const result = await publishLesson(draft, skeleton, prisma);
    const action = result.created ? 'created' : 'updated';
    console.log(
      `  ${action} lesson ${result.lessonDbId} (${result.itemsLinked} items, ${result.checksWritten} checks)`,
    );
    console.log(`\nPublished ✓`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
