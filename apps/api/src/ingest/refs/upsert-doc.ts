import { PrismaClient, Prisma } from '@prisma/client';

export type RefDocInput = {
  id: string;
  source: string;
  language: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
};

/**
 * Upsert a ReferenceDoc with its vector embedding via raw SQL.
 * The `embedding` column is `vector(1024)` (Unsupported in Prisma client),
 * so we bypass the ORM for this table.
 */
export async function upsertRefDoc(
  prisma: PrismaClient,
  doc: RefDocInput,
): Promise<void> {
  const vectorLiteral = `[${doc.embedding.join(',')}]`;
  const metadata = JSON.stringify(doc.metadata ?? {});

  await prisma.$executeRaw`
    INSERT INTO "ReferenceDoc" (id, source, language, text, embedding, metadata, "createdAt")
    VALUES (
      ${doc.id},
      ${doc.source},
      ${doc.language},
      ${doc.text},
      ${vectorLiteral}::vector,
      ${Prisma.raw(`'${metadata.replace(/'/g, "''")}'`)}::jsonb,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      text    = EXCLUDED.text,
      embedding = EXCLUDED.embedding,
      metadata  = EXCLUDED.metadata
  `;
}
