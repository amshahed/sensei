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
import { generateCritique } from './lesson-prompter';
import { validateStructure } from './lesson-validator';

function parseArgs(): { draftPath: string } {
  const args = process.argv.slice(2);
  const draftPath = args.find((a) => !a.startsWith('--')) ?? '';
  if (!draftPath) {
    throw new Error('Usage: authoring:critique <draft-path>');
  }
  return { draftPath: path.resolve(draftPath) };
}

async function main(): Promise<void> {
  const { draftPath } = parseArgs();

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
  const anthropic = new Anthropic({ apiKey });

  try {
    // Structural validation first (deterministic, free)
    const validation = await validateStructure(draft, prisma);
    if (!validation.pass) {
      console.warn(`\n[validator] FAIL:`);
      for (const e of validation.errors) console.warn(`  • ${e}`);
    } else {
      console.log(`[validator] pass`);
    }

    // AI critic
    console.log(
      `[critic] calling ${process.env['LLM_CRITIC_MODEL'] ?? 'claude-haiku-4-5-20251001'}...`,
    );
    const { critique, inputTokens, outputTokens } = await generateCritique(
      anthropic,
      draft,
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

    const costUsd = (inputTokens * 0.8 + outputTokens * 4) / 1_000_000;
    console.log(
      `\ntokens: ${inputTokens} in / ${outputTokens} out  (~$${costUsd.toFixed(4)})`,
    );

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
