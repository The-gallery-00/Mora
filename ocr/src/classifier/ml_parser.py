# ═══════════════════════════════════════════════════════════════
# src/classifier/ml_parser.py — 학습된 트랜스포머 기반 필드 분류기
# ═══════════════════════════════════════════════════════════════
#
# [역할]
# 직접 파인튜닝한 한국어 트랜스포머(klue/bert-base, 31-라벨 단일 통합
# 시퀀스 분류기)를 서비스 파서로 노출한다. OCR 라인(블록) 한 줄을
# "그 문서종류의 내부필드 중 하나 또는 unknown" 으로 분류하며,
# 출력 shape 는 rule_based.classify_all_blocks_for_type 와 100% 동형이다.
#
# [핵심 계약]
# - classify_blocks_ml(text_blocks, document_type)
#     -> list[{text, confidence, bbox, block_index, field}]
#   rule 과 동일한 키/순서/길이(라인당 1개; TICKET 분리 시 1라인이 2항목
#   으로 늘 수 있음 — rule 도 동일). confidence 자리에는 OCR 원본
#   confidence 를 그대로 둔다(services 의 best-per-field 선택 호환).
#   모델 softmax 확률은 _ml_prob 키로만 부가.
#
# - get_field_extractor()
#     최초 호출 1회 lazy 로드. 실패 시 예외를 던지지 않고 None 반환.
#     모듈 import 만으로는 모델을 로드하지 않는다(서버 시작 지연 방지).
#
# [입력 포맷 — 학습과 100% 동일]
#   "[DOCTYPE={dt}] [CTX] {prev} [TGT] {cur} [CTX] {next}"
#   각 라인 텍스트는 strip(), 문맥 윈도우 ±1. special token 7개는
#   학습 산출 토크나이저에 이미 포함되어 있다(임베딩 resize 완료).
#
# [doctype 마스킹]
#   label_map.json 의 doctype_allowed_label_ids[document_type] 에 없는
#   라벨 logits 를 -inf 로 마스킹한 뒤 argmax. 타 doctype 라벨 유출 차단.
#   알 수 없는 document_type 은 ETC(=unknown 만 허용)로 폴백.
#
# [안전/제약]
# - paddle import 금지(이 모듈은 paddle 없이 import 가능해야 함).
# - 외부 네트워크/LLM 호출 금지: 전적으로 로컬 산출물만 로드.
# - 어떤 실패도 예외로 전파하지 않는다(서비스가 rule 로 폴백할 수 있게).
#
# ═══════════════════════════════════════════════════════════════

"""학습된 트랜스포머 필드 분류기 — lazy 싱글톤 + rule 동형 출력."""
from __future__ import annotations

import os
import threading

# rule 과 값 정제/티켓 복합분리 로직을 공유(피처/후처리 일관성).
from .rule_based import (
    extract_clean_value,
    _classify_and_split_ticket_blocks,
    segment_text_blocks,
)

# ── 경로: 이 파일(ocr/src/classifier/) 기준 ocr/models/field_extractor/ ──
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.environ.get(
    "OCR_FIELD_EXTRACTOR_DIR",
    os.path.normpath(os.path.join(_THIS_DIR, "..", "..", "models", "field_extractor")),
)

# 입력 포맷 / 마스킹 상수
_MAX_LENGTH = 128
_NEG = -1e9
UNKNOWN_LABEL = "unknown"

# 학습과 동일하게 라벨 정제에 사용할 "값 정제 필드" 집합
# (rule 의 classify_all_blocks_for_type 와 동일 정책)
_CLEAN_FIELDS = (
    "email", "website", "website_url",
    "mobile_phone", "office_phone", "fax_number",
    "contact_phone", "contact_email", "total_amount",
    "address",   # 선두 우편번호 분리 + 도로명주소 값 정제(ml-only 경로 일관성)
    "person_name", "transport_type",
    "departure_location", "departure_date", "departure_time",
    "arrival_location", "arrival_date", "arrival_time",
)


# ════════════════════════════════════════════
# Lazy 싱글톤 로더
# ════════════════════════════════════════════

class _FieldExtractor:
    """토크나이저 + 모델 + 라벨맵 + doctype 허용마스크를 묶은 추론 핸들."""

    def __init__(self, tokenizer, model, device, id2label, doctype_allow_ids):
        self.tokenizer = tokenizer
        self.model = model
        self.device = device
        self.id2label = id2label  # {int: str}
        self.num_labels = len(id2label)
        # doctype -> 허용 라벨 id set (마스킹용)
        self.doctype_allow_ids = doctype_allow_ids  # {str: set[int]}

    def allowed_ids(self, document_type: str) -> set:
        """document_type 의 허용 라벨 id 집합. 모르면 ETC(=unknown만)."""
        if document_type in self.doctype_allow_ids:
            return self.doctype_allow_ids[document_type]
        return self.doctype_allow_ids.get("ETC", {0})


# 싱글톤 상태 (None = 미로드, False = 로드 실패 확정, 객체 = 성공)
_extractor = None
_load_failed = False
_lock = threading.Lock()


def get_field_extractor():
    """
    학습된 필드 추출기를 최초 호출 1회 로드하고 재사용.
    실패 시(파일 없음/torch·transformers 미설치/로드 오류) None 반환.
    예외를 절대 던지지 않는다 → 서비스가 rule 로 폴백 가능.
    """
    global _extractor, _load_failed
    if _extractor is not None:
        return _extractor
    if _load_failed:
        return None

    with _lock:
        # 더블체크 (락 대기 중 다른 스레드가 로드 완료했을 수 있음)
        if _extractor is not None:
            return _extractor
        if _load_failed:
            return None
        try:
            _extractor = _load_extractor()
            return _extractor
        except Exception as e:  # noqa: BLE001 — 어떤 실패도 폴백으로 흡수
            _load_failed = True
            print(f"[ML] field_extractor load failed -> rule fallback: {e!r}", flush=True)
            return None


def _load_extractor() -> "_FieldExtractor":
    """실제 로드 로직 (실패 시 예외를 던지고, 호출자가 흡수)."""
    import json

    label_map_path = os.path.join(MODEL_DIR, "label_map.json")
    if not os.path.isdir(MODEL_DIR) or not os.path.isfile(label_map_path):
        raise FileNotFoundError(f"model dir or label_map.json missing: {MODEL_DIR}")

    # torch / transformers 는 여기서만 import (paddle 미사용, import 비용 지연)
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    with open(label_map_path, "r", encoding="utf-8") as f:
        lmeta = json.load(f)
    id2label = {int(k): v for k, v in lmeta["id2label"].items()}
    doctype_allow_ids = {
        dt: set(int(i) for i in ids)
        for dt, ids in lmeta["doctype_allowed_label_ids"].items()
    }

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR).to(device)
    model.eval()

    n_model = int(model.config.num_labels)
    if n_model != len(id2label):
        raise ValueError(
            f"label_map/model mismatch: model={n_model} labels, "
            f"label_map={len(id2label)} labels"
        )

    print(
        f"[ML] field_extractor loaded | dir={MODEL_DIR} | device={device} | "
        f"labels={len(id2label)} | vocab={len(tokenizer)}",
        flush=True,
    )
    return _FieldExtractor(tokenizer, model, device, id2label, doctype_allow_ids)


# ════════════════════════════════════════════
# 입력 빌더 (학습과 100% 동일 포맷)
# ════════════════════════════════════════════

def _build_input_text(prev: str, cur: str, nxt: str, document_type: str) -> str:
    """학습 시 build_dataset.doc_to_examples 와 글자 단위로 동일한 문자열."""
    return f"[DOCTYPE={document_type}] [CTX] {prev} [TGT] {cur} [CTX] {nxt}"


# ════════════════════════════════════════════
# 공개 추론 함수 — rule 동형 출력
# ════════════════════════════════════════════

def classify_blocks_ml(text_blocks: list[dict], document_type: str = "BUSINESS_CARD") -> list[dict]:
    """
    학습된 트랜스포머로 라인 배치 추론 → doctype 마스킹 argmax →
    내부필드 라벨 부여 → 값 정제 → rule 과 동형의 entry dict 리스트 반환.

    Returns:
        list[{text, confidence, bbox, block_index, field, _ml_prob?}]
        rule_based.classify_all_blocks_for_type 와 동일한 키/순서/길이.

    Raises:
        RuntimeError: 모델 로드 실패 시(get_field_extractor()가 None).
                      → 호출자(services)가 try/except 로 잡아 rule 폴백.
    """
    if not text_blocks:
        return []

    extractor = get_field_extractor()
    if extractor is None:
        # 명시적 신호: 호출자가 rule 폴백하도록 예외를 던진다.
        raise RuntimeError("field_extractor unavailable")

    # TICKET 은 복합필드(여정/날짜+시간) 분리가 필요한데 ML 라인분류로는
    # 불가하다. 라벨공간/후처리 일관성을 위해 rule 의 split 헬퍼를 재사용한다.
    # (정찰 계약: "TICKET 경로는 분리 후처리는 기존 split 헬퍼를 재사용")
    if document_type == "TICKET":
        return _classify_and_split_ticket_blocks(text_blocks)

    # 비-TICKET: 혼합 블록("강미경 010..")을 분할해 라인단위를 학습분포(클린)에
    # 맞춤. block_index 는 분할블록끼리 공유(rule 의 _split 관행과 동일).
    text_blocks = segment_text_blocks(text_blocks)

    import torch

    allowed = extractor.allowed_ids(document_type)
    tok = extractor.tokenizer
    model = extractor.model
    device = extractor.device
    id2label = extractor.id2label
    num_labels = extractor.num_labels

    # 라인 텍스트(strip)와 입력 문자열 구성 (문맥 ±1 = 인접 블록)
    lines = [(b.get("text") or "").strip() for b in text_blocks]
    n = len(lines)
    input_texts = []
    for i in range(n):
        prev = lines[i - 1] if i > 0 else ""
        cur = lines[i]
        nxt = lines[i + 1] if i < n - 1 else ""
        input_texts.append(_build_input_text(prev, cur, nxt, document_type))

    # 허용 라벨 마스크 (불허 라벨 logits -> -inf)
    block_mask = torch.full((num_labels,), _NEG, dtype=torch.float32, device=device)
    for lid in allowed:
        if 0 <= lid < num_labels:
            block_mask[lid] = 0.0

    pred_ids: list[int] = []
    pred_probs: list[float] = []
    batch_size = 64
    with torch.no_grad():
        for start in range(0, n, batch_size):
            batch_texts = input_texts[start:start + batch_size]
            enc = tok(
                batch_texts,
                truncation=True,
                max_length=_MAX_LENGTH,
                padding=True,
                return_tensors="pt",
            ).to(device)
            logits = model(**enc).logits.float()  # (B, num_labels)
            masked = logits + block_mask  # 불허 라벨 -inf
            probs = torch.softmax(masked, dim=-1)
            top_p, top_i = probs.max(dim=-1)
            pred_ids.extend(top_i.detach().cpu().tolist())
            pred_probs.extend(top_p.detach().cpu().tolist())

    # rule 동형 entry 구성
    results = []
    for b, lid, prob in zip(text_blocks, pred_ids, pred_probs):
        field = id2label.get(int(lid), UNKNOWN_LABEL)
        raw_text = (b.get("text") or "").strip()
        # 값 정제: 전화/이메일/URL/금액/이름/티켓필드는 rule 과 동일 정제
        clean_text = extract_clean_value(raw_text, field) if field in _CLEAN_FIELDS else raw_text
        results.append({
            "text": clean_text,
            "confidence": b.get("confidence", 0.0),  # OCR 원본 confidence 유지
            "bbox": b.get("bbox"),
            "block_index": b["block_index"],
            "field": field,
            "_ml_prob": round(float(prob), 4),  # 모델 확률은 부가키로만
        })

    return results
