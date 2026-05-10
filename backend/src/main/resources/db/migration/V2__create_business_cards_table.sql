CREATE TABLE IF NOT EXISTS business_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100),
    company VARCHAR(200),
    position VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    raw_ocr_text TEXT,
    image_url TEXT,
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_cards_user_id
    ON business_cards(user_id);
