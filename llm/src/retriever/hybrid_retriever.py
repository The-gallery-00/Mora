# hybrid_retriever.py — 백엔드 하이브리드 검색 리트리버

import os

import httpx
from langsmith import traceable

# 백엔드 서버 주소 (환경변수로 주입, 기본값: localhost:8080)
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8080")

# 문서 타입 → 백엔드 검색 엔드포인트 매핑
SEARCH_ENDPOINTS = {
    "BUSINESS_CARD": "/api/cards/search",
    "TICKET":        "/api/tickets/search",
    "POSTER":        "/api/posters/search",
    "RECEIPT":       "/api/receipts/search",
}


class HybridRetriever:
    @traceable(name="Hybrid Retriever")
    async def retrieve(
        self,
        query: str,
        document_type: str,
        top_k: int = 5,
        auth_header: str | None = None,
    ) -> list[dict]:
        """
        백엔드 하이브리드 검색 API를 호출하여 관련 문서를 반환한다.

        Args:
            query:         검색 질문
            document_type: BUSINESS_CARD | TICKET | POSTER
            top_k:         반환할 최대 문서 수
            auth_header:   Authorization 헤더값 (Bearer <jwt>)

        Returns:
            검색된 문서 딕셔너리 목록. 검색 실패 시 빈 리스트.
        """
        endpoint = SEARCH_ENDPOINTS.get(document_type)
        if not endpoint:
            print(f"[LLM] 지원하지 않는 문서 타입: {document_type}", flush=True)
            return []

        url = f"{BACKEND_URL}{endpoint}"
        params = {"q": query, "topK": top_k}
        headers = {}
        if auth_header:
            headers["Authorization"] = auth_header

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()

            data = response.json()

            # 백엔드 응답 형식: { "success": true, "data": [...] }
            if not data.get("success"):
                print(f"[LLM] 검색 API 실패: {data}", flush=True)
                return []

            docs = data.get("data", [])
            print(f"[LLM] 검색 결과 {len(docs)}건 (type={document_type}, query={query!r})", flush=True)
            return docs

        except Exception as e:
            print(f"[LLM] 검색 API 호출 오류: {e}", flush=True)
            return []
