// 명함 데이터 인터페이스 — 백엔드(Spring Boot) 응답 필드명과 동일하게 camelCase 사용
export interface BusinessCard {
  id?: string
  name: string
  company: string
  position: string
  phone: string
  email: string
  rawOcrText?: string
  raw_texts?: string[]   // OCR 스캔 시 프론트에서만 사용 (Python OCR 원본 블록)
  imageUrl?: string
  createdAt?: string
  similarity?: number    // 검색 결과 유사도 (0~1)
}

// 문서 종류
export type DocumentType = 'POSTER' | 'BUSINESS_CARD' | 'RECEIPT' | 'TICKET' | 'ETC'

// OCR 스캔 결과 인터페이스
export interface ScanResult {
  type: DocumentType
  confidence: number
  parsed: Record<string, string>
  rawTexts: string[]
  imageUrl: string
}

// API 응답 타입 — 판별 유니온(discriminated union) 패턴
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string }
