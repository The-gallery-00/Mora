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

"""OCR router — POST /scan, POST /ner-label."""
import uuid
import hashlib
import shutil
import json
from pathlib import Path
from datetime import datetime

import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image

from fastapi import APIRouter, File, UploadFile, Body
from fastapi.responses import JSONResponse

# services.py에서 싱글톤으로 생성된 파이프라인과 파싱 스킬을 가져옴
from services import pipeline, parsing_skill
from src.classifier.field_schema import DOCUMENT_FIELDS, FIELD_LABELS_KO

router = APIRouter()

# 업로드 디렉토리 경로 설정 (프로젝트 루트/uploads)
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

# ===== 분류 모델 로드 (서버 시작 시 1회) =====
CLASSIFIER_PATH = Path(__file__).resolve().parent.parent / "models" / "image_classifier.pt"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

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


def classify_image(image_path: str) -> tuple[str, float]:
    """이미지를 분류하여 (document_type, confidence)를 반환."""
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
    print(f"[분류] {model_class} ({confidence:.4f}) → {document_type}")
    for i, cls in enumerate(MODEL_CLASSES):
        print(f"  {cls}: {probs[i]*100:.1f}%")

    return document_type, confidence


# NER 학습 데이터 저장 디렉토리
NER_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "ner_dataset"
NER_DATA_DIR.mkdir(parents=True, exist_ok=True)

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
    """이미지를 받아 중복 체크 → 분류 → OCR → 파싱 결과를 반환."""

    # 원본 확장자를 유지하면서 UUID 기반 고유 파일명 생성
    suffix = Path(file.filename).suffix
    img_name = f"{uuid.uuid4().hex}{suffix}"

    # 임시로 UPLOAD_DIR에 저장 (분류 후 이동)
    temp_path = UPLOAD_DIR / img_name
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # 중복 이미지 체크 (해시 기록만 하고 차단은 하지 않음)
    img_hash = _compute_image_hash(str(temp_path))
    hash_index = _load_hash_index()

    try:
        # Step 1: OCR 먼저 실행 (분류보다 선행)
        ocr_result = pipeline.run(str(temp_path))
        text_blocks = ocr_result.get("raw_blocks", [])

        # Step 2: OCR 텍스트로 티켓 감지 → 감지되면 ML 분류 스킵
        if _detect_ticket_from_ocr(text_blocks):
            document_type = "TICKET"
            confidence = 1.0
            print(f"[분류] 티켓 키워드 감지 → TICKET (ML 분류 스킵)")
        else:
            document_type, confidence = classify_image(str(temp_path))

        # 종류별 폴더로 이동
        type_dir = UPLOAD_DIR / document_type
        type_dir.mkdir(parents=True, exist_ok=True)
        img_path = type_dir / img_name
        shutil.move(str(temp_path), str(img_path))

        # Step 3: 텍스트 블록을 문서 종류에 맞게 파싱
        parsed_result = parsing_skill.execute(text_blocks, document_type=document_type)
        parsed = parsed_result["parsed"]

        fields = {
            ext: FIELD_LABELS_KO.get(ext, ext)
            for ext in DOCUMENT_FIELDS.get(document_type, {}).values()
        }

        # 해시 인덱스에 등록 (중복 방지)
        hash_index[img_hash] = {
            "filename": img_name,
            "type": document_type,
            "path": f"{document_type}/{img_name}",
        }
        _save_hash_index(hash_index)

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
        # 에러 시 임시 파일 정리
        if temp_path.exists():
            temp_path.unlink()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@router.post("/ner-label")
async def save_ner_label(data: dict = Body(...)):
    """
    사용자가 수정/확인한 OCR 결과를 NER 학습 데이터로 저장.

    프론트에서 "확인 & 저장" 시 이 엔드포인트도 호출하여
    OCR 원본 블록 + 사용자 수정 정답을 축적한다.

    요청 body:
    {
        "document_type": "BUSINESS_CARD",
        "image_url": "/uploads/BUSINESS_CARD/xxx.jpg",
        "raw_blocks": [{"text": "...", "confidence": 0.99, ...}, ...],
        "corrected_fields": {"name": "이응환", "company_name": "우주관광(주)", ...}
    }
    """
    try:
        document_type = data.get("document_type", "UNKNOWN")
        image_url = data.get("image_url", "")
        raw_blocks = data.get("raw_blocks", [])
        corrected_fields = data.get("corrected_fields", {})

        if not raw_blocks or not corrected_fields:
            return JSONResponse(content={"success": False, "error": "raw_blocks와 corrected_fields 필요"})

        # 문서 종류별 디렉토리
        type_dir = NER_DATA_DIR / document_type
        type_dir.mkdir(parents=True, exist_ok=True)

        # 파일명: 타임스탬프 기반
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        label_path = type_dir / f"{timestamp}.json"

        label_data = {
            "document_type": document_type,
            "image_url": image_url,
            "raw_blocks": [{"text": b["text"], "confidence": b.get("confidence", 0)} for b in raw_blocks],
            "corrected_fields": corrected_fields,
            "created_at": datetime.now().isoformat(),
        }

        with open(label_path, "w", encoding="utf-8") as f:
            json.dump(label_data, f, ensure_ascii=False, indent=2)

        # 현재 축적된 데이터 수 카운트
        count = len(list(type_dir.glob("*.json")))
        print(f"[NER] {document_type} 라벨 저장 ({count}건 축적)")

        return JSONResponse(content={"success": True, "data": {"count": count}})

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
