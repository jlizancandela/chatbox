CREATE INDEX IF NOT EXISTS document_chunks_embedding_cosine_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);
