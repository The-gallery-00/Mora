# ═══════════════════════════════════════════════════════════════
# src/classifier/rule_based.py — 규칙 기반 텍스트 분류기
# ═══════════════════════════════════════════════════════════════
#
# [역할]
# OCR로 추출된 텍스트 블록들을 정규식과 휴리스틱 규칙으로 분류하여
# 문서 종류별 필드에 매핑한다.
# 머신러닝 모델 없이 순수 규칙 기반으로 동작하므로 속도가 빠르고
# 분류 기준이 투명하다.
#
# [코드 흐름]
# 1) 모듈 로드 시 정규식 패턴(이메일, 전화, 팩스 등)을 compile한다
# 2) classify_all_blocks_for_type() 호출 시 문서 종류에 따라 분기:
#    a) BUSINESS_CARD → classify_all_blocks() (2-pass 분류)
#    b) POSTER → classify_text_block_for_poster()
#    c) RECEIPT → classify_text_block_for_receipt()
#    d) TICKET → classify_text_block_for_ticket()
#    e) ETC → 모든 블록 unknown
#
# [메서드 목록]
# - classify_text_block(text, all_blocks, block_index):
#     단일 텍스트 블록을 명함 스키마 필드로 분류.
# - classify_text_block_for_poster(text):
#     포스터용 단일 텍스트 블록 분류.
# - classify_text_block_for_receipt(text):
#     영수증용 단일 텍스트 블록 분류.
# - classify_text_block_for_ticket(text):
#     티켓용 단일 텍스트 블록 분류.
# - extract_clean_value(text, field):
#     분류된 필드에서 해당 값만 정규식으로 추출 (노이즈 제거).
# - _split_multi_number_blocks(text_blocks):
#     하나의 텍스트 블록에 2개 이상의 전화번호가 포함된 경우
#     각각 별도 블록으로 분리하는 전처리.
# - classify_all_blocks_for_type(text_blocks, document_type):
#     문서 종류에 따라 적절한 분류 함수를 선택하여 전체 블록 분류.
# - classify_all_blocks(text_blocks):
#     명함 전용. 전처리 → 2-pass 분류 → 값 추출.
#
# [사용된 라이브러리]
# ───────────────────────────────────────────
# re.compile(pattern)
#   정규식 문자열을 패턴 객체(re.Pattern)로 변환함.
#   같은 패턴을 반복 사용할 때 compile()로 미리 만들어두면
#   호출마다 패턴을 새로 파싱하지 않고 객체를 재사용할 수 있음.
# ───────────────────────────────────────────
# pattern.search(text)
#   문자열 전체를 훑으며 패턴을 탐색함.
#   패턴이 발견되면 Match 객체, 없으면 None 반환.
# ───────────────────────────────────────────
# pattern.match(text)
#   문자열의 **시작 부분**부터 패턴 매칭을 시도한다.
# ───────────────────────────────────────────
# pattern.finditer(text)
#   문자열에서 패턴과 일치하는 모든 위치를 이터레이터로 반환.
# ───────────────────────────────────────────
#
# ═══════════════════════════════════════════════════════════════

"""
규칙 기반 분류기: 정규식 + 휴리스틱으로 텍스트 블록을 스키마 필드에 매핑.
"""
from __future__ import annotations

import re

# ========== 공통 패턴 ==========

# 이메일: 영어와 @ . 으로 이루어져있음
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+")

# 휴대폰: 010-xxxx-xxxx, 01x-xxx-xxxx
MOBILE_PATTERN = re.compile(r"01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}")

# 일반 전화 / 팩스: 02-xxx-xxxx, 0xx-xxx-xxxx
LANDLINE_PATTERN = re.compile(r"0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}")

# 팩스 키워드
FAX_KEYWORDS = re.compile(r"(?i)(fax|팩스|f\s*[:.]|FAX\s*[:.)])")

# 전화 키워드
PHONE_KEYWORDS = re.compile(r"(?i)(tel|phone|전화|핸드폰|휴대폰|mobile|h\.?p\.?|t\s*[:.])")

# 날짜: "2024년 3월 15일", "2024.03.15", "2024-03-15", "3/15" 등
DATE_PATTERN = re.compile(
    r"\d{4}[년.\-/]\s*\d{1,2}[월.\-/]\s*\d{1,2}[일]?"
    r"|\d{1,2}[월.\-/]\s*\d{1,2}[일]?"
)

# 시간: "14:30", "09:00", "오후 2시" 등
TIME_PATTERN = re.compile(
    r"\d{1,2}\s*:\s*\d{2}"
    r"|[오전후]+\s*\d{1,2}\s*시"
)

# URL 링크: http://, https://, www. 로 시작하는 주소
LINK_PATTERN = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)

# 금액: "12,000원", "₩12,000" 등
PRICE_PATTERN = re.compile(r"[\d,]+\s*원|₩\s*[\d,]+")

# ========== 명함 전용 패턴 ==========

# 한국어 이름 패턴 (2~4글자 한글)
KOREAN_NAME_PATTERN = re.compile(r"^[가-힣]{2,4}$")

# 한국어 성 (외자)
KOREAN_SURNAME_SINGLE = re.compile(
    r"^(김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|유|류|홍|전|고|문|손|"
    r"양|배|백|허|노|심|하|주|구|곽|성|차|우|진|민|나|지|엄|채|원|천|방|공|현|함|"
    r"변|염|여|추|도|소|석|선|설|마|길|연|위|표|명|기|반|라|왕|금|옥|육|인|맹)"
)

# 복성(두 글자 성) — 남궁, 독고, 황보 등
KOREAN_SURNAME_DOUBLE = re.compile(
    r"^(남궁|독고|황보|제갈|선우|동방|사공|서문)"
)

# 직책 키워드
JOB_TITLE_KEYWORDS = [
    # 한국어
    "대표", "사장", "부사장", "전무", "상무", "이사", "부장", "차장",
    "과장", "대리", "사원", "주임", "팀장", "실장", "본부장", "센터장",
    "매니저", "엔지니어", "디자이너", "개발자", "연구원", "교수", "박사",
    # 영어
    "CEO", "CTO", "CFO", "COO", "VP", "Director", "Manager", "Engineer",
    "Designer", "Developer", "Analyst", "Consultant", "President",
    "Senior", "Junior", "Lead", "Head", "Chief", "Officer", "Intern",
]

# 회사명 키워드
COMPANY_KEYWORDS = [
    # 한국어
    "주식회사", "(주)", "㈜", "(재)", "재단법인", "(사)", "사단법인",
    "협회", "재단", "기술원", "연구원", "진흥원", "공사", "공단",
    "회사", "그룹", "코퍼레이션", "테크", "랩",
    "솔루션", "시스템", "네트워크", "미디어", "엔터", "파트너스",
    # 영어
    "Inc", "Corp", "Ltd", "LLC", "Co.", "Company", "Group",
    "Technologies", "Tech", "Labs", "Solutions", "Systems",
    "Networks", "Media", "Entertainment", "Partners", "Global",
]

# 부서 키워드 — 텍스트 끝에 이 키워드가 오면 부서명으로 판별
DEPARTMENT_KEYWORDS = [
    "부", "팀", "실", "센터", "본부", "사업부", "연구소", "지점",
    "파트", "그룹", "Division", "Team", "Department", "Dept",
]

# 주소 패턴 — 한국 주소에 자주 등장하는 키워드 조합
ADDRESS_PATTERN = re.compile(
    r"(시|구|동|로|길|읍|면|리|층|호|번지|번길)"
)

# 우편번호 패턴 — 5자리 숫자 단독
ZIP_CODE_PATTERN = re.compile(r"^\d{5}$")

# ========== 포스터 전용 패턴 ==========

# 주최/주관 키워드
ORGANIZER_KEYWORDS = ["주최", "주관", "후원", "협찬", "organizer", "hosted by"]

# 장소 키워드
LOCATION_KEYWORDS = ["장소", "위치", "곳", "at ", "venue", "홀", "센터", "회의실", "강당"]

# 행사 시작 키워드
EVENT_START_KEYWORDS = ["일시", "시작", "개최", "행사일", "기간"]

# 행사 종료/마감 키워드
EVENT_END_KEYWORDS = ["마감", "접수", "신청기한", "deadline", "모집기간", "종료", "까지"]

# ========== 영수증 전용 패턴 ==========

# 합계 키워드
TOTAL_KEYWORDS = ["합계", "총액", "total", "합산", "결제", "총"]

# 업장 키워드
STORE_KEYWORDS = ["상호", "매장", "가맹점"]

# ========== 티켓 전용 패턴 ==========

# 교통수단 키워드 → 정규화된 교통수단명 매핑
TRANSPORT_NORMALIZE = {
    # KTX
    "KTX": "KTX",
    # SRT
    "SRT": "SRT",
    # ITX
    "ITX": "ITX",
    # 무궁화
    "무궁화": "무궁화",
    # 고속버스
    "고속버스": "고속버스", "시외버스": "고속버스",
    # 비행기 (항공사명, 항공 키워드, IATA 코드)
    "항공": "비행기", "AIR": "비행기", "비행기": "비행기",
    "아시아나": "비행기", "대한항공": "비행기", "진에어": "비행기",
    "티웨이": "비행기", "제주항공": "비행기", "에어부산": "비행기",
    "에어서울": "비행기", "이스타": "비행기", "플라이강원": "비행기",
    "탑승권": "비행기",
    # IATA 항공사 코드
    "OZ": "비행기", "KE": "비행기", "LJ": "비행기",
    "TW": "비행기", "7C": "비행기", "BX": "비행기",
    "ZE": "비행기", "RS": "비행기",
}

# 역호환용 키워드 리스트 (티켓 감지에 사용)
TRANSPORT_KEYWORDS = list(TRANSPORT_NORMALIZE.keys())

# 출발 키워드
DEPARTURE_KEYWORDS = ["출발", "탑승", "departure", "from", "승차"]

# 도착 키워드
ARRIVAL_KEYWORDS = ["도착", "하차", "arrival", "to", "종착"]


# ════════════════════════════════════════════
# 명함 분류기
# ════════════════════════════════════════════

def classify_text_block(text: str, all_blocks: list[dict] = None, block_index: int = 0) -> str:
    """
    단일 텍스트 블록을 명함 스키마 필드로 분류.

    Args:
        text: OCR에서 추출된 텍스트
        all_blocks: 전체 텍스트 블록 목록 (문맥 참조용)
        block_index: 현재 블록의 인덱스

    Returns:
        필드명 (person_name, english_name, company_name, department,
        job_title, mobile_phone, office_phone, fax_number, email,
        address, website, zip_code, unknown)
    """
    text_stripped = text.strip()
    if not text_stripped:
        return "unknown"

    # 1) 이메일 확인 — @ 기호를 포함한 이메일 패턴 매칭
    if EMAIL_PATTERN.search(text_stripped):
        return "email"

    # 2) 웹사이트 확인 — http/https/www 패턴
    if LINK_PATTERN.search(text_stripped):
        return "website"

    # 3) 팩스 확인 — 팩스 키워드 + 전화번호 패턴이 동시에 존재
    if FAX_KEYWORDS.search(text_stripped) and LANDLINE_PATTERN.search(text_stripped):
        return "fax_number"

    # 4) 휴대폰 번호 확인 — 010/011/016/017/018/019로 시작하는 번호
    if MOBILE_PATTERN.search(text_stripped):
        if FAX_KEYWORDS.search(text_stripped):
            return "fax_number"
        return "mobile_phone"

    # 5) 일반 전화번호 / 팩스 판별 — 0으로 시작하는 유선 번호
    if LANDLINE_PATTERN.search(text_stripped):
        if FAX_KEYWORDS.search(text_stripped):
            return "fax_number"
        if PHONE_KEYWORDS.search(text_stripped):
            return "office_phone"
        # 키워드 없는 유선번호 → 문맥으로 판단
        # 이미 mobile_phone이 할당된 블록이 있으면 office_phone으로 분류
        if all_blocks:
            mobile_already_found = any(
                b.get("_classified") == "mobile_phone"
                for b in all_blocks
                if b["block_index"] != block_index
            )
            return "office_phone" if mobile_already_found else "office_phone"
        return "office_phone"

    # 6) 우편번호 확인 — 5자리 숫자 단독
    if ZIP_CODE_PATTERN.match(text_stripped):
        return "zip_code"

    # 7) 주소 확인 — 한국 주소 키워드 포함 + 어느 정도 길이
    if len(text_stripped) >= 5 and ADDRESS_PATTERN.search(text_stripped):
        # 주소는 보통 5자 이상이고 숫자+한글 혼합
        address_keyword_count = len(ADDRESS_PATTERN.findall(text_stripped))
        if address_keyword_count >= 2:
            return "address"

    # 8) 직책 확인 — 키워드 리스트와 대소문자 무관 비교
    for keyword in JOB_TITLE_KEYWORDS:
        if keyword.lower() in text_stripped.lower():
            return "job_title"

    # 9) 부서 확인 — 텍스트가 부서 키워드로 끝나는 경우
    for keyword in DEPARTMENT_KEYWORDS:
        if text_stripped.endswith(keyword):
            return "department"

    # 10) 회사명 확인 — 키워드 리스트와 대소문자 무관 비교
    for keyword in COMPANY_KEYWORDS:
        if keyword.lower() in text_stripped.lower():
            return "company_name"

    # 11) 한국어 이름 확인 — 2~4글자 한글 단독 + 한국 성씨로 시작
    #     공백이 포함된 경우("이 응 환")도 공백 제거 후 판별
    name_no_space = re.sub(r"\s+", "", text_stripped)
    if 2 <= len(name_no_space) <= 4 and re.match(r"^[가-힣]+$", name_no_space):
        if KOREAN_SURNAME_SINGLE.match(name_no_space) or KOREAN_SURNAME_DOUBLE.match(name_no_space):
            return "person_name"

    # 12) 영문 이름 추정 — 2~3 단어, 모두 알파벳, 각 단어 첫 글자 대문자
    words = text_stripped.split()
    if 2 <= len(words) <= 3 and all(w[0].isupper() and w.isalpha() for w in words):
        # 이미 한국어 이름이 분류된 블록이 있으면 english_name으로
        if all_blocks:
            has_korean_name = any(
                b.get("_classified") == "person_name"
                for b in all_blocks
            )
            if has_korean_name:
                return "english_name"
        return "person_name"

    return "unknown"


def _normalize_phone(number: str) -> str:
    """전화번호의 구분자(. 또는 공백)를 하이픈(-)으로 통일."""
    return re.sub(r"[.\s]+(?=\d)", "-", number)


def extract_clean_value(text: str, field: str) -> str:
    """분류된 필드에서 해당 값만 깨끗하게 추출 (키워드/노이즈 제거)."""
    if field == "email":
        # "E-mail.", "Email:", "E.", "e:" 등 접두사 키워드 제거 후 추출
        cleaned = re.sub(r"(?i)^e[-.]?mail\s*[.:)]\s*", "", text.strip())
        cleaned = re.sub(r"(?i)^e\s*[.:)]\s*", "", cleaned)
        match = EMAIL_PATTERN.search(cleaned)
        return match.group() if match else text
    if field in ("mobile_phone", "office_phone", "contact_phone"):
        match = MOBILE_PATTERN.search(text) or LANDLINE_PATTERN.search(text)
        return _normalize_phone(match.group()) if match else text
    if field == "fax_number":
        match = LANDLINE_PATTERN.search(text) or MOBILE_PATTERN.search(text)
        return _normalize_phone(match.group()) if match else text
    if field == "total_amount":
        match = PRICE_PATTERN.search(text)
        return match.group() if match else text
    if field == "website" or field == "website_url":
        match = LINK_PATTERN.search(text)
        return match.group() if match else text
    # 티켓: 교통수단은 정규화된 이름으로 반환
    if field == "transport_type":
        upper = text.upper()
        for kw, normalized in TRANSPORT_NORMALIZE.items():
            if kw.upper() in upper:
                return normalized
        return text.strip()
    # 티켓 필드: "라벨 : 값" 패턴에서 값만 추출
    _TICKET_FIELDS = (
        "departure_location", "departure_date",
        "departure_time", "arrival_location", "arrival_date", "arrival_time",
    )
    if field in _TICKET_FIELDS:
        label_match = re.match(r"^[\-▶►●·※\[\]\s]*(.+?)\s*[:：]\s*(.+)$", text.strip())
        if label_match:
            return label_match.group(2).strip()
        return text.strip()
    # departure_location이지만 여정(출발-도착) 합쳐진 경우 → 출발지만 반환
    # (도착지는 _split_ticket_compound_fields에서 별도 블록으로 분리됨)
    if field == "_route_departure":
        return text.strip()
    if field == "_route_arrival":
        return text.strip()
    if field == "person_name":
        # 공백 포함된 한국어 이름("이 응 환") → 공백 제거("이응환")
        name_no_space = re.sub(r"\s+", "", text.strip())
        if re.match(r"^[가-힣]{2,4}$", name_no_space):
            return name_no_space
        return text.strip()
    return text


def _split_multi_pattern_blocks(text_blocks: list[dict]) -> list[dict]:
    """
    하나의 블록에 여러 종류의 정보(전화+팩스, 팩스+이메일 등)가
    합쳐진 경우 각각 별도 블록으로 분리.

    예:
      "F.053-813-1212E.ukneeon@naver.com"
        → ["F.053-813-1212", "E.ukneeon@naver.com"]
      "T.053-216-1613 HP.010-3051-5765"
        → ["T.053-216-1613", "HP.010-3051-5765"]
      "Fax 053-289-4021Mobile 010-5140-3662"
        → ["Fax 053-289-4021", "Mobile 010-5140-3662"]
    """
    # 전화번호 → 이메일/URL 순서로 매칭 (전화번호를 먼저 확정해야
    # 이메일 패턴이 전화번호 숫자를 로컬파트로 삼키는 것을 방지)
    _PHONE_PATTERNS = [MOBILE_PATTERN, LANDLINE_PATTERN]
    _OTHER_PATTERNS = [EMAIL_PATTERN, LINK_PATTERN]

    expanded = []
    for block in text_blocks:
        text = block["text"].strip()

        # Step 1: 전화번호 매치를 먼저 확정
        phone_matches = []
        for pattern in _PHONE_PATTERNS:
            for m in pattern.finditer(text):
                phone_matches.append((m.start(), m.end()))

        # 겹치는 전화번호 매치 제거
        phone_matches.sort(key=lambda x: x[0])
        phone_filtered = []
        for start, end in phone_matches:
            if not phone_filtered or start >= phone_filtered[-1][1]:
                phone_filtered.append((start, end))

        # Step 2: 전화번호 영역을 마스킹한 텍스트에서 이메일/URL 매칭
        # (전화번호 숫자가 이메일 로컬파트로 잡히는 것을 방지)
        masked = list(text)
        for ps, pe in phone_filtered:
            for i in range(ps, pe):
                masked[i] = '\x00'
        masked_text = ''.join(masked)

        other_matches = []
        for pattern in _OTHER_PATTERNS:
            for m in pattern.finditer(masked_text):
                other_matches.append((m.start(), m.end()))

        # 전체 매치 합치기
        all_matches = phone_filtered + other_matches
        all_matches.sort(key=lambda x: x[0])
        filtered = []
        for start, end in all_matches:
            if not filtered or start >= filtered[-1][1]:
                filtered.append((start, end))

        # 패턴이 2개 이상이면 분리
        if len(filtered) >= 2:
            segments = []
            for i, (start, end) in enumerate(filtered):
                # 이 매치 앞의 접두사 텍스트 (키워드 라벨)를 포함
                if i == 0:
                    prefix = text[:start]
                else:
                    prefix = text[filtered[i - 1][1]:start]
                # 마지막 매치이면 뒤에 남은 텍스트도 포함
                if i == len(filtered) - 1:
                    suffix = text[end:]
                else:
                    suffix = ""
                segment_text = (prefix + text[start:end] + suffix).strip()
                if segment_text:
                    segments.append(segment_text)

            for seg in segments:
                expanded.append({
                    "text": seg,
                    "confidence": block.get("confidence", 0.0),
                    "bbox": block.get("bbox"),
                    "block_index": block["block_index"],
                })
        else:
            expanded.append(block)
    return expanded


# ════════════════════════════════════════════
# 포스터 분류기
# ════════════════════════════════════════════

def classify_text_block_for_poster(text: str) -> str:
    """
    포스터용 단일 텍스트 블록을 스키마 필드로 분류.

    판별 순서:
    1) 이메일 → contact_email
    2) URL 링크 → website_url
    3) 전화번호(휴대폰/유선) → contact_phone
    4) 주최/주관 키워드 → organizer_name
    5) 장소 키워드 → location
    6) 날짜 패턴 + 종료 키워드 → event_end_date
    7) 날짜 패턴 + 시작 키워드(또는 키워드 없음) → event_start_date
    8) 해당 없음 → unknown (가장 긴 unknown을 title로 승격)
    """
    text_stripped = text.strip()
    if not text_stripped:
        return "unknown"

    lower = text_stripped.lower()

    # 1) 이메일 확인
    if EMAIL_PATTERN.search(text_stripped):
        return "contact_email"

    # 2) URL 링크 확인
    if LINK_PATTERN.search(text_stripped):
        return "website_url"

    # 3) 전화번호 확인 (휴대폰 또는 유선)
    if MOBILE_PATTERN.search(text_stripped) or LANDLINE_PATTERN.search(text_stripped):
        return "contact_phone"

    # 4) 주최/주관 키워드 확인
    for kw in ORGANIZER_KEYWORDS:
        if kw in lower:
            return "organizer_name"

    # 5) 장소 키워드 확인
    for kw in LOCATION_KEYWORDS:
        if kw in lower:
            return "location"

    # 6) 날짜 패턴이 있으면 키워드로 event_end_date vs event_start_date 구분
    has_date = DATE_PATTERN.search(text_stripped)
    if has_date:
        for kw in EVENT_END_KEYWORDS:
            if kw in lower:
                return "event_end_date"
        for kw in EVENT_START_KEYWORDS:
            if kw in lower:
                return "event_start_date"
        # 키워드 없는 날짜 → 행사 시작일로 기본 분류
        return "event_start_date"

    return "unknown"


# ════════════════════════════════════════════
# 영수증 분류기
# ════════════════════════════════════════════

def classify_text_block_for_receipt(text: str) -> str:
    """
    영수증용 단일 텍스트 블록을 스키마 필드로 분류.

    판별 순서:
    1) 금액 패턴 + 합계 키워드 → total_amount
    2) 날짜 패턴 → purchase_date
    3) 업장 키워드 → store_name
    4) 해당 없음 → unknown
    """
    text_stripped = text.strip()
    if not text_stripped:
        return "unknown"

    lower = text_stripped.lower()

    # 1) 금액 + 합계 키워드 확인
    if PRICE_PATTERN.search(text_stripped):
        for kw in TOTAL_KEYWORDS:
            if kw in lower:
                return "total_amount"

    # 2) 날짜 패턴 확인 → 구매일자
    if DATE_PATTERN.search(text_stripped):
        return "purchase_date"

    # 3) 업장명 키워드 확인
    for kw in STORE_KEYWORDS:
        if kw in lower:
            return "store_name"

    return "unknown"


# ════════════════════════════════════════════
# 티켓 분류기
# ════════════════════════════════════════════

# 캡쳐 티켓에서 "라벨 : 값" 패턴 매칭용 정규식
# 접두사: -, ▶, ►, ●, ·, ※, [] 등 제거
_LABEL_VALUE_PATTERN = re.compile(r"^[\-▶►●·※\[\]\s]*(.+?)\s*[:：]\s*(.+)$")

# 라벨 → 필드 매핑 (캡쳐 티켓 카카오 알림톡/앱 형태)
_TICKET_LABEL_MAP = {
    # 긴 키워드를 먼저 배치해야 "출발"이 "출발시간"보다 먼저 매칭되는 것을 방지
    # 교통수단/편명
    "항공편명": "transport_type", "항공편": "transport_type",
    "편명": "transport_type",
    # 출발 (긴 것 먼저)
    "출발일시": "departure_date", "출발시간": "departure_time",
    "출발일": "departure_date", "출발지": "departure_location",
    "출발": "departure_location",
    # 도착 (긴 것 먼저)
    "도착시간": "arrival_time", "도착일": "arrival_date",
    "도착지": "arrival_location", "도착": "arrival_location",
    # 구간/여정
    "구간": "departure_location", "여정": "departure_location",
    # 기타
    "좌석번호": "unknown", "좌석": "unknown",
    "예약번호": "unknown",
    "탑승객명": "unknown", "탑승객": "unknown",
    "승객명": "unknown", "승객": "unknown",
}


def classify_text_block_for_ticket(text: str) -> str:
    """
    티켓용 단일 텍스트 블록을 스키마 필드로 분류.

    캡쳐 티켓 지원을 위해 "라벨 : 값" 패턴을 우선 처리하고,
    매칭 안 되면 키워드 기반 분류로 폴백.
    """
    text_stripped = text.strip()
    if not text_stripped:
        return "unknown"

    lower = text_stripped.lower()

    # 캡쳐 티켓은 "라벨:값" 패턴 안에 있는 정보만 신뢰.
    # 단독 블록(UI 시계, 전화번호, 날짜 헤더 등)은 전부 노이즈.

    # 1) "라벨 : 값" 패턴 매칭
    label_match = _LABEL_VALUE_PATTERN.match(text_stripped)
    if label_match:
        label = label_match.group(1).strip().rstrip("-").strip()
        for key, field in _TICKET_LABEL_MAP.items():
            if key in label:
                return field

    # 2) 라벨 없이 교통수단 키워드가 포함된 블록 (예: "SRT 373", "KTX-산천 292")
    for kw in TRANSPORT_KEYWORDS:
        if kw.upper() in text_stripped.upper():
            return "transport_type"

    # 나머지는 전부 unknown (UI 노이즈)
    return "unknown"


# 여정 구분자: "포항경주(KPO) - 제주(CJU)", "TAE-CXR", "서울 → 부산"
_ROUTE_SEPARATORS = re.compile(r"\s*[-–—→>]\s*")

# 날짜+시간 분리: "2025.10.10(금)10:45", "2025-12-22(월)19:40"
_DATETIME_SPLIT = re.compile(
    r"^(.*?\d{4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}(?:\s*\([가-힣]\))?)\s*(.*)$"
)


# 한국 기차역 화이트리스트 (SRT + KTX + ITX + 무궁화)
_STATION_NAMES = {
    # SRT
    "수서", "동탄", "평택지제", "천안아산", "오송", "대전", "김천구미",
    "동대구", "신경주", "경주", "울산", "부산",
    # KTX 추가
    "서울", "용산", "광명", "영등포", "수원", "천안", "조치원",
    "세종", "서대전", "익산", "전주", "남원", "광주송정", "광주",
    "목포", "나주", "순천", "여수엑스포", "여수", "포항", "강릉",
    "정동진", "동해", "삼척", "진주", "마산", "창원", "창원중앙",
    "밀양", "구포", "부전", "태화강",
    # 수도권/기타
    "청량리", "왕십리", "상봉", "양평", "원주", "제천", "충주",
    "안동", "영주", "춘천", "가평", "남춘천",
}

# "역명(시간)" 패턴: "동대구(05:48)", "수서(07:35)"
_STATION_TIME = re.compile(r"([가-힣]{2,5})\s*\((\d{1,2}:\d{2})\)")

# 시간 단독 패턴: "21:00", "13:23"
_TIME_ONLY = re.compile(r"^\d{1,2}:\d{2}$")


def _try_layout_based_ticket(text_blocks: list[dict]) -> list[dict] | None:
    """
    SRT/KTX 네이버 예매 승차권 레이아웃 기반 파싱.
    역명(한글 2~5자)과 시간(HH:MM)이 왼쪽/오른쪽에 쌍으로 배치된 패턴을 감지.
    성공하면 분류 결과 반환, 아니면 None.
    """
    # 역명 블록 찾기
    stations = []
    times = []
    date_block = None
    transport_block = None

    for b in text_blocks:
        text = b["text"].strip()
        bbox = b.get("bbox")
        if not bbox:
            continue
        x = bbox[0][0]

        # "역명(시간)" 합쳐진 패턴 (SRT 앱: "동대구(05:48)")
        st_matches = _STATION_TIME.findall(text)
        if st_matches:
            for station, time_str in st_matches:
                if station in _STATION_NAMES:
                    stations.append({"text": station, "x": x, "block": b})
                    times.append({"text": time_str, "x": x, "block": b})
                    x += 200  # 같은 블록 내 두 번째 매치는 오른쪽으로 취급
            continue

        # 역명 단독 (네이버 예매: "수서", "동대구")
        if text in _STATION_NAMES:
            stations.append({"text": text, "x": x, "block": b})
        elif _TIME_ONLY.match(text):
            times.append({"text": text, "x": x, "block": b})
        elif DATE_PATTERN.search(text) and len(text) >= 8 and not date_block:
            date_block = b
        elif any(kw.upper() in text.upper() for kw in TRANSPORT_KEYWORDS) and not transport_block:
            transport_block = b

    # 역명 2개 + 시간 2개가 있어야 레이아웃 기반 파싱
    if len(stations) < 2 or len(times) < 2:
        return None

    # x 좌표로 정렬 → 왼쪽이 출발, 오른쪽이 도착
    stations.sort(key=lambda s: s["x"])
    times.sort(key=lambda t: t["x"])

    results = []
    base = lambda b: {"confidence": b.get("confidence", 0.0), "bbox": b.get("bbox"), "block_index": b["block_index"]}

    # 출발역/도착역
    results.append({**base(stations[0]["block"]), "text": stations[0]["text"], "field": "departure_location"})
    results.append({**base(stations[-1]["block"]), "text": stations[-1]["text"], "field": "arrival_location"})

    # 출발시간/도착시간
    results.append({**base(times[0]["block"]), "text": times[0]["text"], "field": "departure_time"})
    results.append({**base(times[-1]["block"]), "text": times[-1]["text"], "field": "arrival_time"})

    # 날짜
    if date_block:
        date_text = date_block["text"].strip()
        results.append({**base(date_block), "text": date_text, "field": "departure_date"})
        # 기차/버스: 도착시간이 출발시간보다 크면(자정 안 넘김) 도착일 = 출발일
        dep_time = times[0]["text"]  # "21:00"
        arr_time = times[-1]["text"]  # "22:42"
        dep_h = int(dep_time.split(":")[0])
        arr_h = int(arr_time.split(":")[0])
        if arr_h >= dep_h:  # 자정 안 넘김
            results.append({**base(date_block), "text": date_text, "field": "arrival_date"})

    # 교통수단
    if transport_block:
        transport_name = extract_clean_value(transport_block["text"], "transport_type")
        results.append({**base(transport_block), "text": transport_name, "field": "transport_type"})

    # 나머지 블록은 unknown
    classified_indices = {r["block_index"] for r in results}
    for b in text_blocks:
        if b["block_index"] not in classified_indices:
            results.append({**base(b), "text": b["text"].strip(), "field": "unknown"})

    return results


def _classify_and_split_ticket_blocks(text_blocks: list[dict]) -> list[dict]:
    """
    티켓 블록을 분류한 뒤 복합 필드를 분리.
    1) SRT/KTX 레이아웃 기반 파싱 시도
    2) 실패 시 라벨:값 기반 파싱 (카카오 알림톡 등)
       - 여정(출발-도착 합쳐진 것) → departure_location + arrival_location
       - 출발일시(날짜+시간 합쳐진 것) → departure_date + departure_time
    """
    # SRT/KTX 레이아웃 기반 먼저 시도
    layout_result = _try_layout_based_ticket(text_blocks)
    if layout_result:
        return layout_result

    # 라벨:값 기반 파싱 (카카오 알림톡 등)
    results = []
    for block in text_blocks:
        text = block["text"].strip()
        field = classify_text_block_for_ticket(text)
        clean_text = extract_clean_value(text, field)
        base = {
            "confidence": block.get("confidence", 0.0),
            "bbox": block.get("bbox"),
            "block_index": block["block_index"],
        }

        # 여정 분리: "포항경주(KPO) - 제주(CJU)" → 출발지 + 도착지
        if field == "departure_location":
            parts = _ROUTE_SEPARATORS.split(clean_text)
            if len(parts) >= 2:
                results.append({**base, "text": parts[0].strip(), "field": "departure_location"})
                results.append({**base, "text": parts[-1].strip(), "field": "arrival_location"})
                continue

        # 출발일시 분리: "2025.10.10(금)10:45" → 날짜 + 시간
        if field in ("departure_date", "departure_time"):
            dt_match = _DATETIME_SPLIT.match(clean_text)
            if dt_match and dt_match.group(2).strip():
                results.append({**base, "text": dt_match.group(1).strip(), "field": "departure_date"})
                results.append({**base, "text": dt_match.group(2).strip(), "field": "departure_time"})
                continue

        results.append({**base, "text": clean_text, "field": field})

    return results


# ════════════════════════════════════════════
# 통합 분류 함수
# ════════════════════════════════════════════

def classify_all_blocks_for_type(text_blocks: list[dict], document_type: str = "BUSINESS_CARD") -> list[dict]:
    """
    문서 종류에 따라 적절한 분류 함수를 선택하여 전체 블록을 분류.

    - BUSINESS_CARD: 기존 classify_all_blocks()에 위임 (2-pass 분류)
    - POSTER: classify_text_block_for_poster() 사용
      + unknown 블록 중 가장 긴 텍스트를 title로 자동 승격
    - RECEIPT: classify_text_block_for_receipt() 사용
    - TICKET: classify_text_block_for_ticket() 사용
    - ETC: 모든 블록을 unknown으로 반환 (파싱 스키마 미정의)
    """
    # 명함은 기존 로직(2-pass + 문맥 참조) 그대로 사용
    if document_type == "BUSINESS_CARD":
        return classify_all_blocks(text_blocks)

    # 문서 종류별 분류 함수 선택
    if document_type == "POSTER":
        classify_fn = classify_text_block_for_poster
    elif document_type == "RECEIPT":
        classify_fn = classify_text_block_for_receipt
    elif document_type == "TICKET":
        classify_fn = classify_text_block_for_ticket
        # 티켓은 분류 후 복합 필드 분리 후처리 필요
        return _classify_and_split_ticket_blocks(text_blocks)
    else:
        # ETC: 스키마 미정의 → 모든 블록을 unknown으로
        return [{"text": b["text"], "confidence": b.get("confidence", 0.0),
                 "bbox": b.get("bbox"), "block_index": b["block_index"],
                 "field": "unknown"} for b in text_blocks]

    # 각 블록을 분류하고 결과 리스트 생성
    results = []
    title_candidate = None
    for block in text_blocks:
        text = block["text"].strip()
        field = classify_fn(text)
        # 전화번호/이메일/URL + 티켓 필드 → extract_clean_value로 노이즈 제거
        clean_fields = (
            "contact_phone", "contact_email", "website_url", "total_amount",
            "transport_type", "departure_location", "departure_date",
            "departure_time", "arrival_location", "arrival_date", "arrival_time",
        )
        clean_text = extract_clean_value(text, field) if field in clean_fields else text
        entry = {"text": clean_text, "confidence": block.get("confidence", 0.0),
                 "bbox": block.get("bbox"), "block_index": block["block_index"], "field": field}
        results.append(entry)
        # 포스터: unknown 중 가장 긴 텍스트를 title 후보로 추적
        if document_type == "POSTER" and field == "unknown":
            if title_candidate is None or len(text) > len(title_candidate["text"]):
                title_candidate = entry

    # 포스터에서 title이 명시적으로 분류된 블록이 없으면 후보를 title로 승격
    if document_type == "POSTER" and title_candidate:
        has_title = any(r["field"] == "title" for r in results)
        if not has_title:
            title_candidate["field"] = "title"

    return results


def classify_all_blocks(text_blocks: list[dict]) -> list[dict]:
    """
    명함 전용. 전체 텍스트 블록을 순회하며 분류 결과를 추가.
    전처리: 복합 블록 분리 → 2-pass 분류 → 값 추출.
    """
    # 전처리: 여러 정보가 합쳐진 블록 분리 (전화+이메일, 팩스+전화 등)
    text_blocks = _split_multi_pattern_blocks(text_blocks)

    # 1st pass: 확실한 패턴 먼저 분류 (이메일, 휴대폰)
    # → 2nd pass에서 이미 분류된 블록을 문맥으로 참조할 수 있게 함
    for block in text_blocks:
        text = block["text"].strip()
        if EMAIL_PATTERN.search(text):
            block["_classified"] = "email"
        elif MOBILE_PATTERN.search(text) and not FAX_KEYWORDS.search(text):
            block["_classified"] = "mobile_phone"

    # 2nd pass: 나머지 블록 분류 (문맥 참조 가능)
    # 예: 유선번호가 mobile_phone 이미 있으면 office_phone으로 추정
    for block in text_blocks:
        if "_classified" not in block:
            block["_classified"] = classify_text_block(
                block["text"], all_blocks=text_blocks, block_index=block["block_index"]
            )

    # 결과 정리: _classified 임시 키를 제거하고 clean value 추출
    results = []
    for block in text_blocks:
        field = block.pop("_classified")
        clean_text = extract_clean_value(block["text"], field)
        results.append({
            "text": clean_text,
            "confidence": block.get("confidence", 0.0),
            "bbox": block.get("bbox"),
            "block_index": block["block_index"],
            "field": field,
        })

    return results
