CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS posters (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type VARCHAR(30) NOT NULL,
    classification_confidence NUMERIC(4, 3),
    title VARCHAR(255),              -- 포스터 제목
    organizer_name VARCHAR(150),     -- 주최 기관명
    event_start_date DATE,           -- 행사 시작일
    event_end_date DATE,             -- 행사 종료일
    contact_phone VARCHAR(50),       -- 문의 전화번호
    contact_email VARCHAR(150),      -- 문의 이메일
    location VARCHAR(255),           -- 장소
    fee VARCHAR(100),                -- 참가비/입장료
    website_url TEXT,                -- 관련 링크
    description TEXT,                -- 포스터 설명 / 추가 내용
    raw_text TEXT,                   -- raw_text: OCR 인식 텍스트 배열을 공백으로 JOIN한 전체 텍스트 (임베딩 입력용)
    parsed_json JSONB,               -- parsed_json: 파싱된 구조화 데이터 원본 (JSONB)
    raw_json JSONB,                  -- raw_json: OCR 응답 전체 원본 (JSONB)
    embedding vector(1536),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
    );

-- 사용자별 포스터 조회 인덱스 (목록 조회 성능)
CREATE INDEX IF NOT EXISTS idx_posters_user_id
    ON posters (user_id);

CREATE INDEX IF NOT EXISTS idx_posters_title_trgm
    ON posters USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posters_organizer_name_trgm
    ON posters USING GIN (organizer_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posters_location_trgm
    ON posters USING GIN (location gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posters_contact_phone_trgm
    ON posters USING GIN (contact_phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posters_contact_email_trgm
    ON posters USING GIN (contact_email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posters_raw_text_trgm
    ON posters USING GIN (raw_text gin_trgm_ops);