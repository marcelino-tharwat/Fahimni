CREATE TABLE content_chunks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    content TEXT NOT NULL,
    embedding vector(768),
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX content_chunks_embedding_idx
ON content_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX content_chunks_lesson_id_idx
ON content_chunks (lesson_id);
