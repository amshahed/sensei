import { PrismaClient } from '@prisma/client';
import { ingestKana } from './kana';
import { ingestVocab } from './vocab';
import { ingestKanji } from './kanji';
import { ingestGrammar } from './grammar';
import { ingestSupplement } from './supplement';

const KIND = process.argv[2];
const sourceIdx = process.argv.indexOf('--source');
const SOURCE = sourceIdx !== -1 ? process.argv[sourceIdx + 1] : undefined;

const USAGE = `
Usage: pnpm --filter api ingest:items <kind> [--source <path>]

  kind:
    kana              ingest all hiragana + katakana (no --source needed)
    vocab             ingest JLPT N5–N4 vocab from jmdict-simplified JSON
    kanji             ingest JLPT N5 kanji from kanjidic2-simplified JSON
    grammar           ingest N5 grammar shells from JSON or TSV
    supplement        insert the beta's set phrases and prerequisite grammar,
                      and fill empty grammar meanings (--source is jmdict-simplified JSON)

  Examples:
    pnpm --filter api ingest:items kana
    pnpm --filter api ingest:items vocab --source ./data/jmdict-eng.json
    pnpm --filter api ingest:items kanji --source ./data/kanjidic2.json
    pnpm --filter api ingest:items grammar --source ./data/tanos-n5-grammar.json
    pnpm --filter api ingest:items supplement --source ./data/jmdict-eng.json
`.trim();

async function main() {
  if (!KIND || KIND === '--help' || KIND === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  const prisma = new PrismaClient();

  try {
    switch (KIND) {
      case 'kana':
        await ingestKana(prisma);
        break;
      case 'vocab':
        if (!SOURCE)
          throw new Error(
            '--source <path> is required for vocab ingestion\n\n' + USAGE,
          );
        await ingestVocab(prisma, SOURCE);
        break;
      case 'kanji':
        if (!SOURCE)
          throw new Error(
            '--source <path> is required for kanji ingestion\n\n' + USAGE,
          );
        await ingestKanji(prisma, SOURCE);
        break;
      case 'grammar':
        if (!SOURCE)
          throw new Error(
            '--source <path> is required for grammar ingestion\n\n' + USAGE,
          );
        await ingestGrammar(prisma, SOURCE);
        break;
      case 'supplement':
        if (!SOURCE)
          throw new Error(
            '--source <path> is required for supplement ingestion\n\n' + USAGE,
          );
        await ingestSupplement(prisma, SOURCE);
        break;
      default:
        throw new Error(`Unknown kind "${KIND}"\n\n` + USAGE);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
