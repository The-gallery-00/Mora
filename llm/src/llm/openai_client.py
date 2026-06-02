# openai_client.py — OpenAI gpt-4o-mini 클라이언트

import os

from langsmith import traceable
from openai import OpenAI

# 문서 타입별 한국어 설명 (프롬프트 내 컨텍스트 제목용)
DOCUMENT_TYPE_LABELS = {
    "BUSINESS_CARD": "명함",
    "TICKET": "티켓",
    "POSTER": "포스터",
    "RECEIPT": "영수증",
}

FIELD_LABELS = {
    "BUSINESS_CARD": {
        "name": "이름",
        "company": "회사",
        "position": "직책",
        "phone": "전화번호",
        "email": "이메일",
        # "rawOcrText": "OCR 원문",
        "createdAt": "등록일",
    },
    "TICKET": {
        "transportType": "교통수단",
        "departureLocation": "출발지",
        "departureDate": "출발일",
        "departureTime": "출발시간",
        "arrivalLocation": "도착지",
        "arrivalDate": "도착일",
        "arrivalTime": "도착시간",
        # "rawText": "OCR 원문",
        "createdAt": "등록일",
    },
    "POSTER": {
        "title": "제목",
        "organizerName": "주최",
        "eventStartDate": "시작일",
        "eventEndDate": "종료일",
        "contactPhone": "연락처",
        "contactEmail": "이메일",
        "location": "장소",
        "fee": "참가비",
        "websiteUrl": "웹사이트",
        "description": "설명",
        # "rawText": "OCR 원문",
        "createdAt": "등록일",
    },
    "RECEIPT": {
        "merchantName": "상호명",
        "merchantAddress": "주소",
        "purchaseDate": "구매일",
        "purchaseTime": "구매시간",
        "paymentMethod": "결제방법",
        "cardCompany": "카드사",
        "totalAmount": "총금액",
        "currencyCode": "통화",
        # "rawText": "OCR 원문",
        "createdAt": "등록일",
    },
}

EXCLUDED_FIELDS = {
    "id", "userId", "imageUrl", "image_url", "similarity",
    "docType", "classificationConfidence", "parsedJson", "rawJson",
}


class OpenAIClient:
    def __init__(self):
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"

    @traceable(name="GPT-4o-mini Generate")
    def generate(self, query: str, context_docs: list[dict], document_type: str) -> str:
        """
        검색된 문서들을 컨텍스트로 LLM 답변을 생성한다.

        Args:
            query:         사용자 질문
            context_docs:  하이브리드 검색으로 찾은 문서 목록
            document_type: 문서 타입 (BUSINESS_CARD | TICKET | POSTER)

        Returns:
            gpt-4o-mini가 생성한 자연어 답변 문자열
        """
        type_label = DOCUMENT_TYPE_LABELS.get(document_type, document_type)

        # 검색된 문서들을 번호 매긴 텍스트 블록으로 변환
        context_text = self._format_context(context_docs, document_type)

        user_message = (
            f"다음은 사용자의 {type_label} 데이터입니다.\n\n"
            f"{context_text}\n\n"
            f"위 데이터만을 참고하여 다음 질문에 답변해 주세요.\n"
            f"데이터에 없는 정보는 '해당 정보가 없습니다'라고 답하세요.\n"
            f"질문: {query}"
        )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": (
                    "당신은 사용자의 개인 문서 관리 어시스턴트입니다. "
                    "사용자가 저장한 명함, 티켓, 포스터, 영수증 데이터를 기반으로 질문에 답변합니다. "
                    "반드시 제공된 데이터만 참고하고, 데이터에 없는 내용은 추측하지 마세요. "
                    "답변은 간결하고 명확하게 한국어로 작성하세요. "
                    "답변은 자연스러운 문장(산문) 형식으로 작성하세요. 목록이나 기호(-,•)를 사용하지 마세요."
                )},
                {"role": "user", "content": user_message},
            ],
            temperature=0,      # 사실 기반 답변 — 일관된 출력
            max_tokens=1024,
        )

        return response.choices[0].message.content.strip()

    def _format_context(self, docs: list[dict], document_type: str) -> str:
        if not docs:
            return "관련 데이터가 없습니다."

        field_labels = FIELD_LABELS.get(document_type, {})
        lines = []
        for i, doc in enumerate(docs, start=1):
            lines.append(f"[{i}]")
            for key, value in doc.items():
                if key in EXCLUDED_FIELDS:
                    continue
                if key == "items" and document_type == "RECEIPT":
                    if value:
                        lines.append("  구매 품목:")
                        for j, item in enumerate(value, start=1):
                            name = item.get("itemName", "")
                            qty = item.get("quantity", "")
                            total = item.get("totalPrice", "")
                            lines.append(f"    {j}. {name} x{qty} = {total}원")
                    continue
                if key not in field_labels:
                    continue
                if value:
                    label = field_labels[key]
                    lines.append(f"  {label}: {value}")
            lines.append("")

        return "\n".join(lines).strip()
