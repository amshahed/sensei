import { CRITIQUE_CHECKLIST } from './lesson-schema';
import type { LessonDraft } from './lesson-schema';

export interface ReviewCheckItem {
  name: string;
  pass: boolean;
  note?: string;
}

export interface ReviewResult {
  lessonId: string;
  decision: 'APPROVE' | 'SEND_BACK';
  checks: ReviewCheckItem[];
  notes: string;
}

export function buildReviewTemplate(draft: LessonDraft): string {
  const previewLines = buildPreviewLines(draft);
  const checklist = CRITIQUE_CHECKLIST.map((name) => `- [ ] ${name}`).join(
    '\n',
  );

  return [
    `# Review: ${draft.lessonId} (${draft.lessonType})`,
    `# Title: ${draft.title}`,
    `# Generated: ${draft.meta.generatedAt}`,
    `# ─────────────────────────────────────────────────────────────────────────────`,
    `# LESSON PREVIEW (read-only — changes to this section are ignored)`,
    `# ─────────────────────────────────────────────────────────────────────────────`,
    ...previewLines.map((l) => `# ${l}`),
    `# ─────────────────────────────────────────────────────────────────────────────`,
    `# REVIEW (edit below)`,
    `# ─────────────────────────────────────────────────────────────────────────────`,
    `#`,
    `# Toggle [x] for each FAIL item.  Add a note after the dash: "- [x] tone — too dry"`,
    `# Set DECISION to APPROVE or SEND_BACK.`,
    `#`,
    ``,
    `DECISION: APPROVE`,
    ``,
    `## Checklist`,
    ``,
    checklist,
    ``,
    `## Notes`,
    ``,
    ``,
  ].join('\n');
}

function buildPreviewLines(draft: LessonDraft): string[] {
  const lines: string[] = [''];

  lines.push('TEACH BLOCKS:');
  draft.teach.blocks.forEach((block, i) => {
    const n = i + 1;
    if (block.type === 'text') {
      lines.push(`  ${n}. [text] ${block.md.replace(/\n/g, '↵').slice(0, 80)}`);
    } else if (block.type === 'example') {
      lines.push(
        `  ${n}. [example] ${block.japanese} (${block.reading}) — ${block.translation}`,
      );
    } else if (block.type === 'mnemonic') {
      lines.push(`  ${n}. [mnemonic] ${block.text.slice(0, 80)}`);
    } else if (block.type === 'passage') {
      lines.push(`  ${n}. [passage] ${block.text.slice(0, 80)}`);
    } else {
      // audio
      lines.push(`  ${n}. [audio] ${block.src} (${block.label})`);
    }
  });

  lines.push('');
  lines.push(
    `CHECK QUESTIONS (${draft.check.questions.length} total, showing first 3):`,
  );
  draft.check.questions.slice(0, 3).forEach((q, i) => {
    lines.push(
      `  Q${i + 1} (${q.targetItemId}) ${q.prompt} → ${q.correctAnswer}  [${q.answerType}]`,
    );
  });
  lines.push('');

  return lines;
}

export function parseReviewFile(
  content: string,
  lessonId: string,
): ReviewResult {
  // Extract DECISION
  const decisionMatch = /^DECISION:\s*(APPROVE|SEND_BACK)\s*$/m.exec(content);
  if (!decisionMatch) {
    throw new Error(
      'Review file must contain "DECISION: APPROVE" or "DECISION: SEND_BACK" on its own line',
    );
  }
  const decision = decisionMatch[1] as 'APPROVE' | 'SEND_BACK';

  // Extract checklist items: "- [ ] name" or "- [x] name — note"
  // Use [ \t]+ (not \s+) in the note separator to avoid matching across lines
  const checks: ReviewCheckItem[] = [];
  const checklistRe = /^- \[([ x])\]\s+([\w-]+)(?:[ \t]+[-–—][ \t]+(.+))?$/gm;
  let m: RegExpExecArray | null;
  while ((m = checklistRe.exec(content)) !== null) {
    const fail = m[1] === 'x';
    const name = m[2];
    const note = m[3]?.trim();
    checks.push({ name, pass: !fail, ...(note ? { note } : {}) });
  }

  if (checks.length === 0) {
    throw new Error('No checklist items found — file may be malformed');
  }

  const unknown = checks.filter(
    (c) => !(CRITIQUE_CHECKLIST as readonly string[]).includes(c.name),
  );
  if (unknown.length > 0) {
    console.warn(
      `Warning: unrecognised checklist item(s): ${unknown.map((c) => c.name).join(', ')} — possible typo`,
    );
  }

  // Extract Notes section
  const notes = extractNotes(content);

  return { lessonId, decision, checks, notes };
}

function extractNotes(content: string): string {
  const header = '\n## Notes';
  const start = content.indexOf(header);
  if (start === -1) return '';
  const body = content.slice(start + header.length);
  const nextSection = body.indexOf('\n## ');
  const raw = nextSection !== -1 ? body.slice(0, nextSection) : body;
  // Strip HTML comments (the default template placeholder)
  return raw.replace(/<!--.*?-->/gs, '').trim();
}
