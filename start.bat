@echo off
chcp 65001 >nul 2>&1
echo ===== MORA START =====

echo [0/5] Killing old processes...
taskkill /IM node.exe /F >nul 2>&1
taskkill /IM java.exe /F >nul 2>&1

echo [1/5] Starting DB...
docker start mora-db >nul 2>&1
if %errorlevel% neq 0 (
    echo DB container not found, creating new one with named volume...
    docker run -d --name mora-db -e POSTGRES_DB=mora -e POSTGRES_USER=mora -e POSTGRES_PASSWORD=mora1234 -p 5433:5432 -v mora-pgdata:/var/lib/postgresql/data --restart unless-stopped pgvector/pgvector:pg16
    timeout /t 5 /nobreak >nul
    echo [2/5] Creating tables...
    docker exec mora-db psql -U mora -d mora -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider VARCHAR(20) DEFAULT 'local', email VARCHAR(255) NOT NULL, password_hash VARCHAR(255), name VARCHAR(100) NOT NULL, picture TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(email, provider)); CREATE TABLE IF NOT EXISTS business_cards (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(100), company VARCHAR(200), position VARCHAR(100), phone VARCHAR(50), email VARCHAR(255), raw_ocr_text TEXT, image_url TEXT DEFAULT '', embedding vector(1536), created_at TIMESTAMPTZ DEFAULT now()); CREATE INDEX IF NOT EXISTS idx_cards_user_id ON business_cards(user_id);"
) else (
    echo DB container already running.
    timeout /t 2 /nobreak >nul
)

echo [3/5] Starting Python OCR (port 8000) with auto-reload...
start "MORA-OCR" cmd /k "cd /d %~dp0backend && py -3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload"

echo [4/5] Starting Spring Boot (port 8080)...
start "MORA-Spring" cmd /k "cd /d %~dp0spring && mvn spring-boot:run"

echo [5/5] Starting Frontend (port 3000)...
start "MORA-Frontend" cmd /k "cd /d %~dp0frontend && pnpm dev"

echo.
echo ===== ALL STARTED =====
echo DB:       localhost:5433
echo OCR:      http://localhost:8000
echo Spring:   http://localhost:8080
echo Frontend: http://localhost:3000
echo.
pause
