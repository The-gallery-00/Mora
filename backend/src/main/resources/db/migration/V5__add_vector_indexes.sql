-- tickets 벡터 인덱스
CREATE INDEX IF NOT EXISTS idx_tickets_embedding_hnsw
    ON tickets USING hnsw (embedding vector_cosine_ops);

-- posters 벡터 인덱스
CREATE INDEX IF NOT EXISTS idx_posters_embedding_hnsw
    ON posters USING hnsw (embedding vector_cosine_ops);

-- business_cards 벡터 인덱스
CREATE INDEX IF NOT EXISTS idx_business_cards_embedding_hnsw
    ON business_cards USING hnsw (embedding vector_cosine_ops);
