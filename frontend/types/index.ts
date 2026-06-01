// Business card data shape from backend responses.
export interface BusinessCard {
  id?: string
  name: string
  company: string
  position: string
  phone: string
  email: string
  englishName?: string
  companyName?: string
  department?: string
  jobTitle?: string
  mobilePhone?: string
  officePhone?: string
  fax?: string
  address?: string
  website?: string
  zipCode?: string
  documentType?: DocumentType
  rawOcrText?: string
  raw_texts?: string[]
  imageUrl?: string
  groupId?: string | null
  createdAt?: string
  similarity?: number    // 검색 결과 유사도 (0~1)
}

export interface BusinessCardGroup {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

// 문서 종류
export type DocumentType = 'POSTER' | 'BUSINESS_CARD' | 'RECEIPT' | 'TICKET' | 'ETC'

export interface RawBlock {
  text: string
  confidence: number
  bbox: number[][]
  block_index: number
}

export interface OcrImageSize {
  width: number
  height: number
}

export interface ScanResult {
  type: DocumentType
  confidence: number
  parsed: Record<string, string>
  fields: Record<string, string>
  rawTexts: string[]
  rawBlocks: RawBlock[]
  imageUrl: string
  imageSize: OcrImageSize | null
}

export interface TicketResponse {
  id: string
  docType: string
  transportType: string
  departureLocation: string
  departureDate: string
  departureTime: string
  arrivalLocation: string
  arrivalDate: string
  arrivalTime: string
  rawText: string
  parsedJson: string
  rawJson: string
  imageUrl: string
  createdAt: string
  similarity?: number
}

export interface PosterResponse {
  id: string
  docType: string
  title: string
  organizerName: string
  eventStartDate: string
  eventEndDate: string
  contactPhone: string
  contactEmail: string
  location: string
  fee: string
  websiteUrl: string
  description: string
  rawText: string
  parsedJson: string
  rawJson: string
  imageUrl: string
  createdAt: string
  similarity?: number
}

export interface ReceiptResponse {
  id: number
  userId: string
  docType: string
  merchantName: string
  merchantAddress: string
  purchaseDate: string
  purchaseTime: string
  paymentMethod: string
  cardCompany: string
  totalAmount: number | string
  currencyCode: string
  rawText: string
  parsedJson: string
  rawJson: string
  createdAt: string
  similarity?: number
}

export type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string }
