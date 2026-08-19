DO $$
DECLARE
  current_embedding_type TEXT;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO current_embedding_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = current_schema()
    AND relation.relname = 'document_chunks'
    AND attribute.attname = 'embedding'
    AND NOT attribute.attisdropped;

  IF current_embedding_type = 'vector(384)' THEN
    -- Old embeddings cannot be converted safely; the ingestion CLI must recreate them.
    TRUNCATE TABLE documents RESTART IDENTITY CASCADE;

    ALTER TABLE document_chunks DROP COLUMN embedding;
    ALTER TABLE document_chunks ADD COLUMN embedding vector(768) NOT NULL;
  ELSIF current_embedding_type IS NOT NULL
    AND current_embedding_type <> 'vector(768)' THEN
    RAISE EXCEPTION 'Unsupported document_chunks.embedding type: %', current_embedding_type;
  END IF;
END
$$;
