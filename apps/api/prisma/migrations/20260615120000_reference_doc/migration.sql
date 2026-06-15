-- CreateTable
CREATE TABLE "ReferenceDoc" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1024),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferenceDoc_source_language_idx" ON "ReferenceDoc"("source", "language");

-- CreateIndex (HNSW for cosine-similarity nearest-neighbour search)
CREATE INDEX "ReferenceDoc_embedding_hnsw_idx" ON "ReferenceDoc"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
