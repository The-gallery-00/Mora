# routers/llm.py — LLM RAG 채팅 API 라우터
# 질문 + 문서타입 → 하이브리드 검색 → LLM 답변 생성 → 결과 반환
#
# [요청 body]
# {
#   "query": "삼성전자에서 만난 김씨",
#   "document_type": "BUSINESS_CARD",  // BUSINESS_CARD | TICKET | POSTER
#   "top_k": 5                         // 검색 결과 수 (기본값 5)
# }
#
# [응답 body]
# {
#   "success": true,
#   "data": {
#     "answer": "...",        // LLM 생성 답변
#     "sources": [...],       // 검색된 참고 문서 목록
#     "query": "..."          // 원본 질문
#   }
# }


"""LLM RAG router — POST /chat."""
import time
import uuid

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services import get_rag_pipeline

router = APIRouter()


class ChatRequest(BaseModel):
    """채팅 요청 body 스키마."""
    query: str
    document_type: str          # BUSINESS_CARD | TICKET | POSTER
    top_k: int = 5


def log_timing(request_id: str, event: str, started_at: float, previous_at: float | None = None):
    now = time.perf_counter()
    total = now - started_at
    if previous_at is None:
        print(f"[LLM:{request_id}] {event} total={total:.3f}s", flush=True)
    else:
        step = now - previous_at
        print(f"[LLM:{request_id}] {event} step={step:.3f}s total={total:.3f}s", flush=True)
    return now


@router.post("/chat")
async def chat(
    body: ChatRequest,
    authorization: str = Header(default=None),  # JWT 토큰 (백엔드 검색 API 호출에 전달)
):
    """자연어 질문을 받아 하이브리드 검색 + LLM 답변을 반환."""
    request_id = uuid.uuid4().hex[:8]
    started_at = time.perf_counter()
    last_at = log_timing(request_id, "request_start", started_at)

    try:
        pipeline = get_rag_pipeline()
        last_at = log_timing(request_id, "pipeline_ready", started_at, last_at)

        result = await pipeline.run(
            query=body.query,
            document_type=body.document_type,
            top_k=body.top_k,
            auth_header=authorization,
        )
        log_timing(request_id, "request_done", started_at, last_at)

        return JSONResponse(content={
            "success": True,
            "data": result,
        })

    except Exception as e:
        log_timing(request_id, f"request_failed error={e}", started_at, last_at)
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
