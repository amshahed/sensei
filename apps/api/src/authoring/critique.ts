/**
 * authoring:critique CLI — runs the AI critic + structural validator on a draft.
 *
 * Usage: pnpm --filter api authoring:critique <draft-path>
 *
 * Reads a draft JSON from disk (output of authoring:draft), runs the structural
 * validator, then calls Claude Haiku against the 9-point checklist.
 * Writes a critique report to <draft-path>.critique.json.
 *
 * Prerequisites:
 *   - A draft JSON produced by pnpm authoring:draft
 *   - ANTHROPIC_API_KEY set in environment
 */
import * as path from 'path';
import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import { LessonDraftSchema } from './lesson-schema';
import { courseContextFor } from './course-context';
import { SkeletonSchema } from './skeleton-schema';
import { generateCritique } from './lesson-prompter';
import { validateStructure } from './lesson-validator';
import { AUTHORING_TIMEOUT_MS, criticModel, formatCost } from './authoring-llm';

function parseArgs(): { draftPath: string; skeletonPath: string } {
  const args = process.argv.slice(2);
  const skeletonIdx = args.indexOf('--skeleton');
  const skeletonValue = skeletonIdx === -1 ? undefined : args[skeletonIdx + 1];
  const draftPath =
    args.find((a) => !a.startsWith('--') && a !== skeletonValue) ?? '';
  if (!draftPath) {
    throw new Error(
      'Usage: authoring:critique <draft-path> [--skeleton <path>]',
    );
  }
  return {
    draftPath: path.resolve(draftPath),
    skeletonPath: skeletonValue
      ? path.resolve(skeletonValue)
      : path.resolve(
          process.cwd(),
          '../../tools/authoring/output/skeleton.json',
        ),
  };
}

async function main(): Promise<void> {
  const { draftPath, skeletonPath } = parseArgs();

  const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for authoring:critique.');
  }

  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft not found: ${draftPath}`);
  }

  const draftRaw = JSON.parse(fs.readFileSync(draftPath, 'utf8')) as unknown;
  const draft = LessonDraftSchema.parse(draftRaw);

  console.log(
    `authoring:critique — reviewing "${draft.lessonId}" (${draft.lessonType})`,
  );

  const prisma = new PrismaClient();
  const anthropic = new Anthropic({ apiKey, timeout: AUTHORING_TIMEOUT_MS });

  try {
    // Structural validation first (deterministic, free)
    const validation = await validateStructure(draft, prisma);
    if (!validation.pass) {
      console.warn(`\n[validator] FAIL:`);
      for (const e of validation.errors) console.warn(`  • ${e}`);
    } else {
      console.log(`[validator] pass`);
    }

    // The critic judges against what the learner has been taught so far.
    const ctx = fs.existsSync(skeletonPath)
      ? courseContextFor(
          SkeletonSchema.parse(
            JSON.parse(fs.readFileSync(skeletonPath, 'utf8')) as unknown,
          ),
          draft.lessonId,
        )
      : null;

    // AI critic
    console.log(`[critic] calling ${criticModel()}...`);
    const { critique, inputTokens, outputTokens } = await generateCritique(
      anthropic,
      draft,
      ctx,
    );

    // Print report
    console.log(
      `\n── Critique report ─────────────────────────────────────────`,
    );
    console.log(`Overall: ${critique.overallPass ? '✓ PASS' : '✗ FAIL'}`);
    if (critique.summary) console.log(`Summary: ${critique.summary}`);
    console.log('');
    for (const c of critique.checks) {
      const icon = c.pass ? '✓' : '✗';
      const note = c.note ? `  → ${c.note}` : '';
      console.log(`  ${icon} ${c.name}${note}`);
    }
    console.log(`────────────────────────────────────────────────────────────`);

    const cost = formatCost(critique.meta.model, inputTokens, outputTokens);
    console.log(`\ntokens: ${inputTokens} in / ${outputTokens} out  (${cost})`);

    const outPath = draftPath.replace(/\.json$/, '.critique.json');
    fs.writeFileSync(outPath, JSON.stringify(critique, null, 2), 'utf8');
    console.log(`critique → ${outPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
