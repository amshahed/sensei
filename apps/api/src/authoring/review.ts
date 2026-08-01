/**
 * authoring:review CLI — editorial review of a lesson draft.
 *
 * Usage: pnpm --filter api authoring:review <lesson-id> [--skeleton <path>] [--regenerate]
 *
 * Opens $EDITOR with a structured review template (lesson preview + 9-point
 * checklist). On save:
 *   APPROVE → moves draft from output/ to published/ (ready for authoring:publish)
 *   SEND_BACK → appends to corrections.jsonl; --regenerate re-runs drafter
 *
 * Prerequisites:
 *   - pnpm --filter api authoring:draft <lesson-id> (draft must exist in output/)
 */
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { LessonDraftSchema } from './lesson-schema';
import { buildReviewTemplate, parseReviewFile } from './review-schema';
import { appendCorrection } from './corrections-log';

function parseArgs(): {
  lessonId: string;
  skeletonPath: string;
  outputDir: string;
  publishedDir: string;
  correctionsPath: string;
  regenerate: boolean;
} {
  const args = process.argv.slice(2);
  const lessonId = args.find((a) => !a.startsWith('--')) ?? '';
  if (!lessonId)
    throw new Error('Usage: authoring:review <lesson-id> [--regenerate]');

  const skeletonIdx = args.indexOf('--skeleton');
  const skeletonPath =
    skeletonIdx !== -1 && args[skeletonIdx + 1]
      ? args[skeletonIdx + 1]
      : path.resolve(
          process.cwd(),
          '../../tools/authoring/output/skeleton.json',
        );

  const root = path.resolve(process.cwd(), '../../tools/authoring');
  return {
    lessonId,
    skeletonPath,
    outputDir: path.join(root, 'output'),
    publishedDir: path.join(root, 'published'),
    correctionsPath: path.join(root, 'corrections.jsonl'),
    regenerate: args.includes('--regenerate'),
  };
}

function openEditor(filePath: string): void {
  const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi';
  const result = spawnSync(editor, [filePath], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Editor exited with status ${String(result.status ?? 1)}`);
  }
}

function main(): void {
  const {
    lessonId,
    skeletonPath,
    outputDir,
    publishedDir,
    correctionsPath,
    regenerate,
  } = parseArgs();

  const draftPath = path.join(outputDir, `${lessonId}.json`);
  if (!fs.existsSync(draftPath)) {
    throw new Error(
      `Draft not found at ${draftPath}. Run authoring:draft ${lessonId} first.`,
    );
  }

  const draftRaw = JSON.parse(fs.readFileSync(draftPath, 'utf8')) as unknown;
  const draft = LessonDraftSchema.parse(draftRaw);

  console.log(`authoring:review — opening "${lessonId}" (${draft.lessonType})`);

  // Write review template to a temp file and open in editor
  const tmpFile = path.join(os.tmpdir(), `sensei-review-${lessonId}.md`);
  fs.writeFileSync(tmpFile, buildReviewTemplate(draft), 'utf8');

  try {
    openEditor(tmpFile);
  } catch (err) {
    fs.rmSync(tmpFile, { force: true });
    throw err;
  }

  const saved = fs.readFileSync(tmpFile, 'utf8');
  const review = parseReviewFile(saved, lessonId);
  fs.rmSync(tmpFile, { force: true });

  const fails = review.checks.filter((c) => !c.pass);
  const passCount = review.checks.length - fails.length;
  console.log(
    `\nDecision: ${review.decision}  (${passCount}/${review.checks.length} checks pass)`,
  );
  if (fails.length > 0) {
    for (const f of fails) {
      const note = f.note ? ` — ${f.note}` : '';
      console.log(`  ✗ ${f.name}${note}`);
    }
  }

  if (review.decision === 'APPROVE') {
    if (fails.length > 0) {
      console.warn(
        `\nWarning: approving with ${fails.length} failing check(s) — consider SEND_BACK.`,
      );
    }
    fs.mkdirSync(publishedDir, { recursive: true });
    const destPath = path.join(publishedDir, `${lessonId}.json`);
    fs.copyFileSync(draftPath, destPath);
    console.log(`\nApproved → ${destPath}`);
    console.log(`Run: pnpm --filter api authoring:publish ${lessonId}`);
  } else {
    if (fails.length === 0 && !review.notes.trim()) {
      throw new Error(
        'SEND_BACK requires at least one failing check ([x]) or a note in the Notes section.',
      );
    }

    const notes = [
      review.notes,
      ...fails.map((f) =>
        f.note ? `[${f.name}] ${f.note}` : `[${f.name}] failed`,
      ),
    ]
      .filter(Boolean)
      .join('\n');

    appendCorrection(
      {
        lesson_type: draft.lessonType,
        original_draft: draft,
        notes,
        regenerated_version: null,
        timestamp: new Date().toISOString(),
      },
      correctionsPath,
    );

    console.log(`\nSent back — correction appended to corrections.jsonl`);

    if (regenerate) {
      console.log(`\nRegenerating draft with updated corrections...`);
      const result = spawnSync(
        'pnpm',
        [
          '--filter',
          'api',
          'authoring:draft',
          lessonId,
          '--skeleton',
          skeletonPath,
        ],
        { stdio: 'inherit', cwd: path.resolve(process.cwd(), '../..') },
      );
      if (result.status !== 0) {
        console.warn(
          `Regeneration exited with status ${String(result.status ?? 1)}`,
        );
      }
    } else {
      console.log(
        `Tip: re-run authoring:draft ${lessonId} to regenerate with updated corrections.`,
      );
    }
  }
}

try {
  main();
} catch (err: unknown) {
  console.error((err as Error).message ?? err);
  process.exit(1);
}
