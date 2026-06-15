import { PrismaClient } from '@prisma/client';
import { makeVoyageClient } from '../../voyage/voyage-client';
import { ingestTatoeba } from './tatoeba';
import { ingestGrammarRefs } from './grammar-ref';

const KIND = process.argv[2];
const sourceIdx = process.argv.indexOf('--source');
const SOURCE = sourceIdx !== -1 ? process.argv[sourceIdx + 1] : undefined;
const PRE_FILTERED = process.argv.includes('--pre-filtered');

const USAGE = `
Usage: pnpm --filter api ingest:refs <kind> [--source <path>]

  kind:
    tatoeba     embed + upsert filtered Tatoeba JA sentences
                  --source <path>     path to sentences file (see docs/ingest.md)
                  --pre-filtered      file is id\\ttext (already filtered to JA)
    grammar     generate + embed grammar reference passages via Claude Opus
                  (reads grammar items already in the DB from ingest:items grammar)

  Requires:
    VOYAGE_API_KEY       for embedding
    ANTHROPIC_API_KEY    for grammar passage generation (grammar kind only)

  Examples:
    pnpm --filter api ingest:refs tatoeba --source ./data/jpn_sentences.tsv --pre-filtered
    pnpm --filter api ingest:refs grammar
`.trim();

async function main() {
  if (!KIND || KIND === '--help' || KIND === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  const prisma = new PrismaClient();
  const voyage = makeVoyageClient();

  try {
    switch (KIND) {
      case 'tatoeba':
        if (!SOURCE)
          throw new Error(
            '--source <path> is required for tatoeba ingestion\n\n' + USAGE,
          );
        await ingestTatoeba(prisma, voyage, SOURCE, PRE_FILTERED);
        break;
      case 'grammar':
        await ingestGrammarRefs(
          prisma,
          voyage,
          process.env['ANTHROPIC_API_KEY'] ?? '',
        );
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
