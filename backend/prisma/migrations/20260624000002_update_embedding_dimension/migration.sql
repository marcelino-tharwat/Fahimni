DROP INDEX IF EXISTS content_chunks_embedding_idx;
ALTER TABLE content_chunks ALTER COLUMN embedding TYPE vector(3072);
