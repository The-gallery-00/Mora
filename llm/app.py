# app.py — FastAPI 애플리케이션 진입점 (메인 서버 설정)

"""
LLM — RAG(with gpt-4o-mini)
"""
import os
import sys
from pathlib import Path

# .env 파일 자동 로드
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Path Setup ──
# llm 디렉토리를 sys.path에 추가하여 routers 패키지를 import 가능하게 함
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from routers import llm  # noqa: E402

# ── App Setup ──
app = FastAPI(title="MORA LLM Service", version="1.0")

# 모든 출처에서의 교차 출처 요청을 허용하는 CORS 미들웨어
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router ──
# LLM 관련 엔드포인트를 /api 경로 아래에 등록
app.include_router(llm.router, prefix="/api", tags=["LLM"])


@app.get("/")
def root():
    """서비스 상태 확인용 루트 엔드포인트."""
    return {"service": "MORA LLM Service", "version": "1.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("LLM_PORT", "8001")))
