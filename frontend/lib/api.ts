import type { BusinessCard, ApiResponse, ScanResult } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

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
    const raw = inner.raw_blocks || json.data?.raw_blocks || []

    return {
      success: true,
      data: {
        type: inner.type || json.data?.type || 'ETC',
        confidence: inner.confidence || json.data?.confidence || 0,
        parsed,
        rawTexts: raw.map((b: { text: string }) => b.text),
        imageUrl: inner.image_url || json.data?.image_url || '',
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
      company: parsed.company || '',
      position: parsed.position || '',
      phone: parsed.phone || parsed.fax || '',
      email: parsed.email || '',
      raw_texts: rawTexts,
      imageUrl,
    },
  }
}

/** 명함 데이터를 DB에 저장 */
export async function saveCard(card: BusinessCard, imageUrl: string = ''): Promise<ApiResponse<{ id: string }>> {
  try {
    const res = await fetch(`${API_BASE}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        name: card.name,
        company: card.company,
        position: card.position,
        phone: card.phone,
        email: card.email,
        imageUrl,
      }),
    })
    const json = await res.json().catch(() => null)

    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `저장 실패 (${res.status})` }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}

/** 내 명함 목록 조회 */
export async function getMyCards(): Promise<ApiResponse<BusinessCard[]>> {
  try {
    const res = await fetch(`${API_BASE}/api/cards`, { headers: getAuthHeaders() })
    const json = await res.json().catch(() => null)

    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || `조회 실패 (${res.status})` }
    }
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
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
    // 백엔드 ApiResponse는 data 필드로 감싸서 반환
    return { success: true, data: json.data || [] }
  } catch {
    return { success: false, error: '백엔드 서버에 연결할 수 없습니다.' }
  }
}
