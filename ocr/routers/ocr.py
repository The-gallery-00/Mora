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
# 2) 파일명을 UUID로 변환하여 uploads 디렉토리에 저장한다
# 3) pipeline.run()으로 OCR을 수행하여 텍스트 블록을 추출한다
# 4) parsing_skill.execute()로 텍스트 블록을 명함 필드로 분류한다
# 5) 파싱 결과, 원본 블록, 이미지 URL을 JSON으로 반환한다
# 6) 에러 발생 시 500 상태 코드와 에러 메시지를 반환한다
#
# [메서드 목록]
# - scan(file): POST /scan 엔드포인트.
#     업로드된 이미지를 저장 → OCR → 파싱 → 결과 반환
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

"""OCR router — POST /scan only."""
import time
import uuid
import shutil
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image, ImageOps

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

# services.py에서 lazy 생성되는 파이프라인과 파싱 스킬을 가져옴
from services import get_pipeline, parsing_skill
from src.classifier.field_schema import DOCUMENT_FIELDS, FIELD_LABELS_KO

router = APIRouter()

# 업로드 디렉토리 경로 설정 (프로젝트 루트/uploads)
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
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


@router.post("/scan")
async def scan(file: UploadFile = File(...)):
    """이미지를 받아 분류 → OCR → 파싱 결과를 반환."""
    request_id = uuid.uuid4().hex[:8]
    request_started_at = time.perf_counter()
    last_at = log_timing(request_id, "request_start", request_started_at)

    # 원본 확장자를 유지하면서 UUID 기반 고유 파일명 생성
    suffix = Path(file.filename).suffix or ".jpg"
    img_name = f"{uuid.uuid4().hex}{suffix}"

    # 임시로 UPLOAD_DIR에 저장 (분류 후 이동)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = UPLOAD_DIR / img_name
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    last_at = log_timing(request_id, "image_saved", request_started_at, last_at)

    image_info = normalize_uploaded_image(temp_path)
    print(
        f"[OCR:{request_id}] image_normalized resized={image_info['resized']} "
        f"original={image_info['original_size']} processed={image_info['processed_size']}",
        flush=True,
    )
    last_at = log_timing(request_id, "image_preprocessed", request_started_at, last_at)

    try:
        # 이미지 분류
        document_type, confidence = classify_image(str(temp_path))
        last_at = log_timing(request_id, "classification_done", request_started_at, last_at)

        # 종류별 폴더로 이동
        type_dir = UPLOAD_DIR / document_type
        type_dir.mkdir(parents=True, exist_ok=True)
        img_path = type_dir / img_name
        shutil.move(str(temp_path), str(img_path))
        last_at = log_timing(request_id, "image_moved", request_started_at, last_at)

        # OCR 파이프라인 실행 → 이미지에서 텍스트 블록 추출
        print(f"[OCR:{request_id}] engine_get_start", flush=True)
        pipeline = get_pipeline()
        last_at = log_timing(request_id, "engine_ready", request_started_at, last_at)

        print(f"[OCR:{request_id}] ocr_run_start", flush=True)
        ocr_result = pipeline.run(str(img_path))
        last_at = log_timing(request_id, "ocr_run_done", request_started_at, last_at)
        text_blocks = ocr_result.get("raw_blocks", [])

        # 텍스트 블록을 명함 필드(이름, 회사, 전화 등)로 분류/파싱
        parsed_result = parsing_skill.execute(text_blocks, document_type=document_type)
        parsed = parsed_result["parsed"]
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
                "fields": fields,
                "raw_blocks": text_blocks,
                "image_url": f"/uploads/{document_type}/{img_name}",
                "image_size": ocr_result.get("image_size"),
            }
        })
    except Exception as e:
        log_timing(request_id, f"request_failed error={e}", request_started_at, last_at)
        # 에러 시 임시 파일 정리
        if temp_path.exists():
            temp_path.unlink()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
