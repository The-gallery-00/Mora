-- users 테이블에 updated_at 컬럼 추가
-- 비밀번호/닉네임 등 프로필 변경 시점 감사 목적
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- 기존 행은 created_at 으로 백필 (NOT NULL 제약은 두지 않아 nullable 유지)
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
