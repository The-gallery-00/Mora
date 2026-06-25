# ═══════════════════════════════════════════════════════════════
# routers/ocr.py — OCR 스캔 API 라우터
# ═══════════════════════════════════════════════════════════════
#
# [역할]
# 클라이언트가 업로드한 이미지를 받아 OCR을 수행하고,
# 규칙 기반 파싱으로 명함 필드(이름, 회사, 전화번호 등)를
# 분류한 결과를 JSON으로 반환하는 API 엔드포인트를 정의한다.
#
# [코드 흐름]
# 1) 클라이언트가 POST /api/scan 으로 이미지 파일을 업로드한다
# 2) 영구 저장하지 않고 임시 파일로만 받아 OCR 처리 후 즉시 삭제한다
# 3) pipeline.run()으로 OCR을 수행하여 텍스트 블록을 추출한다
# 4) parsing_skill.execute()로 텍스트 블록을 명함 필드로 분류한다
# 5) 파싱 결과, 원본 블록을 JSON으로 반환한다 (image_url 은 비어 있음)
# 6) 에러 발생 시 500 상태 코드와 에러 메시지를 반환한다
#
# 7) 사용자가 "확인 & 저장" 시 POST /api/commit 으로 원본 이미지를
#    재전송하면, 이때 비로소 uploads/{종류}/ 에 영구 저장하고
#    ner_dataset 에 라벨 데이터를 축적한다. (업로드 시점에는 누적 안 함)
#
# [메서드 목록]
# - scan(file): POST /scan 엔드포인트.
#     업로드 이미지를 임시 처리 → OCR → 파싱 → 결과 반환 (저장 안 함)
# - commit_document(...): POST /commit 엔드포인트.
#     확인&저장 시점에 이미지 영구 저장 + NER 라벨 누적
# - save_ner_label(...): POST /ner-label 엔드포인트 (하위 호환, 라벨만 저장)
#
# [사용된 라이브러리]
# ───────────────────────────────────────────
# uuid.uuid4().hex
#   랜덤 UUID를 생성하고 하이픈 없는 32자리 16진수 문자열로 변환.
#   업로드 파일명 충돌을 방지하기 위해 사용.
# ───────────────────────────────────────────
# shutil.copyfileobj(src, dst)
#   파일 객체에서 다른 파일 객체로 내용을 복사한다.
#   업로드된 파일 스트림을 디스크의 파일로 저장할 때 사용.
# ───────────────────────────────────────────
# pathlib.Path(filename).suffix
#   파일명에서 확장자를 추출한다. (예: ".jpg", ".png")
#   원본 확장자를 유지하면서 파일명만 UUID로 교체하기 위해 사용.
# ───────────────────────────────────────────
# fastapi.APIRouter()
#   FastAPI의 라우터 인스턴스를 생성한다.
#   라우터에 엔드포인트를 정의한 뒤 app.include_router()로 등록.
# ───────────────────────────────────────────
# fastapi.File(...)
#   엔드포인트 매개변수가 파일 업로드임을 선언하는 기본값.
#   ...는 필수 매개변수를 의미 (파일 업로드 생략 불가).
# ───────────────────────────────────────────
# fastapi.UploadFile
#   업로드된 파일의 메타데이터(filename 등)와 파일 스트림(.file)을
#   제공하는 FastAPI의 파일 업로드 타입.
# ───────────────────────────────────────────
# fastapi.responses.JSONResponse(content, status_code)
#   JSON 형식의 HTTP 응답을 생성한다.
#   content에 딕셔너리를 전달하면 자동으로 JSON 직렬화됨.
# ───────────────────────────────────────────
#
# ═══════════════════════════════════════════════════════════════

"""OCR router — POST /scan, POST /commit, POST /ner-label."""
import os
import time
import uuid
import hashlib
import shutil
import json
import tempfile
from pathlib import Path
from datetime import datetime

import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image, ImageOps

from fastapi import APIRouter, File, UploadFile, Body, Form
from fastapi.responses import JSONResponse

# services.py에서 lazy 생성되는 파이프라인과 파싱 스킬을 가져옴
from services import get_pipeline, parsing_skill
from src.classifier.field_schema import DOCUMENT_FIELDS, FIELD_LABELS_KO

router = APIRouter()

# 업로드 디렉토리 경로 설정 (ocr/uploads — 확인&저장 시점에만 영구 저장됨)
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
MAX_IMAGE_SIDE = 1280

# ===== 분류 모델 로드 (최초 요청 시 1회) =====
CLASSIFIER_PATH = Path(__file__).resolve().parent.parent / "models" / "image_classifier.pt"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_classifier = None
MODEL_CLASSES = []

classify_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# 분류 모델 클래스명 → DB enum 폴더명 매핑
CLASS_TO_TYPE = {
    "namecard": "BUSINESS_CARD",
    "poster": "POSTER",
    "recipt": "RECEIPT",
}

CONFIDENCE_THRESHOLD = 0.8

# 티켓 감지 키워드 — OCR 텍스트에 이 키워드가 있으면 티켓으로 판별
TICKET_KEYWORDS = [
    # 공통
    "탑승권", "승차권", "편명", "항공편명", "좌석번호", "좌석",
    "탑승구", "탑승장", "호차", "열차정보", "열차번호",
    # 열차
    "KTX", "SRT", "ITX", "무궁화", "새마을",
    # 항공 코드
    "OZ", "LJ", "TW", "7C", "BX", "ZE", "RS",  # 한국 항공사 코드
    "ICN", "GMP", "CJU", "PUS", "TAE", "KPO",   # 한국 공항 코드
    "LAX", "NRT", "KIX", "CXR",                  # 해외 공항 코드
    # 맥락
    "출발일", "출발시간", "도착", "구간",
    "예약번호", "승차권 번호", "e티켓",
    "모바일 탑승권", "스마트티켓",
]


def _detect_ticket_from_ocr(text_blocks: list[dict]) -> bool:
    """OCR 텍스트 블록에서 티켓 키워드를 감지."""
    all_text = " ".join(b["text"] for b in text_blocks).upper()
    match_count = sum(1 for kw in TICKET_KEYWORDS if kw.upper() in all_text)
    # 2개 이상 키워드 매칭 시 티켓으로 판별
    return match_count >= 2


def log_timing(request_id: str, event: str, started_at: float, previous_at: float | None = None):
    now = time.perf_counter()
    total = now - started_at
    if previous_at is None:
        print(f"[OCR:{request_id}] {event} total={total:.3f}s", flush=True)
    else:
        step = now - previous_at
        print(f"[OCR:{request_id}] {event} step={step:.3f}s total={total:.3f}s", flush=True)
    return now


def get_classifier():
    """이미지 분류 모델을 최초 요청 때 1회만 로드하고 재사용."""
    global _classifier, MODEL_CLASSES
    if _classifier is None:
        started_at = time.perf_counter()
        print("[OCR] classifier_load_start", flush=True)
        checkpoint = torch.load(CLASSIFIER_PATH, map_location=DEVICE, weights_only=True)
        MODEL_CLASSES = checkpoint["classes"]  # ["namecard", "poster", "recipt"]

        classifier = models.resnet18(weights=None)
        classifier.fc = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(classifier.fc.in_features, len(MODEL_CLASSES)),
        )
        classifier.load_state_dict(checkpoint["model_state"])
        classifier.to(DEVICE)
        classifier.eval()

        _classifier = classifier
        elapsed = time.perf_counter() - started_at
        print(f"[OCR] classifier_load_done elapsed={elapsed:.3f}s", flush=True)
    return _classifier


def normalize_uploaded_image(image_path: Path) -> dict:
    """EXIF 회전을 반영하고 긴 변이 크면 저장 파일 자체를 축소."""
    with Image.open(image_path) as opened:
        original_size = opened.size
        image = ImageOps.exif_transpose(opened).convert("RGB")

    max_dim = max(image.size)
    resized = False
    if max_dim > MAX_IMAGE_SIDE:
        ratio = MAX_IMAGE_SIDE / max_dim
        new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
        image = image.resize(new_size, Image.LANCZOS)
        resized = True

    image.save(image_path, quality=90, optimize=True)

    return {
        "original_size": {"width": original_size[0], "height": original_size[1]},
        "processed_size": {"width": image.size[0], "height": image.size[1]},
        "resized": resized,
    }


def classify_image(image_path: str) -> tuple[str, float]:
    """이미지를 분류하여 (document_type, confidence)를 반환."""
    classifier = get_classifier()
    image = Image.open(image_path).convert("RGB")
    input_tensor = classify_transform(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = classifier(input_tensor)
        probs = torch.softmax(outputs, dim=1)[0]

    max_idx = probs.argmax().item()
    confidence = probs[max_idx].item()
    model_class = MODEL_CLASSES[max_idx]
    document_type = CLASS_TO_TYPE.get(model_class, "ETC")

    # 디버그 로그
    print(f"[분류] {model_class} ({confidence:.4f}) → {document_type}", flush=True)
    for i, cls in enumerate(MODEL_CLASSES):
        print(f"  {cls}: {probs[i]*100:.1f}%", flush=True)

    return document_type, confidence


# NER 학습 데이터 저장 디렉토리 (ocr/ner_dataset)
NER_DATA_DIR = Path(__file__).resolve().parent.parent / "ner_dataset"
NER_DATA_DIR.mkdir(parents=True, exist_ok=True)

# 저장 경로에 쓰일 문서 종류 화이트리스트 (외부 입력 기반 경로 조합 → 디렉토리 탈출 방지)
ALLOWED_DOC_TYPES = {"BUSINESS_CARD", "POSTER", "RECEIPT", "TICKET", "ETC", "UNKNOWN"}


def _safe_doc_type(document_type: str) -> str:
    """허용된 문서 종류만 통과시키고, 그 외는 ETC로 대체 (경로 인젝션 차단)."""
    return document_type if document_type in ALLOWED_DOC_TYPES else "ETC"

# 이미지 해시 → 파일명 매핑 (중복 방지용)
_hash_index_path = UPLOAD_DIR / ".hash_index.json"


def _compute_image_hash(file_path: str) -> str:
    """이미지 파일의 MD5 해시 계산."""
    h = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_hash_index() -> dict:
    """해시 인덱스 로드."""
    if _hash_index_path.exists():
        with open(_hash_index_path, "r") as f:
            return json.load(f)
    return {}


def _save_hash_index(index: dict):
    """해시 인덱스 저장."""
    with open(_hash_index_path, "w") as f:
        json.dump(index, f, ensure_ascii=False)


@router.post("/scan")
async def scan(file: UploadFile = File(...)):
    """이미지를 받아 OCR → 티켓 감지/분류 → 파싱 결과를 반환.

    업로드 시점에는 어떤 데이터도 영구 저장하지 않는다.
    이미지는 시스템 임시 파일로만 받아 처리 후 즉시 삭제하며,
    영구 저장(uploads)·NER 라벨 누적(ner_dataset)은
    사용자가 "확인 & 저장"할 때 POST /api/commit 에서 수행한다.
    """
    request_id = uuid.uuid4().hex[:8]
    request_started_at = time.perf_counter()
    last_at = log_timing(request_id, "request_start", request_started_at)

    # 원본 확장자를 유지하되 uploads 가 아닌 시스템 임시 파일로만 저장
    suffix = Path(file.filename).suffix or ".jpg"
    fd, tmp_name = tempfile.mkstemp(suffix=suffix, prefix="mora_scan_")
    os.close(fd)
    temp_path = Path(tmp_name)

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        last_at = log_timing(request_id, "image_saved_tmp", request_started_at, last_at)

        image_info = normalize_uploaded_image(temp_path)
        print(
            f"[OCR:{request_id}] image_normalized resized={image_info['resized']} "
            f"original={image_info['original_size']} processed={image_info['processed_size']}",
            flush=True,
        )
        last_at = log_timing(request_id, "image_preprocessed", request_started_at, last_at)

        # Step 1: OCR 먼저 실행 (티켓 키워드 감지를 위해 분류보다 선행)
        print(f"[OCR:{request_id}] engine_get_start", flush=True)
        pipeline = get_pipeline()
        last_at = log_timing(request_id, "engine_ready", request_started_at, last_at)

        print(f"[OCR:{request_id}] ocr_run_start", flush=True)
        ocr_result = pipeline.run(str(temp_path))
        last_at = log_timing(request_id, "ocr_run_done", request_started_at, last_at)
        text_blocks = ocr_result.get("raw_blocks", [])

        # Step 2: OCR 텍스트로 티켓 감지 → 감지되면 ML 분류 스킵
        if _detect_ticket_from_ocr(text_blocks):
            document_type = "TICKET"
            confidence = 1.0
            print("[분류] 티켓 키워드 감지 → TICKET (ML 분류 스킵)", flush=True)
        else:
            document_type, confidence = classify_image(str(temp_path))
        last_at = log_timing(request_id, "classification_done", request_started_at, last_at)

        # Step 3: 텍스트 블록을 문서 종류에 맞게 파싱
        parsed_result = parsing_skill.execute(text_blocks, document_type=document_type)
        parsed = parsed_result["parsed"]
        items = parsed_result.get("items", [])  # 영수증 품목 (RECEIPT 만)
        last_at = log_timing(request_id, "parsing_done", request_started_at, last_at)

        fields = {
            ext: FIELD_LABELS_KO.get(ext, ext)
            for ext in DOCUMENT_FIELDS.get(document_type, {}).values()
        }

        log_timing(request_id, "request_done", request_started_at, last_at)

        return JSONResponse(content={
            "success": True,
            "data": {
                "type": document_type,
                "confidence": round(confidence, 4),
                "parsed": parsed,
                "items": items,
                "fields": fields,
                "raw_blocks": text_blocks,
                # 업로드 단계에서는 저장하지 않으므로 image_url 은 비어 있음.
                # 영구 URL 은 확인&저장(/commit) 응답에서 받는다.
                "image_url": "",
                "image_size": ocr_result.get("image_size"),
            }
        })
    except Exception as e:
        log_timing(request_id, f"request_failed error={e}", request_started_at, last_at)
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
    finally:
        # 임시 파일은 성공/실패와 무관하게 항상 삭제 (누적 방지)
        temp_path.unlink(missing_ok=True)


def _persist_image(file: UploadFile, document_type: str) -> tuple[str, str]:
    """업로드 이미지를 uploads/{종류}/ 에 영구 저장하고 (파일명, image_url)을 반환.

    확인&저장(/commit) 시점에만 호출된다. 정규화(EXIF/리사이즈)도 함께 수행하고,
    중복 추적용 해시 인덱스에 등록한다.
    """
    suffix = Path(file.filename).suffix or ".jpg"
    img_name = f"{uuid.uuid4().hex}{suffix}"

    type_dir = UPLOAD_DIR / document_type
    type_dir.mkdir(parents=True, exist_ok=True)
    img_path = type_dir / img_name

    with open(img_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    normalize_uploaded_image(img_path)

    # 중복 추적용 해시 인덱스 등록 (기록만, 차단은 안 함)
    img_hash = _compute_image_hash(str(img_path))
    hash_index = _load_hash_index()
    hash_index[img_hash] = {
        "filename": img_name,
        "type": document_type,
        "path": f"{document_type}/{img_name}",
    }
    _save_hash_index(hash_index)

    return img_name, f"/uploads/{document_type}/{img_name}"


def _write_ner_label(document_type: str, image_url: str,
                     raw_blocks: list, corrected_fields: dict) -> int:
    """OCR 원본 블록 + 사용자 수정 정답을 ner_dataset 에 누적하고 총 건수를 반환."""
    type_dir = NER_DATA_DIR / document_type
    type_dir.mkdir(parents=True, exist_ok=True)

    # 파일명: 타임스탬프 기반
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    label_path = type_dir / f"{timestamp}.json"

    label_data = {
        "document_type": document_type,
        "image_url": image_url,
        "raw_blocks": [
            {"text": b.get("text", ""), "confidence": b.get("confidence", 0)}
            for b in raw_blocks
        ],
        "corrected_fields": corrected_fields,
        "created_at": datetime.now().isoformat(),
    }

    with open(label_path, "w", encoding="utf-8") as f:
        json.dump(label_data, f, ensure_ascii=False, indent=2)

    count = len(list(type_dir.glob("*.json")))
    print(f"[NER] {document_type} 라벨 저장 ({count}건 축적)")
    return count


@router.post("/commit")
async def commit_document(
    file: UploadFile = File(...),
    document_type: str = Form("UNKNOWN"),
    raw_blocks: str = Form("[]"),
    corrected_fields: str = Form("{}"),
):
    """사용자가 "확인 & 저장"할 때 호출되는 영구 저장 엔드포인트.

    업로드 시점(/scan)에는 아무것도 저장하지 않으므로, 확정된 이 시점에만
    1) 원본 이미지를 uploads/{종류}/ 에 영구 저장하고
    2) ner_dataset 에 학습 라벨을 누적한다.

    multipart/form-data:
      - file: 원본 이미지 (스캔 때 보냈던 그 파일을 재전송)
      - document_type: "BUSINESS_CARD" | "POSTER" | "RECEIPT" | "TICKET"
      - raw_blocks: OCR 원본 블록 JSON 문자열
      - corrected_fields: 사용자가 수정/확인한 필드 JSON 문자열
    응답 data: {"image_url": "/uploads/.../xxx.jpg", "count": 축적 건수}
    """
    try:
        try:
            blocks = json.loads(raw_blocks or "[]")
            fields = json.loads(corrected_fields or "{}")
        except json.JSONDecodeError as e:
            return JSONResponse(status_code=400,
                                content={"success": False, "error": f"잘못된 JSON: {e}"})

        if not isinstance(blocks, list):
            blocks = []
        if not isinstance(fields, dict):
            fields = {}

        document_type = _safe_doc_type(document_type)

        # 1) 이미지 영구 저장
        _, image_url = _persist_image(file, document_type)

        # 2) NER 라벨 누적 (블록/필드가 비어 있으면 라벨은 생략, 이미지는 유지)
        count = 0
        if blocks and fields:
            count = _write_ner_label(document_type, image_url, blocks, fields)

        return JSONResponse(content={
            "success": True,
            "data": {"image_url": image_url, "count": count},
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.post("/ner-label")
async def save_ner_label(data: dict = Body(...)):
    """라벨만 누적하는 하위 호환 엔드포인트 (이미지 저장은 /commit 에서 수행).

    요청 body:
    {
        "document_type": "BUSINESS_CARD",
        "image_url": "/uploads/BUSINESS_CARD/xxx.jpg",
        "raw_blocks": [{"text": "...", "confidence": 0.99, ...}, ...],
        "corrected_fields": {"name": "이응환", "company_name": "우주관광(주)", ...}
    }
    """
    try:
        document_type = _safe_doc_type(data.get("document_type", "UNKNOWN"))
        image_url = data.get("image_url", "")
        raw_blocks = data.get("raw_blocks", [])
        corrected_fields = data.get("corrected_fields", {})

        if not raw_blocks or not corrected_fields:
            return JSONResponse(content={"success": False, "error": "raw_blocks와 corrected_fields 필요"})

        count = _write_ner_label(document_type, image_url, raw_blocks, corrected_fields)
        return JSONResponse(content={"success": True, "data": {"count": count}})

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
