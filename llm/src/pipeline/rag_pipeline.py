# rag_pipeline.py — RAG 엔드투엔드 파이프라인

from langsmith import traceable
from src.retriever.hybrid_retriever import HybridRetriever
from src.llm.openai_client import OpenAIClient

# 검색 결과가 없을 때 반환할 기본 메시지
NO_RESULT_MESSAGE = "관련된 데이터를 찾을 수 없어 답변하기 어렵습니다. 다른 키워드로 검색해 보세요."


class RagPipeline:
    def __init__(self):
        # 하이브리드 검색 리트리버와 OpenAI 클라이언트 초기화
        self.retriever = HybridRetriever()
        self.llm = OpenAIClient()

    @traceable(name="RAG Pipeline")
    async def run(
        self,
        query: str,
        document_type: str,
        top_k: int = 5,
        auth_header: str | None = None,
    ) -> dict:
        """
        RAG 파이프라인 실행: 검색 → LLM 답변 생성.

        Args:
            query:         사용자 자연어 질문
            document_type: BUSINESS_CARD | TICKET | POSTER
            top_k:         검색 결과 수
            auth_header:   백엔드 API 인증 헤더

        Returns:
            {
                "answer":  "...",   # LLM 생성 답변
                "sources": [...],   # 검색된 참고 문서 목록
                "query":   "..."    # 원본 질문
            }
        """
        # Step 1: 백엔드 하이브리드 검색
        print(f"[RAG] retrieve_start query={query!r} type={document_type}", flush=True)
        docs = await self.retriever.retrieve(
            query=query,
            document_type=document_type,
            top_k=top_k,
            auth_header=auth_header,
        )
        print(f"[RAG] retrieve_done docs={len(docs)}", flush=True)

        # Step 2: 검색 결과 없을 때 조기 반환
        if not docs:
            return {
                "answer": NO_RESULT_MESSAGE,
                "sources": [],
                "query": query,
            }

        # Step 3: gpt-4o-mini로 컨텍스트 기반 답변 생성
        print("[RAG] llm_generate_start", flush=True)
        answer = self.llm.generate(
            query=query,
            context_docs=docs,
            document_type=document_type,
        )
        print("[RAG] llm_generate_done", flush=True)

        return {
            "answer": answer,
            "sources": docs,
            "query": query,
        }
