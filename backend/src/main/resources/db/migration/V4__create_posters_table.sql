-- ═══════════════════════════════════════════════════════════════
-- V2__create_posters_table.sql — 포스터 테이블 생성 마이그레이션
-- ═══════════════════════════════════════════════════════════════
--
-- [목적]
-- OCR로 인식된 포스터 데이터를 저장하는 posters 테이블을 생성한다.
-- pg_trgm 확장을 사용하여 Fuzzy Search(오타 허용 문자열 검색)를 지원한다.
-- pgvector는 V1에서 이미 활성화되어 있으므로 중복 설치하지 않는다.
--
-- [검색 전략]
-- 1) pg_trgm (Fuzzy Search): 제목/주최기관/장소/문의처/전체텍스트 오타 허용 검색
-- 2) pgvector (Vector Search): raw_text 임베딩 기반 의미 유사도 검색
-- 3) 하이브리드: Fuzzy + Vector 결합 검색 가능
-- ═══════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------
-- pg_trgm 확장 활성화
-- ---------------------------------------------------------------
-- pg_trgm: 트라이그램(3글자 단위) 기반 문자열 유사도 함수를 제공한다.
-- similarity(a, b) → 두 문자열의 유사도 (0~1)
-- word_similarity(a, b) → 긴 텍스트 안에서 a와 가장 잘 맞는 부분의 유사도
-- gin_trgm_ops: GIN 인덱스와 함께 사용하여 similarity 검색을 빠르게 한다.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------
-- posters 테이블 생성
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posters (
    -- 기본 키 (SERIAL: 자동 증가 정수)
                                       id SERIAL PRIMARY KEY,

    -- 사용자 식별 (본인 포스터만 조회하기 위해 필수, users 테이블 FK)
                                       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 문서 분류 정보
    -- doc_type: OCR 서버가 분류한 문서 유형 (예: "POSTER")
    -- classification_confidence: 분류 신뢰도 (예: 0.950, 소수점 3자리)
    doc_type VARCHAR(30) NOT NULL,
    classification_confidence NUMERIC(4, 3),

    -- 포스터 핵심 정보
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

-- OCR 및 데이터 원본
-- raw_text: OCR 인식 텍스트 배열을 공백으로 JOIN한 전체 텍스트 (임베딩 입력용)
-- parsed_json: 파싱된 구조화 데이터 원본 (JSONB)
-- raw_json: OCR 응답 전체 원본 (JSONB)
    raw_text TEXT,
    parsed_json JSONB,
    raw_json JSONB,

    -- 벡터 검색용
    -- raw_text를 임베딩한 1536차원 벡터
    embedding vector(1536),

    -- 시스템 컬럼
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
    );

-- ---------------------------------------------------------------
-- 인덱스 생성
-- ---------------------------------------------------------------

-- 사용자별 포스터 조회 인덱스 (목록 조회 성능)
CREATE INDEX IF NOT EXISTS idx_posters_user_id
    ON posters (user_id);

-- pg_trgm GIN 인덱스 (Fuzzy Search 성능 향상)
-- GIN(Generalized Inverted Index): 트라이그램 배열을 역인덱스로 저장하여
-- similarity() 조건 검색을 빠르게 처리한다.
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