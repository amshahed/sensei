import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Source file format (JSON array):
//   [{ "pattern": "〜は〜です", "description": "Declares topic with copula", "jlpt": "N5", "prereqs": [] }]
// "description" and "prereqs" are optional; explanation is filled by the drafter (#21d).
export type GrammarEntry = {
  pattern: string;
  description?: string;
  jlpt?: string;
  prereqs?: string[];
};

export function slugify(pattern: string): string {
  // Convert Japanese pattern to a URL-safe slug.
  // Tildes and wave-dashes become hyphens; spaces collapse; stray punctuation stripped.
  return pattern
    .replace(/[〜~～]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\w぀-ヿ一-鿿-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function buildGrammarItem(entry: GrammarEntry) {
  const slug = slugify(entry.pattern);
  const jlpt = entry.jlpt ?? 'N5';

  return {
    id: `ja:grammar:${slug}`,
    language: 'ja',
    type: 'GRAMMAR' as const,
    display: entry.pattern,
    reading: null,
    meaning: entry.description ?? null,
    data: {
      pattern_name: entry.pattern,
      jlpt_level: jlpt,
      prereqs: entry.prereqs ?? [],
    },
  };
}

export function parseGrammarSource(sourcePath: string): GrammarEntry[] {
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const ext = path.extname(sourcePath).toLowerCase();

  if (ext === '.json') {
    return JSON.parse(raw) as GrammarEntry[];
  }

  // TSV: pattern\tdescription (header row optional — skip if first cell is "pattern")
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const start = lines[0]?.toLowerCase().startsWith('pattern') ? 1 : 0;

  return lines.slice(start).map((line) => {
    const [pattern, description, jlpt, prereqsRaw] = line.split('\t');
    const entry: GrammarEntry = { pattern: pattern.trim() };
    if (description?.trim()) entry.description = description.trim();
    if (jlpt?.trim()) entry.jlpt = jlpt.trim();
    if (prereqsRaw?.trim())
      entry.prereqs = prereqsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return entry;
  });
}

export async function ingestGrammar(
  prisma: PrismaClient,
  sourcePath: string,
): Promise<void> {
  const entries = parseGrammarSource(sourcePath);
  const items = entries.map(buildGrammarItem);

  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  for (const item of unique) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: {
        display: item.display,
        reading: item.reading,
        meaning: item.meaning,
        data: item.data,
      },
      create: item,
    });
  }

  console.log(
    `ingest:items grammar — upserted ${unique.length} grammar shells (${entries.length - unique.length} dupes skipped)`,
  );
}
