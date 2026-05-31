# services.py — 공유 서비스 (싱글톤 RAG 파이프라인)

# [역할]
# RAG 파이프라인을 싱글톤으로 생성하여 앱 전체에서 공유한다.
# OpenAI 클라이언트는 초기화 비용이 낮지만, 하이브리드 리트리버와
# 함께 묶어 한 번만 생성하고 재사용한다.
#
# [코드 흐름]
# 1) RagPipeline을 import한다
# 2) rag_pipeline 싱글톤 인스턴스를 생성한다
# 3) get_rag_pipeline()으로 외부에서 접근한다
#
# [메서드]
# - get_rag_pipeline(): RAG 파이프라인 싱글톤 인스턴스를 반환

import time

from src.pipeline.rag_pipeline import RagPipeline

# ── Lazy 싱글톤 인스턴스 ──
_rag_pipeline = None


def get_rag_pipeline() -> RagPipeline:
    """RAG 파이프라인을 최초 요청 때 1회만 생성하고 재사용."""
    global _rag_pipeline
    if _rag_pipeline is None:
        start = time.perf_counter()
        print("[LLM] pipeline_load_start", flush=True)
        _rag_pipeline = RagPipeline()
        elapsed = time.perf_counter() - start
        print(f"[LLM] pipeline_load_done elapsed={elapsed:.3f}s", flush=True)
    return _rag_pipeline
