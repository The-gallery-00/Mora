import type { BusinessCard, ApiResponse, ScanResult, DocumentType, TicketResponse, PosterResponse } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const OCR_BASE = process.env.NEXT_PUBLIC_OCR_URL || 'http://localhost:8000'

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mora_token') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** 이미지 파일을 서버에 보내 분류 + OCR 수행 */
export async function scanImage(file: File): Promise<ApiResponse<ScanResult>> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_BASE}/api/scan`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeaders(),
    })
    const json = await res.json().catch(() => null)

    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `서버 에러 (${res.status})` }
    }

    // Spring 백엔드가 Python OCR 응답을 한 번 더 감싸는 구조를 풀어서 추출
    const inner = json.data?.data || json.data || {}
    const parsed = inner.parsed || json.data?.parsed || {}
    const fields = inner.fields || json.data?.fields || {}
    const raw = inner.raw_blocks || json.data?.raw_blocks || []

    return {
      success: true,
      data: {
        type: inner.type || json.data?.type || 'ETC',
        confidence: inner.confidence || json.data?.confidence || 0,
        parsed,
        fields,
        rawTexts: raw.map((b: { text: string }) => b.text),
        rawBlocks: raw,
        imageUrl: inner.image_url || json.data?.image_url || '',
        imageSize: inner.image_size || json.data?.image_size || null,
      },
    }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 이미지 파일을 서버에 보내 OCR 수행 (명함 전용, 하위 호환) */
export async function scanCard(file: File): Promise<ApiResponse<BusinessCard>> {
  const res = await scanImage(file)
  if (!res.success) return res

  const { parsed, rawTexts, imageUrl } = res.data
  return {
    success: true,
    data: {
      name: parsed.name || '',
      company: parsed.company_name || parsed.company || '',
      position: parsed.job_title || parsed.position || '',
      phone: parsed.mobile_phone || parsed.phone || '',
      email: parsed.email || '',
      raw_texts: rawTexts,
      imageUrl,
    },
  }
}

/** 문서 데이터를 DB에 저장 — 문서 종류에 따라 다른 엔드포인트로 분기 */
export async function saveCard(
  documentType: DocumentType,
  fields: Record<string, string>,
  imageUrl: string = '',
  rawTexts: string[] = [],
  rawBlocks: { text: string; confidence: number }[] = [],
  confidence: number = 0,
): Promise<ApiResponse<{ id: string }>> {
  try {
    let url: string
    let body: Record<string, unknown>

    if (documentType === 'TICKET') {
      url = `${API_BASE}/api/tickets/save`
      body = {
        docType: documentType,
        classificationConfidence: confidence,
        transportType: fields.transport_type || '',
        departureLocation: fields.departure_location || '',
        departureDate: fields.departure_date || '',
        departureTime: fields.departure_time || '',
        arrivalLocation: fields.arrival_location || '',
        arrivalDate: fields.arrival_date || '',
        arrivalTime: fields.arrival_time || '',
        rawText: rawTexts,
        parsedJson: JSON.stringify({ ...fields, imageUrl }),
        rawJson: JSON.stringify(rawBlocks),
      }
    } else if (documentType === 'POSTER') {
      url = `${API_BASE}/api/posters/save`
      body = {
        docType: documentType,
        classificationConfidence: confidence,
        title: fields.title || '',
        organizerName: fields.organizer_name || '',
        eventStartDate: fields.event_start_date || '',
        eventEndDate: fields.event_end_date || '',
        contactPhone: fields.contact_phone || '',
        contactEmail: fields.contact_email || '',
        location: fields.location || '',
        fee: fields.fee || '',
        websiteUrl: fields.website_url || '',
        description: fields.description || '',
        rawText: rawTexts,
        parsedJson: JSON.stringify({ ...fields, imageUrl }),
        rawJson: JSON.stringify(rawBlocks),
      }
    } else if (documentType === 'BUSINESS_CARD') {
      url = `${API_BASE}/api/cards/save`
      body = {
        imageUrl,
        rawOcrText: rawTexts.join('\n'),
        name: fields.name || '',
        company: fields.company_name || '',
        position: fields.job_title || '',
        phone: fields.mobile_phone || fields.contact_phone || '',
        email: fields.email || fields.contact_email || '',
      }
    } else if (documentType === 'RECEIPT') {
      url = `${API_BASE}/api/receipts/save`
      body = {
        docType: documentType,
        classificationConfidence: confidence,
        merchantName: fields.store_name || fields.merchant_name || '',
        merchantAddress: fields.merchant_address || fields.address || '',
        purchaseDate: fields.purchase_date || '',
        purchaseTime: fields.purchase_time || '',
        paymentMethod: fields.payment_method || '',
        cardCompany: fields.card_company || '',
        totalAmount: parseMoney(fields.total_amount),
        currencyCode: fields.currency_code || 'KRW',
        rawText: rawTexts,
        parsedJson: JSON.stringify({ ...fields, imageUrl }),
        rawJson: JSON.stringify(rawBlocks),
        items: [],
      }
    } else {
      return { success: false, error: '저장할 수 없는 문서 유형입니다.' }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)

    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `저장 실패 (${res.status})` }
    }

    // NER 학습 데이터 축적 (비동기, 실패해도 무시)
    fetch(`${OCR_BASE}/api/ner-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: documentType,
        image_url: imageUrl,
        raw_blocks: rawBlocks,
        corrected_fields: fields,
      }),
    }).catch(() => {})

    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

function parseMoney(value?: string): number | null {
  if (!value) return null
  const normalized = value.replace(/[^\d.-]/g, '')
  if (!normalized) return null
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

/** 내 명함 목록 조회 */
export async function getMyCards(): Promise<ApiResponse<BusinessCard[]>> {
  try {
    const res = await fetch(`${API_BASE}/api/cards`, { headers: getAuthHeaders() })
    const json = await res.json().catch(() => null)

    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `조회 실패 (${res.status})` }
    }

    const rawCards = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.content)
        ? json.data.content
        : []

    return { success: true, data: rawCards.map(normalizeBusinessCard) }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

function normalizeBusinessCard(card: BusinessCard & { createdAt?: string | number[] }): BusinessCard {
  return {
    ...card,
    createdAt: normalizeDateTime(card.createdAt),
  }
}

function normalizeDateTime(value?: string | number[]): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
  }
  return undefined
}

/** 명함 삭제 */
export async function deleteCard(cardId: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/api/cards/${cardId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || '삭제 실패' }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '서버 연결 실패' }
  }
}

/** 명함 수정 */
export async function updateCard(cardId: string, card: BusinessCard): Promise<ApiResponse<BusinessCard>> {
  try {
    const res = await fetch(`${API_BASE}/api/cards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(card),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || '수정 실패' }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '서버 연결 실패' }
  }
}

/** 티켓 삭제 */
export async function deleteTicket(ticketId: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || '삭제 실패' }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '서버 연결 실패' }
  }
}

/** 포스터 삭제 */
export async function deletePoster(posterId: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/api/posters/${posterId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || '삭제 실패' }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '서버 연결 실패' }
  }
}

/** 티켓 수정 */
export async function updateTicket(ticketId: string, body: Record<string, unknown>): Promise<ApiResponse<TicketResponse>> {
  try {
    const res = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || '수정 실패' }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '서버 연결 실패' }
  }
}

/** 포스터 수정 */
export async function updatePoster(posterId: string, body: Record<string, unknown>): Promise<ApiResponse<PosterResponse>> {
  try {
    const res = await fetch(`${API_BASE}/api/posters/${posterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || '수정 실패' }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '서버 연결 실패' }
  }
}

/** 내 티켓 목록 조회 */
export async function getMyTickets(page = 0, size = 20): Promise<ApiResponse<TicketResponse[]>> {
  try {
    const res = await fetch(`${API_BASE}/api/tickets?page=${page}&size=${size}`, { headers: getAuthHeaders() })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `조회 실패 (${res.status})` }
    }
    // Spring Page<> 응답: { content: [...], totalPages, ... }
    const items = Array.isArray(json.data) ? json.data : (json.data?.content || [])
    return { success: true, data: items }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 내 포스터 목록 조회 */
export async function getMyPosters(page = 0, size = 20): Promise<ApiResponse<PosterResponse[]>> {
  try {
    const res = await fetch(`${API_BASE}/api/posters?page=${page}&size=${size}`, { headers: getAuthHeaders() })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `조회 실패 (${res.status})` }
    }
    // Spring Page<> 응답: { content: [...], totalPages, ... }
    const items = Array.isArray(json.data) ? json.data : (json.data?.content || [])
    return { success: true, data: items }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 내 계정 정보 조회 (provider 확인용) */
export async function getMe(): Promise<ApiResponse<{ id: string; email: string; name: string; picture?: string; provider?: string; createdAt?: string | number[] }>> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `조회 실패 (${res.status})` }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 닉네임 변경 */
export async function changeName(name: string): Promise<ApiResponse<{ id: string; email: string; name: string; picture?: string; provider?: string }>> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `변경 실패 (${res.status})` }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 비밀번호 변경 (현재 비번 확인 후 새 비번 설정) */
export async function changePassword(current: string, next: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/auth/me/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const json = await res.json().catch(() => null)
    if (res.status === 429) {
      return { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }
    }
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `변경 실패 (${res.status})` }
    }
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 회원 탈퇴 */
export async function deleteAccount(password?: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(password ? { password } : {}),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `회원 탈퇴 실패 (${res.status})` }
    }
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** Google Calendar 연동 상태 조회 */
export async function getGoogleCalendarConnected(userId: string): Promise<ApiResponse<{ userId: string; connected: boolean }>> {
  try {
    const res = await fetch(`${API_BASE}/api/google-calendar/connected/${userId}`, { headers: getAuthHeaders() })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `조회 실패 (${res.status})` }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** Google Calendar OAuth 시작 URL 조회 */
export async function getGoogleCalendarConnectUrl(): Promise<ApiResponse<{ url: string }>> {
  try {
    const res = await fetch(`${API_BASE}/api/google-calendar/connect-url`, { headers: getAuthHeaders() })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `연동 URL 조회 실패 (${res.status})` }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** Google Calendar 연동 해제 */
export async function disconnectGoogleCalendar(userId: string): Promise<ApiResponse<{ userId: string; connected: boolean }>> {
  try {
    const res = await fetch(`${API_BASE}/api/google-calendar/tokens/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `연동 해제 실패 (${res.status})` }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 검색 기록 전체 삭제 */
export async function clearSearchHistories(): Promise<ApiResponse<number>> {
  try {
    const res = await fetch(`${API_BASE}/api/search-histories`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `삭제 실패 (${res.status})` }
    }
    return { success: true, data: json.data || 0 }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 내가 저장한 문서 데이터 전체 삭제 */
export async function deleteMyDocuments(): Promise<ApiResponse<{
  deletedBusinessCards: number
  deletedTickets: number
  deletedPosters: number
  deletedReceipts: number
  deletedSearchHistories: number
  deletedGoogleCalendarMappings: number
}>> {
  try {
    const res = await fetch(`${API_BASE}/api/me/documents`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `삭제 실패 (${res.status})` }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 키워드로 명함 검색 */
export async function searchCards(query: string): Promise<ApiResponse<BusinessCard[]>> {
  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
    })
    const json = await res.json().catch(() => null)

    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `검색 실패 (${res.status})` }
    }
    return { success: true, data: json.data || [] }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}
