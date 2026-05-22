-- 필요한 PostgreSQL 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- 영수증 기본 정보 테이블
CREATE TABLE IF NOT EXISTS receipts
(
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    doc_type VARCHAR(30) NOT NULL DEFAULT 'RECEIPT',   -- 문서 유형
    classification_confidence NUMERIC(4, 3),    -- 분류 신뢰도
    merchant_name VARCHAR(255),                             -- 상호명
    merchant_address TEXT,                                     -- 매장 주소
    purchase_date DATE,                                     -- 결제 날짜
    purchase_time TIME,                                     -- 결제 시간
    payment_method VARCHAR(50),                              -- 결제 수단
    card_company VARCHAR(100),                             -- 카드사
    total_amount NUMERIC(12, 2) CHECK (total_amount >= 0), -- 총 결제금액
    currency_code VARCHAR(10) DEFAULT 'KRW',       -- 통화 코드
    raw_text TEXT,                                     -- OCR 원문
    parsed_json JSONB,                                    -- 파싱 결과
    raw_json JSONB,                                    -- OCR 원본 응답
    embedding vector(1536),                             -- 검색용 임베딩

    created_at TIMESTAMP DEFAULT NOW(),       -- 생성 시각
    updated_at TIMESTAMP DEFAULT NOW()        -- 수정 시각
);

-- 영수증 품목 테이블
CREATE TABLE IF NOT EXISTS receipt_items
(
    id          SERIAL PRIMARY KEY,
    receipt_id  INTEGER      NOT NULL REFERENCES receipts (id) ON DELETE CASCADE,
    item_name   VARCHAR(255) NOT NULL,                   -- 품명
    quantity    NUMERIC(10, 2) CHECK (quantity >= 0),    -- 수량
    unit_price  NUMERIC(12, 2) CHECK (unit_price >= 0),  -- 단가
    total_price NUMERIC(12, 2) CHECK (total_price >= 0), -- 품목 총액
    category    VARCHAR(100),                            -- 품목 카테고리

    created_at  TIMESTAMP DEFAULT NOW()                  -- 생성 시각
);

-- 사용자별 영수증 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_receipts_user_id
    ON receipts (user_id);

-- 상호명 유사 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_name_trgm
    ON receipts USING GIN (merchant_name gin_trgm_ops);

-- OCR 원문 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_receipts_raw_text_trgm
    ON receipts USING GIN (raw_text gin_trgm_ops);

-- 결제 날짜 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_receipts_purchase_date
    ON receipts (purchase_date);

-- 결제 수단 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_receipts_payment_method_trgm
    ON receipts USING GIN (payment_method gin_trgm_ops);

-- 영수증별 품목 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id
    ON receipt_items (receipt_id);

-- 품목명 유사 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_receipt_items_item_name_trgm
    ON receipt_items USING GIN (item_name gin_trgm_ops);