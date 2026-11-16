/**
 * authoring:publish CLI — writes an approved lesson draft to the database.
 *
 * Usage: pnpm --filter api authoring:publish <lesson-id> [--skeleton <path>]
 *
 * Reads the approved draft from tools/authoring/published/<lesson-id>.json,
 * checks it against the structural validator and the course rules, then
 * writes Module → Chapter → Lesson → LessonItem → Check rows transactionally.
 * Re-publishing is idempotent (upserts by slug).
 *
 * Prerequisites:
 *   - Draft approved via authoring:review (published/ file must exist)
 *   - DATABASE_URL set in environment
 */
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { SkeletonSchema, type Skeleton } from './skeleton-schema';
import { LessonDraftSchema, type LessonDraft } from './lesson-schema';
import { publishLesson } from './lesson-publisher';
import { courseContextFor } from './course-context';
import { checkCourseRules } from './course-rules';
import { validateStructure } from './lesson-validator';

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

/**
 * Why a draft can't be published, empty when it can (F.2.h): the structural
 * validator, so a check on an undeclared item is named here rather than by the
 * foreign key mid-transaction, and the course rules when the skeleton gives
 * the lesson a context. Course-rule warnings are printed, never refused.
 */
export async function publishRefusals(
  draft: LessonDraft,
  skeleton: Skeleton,
  prisma: PrismaClient,
): Promise<string[]> {
  const validation = await validateStructure(draft, prisma);
  const refusals = validation.errors.map((e) => `structure: ${e}`);
  const ctx = courseContextFor(skeleton, draft.lessonId);
  if (ctx) {
    const { errors, warnings } = checkCourseRules(draft, ctx);
    for (const w of warnings) console.warn(`  [course rules] warning: ${w}`);
    refusals.push(...errors);
  }
  return refusals;
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
    const refusals = await publishRefusals(draft, skeleton, prisma);
    if (refusals.length > 0) {
      throw new Error(
        `Refusing to publish "${draft.lessonId}": it fails the gate:\n  ${refusals.join('\n  ')}`,
      );
    }
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

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error((err as Error).message ?? err);
    process.exit(1);
  });
}
