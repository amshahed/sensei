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

/** Rows per multi-row INSERT — ~1024 floats each as text ≈ 10 KB, so ~1 MB/statement. */
const BATCH = 100;

/**
 * Batched form of upsertRefDoc: one multi-row INSERT … ON CONFLICT per 100
 * docs instead of one network round trip per doc (~9.7k sequential INSERTs to
 * Neon took minutes).
 */
export async function upsertRefDocs(
  prisma: PrismaClient,
  docs: RefDocInput[],
): Promise<void> {
  for (let i = 0; i < docs.length; i += BATCH) {
    const rows = docs.slice(i, i + BATCH).map(
      (doc) => Prisma.sql`(
        ${doc.id},
        ${doc.source},
        ${doc.language},
        ${doc.text},
        ${`[${doc.embedding.join(',')}]`}::vector,
        ${JSON.stringify(doc.metadata ?? {})}::jsonb,
        NOW()
      )`,
    );
    await prisma.$executeRaw`
      INSERT INTO "ReferenceDoc" (id, source, language, text, embedding, metadata, "createdAt")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT (id) DO UPDATE SET
        text      = EXCLUDED.text,
        embedding = EXCLUDED.embedding,
        metadata  = EXCLUDED.metadata
    `;
  }
}
