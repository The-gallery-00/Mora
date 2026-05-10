#!/bin/bash
echo "===== MORA START ====="

echo "[0/5] Killing old processes..."
pkill -f "node" 2>/dev/null
pkill -f "java" 2>/dev/null

echo "[1/5] Starting DB..."
docker rm -f mora-db 2>/dev/null
docker run -d --name mora-db -e POSTGRES_DB=mora -e POSTGRES_USER=mora -e POSTGRES_PASSWORD=mora1234 -p 5433:5432 pgvector/pgvector:pg16
sleep 5

echo "[2/5] Creating tables..."
docker exec mora-db psql -U mora -d mora -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider VARCHAR(20) DEFAULT 'local', email VARCHAR(255) NOT NULL, password_hash VARCHAR(255), name VARCHAR(100) NOT NULL, picture TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(email, provider)); CREATE TABLE IF NOT EXISTS business_cards (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(100), company VARCHAR(200), position VARCHAR(100), phone VARCHAR(50), email VARCHAR(255), raw_ocr_text TEXT, image_url TEXT DEFAULT '', embedding vector(1536), created_at TIMESTAMPTZ DEFAULT now()); CREATE INDEX IF NOT EXISTS idx_cards_user_id ON business_cards(user_id);"

echo "[3/5] Starting Python OCR (port 8000)..."
cd "$(dirname "$0")/ocr" && python3 app.py &
cd "$(dirname "$0")"

echo "[4/5] Starting Spring Boot (port 8080)..."
cd "$(dirname "$0")/backend" && ./mvnw spring-boot:run &
cd "$(dirname "$0")"

echo "[5/5] Starting Frontend (port 3000)..."
cd "$(dirname "$0")/frontend" && pnpm dev &

echo ""
echo "===== ALL STARTED ====="
echo "DB:       localhost:5433"
echo "OCR:      http://localhost:8000"
echo "Spring:   http://localhost:8080"
echo "Frontend: http://localhost:3000"
echo ""
wait
