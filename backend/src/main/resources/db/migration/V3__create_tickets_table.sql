CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type VARCHAR(30) NOT NULL,
    classification_confidence NUMERIC(4, 3),
    transport_type VARCHAR(50),         -- 운송수단 (예: KTX, 항공, 버스)
    departure_location VARCHAR(255),    -- 출발지 (예: 서울, 인천공항)
    departure_date     DATE,            -- 출발 날짜
    departure_time     TIME,            -- 출발 시간
    arrival_location VARCHAR(255),      -- 도착지 (예: 부산, 제주)
    arrival_date     DATE,              -- 도착 날짜
    arrival_time     TIME,              -- 도착 시간
    raw_text    TEXT,
    parsed_json JSONB,
    raw_json    JSONB,
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id
    ON tickets (user_id);

CREATE INDEX IF NOT EXISTS idx_tickets_departure_location_trgm
    ON tickets USING GIN (departure_location gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_arrival_location_trgm
    ON tickets USING GIN (arrival_location gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_transport_type_trgm
    ON tickets USING GIN (transport_type gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_raw_text_trgm
    ON tickets USING GIN (raw_text gin_trgm_ops);
