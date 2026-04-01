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

# 교통수단 키워드
TRANSPORT_KEYWORDS = [
    "KTX", "SRT", "ITX", "무궁화", "새마을",
    "비행기", "항공", "AIR", "AIR",
    "고속버스", "시외버스", "버스",
    "기차", "열차", "철도",
    "선박", "페리",
]

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
    if KOREAN_NAME_PATTERN.match(text_stripped):
        if KOREAN_SURNAME_SINGLE.match(text_stripped):
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


def extract_clean_value(text: str, field: str) -> str:
    """분류된 필드에서 해당 값만 깨끗하게 추출 (키워드/노이즈 제거)."""
    if field == "email":
        match = EMAIL_PATTERN.search(text)
        return match.group() if match else text
    if field in ("mobile_phone", "office_phone", "contact_phone"):
        match = MOBILE_PATTERN.search(text) or LANDLINE_PATTERN.search(text)
        return match.group() if match else text
    if field == "fax_number":
        match = LANDLINE_PATTERN.search(text) or MOBILE_PATTERN.search(text)
        return match.group() if match else text
    if field == "total_amount":
        match = PRICE_PATTERN.search(text)
        return match.group() if match else text
    if field == "website" or field == "website_url":
        match = LINK_PATTERN.search(text)
        return match.group() if match else text
    return text


def _split_multi_number_blocks(text_blocks: list[dict]) -> list[dict]:
    """
    하나의 블록에 팩스+전화 등 여러 번호가 합쳐진 경우 분리.
    예: "Fax 053-289-4021Mobile 010-5140-3662" → 2개 블록으로 분리
    """
    expanded = []
    for block in text_blocks:
        text = block["text"].strip()

        # 텍스트 내 모든 유선/휴대폰 번호를 찾음
        landline_matches = list(LANDLINE_PATTERN.finditer(text))
        mobile_matches = list(MOBILE_PATTERN.finditer(text))
        all_matches = landline_matches + mobile_matches

        # 번호가 2개 이상이면 각각 별도 블록으로 분리
        if len(all_matches) >= 2:
            segments = []
            match_positions = sorted(
                [(m.start(), m.end(), m.group()) for m in all_matches],
                key=lambda x: x[0]
            )
            for i, (start, end, number) in enumerate(match_positions):
                if i == 0:
                    prefix = text[:start]
                else:
                    prefix = text[match_positions[i-1][1]:start]
                segment_text = (prefix + number).strip()
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

def classify_text_block_for_ticket(text: str) -> str:
    """
    티켓용 단일 텍스트 블록을 스키마 필드로 분류.

    판별 순서:
    1) 교통수단 키워드 → transport_type
    2) 출발 키워드 + 시간 → departure_time
    3) 도착 키워드 + 시간 → arrival_time
    4) 출발 키워드 + 날짜 → departure_date
    5) 도착 키워드 + 날짜 → arrival_date
    6) 출발 키워드 (장소) → departure_location
    7) 도착 키워드 (장소) → arrival_location
    8) 해당 없음 → unknown
    """
    text_stripped = text.strip()
    if not text_stripped:
        return "unknown"

    lower = text_stripped.lower()

    # 1) 교통수단 키워드 확인
    for kw in TRANSPORT_KEYWORDS:
        if kw.lower() in lower:
            return "transport_type"

    has_date = DATE_PATTERN.search(text_stripped)
    has_time = TIME_PATTERN.search(text_stripped)

    is_departure = any(kw in lower for kw in DEPARTURE_KEYWORDS)
    is_arrival = any(kw in lower for kw in ARRIVAL_KEYWORDS)

    # 2) 출발 + 시간 → departure_time
    if is_departure and has_time:
        return "departure_time"

    # 3) 도착 + 시간 → arrival_time
    if is_arrival and has_time:
        return "arrival_time"

    # 4) 출발 + 날짜 → departure_date
    if is_departure and has_date:
        return "departure_date"

    # 5) 도착 + 날짜 → arrival_date
    if is_arrival and has_date:
        return "arrival_date"

    # 6) 출발 키워드만 있으면 장소로 추정
    if is_departure:
        return "departure_location"

    # 7) 도착 키워드만 있으면 장소로 추정
    if is_arrival:
        return "arrival_location"

    # 8) 날짜만 단독 → 출발일로 기본 분류
    if has_date:
        return "departure_date"

    # 9) 시간만 단독 → 출발 시간으로 기본 분류
    if has_time:
        return "departure_time"

    return "unknown"


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
        # 전화번호/이메일/URL만 extract_clean_value로 노이즈 제거
        clean_fields = ("contact_phone", "contact_email", "website_url", "total_amount")
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
    # 전처리: 번호가 합쳐진 블록 분리
    text_blocks = _split_multi_number_blocks(text_blocks)

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
