# ═══════════════════════════════════════════════════════════════
# services.py — 공유 서비스 (싱글톤 OCR 파이프라인 + 파싱 스킬)
# ═══════════════════════════════════════════════════════════════
#
# [역할]
# OCR 파이프라인과 파싱 스킬을 싱글톤으로 생성하여 앱 전체에서
# 공유한다. PaddleOCR 엔진은 초기화 비용이 높으므로 한 번만
# 생성하고 재사용하는 것이 핵심이다.
# ParsingSkill 클래스는 OCR로 추출된 텍스트 블록을 규칙 기반
# 분류기로 명함 필드(이름, 회사, 직책, 전화 등)에 매핑하고,
# 가장 confidence가 높은 블록을 최종 결과로 선택한다.
#
# [코드 흐름]
# 1) PaddlePaddle 관련 환경변수를 설정한다 (OneDNN, PIR 비활성화)
# 2) BusinessCardPipeline과 classify_all_blocks를 import한다
# 3) ParsingSkill 클래스를 정의한다:
#    a) execute()에서 텍스트 블록을 classify_all_blocks()로 분류
#    b) 같은 필드가 여러 개면 confidence가 높은 것을 선택
#    c) 내부 필드명(person_name 등)을 외부 필드명(name 등)으로 변환
# 4) pipeline과 parsing_skill을 싱글톤으로 생성한다
#
# [메서드 목록]
# - ParsingSkill.execute(text_blocks):
#     텍스트 블록 리스트를 받아 분류하고, 필드별 최고 confidence
#     블록을 선택하여 {classified_blocks, parsed} 딕셔너리를 반환
#
# [사용된 라이브러리]
# ───────────────────────────────────────────
# os.environ[key] = value
#   PaddlePaddle 내부 플래그를 비활성화하는 환경변수 설정.
#   FLAGS_use_mkldnn="0": OneDNN(MKL-DNN) 가속 비활성화 (버그 우회)
#   FLAGS_enable_pir_api="0": PIR(Program IR) API 비활성화
#   FLAGS_enable_pir_in_executor="0": Executor에서 PIR 비활성화
# ───────────────────────────────────────────
# src.pipeline.extract_pipeline.BusinessCardPipeline
#   이미지 → OCR → 필드 분류 → 구조화된 결과를 생성하는 파이프라인.
#   lang="korean"으로 한국어 명함 인식에 최적화됨.
# ───────────────────────────────────────────
# src.classifier.rule_based.classify_all_blocks(text_blocks)
#   텍스트 블록 리스트를 정규식/휴리스틱으로 분류하여
#   각 블록에 field(email, phone_number 등)를 부여한다.
# ───────────────────────────────────────────
#
# ═══════════════════════════════════════════════════════════════

"""공유 서비스 — lazy OCR 파이프라인 + 파싱 스킬."""
import os
import re
import time

# PaddlePaddle 내부 플래그 비활성화 (import 전에 설정해야 적용됨)
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_enable_pir_in_executor"] = "0"
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

from src.pipeline.extract_pipeline import BusinessCardPipeline
from src.classifier.rule_based import (
    classify_all_blocks,
    classify_all_blocks_for_type,
    extract_clean_value,
    EMAIL_PATTERN,
    WEBSITE_PATTERN,
    LINK_PATTERN,
    MOBILE_PATTERN,
    LANDLINE_PATTERN,
    DATE_PATTERN,
    TIME_PATTERN,
)
from src.classifier.field_schema import DOCUMENT_FIELDS

# "unknown" 라벨의 블록은 최종 결과에서 제외됨
UNKNOWN_LABEL = "unknown"

# ── 파서 전략 게이트 ──
# OCR_PARSER_STRATEGY in {rule(기본), ml, hybrid}
#   rule   : 기존 규칙기반 분류기만 사용 (현행 동작 보존).
#   ml     : 학습된 트랜스포머(ml_parser)를 사용. 모델 없음/로드·추론 실패
#            시 즉시 규칙기반으로 폴백한다.
#   hybrid : ml 라벨을 기본으로 하되, 정규식이 신뢰높은 필드(전화/이메일/
#            URL/금액 등)는 규칙으로 검증·보정·오버라이드한다. 실패 시 rule 폴백.
# 어떤 경우에도 {classified_blocks, parsed} 반환 계약과 best-per-field +
# DOCUMENT_FIELDS 매핑 로직은 불변이다. /scan 은 절대 500 을 내지 않는다.
_VALID_STRATEGIES = ("rule", "ml", "hybrid")

# hybrid 에서 "정규식이 확정적"인 필드 → 규칙(extract_clean_value/패턴)으로
# 값 검증/보정하고, 규칙이 해당 라벨로 확정 매칭되면 라벨도 오버라이드한다.
_REGEX_TRUSTED_FIELDS = frozenset({
    "email", "website", "website_url", "contact_email",
    "mobile_phone", "office_phone", "fax_number", "contact_phone",
    "total_amount", "zip_code", "address",
})

# ML 이 'unknown' 으로 기권한 블록에 한해, 규칙이 키워드로 확신하는 의미필드
# (회사/부서/직책)를 보충한다. ML 의 '확정' 라벨은 건드리지 않음(unknown 한정)
# → 대학·기관 명함처럼 학습분포 밖(OOD)에서 ML 이 비는 칸을 규칙이 메움.
_SEMANTIC_RULE_FALLBACK = frozenset({"company_name", "department", "job_title"})

# 한 값이 OCR에서 여러 줄로 쪼개질 수 있는 "텍스트형" 필드.
# (예: "국토교통부 창조센터"가 국토/교통부/창조센터 3블록으로 분리)
# 이 필드들은 같은 필드 블록을 reading order(block_index)로 합쳐 한 값으로 만든다.
# 전화/이메일/URL/날짜/시간/금액/우편번호/역명 등 "원자" 필드는 여기 없으며
# 최고 confidence 한 줄만 사용한다(합치면 값이 깨지므로).
_JOIN_FIELDS = frozenset({
    # 명함
    "company_name", "department", "job_title", "address",
    # 포스터
    "title", "organizer_name", "location",
    # 영수증
    "store_name",
})


def _get_strategy() -> str:
    strategy = os.environ.get("OCR_PARSER_STRATEGY", "rule").strip().lower()
    return strategy if strategy in _VALID_STRATEGIES else "rule"


# ── 포스터 제목 bbox 휴리스틱 ──
# 텍스트-only ML 은 폰트크기/위치를 못 본다(title F1=0.70 최약). 포스터 제목은
# 시각적으로 "제일 큰 + 맨 위 글자"라는 강한 레이아웃 신호를 가지므로, bbox
# (폰트크기 proxy=글자높이, 상단=min(y))로 제목 블록을 골라 ML 을 보강/오버라이드한다.
#
# ⚠️회귀안전 계약: bbox 가 없거나(None/[]) 유효한 후보가 없으면 None 을 반환해
# no-op 한다. 비-OCR 경로(eval/합성)는 bbox=None 이라 휴리스틱이 그냥 꺼지고
# 기존 ML 결과가 100% 유지된다(절대 안 깨짐).

# 제목 후보에서 제외할 atomic(명확한 패턴) 필드 — 전화/이메일/URL/날짜.
# 폰트가 크고 위에 있어도 이런 패턴이면 제목이 아니다(연락처/일시 헤더 오인 방지).
_ATOMIC_TITLE_EXCLUDE = (
    EMAIL_PATTERN, WEBSITE_PATTERN, LINK_PATTERN,
    MOBILE_PATTERN, LANDLINE_PATTERN, DATE_PATTERN, TIME_PATTERN,
)
# atomic '제외' 임계: 패턴 매치 span 이 텍스트의 이 비율 이상일 때만 제외.
# ('2026.03 신년 행사'처럼 날짜토큰 부수포함 제목이 DATE 부분매치로 통째 배제되는 것 방지)
_ATOMIC_DOMINANCE = 0.8
_TITLE_BIG_RATIO = 0.80   # 최대 글자높이의 80% 이상이면 '큰 글자' 동률군


def _bbox_ys(bbox) -> list[float] | None:
    """폴리곤 bbox([[x,y],...])에서 y 좌표들을 뽑는다. 형식 이상이면 None.

    PaddleOCR rec_polys = 4점 폴리곤. 비-OCR 경로는 None/[] → None 반환(no-op).
    """
    if not bbox:
        return None
    ys = []
    for pt in bbox:
        # 각 점은 [x, y] (혹은 (x, y)). 길이<2 거나 숫자 아니면 무효 처리.
        try:
            ys.append(float(pt[1]))
        except (TypeError, IndexError, ValueError):
            return None
    return ys or None


def _is_atomic_field_block(text: str) -> bool:
    """블록 '대부분'이 atomic 패턴(전화/이메일/URL/날짜)이면 True → 제목후보 제외.

    매치 span 이 텍스트 길이의 _ATOMIC_DOMINANCE 이상일 때만 atomic 으로 본다.
    제목에 부수적으로 섞인 날짜/도메인 토큰만으로는 제외하지 않는다.
    """
    t = (text or "").strip()
    if not t:
        return True   # 빈 텍스트는 제목 후보 아님
    if DATE_PATTERN.search(t) and TIME_PATTERN.search(t):
        return True   # 날짜+시간 동시 = 일정 라인(제목 아님)
    for pat in _ATOMIC_TITLE_EXCLUDE:
        m = pat.search(t)
        if m and (m.end() - m.start()) >= _ATOMIC_DOMINANCE * len(t):
            return True
    return False


def _pick_poster_title(blocks: list[dict]) -> int | None:
    """포스터 제목 블록의 인덱스(blocks 리스트상 위치)를 bbox 휴리스틱으로 고른다.

    선정 기준: "제일 큰 폰트(글자높이=max(y)-min(y)) + 상단(min(y) 작을수록 위)".
      - 1순위: 글자높이 내림차순(큰 폰트 우선).
      - 동률(근소차) 보정: 글자높이가 최대치의 일정 비율 이상인 후보들 중
        가장 위(min(y) 최소)에 있는 블록을 택한다 → "크고 위"를 함께 만족.
    제외: atomic 필드(전화/이메일/URL/날짜=명확한 패턴) 블록은 제목 후보 아님.

    Args:
        blocks: [{text, bbox, ...}] 리스트. bbox=폴리곤 또는 None/[].

    Returns:
        제목으로 고른 블록의 blocks 내 위치 인덱스(int). bbox 가 하나도 없거나
        (비-OCR 경로) 유효 후보가 없으면 None(no-op → 기존 분류 유지).
    """
    if not blocks:
        return None
    # 세그먼트 감지: 같은 block_index 가 2회 이상 → 분할되어 bbox 공유 → 후보 제외
    # (segment_text_blocks 가 원본 폴리곤을 복사 → 폰트크기 proxy 무력).
    idx_counts: dict = {}
    for b in blocks:
        bi = b.get("block_index")
        if bi is not None:
            idx_counts[bi] = idx_counts.get(bi, 0) + 1

    # (위치 i, 글자높이 h, 상단 top) 후보 수집. 세그먼트/bbox없음/atomic 이면 스킵.
    candidates: list[tuple[int, float, float]] = []
    for i, b in enumerate(blocks):
        bi = b.get("block_index")
        if bi is not None and idx_counts.get(bi, 0) > 1:
            continue   # 세그먼트(bbox 공유) → 폰트크기 신호 무효 → 스킵
        ys = _bbox_ys(b.get("bbox"))
        if ys is None:
            continue
        if _is_atomic_field_block(b.get("text", "")):
            continue
        height = max(ys) - min(ys)
        if height <= 0:
            continue   # 퇴화 폴리곤(높이 0) 제외
        candidates.append((i, height, min(ys)))

    if not candidates:
        return None   # bbox 전무(비-OCR) 또는 후보 전멸 → no-op

    # 1) 제일 큰 폰트. 2) 큰 폰트끼리(최대높이의 _TITLE_BIG_RATIO 이상) 동률이면 더 위(top↑).
    max_h = max(c[1] for c in candidates)
    big = [c for c in candidates if c[1] >= max_h * _TITLE_BIG_RATIO]
    best = min(big, key=lambda c: (c[2], -c[1], c[0]))
    return best[0]


_NONTITLE_FIELDS = {"organizer_name", "location", "event_start_date", "event_end_date",
                    "contact_phone", "contact_email", "website_url"}

# 포스터 섹션헤더/자격·안내 문구(제목 밴드 회수 시 제외 — 제목 아님).
_TITLE_SECTION = re.compile(
    r"참가\s*자격|참가\s*대상|응모\s*자격|지원\s*자격|공모\s*주제|공모\s*분야|공모\s*부문|"
    r"공모\s*개요|공모\s*기간|시상\s*내역|시상\s*내용|시상\s*규모|구\s*분|문\s*의|"
    r"접수\s*기간|접수\s*방법|신청\s*방법|제출\s*서류|심사\s*기준|모집\s*기간|"
    r"규\s*격|분\s*량|작품\s*요강|유의\s*사항|주의\s*사항|관심\s*있|누구나|국민\s*누구")

# 기관/단체/기업 이름 접미사 패턴(하드코딩 리스트 아님 — '고흥군 운동대회' 같은 제목은 안 걸림,
# 단독 기관명 블록만 매치). 주최/주관 추출 강화에 사용.
_ORG_SUFFIX = re.compile(
    r"대학교|대학|재단|협회|학회|진흥회|진흥원|연구원|연구소|공사|위원회|중앙회|연합회|"
    r"문화원|문화재단|사업단|장학회|봉사단|복지관|그룹|방송|은행|\(주\)|㈜|주식회사|"
    r"[가-힣]{2,5}(?:군|시|구|도)\b|교육청|시청|군청|도청|구청|YMCA|YWCA|EBS|KBS|MBC|SBS")
# 기관전용 접미사(주소와 모호한 bare 시/군/구/도 제외) — fallback(cue 없는) 경로용.
_ORG_SUFFIX_STRICT = re.compile(
    r"대학교|대학|재단|협회|학회|진흥회|진흥원|연구원|연구소|공사|위원회|중앙회|연합회|"
    r"문화원|문화재단|사업단|장학회|봉사단|복지관|그룹|방송|은행|\(주\)|㈜|주식회사|"
    r"교육청|시청|군청|도청|구청|YMCA|YWCA|EBS|KBS|MBC|SBS")
# '주최/주관' 단독 라벨 블록(값은 다음 블록) — 후원/협찬은 제외(주최·주관만 organizer).
_ORG_LABEL_ONLY = re.compile(r"^\s*(주\s*최|주\s*관|주최\s*[·/]\s*주관|주최\s*및\s*주관)\s*[|｜:：·\-]*\s*$")
# 본문 라인 지표(신청안내/조건 등) → organizer 후보 제외(fallback 경로용)
_ORG_BODY = re.compile(
    r"신청|모집|문의|접수|마감|일정|대상|자격|제출|시상|심사|선발|참가|기간|상금|"
    r"http|@|\d{3,}|만원|공모|주제|분야|내용|혜택")


def _pick_anchor(cand):
    """제목 anchor(기준 블록) 선택. 기본은 '가장 큰 글자'지만, 모델 title 확률이
    있으면 title 같지 않은 큰 블록(주최기관명 등)을 anchor 로 잘못 잡지 않도록
    title-prob 가 어느정도(≥0.1) 있는 후보 중 가장 큰 것을 고른다.
    확률정보 없으면(synth/eval) 최대높이 = 기존 동작(회귀안전)."""
    if any(c[4] is not None for c in cand):
        titley = [c for c in cand if (c[4] or 0.0) >= 0.1]
        if titley:
            return max(titley, key=lambda c: c[1])
    return max(cand, key=lambda c: c[1])


def _is_clear_nontitle(block: dict) -> bool:
    """모델이 제목 아닌 특정 필드(주최/날짜/장소/연락처/URL)로 분류한 블록.
    제목밴드(같은 폰트 행)에 섞여도 제외 → 하드코딩 없이 의미적 선별.
    title/unknown 은 유지(멀티블록 제목·스타일조각 보존)."""
    return block.get("field") in _NONTITLE_FIELDS


def _pick_poster_title_band(blocks: list[dict]) -> list[int]:
    """포스터 제목 '밴드'를 bbox 로 묶어 인덱스 목록 반환(멀티블록 제목).

    실세계 포스터 제목은 큰 글자가 여러 OCR 블록으로 쪼개진다
    ('데이터분석'/'준전문가 ADsP'/'활용 과정 모집'). 단일 블록 픽으론 부족 →
    제일 큰 글자(anchor) + 같은 상단 밴드(세로 근접 ≤2*anchor높이) + 충분히 큰 글자
    (≥0.6*anchor)들을 모두 제목으로 묶는다. 섹션헤더(교육내용 등)는 세로로 멀어 제외.

    제외: atomic(전화/이메일/URL/날짜), 세그먼트(bbox 공유), bbox 없음/퇴화.
    Returns: 제목 블록 인덱스 목록(reading order). bbox 전무 → [](no-op, 회귀안전).
    """
    if not blocks:
        return []
    idx_counts: dict = {}
    for b in blocks:
        bi = b.get("block_index")
        if bi is not None:
            idx_counts[bi] = idx_counts.get(bi, 0) + 1

    cand = []  # (i, height, cy, cx, title_prob)
    for i, b in enumerate(blocks):
        bi = b.get("block_index")
        if bi is not None and idx_counts.get(bi, 0) > 1:
            continue
        ys = _bbox_ys(b.get("bbox"))
        if ys is None:
            continue
        txt = b.get("text", "")
        if _is_atomic_field_block(txt):       # 전화/이메일/URL/날짜/시간 dominant 제외
            continue
        if re.match(r"^\s*(위치|장소|venue|오시는\s*길)\s*[:：]", txt):
            continue                          # 위치/장소 라벨 블록은 제목 아님
        h = max(ys) - min(ys)
        if h <= 0:
            continue
        xs = [p[0] for p in b["bbox"]]
        cand.append((i, h, sum(ys) / len(ys), sum(xs) / len(xs), b.get("_title_prob")))
    if not cand:
        return []

    _, ah, acy, _, _ = max(cand, key=lambda c: c[1])
    band = [c for c in cand if c[1] >= 0.6 * ah and abs(c[2] - acy) <= 2.0 * ah]
    # 세로 인접한 '브랜드/제목 윗줄'(예: '아이즈모바일' 위 → '영상 공모전') 회수:
    # 밴드에 세로로 붙어있고(±1.2*anchor) 충분히 큰(≥0.33*anchor) 블록을 추가.
    # 단 섹션헤더(참가자격/공모주제/시상내역 등)·작은 자격문구는 제외(=한 뭉탱이로 묶기).
    if band:
        _bcy = [c[2] for c in band]
        _top, _bot = min(_bcy), max(_bcy)
        _bset = set(id(c) for c in band)
        _ext = [c for c in cand if id(c) not in _bset
                and c[1] >= 0.33 * ah
                and (_top - 1.2 * ah) <= c[2] <= (_bot + 1.2 * ah)
                and not _TITLE_SECTION.search(blocks[c[0]].get("text", ""))
                and not DATE_PATTERN.search(blocks[c[0]].get("text", ""))
                and not re.search(r"\d{2,}|만\s*원|@|http", blocks[c[0]].get("text", ""))]
        band = band + _ext
    # 한글 우선: 밴드에 한글 블록이 있으면 영어전용(슬로건/로고/태그라인) 블록 제외.
    # 한국 행사 포스터 제목은 한글(영문 약어는 한글 블록에 섞여 있어 보존됨).
    kor = [c for c in band if re.search(r"[가-힣]", blocks[c[0]].get("text", ""))]
    if kor:
        band = kor
    band.sort(key=lambda c: (c[2], c[3]))   # reading order(위→아래, 왼→오른)
    return [c[0] for c in band]


class ParsingSkill:
    """OCR 텍스트 블록을 문서종류별 필드로 분류/파싱.

    전략(OCR_PARSER_STRATEGY)에 따라 규칙기반/ML/하이브리드 분류기를 선택하며,
    ML 경로 실패 시 항상 규칙기반으로 폴백한다.
    """

    def execute(self, text_blocks: list[dict], document_type: str = "BUSINESS_CARD") -> dict:
        if not text_blocks:
            return {"classified_blocks": [], "parsed": {}}

        classified = self._classify(text_blocks, document_type)
        field_map = DOCUMENT_FIELDS.get(document_type, {})
        parsed = self._aggregate(classified, field_map)

        return {"classified_blocks": classified, "parsed": parsed}

    # ── 필드별 값 집계 (멀티라인 합치기 + 원자필드 최고conf) ──
    @staticmethod
    def _aggregate(classified: list[dict], field_map: dict) -> dict:
        """분류된 블록을 필드별로 묶어 최종 값(parsed)을 만든다.

        - _JOIN_FIELDS(회사/부서/주소/제목 등 여러 줄로 쪼개지는 값): 같은 필드
          블록을 block_index(reading order)로 정렬해 공백으로 합친다. 동일 텍스트
          중복은 제거. 예) 국토 + 교통부 + 창조센터 → "국토 교통부 창조센터".
        - 그 외(전화/이메일/URL/날짜/금액/우편번호/역명 등 원자 필드): 최고
          confidence 블록 한 줄만 사용(합치면 값이 깨짐).
        """
        from collections import defaultdict

        groups = defaultdict(list)
        for block in classified:
            field = block["field"]
            if field == UNKNOWN_LABEL:
                continue
            groups[field].append(block)

        parsed = {}
        for field, blocks in groups.items():
            if field in _JOIN_FIELDS and len(blocks) > 1:
                ordered = sorted(blocks, key=lambda b: b.get("block_index", 0))
                parts = []
                for b in ordered:
                    t = (b.get("text") or "").strip()
                    if t and (not parts or parts[-1] != t):  # 인접 중복 제거
                        parts.append(t)
                value = " ".join(parts)
            else:
                best = max(blocks, key=lambda b: b.get("confidence", 0.0))
                value = best["text"]
            # 최종 값 정제(전 전략 공통): 라벨/괄호/노이즈 제거. 전화/이메일/금액/날짜/장소.
            # 정제 결과가 빈값(유효한 값 없음=라벨만/비전화 숫자 등)이면 필드를 누락한다.
            # 상용 기준: 빈 칸이 'tel.', 라벨, 계좌번호 같은 garbage 보다 사람이 쓰기 적합.
            value = (extract_clean_value(value, field) or "").strip()
            if not value:
                continue
            parsed[field_map.get(field, field)] = value
        return parsed

    # ── 전략 디스패치 + 폴백 ──
    def _classify(self, text_blocks: list[dict], document_type: str) -> list[dict]:
        strategy = _get_strategy()
        if strategy == "rule":
            return classify_all_blocks_for_type(text_blocks, document_type)

        # ml / hybrid: ml_parser 를 lazy import (상단 강제 import 금지).
        try:
            from src.classifier.ml_parser import classify_blocks_ml
            classified = classify_blocks_ml(text_blocks, document_type)
        except Exception as e:  # noqa: BLE001 — 모델없음/로드·추론 실패 모두 흡수
            print(f"[PARSER] strategy={strategy} ml failed -> rule fallback: {e!r}", flush=True)
            return classify_all_blocks_for_type(text_blocks, document_type)

        if strategy == "hybrid":
            try:
                classified = self._apply_hybrid_corrections(
                    classified, text_blocks, document_type
                )
            except Exception as e:  # noqa: BLE001 — 보정 실패해도 ml 결과는 살린다
                print(f"[PARSER] hybrid correction skipped: {e!r}", flush=True)

        return classified

    # ── hybrid: 정규식 신뢰필드 검증/보정 + 빈필드 규칙보충 ──
    def _apply_hybrid_corrections(
        self, ml_classified: list[dict], text_blocks: list[dict], document_type: str
    ) -> list[dict]:
        """
        1) 정규식 신뢰필드(전화/이메일/URL/금액/우편번호)는 규칙이 확정적으로
           매칭되는 라인이면 rule 라벨로 오버라이드하고 값도 규칙으로 정제.
        2) ml 이 분류한 신뢰필드 라인의 값도 규칙 정제로 한 번 더 정돈.
        3) ml 이 어떤 신뢰필드도 못 찾았는데 규칙은 찾은 경우(빈필드 보충),
           규칙 라벨/값으로 채운다.
        TICKET 복합분리는 ml_parser 가 이미 rule split 헬퍼를 재사용하므로 패스.
        """
        if document_type == "TICKET":
            return ml_classified

        allowed_internal = set(DOCUMENT_FIELDS.get(document_type, {}).keys())
        rule_classified = classify_all_blocks_for_type(text_blocks, document_type)
        # block_index -> 규칙 결과(라인당 대표 1개). 같은 인덱스 복수면 첫번째 유지.
        rule_by_idx = {}
        for r in rule_classified:
            rule_by_idx.setdefault(r["block_index"], r)

        ml_fields_present = {e["field"] for e in ml_classified}

        for entry in ml_classified:
            rule_entry = rule_by_idx.get(entry["block_index"])
            if rule_entry is None:
                continue
            rule_field = rule_entry["field"]
            # 규칙이 신뢰필드로 확정 매칭한 라인 → 라벨/값을 규칙으로 오버라이드
            if (
                rule_field in _REGEX_TRUSTED_FIELDS
                and rule_field in allowed_internal
                and entry["field"] != rule_field
            ):
                entry["field"] = rule_field
                entry["text"] = rule_entry["text"]
                continue
            # ML 이 unknown 으로 기권 + 규칙이 키워드로 의미필드 확신 → 규칙 채택
            # (대학명함 등 OOD 보완. ML 확정라벨은 위 분기서 이미 처리, 여기는 unknown 만)
            if (
                entry["field"] == "unknown"
                and rule_field in _SEMANTIC_RULE_FALLBACK
                and rule_field in allowed_internal
            ):
                entry["field"] = rule_field
                entry["text"] = rule_entry["text"]
                continue
            # ml 과 규칙 라벨이 같고 신뢰필드면 값만 규칙 정제로 재확정
            if entry["field"] == rule_field and entry["field"] in _REGEX_TRUSTED_FIELDS:
                entry["text"] = extract_clean_value(rule_entry["text"], entry["field"])

        # 빈필드 보충: ml 이 놓친 신뢰필드를 규칙이 찾았으면 추가
        for r in rule_classified:
            rf = r["field"]
            if (
                rf in _REGEX_TRUSTED_FIELDS
                and rf in allowed_internal
                and rf not in ml_fields_present
            ):
                ml_classified.append({
                    "text": r["text"],
                    "confidence": r.get("confidence", 0.0),
                    "bbox": r.get("bbox"),
                    "block_index": r["block_index"],
                    "field": rf,
                })
                ml_fields_present.add(rf)

        # ── POSTER 제목 bbox 밴드 그룹핑 ──
        # 큰 제목이 여러 OCR 블록으로 쪼개지므로(데이터분석/준전문가 ADsP/활용...),
        # bbox 로 상단 큰글자 밴드를 묶어 전부 title 로 만든다(_aggregate 가 reading
        # order 로 합쳐 완전한 제목). 밴드 밖의 ML title 오인(슬로건/본문조각)은 강등.
        # bbox 없으면(eval/합성) 밴드=[] → no-op, 기존 ML title 유지(회귀안전).
        if document_type == "POSTER" and os.environ.get("POSTER_TITLE_BBOX", "1") == "1":
            band = _pick_poster_title_band(ml_classified)
            if band:
                band_set = set(band)
                for j, e in enumerate(ml_classified):
                    if j in band_set:
                        e["field"] = "title"
                    elif e.get("field") == "title":
                        e["field"] = "unknown"   # 밴드 밖 title 오인 → 강등

            # ML 이 놓친 행사 날짜 보충: unknown 블록의 날짜패턴 → event_start/end.
            # 접수/마감 기간은 행사일 아님(제외). 날짜 2개(범위)면 종료일도 추가.
            present = {e.get("field") for e in ml_classified}
            if "event_start_date" not in present:
                for e in ml_classified:
                    if e.get("field") != "unknown":
                        continue
                    txt = e.get("text", "")
                    if re.search(r"접수|마감|신청\s*기간", txt):
                        continue
                    dm = [m.group() for m in DATE_PATTERN.finditer(txt)]
                    if not dm:
                        continue
                    e["field"] = "event_start_date"
                    if len(dm) >= 2 and "event_end_date" not in present:
                        end = dict(e)
                        end["field"] = "event_end_date"
                        ml_classified.append(end)
                    break

            # 종료일 보충(start 유무 무관): 범위표기(A~B, 날짜 2개)면 두번째 날짜를 종료일로.
            # 모델이 start 만 라벨하고 끝나는 케이스(접수 2026.07.01~07.20)에서 end 누락 방지.
            # _clean_event_date(role=end) 가 범위서 종료일 추출(연도 상속) → 같은 블록 복제만.
            if "event_end_date" not in {e.get("field") for e in ml_classified}:
                for e in list(ml_classified):
                    if e.get("field") not in ("event_start_date", "unknown"):
                        continue
                    dm = [m.group() for m in DATE_PATTERN.finditer(e.get("text", ""))]
                    if len(dm) >= 2:
                        end = dict(e)
                        end["field"] = "event_end_date"
                        ml_classified.append(end)
                        break
            # 시작일 보충(end 만 있는 경우): 모델이 범위를 event_end 로 라벨 → 첫 날짜를 start 로.
            if "event_start_date" not in {e.get("field") for e in ml_classified}:
                for e in list(ml_classified):
                    if e.get("field") not in ("event_end_date", "unknown"):
                        continue
                    dm = [m.group() for m in DATE_PATTERN.finditer(e.get("text", ""))]
                    if len(dm) >= 2:
                        st = dict(e)
                        st["field"] = "event_start_date"
                        ml_classified.append(st)
                        break
            # 분절 날짜 재조합: 연도("2026.")와 'M.D~M.D' 범위가 따로 OCR된 경우.
            # start 가 월·일 없이(연도만) 잡혔으면 → 연도 + 범위블록 재구성으로 start/end 확정.
            def _has_md(t):
                return bool(re.search(r"(?<!\d)\d{1,2}\s*[.\-/월]\s*\d{1,2}", t))
            _start_ok = any(e.get("field") == "event_start_date" and _has_md(e.get("text", ""))
                            for e in ml_classified)
            if not _start_ok:
                _ym = next((re.search(r"20\d{2}", e.get("text", "")) for e in ml_classified
                            if re.search(r"20\d{2}", e.get("text", ""))), None)
                _yr = _ym.group() if _ym else None
                if _yr:
                    for e in ml_classified:
                        mds = re.findall(r"(?<!\d)(\d{1,2})\s*[.\-/월]\s*(\d{1,2})", e.get("text", ""))
                        mds = [(int(a), int(b)) for a, b in mds if 1 <= int(a) <= 12 and 1 <= int(b) <= 31]
                        if len(mds) >= 2 and not re.search(r"규격|가로|세로|1080|1920", e.get("text", "")):
                            for x in ml_classified:
                                if x.get("field") in ("event_start_date", "event_end_date"):
                                    x["field"] = "unknown"
                            for (mm, dd), fld in ((mds[0], "event_start_date"), (mds[-1], "event_end_date")):
                                ml_classified.append({"text": f"{_yr}-{mm:02d}-{dd:02d}", "confidence": 0.9,
                                                      "bbox": None, "block_index": -1, "field": fld})
                            break

            # ML 이 놓친 장소 보충: 장소/위치 라벨(어디든) 또는 대학+건물 venue 패턴.
            if "location" not in present:
                for e in ml_classified:
                    if e.get("field") != "unknown":
                        continue
                    t = e.get("text", "")
                    if (re.search(r"(장소|위치|실험\s*장소|오시는\s*길)\s*[:：]", t)
                            or (re.search(r"대학교|대학|캠퍼스", t)
                                and re.search(r"캠퍼스|[0-9]+\s*호|관|홀|빌딩|센터|타워", t))):
                        e["field"] = "location"
                        break

            # 주최/주관 추출 강화: 모델이 organizer 못 잡거나 주최/주관 라벨 블록이 있으면 보충.
            # 하드코딩 리스트 아님 — '주최/주관 cue' + 기관명 접미사 패턴(군/시/재단/협회/청 등).
            _org_present = any(e.get("field") == "organizer_name" for e in ml_classified)
            # 1) 주최/주관/후원 cue 가 든 unknown 블록 → organizer (고정밀, 라벨은 _clean 이 제거).
            for e in ml_classified:
                if e.get("field") != "unknown":
                    continue
                t = e.get("text", "")
                if re.search(r"주\s*최|주\s*관|후\s*원", t) and _ORG_SUFFIX.search(t) \
                        and not re.search(r"http|@", t):
                    e["field"] = "organizer_name"
                    _org_present = True
            # 1.5) '주최/주관' 단독 라벨 블록 → 바로 다음 기관명 블록을 organizer(하단 라벨-값 분리 레이아웃).
            for idx, e in enumerate(ml_classified):
                if not _ORG_LABEL_ONLY.match((e.get("text") or "").strip()):
                    continue
                for e2 in ml_classified[idx + 1:idx + 3]:
                    if e2.get("field") != "unknown":
                        continue
                    t2 = (e2.get("text") or "").strip()
                    if (_ORG_SUFFIX_STRICT.search(t2) and not _ORG_BODY.search(t2)
                            and 2 <= len(re.sub(r"\s+", "", t2)) <= 20):
                        e2["field"] = "organizer_name"
                        _org_present = True
                        break
            # 2) 모델·cue 둘다 organizer 못잡음 → 기관전용 접미사 블록(본문/주소 아님) 1개 보충.
            #    bare 시/군/구/도(주소와 모호)는 제외 — venue/location 오인 방지(cktest loc 회귀 차단).
            if not _org_present:
                for e in ml_classified:
                    if e.get("field") != "unknown":
                        continue
                    t = (e.get("text") or "").strip()
                    nl = len(re.sub(r"\s+", "", t))
                    if (_ORG_SUFFIX_STRICT.search(t) and not _ORG_BODY.search(t)
                            and not re.search(r"[0-9]+\s*[호층]|로\s*[0-9]|[0-9]+\s*길|캠퍼스", t)
                            and 2 <= nl <= 20):
                        e["field"] = "organizer_name"
                        break

        return ml_classified


# ── Lazy 싱글톤 인스턴스 ──
# Render가 포트를 빨리 열 수 있도록 서버 시작 시점에는 PaddleOCR을 로드하지 않는다.
_pipeline = None
parsing_skill = ParsingSkill()


def get_pipeline() -> BusinessCardPipeline:
    """PaddleOCR 파이프라인을 최초 요청 때 1회만 생성하고 재사용."""
    global _pipeline
    if _pipeline is None:
        start = time.perf_counter()
        print("[OCR] engine_load_start", flush=True)
        _pipeline = BusinessCardPipeline(lang="korean")
        elapsed = time.perf_counter() - start
        print(f"[OCR] engine_load_done elapsed={elapsed:.3f}s", flush=True)
    return _pipeline
