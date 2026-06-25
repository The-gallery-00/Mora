import type {
  BusinessCard,
  BusinessCardGroup,
  ApiResponse,
  ScanResult,
  DocumentType,
  TicketResponse,
  PosterResponse,
  ReceiptResponse,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const OCR_BASE = process.env.NEXT_PUBLIC_OCR_URL || "http://localhost:8000";

export function getDocumentImageUrl(imageUrl?: string | null): string {
  if (!imageUrl) return "";

  if (
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("data:") ||
    imageUrl.startsWith("blob:")
  ) {
    return imageUrl;
  }

  return `${OCR_BASE}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

function getAuthHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("mora_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("mora_token");
  localStorage.removeItem("mora_user");
  window.dispatchEvent(new Event("mora-session-change"));
}

export type ChatDocumentType = Exclude<DocumentType, "ETC">;

export interface ChatResponseData {
  answer: string;
  sources: Record<string, unknown>[];
  query: string;
}

export async function sendChatMessage(
  query: string,
  documentType: ChatDocumentType,
  topK = 5,
): Promise<ApiResponse<ChatResponseData>> {
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        query,
        document_type: documentType,
        top_k: topK,
      }),
    });
    const json = await res.json().catch(() => null);

    if (res.status === 401) {
      clearAuthSession();
      return {
        success: false,
        error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      };
    }

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error:
          json?.error || `챗봇 답변을 불러오지 못했습니다. (${res.status})`,
      };
    }

    return {
      success: true,
      data: {
        answer: json.data?.answer || "",
        sources: Array.isArray(json.data?.sources) ? json.data.sources : [],
        query: json.data?.query || query,
      },
      message: json.message,
    };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 이미지 파일을 서버로 보내 분류 + OCR 수행 */
export async function scanImage(file: File): Promise<ApiResponse<ScanResult>> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/scan`, {
      method: "POST",
      body: formData,
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `서버 에러 (${res.status})`,
      };
    }

    // Spring 백엔드가 Python OCR 응답을 래핑한 구조를 고려해서 추출
    const inner = json.data?.data || json.data || {};
    const parsed = inner.parsed || json.data?.parsed || {};
    const fields = inner.fields || json.data?.fields || {};
    const raw = inner.raw_blocks || json.data?.raw_blocks || [];

    return {
      success: true,
      data: {
        type: inner.type || json.data?.type || "ETC",
        confidence: inner.confidence || json.data?.confidence || 0,
        parsed,
        fields,
        rawTexts: raw.map((b: { text: string }) => b.text),
        rawBlocks: raw,
        imageUrl: inner.image_url || json.data?.image_url || "",
        imageSize: inner.image_size || json.data?.image_size || null,
      },
    };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 이미지 파일을 서버로 보내 OCR 수행 (명함 전용, 하위 호환) */
export async function scanCard(file: File): Promise<ApiResponse<BusinessCard>> {
  const res = await scanImage(file);
  if (!res.success) return res;

  const { parsed, rawTexts, imageUrl } = res.data;
  return {
    success: true,
    data: {
      name: parsed.name || "",
      company: parsed.company_name || parsed.company || "",
      position: parsed.job_title || parsed.position || "",
      phone: parsed.mobile_phone || parsed.phone || "",
      email: parsed.email || "",
      raw_texts: rawTexts,
      imageUrl,
    },
  };
}

/**
 * 확인 & 저장 시점에만 호출. 원본 이미지를 OCR /commit 으로 재전송하여
 * uploads/{종류}/ 에 영구 저장하고 ner_dataset 라벨을 누적한 뒤 image_url 을 받는다.
 * (업로드/스캔 단계에서는 어떤 데이터도 누적되지 않는다.)
 */
export async function commitDocument(
  file: File,
  documentType: DocumentType,
  rawBlocks: { text: string; confidence: number }[] = [],
  correctedFields: Record<string, string> = {},
): Promise<ApiResponse<{ image_url: string; count: number }>> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);
    formData.append("raw_blocks", JSON.stringify(rawBlocks));
    formData.append("corrected_fields", JSON.stringify(correctedFields));

    const res = await fetch(`${OCR_BASE}/api/commit`, {
      method: "POST",
      body: formData,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `이미지 저장 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "OCR 서버에 연결할 수 없습니다." };
  }
}

/** 문서 데이터를 DB에 저장. 문서 종류에 따라 다른 엔드포인트로 분기 */
export async function saveCard(
  documentType: DocumentType,
  fields: Record<string, string>,
  imageUrl: string = "",
  rawTexts: string[] = [],
  rawBlocks: { text: string; confidence: number }[] = [],
  confidence: number = 0,
  file: File | null = null,
): Promise<ApiResponse<{ id: string }>> {
  try {
    const SUPPORTED: DocumentType[] = [
      "TICKET",
      "POSTER",
      "BUSINESS_CARD",
      "RECEIPT",
    ];
    if (!SUPPORTED.includes(documentType)) {
      return { success: false, error: "지원하지 않는 문서 유형입니다." };
    }

    // 확인&저장 확정 시점에만 이미지+라벨을 영구 저장하고 image_url 을 확보한다.
    if (file) {
      const committed = await commitDocument(
        file,
        documentType,
        rawBlocks,
        fields,
      );

      if (!committed.success) {
        return {
          success: false,
          error: committed.error || "이미지 저장에 실패했습니다.",
        };
      }

      imageUrl = committed.data?.image_url || "";

      if (!imageUrl) {
        return {
          success: false,
          error: "이미지 URL을 받지 못했습니다.",
        };
      }
    }

    let url: string;
    let body: Record<string, unknown>;

    if (documentType === "TICKET") {
      url = `${API_BASE}/api/tickets/save`;
      body = {
        docType: documentType,
        classificationConfidence: confidence,
        transportType: fields.transport_type || "",
        departureLocation: fields.departure_location || "",
        departureDate: fields.departure_date || "",
        departureTime: fields.departure_time || "",
        arrivalLocation: fields.arrival_location || "",
        arrivalDate: fields.arrival_date || "",
        arrivalTime: fields.arrival_time || "",
        rawText: rawTexts,
        parsedJson: JSON.stringify({ ...fields, imageUrl }),
        rawJson: JSON.stringify(rawBlocks),
      };
    } else if (documentType === "POSTER") {
      url = `${API_BASE}/api/posters/save`;
      body = {
        docType: documentType,
        classificationConfidence: confidence,
        title: fields.title || "",
        organizerName: fields.organizer_name || "",
        eventStartDate: fields.event_start_date || "",
        eventEndDate: fields.event_end_date || "",
        contactPhone: fields.contact_phone || "",
        contactEmail: fields.contact_email || "",
        location: fields.location || "",
        fee: fields.fee || "",
        websiteUrl: fields.website_url || "",
        description: fields.description || "",
        rawText: rawTexts,
        parsedJson: JSON.stringify({ ...fields, imageUrl }),
        rawJson: JSON.stringify(rawBlocks),
      };
    } else if (documentType === "BUSINESS_CARD") {
      url = `${API_BASE}/api/cards/save`;
      body = {
        imageUrl,
        rawOcrText: rawTexts.join("\n"),
        name: fields.name || "",
        company: fields.company_name || "",
        position: fields.job_title || "",
        phone: fields.mobile_phone || fields.contact_phone || "",
        email: fields.email || fields.contact_email || "",
      };
    } else if (documentType === "RECEIPT") {
      url = `${API_BASE}/api/receipts/save`;
      body = {
        docType: documentType,
        classificationConfidence: confidence,
        merchantName: fields.store_name || fields.merchant_name || "",
        merchantAddress: fields.merchant_address || fields.address || "",
        purchaseDate: fields.purchase_date || "",
        purchaseTime: fields.purchase_time || "",
        paymentMethod: fields.payment_method || "",
        cardCompany: fields.card_company || "",
        totalAmount: parseMoney(fields.total_amount),
        currencyCode: fields.currency_code || "KRW",
        rawText: rawTexts,
        parsedJson: JSON.stringify({ ...fields, imageUrl }),
        rawJson: JSON.stringify(rawBlocks),
        items: [],
      };
    } else {
      return { success: false, error: "지원하지 않는 문서 유형입니다." };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);

    if (res.status === 401) {
      clearAuthSession();
      return {
        success: false,
        error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      };
    }

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `저장 실패 (${res.status})`,
      };
    }

    // NER 라벨 누적 + 이미지 영구 저장은 위의 commitDocument(/commit)에서 이미 처리됨.
    return { success: true, data: json.data, message: json.message };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

function parseMoney(value?: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

/** 내 명함 목록 조회 */
export async function getMyCards(
  options: { groupId?: string | null; ungrouped?: boolean } = {},
): Promise<ApiResponse<BusinessCard[]>> {
  try {
    const params = new URLSearchParams();
    if (options.groupId) params.set("groupId", options.groupId);
    if (options.ungrouped) params.set("ungrouped", "true");
    const query = params.toString();
    const res = await fetch(
      `${API_BASE}/api/cards${query ? `?${query}` : ""}`,
      { headers: getAuthHeaders() },
    );
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `조회 실패 (${res.status})`,
      };
    }

    const rawCards = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.content)
        ? json.data.content
        : [];

    return { success: true, data: rawCards.map(normalizeBusinessCard) };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 명함 그룹 목록 조회 */
export async function getCardGroups(): Promise<
  ApiResponse<BusinessCardGroup[]>
> {
  try {
    const res = await fetch(`${API_BASE}/api/card-groups`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `그룹 조회 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data || [] };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 명함 그룹 추가 */
export async function createCardGroup(
  name: string,
): Promise<ApiResponse<BusinessCardGroup>> {
  try {
    const res = await fetch(`${API_BASE}/api/card-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `그룹 추가 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 명함 그룹 삭제. 그룹 내 명함은 미분류로 이동된다. */
export async function deleteCardGroup(
  groupId: string,
): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/api/card-groups/${groupId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `그룹 삭제 실패 (${res.status})`,
      };
    }
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 명함을 그룹으로 이동. groupId가 null이면 미분류로 이동된다. */
export async function moveCardToGroup(
  cardId: string,
  groupId: string | null,
): Promise<ApiResponse<BusinessCard>> {
  try {
    const res = await fetch(`${API_BASE}/api/cards/${cardId}/group`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ groupId }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `그룹 이동 실패 (${res.status})`,
      };
    }
    return { success: true, data: normalizeBusinessCard(json.data) };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

function normalizeBusinessCard(
  card: BusinessCard & { createdAt?: string | number[] },
): BusinessCard {
  return {
    ...card,
    createdAt: normalizeDateTime(card.createdAt),
  };
}

function normalizeDateTime(value?: string | number[]): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  }
  return undefined;
}

/** 명함 삭제 */
export async function deleteCard(cardId: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/api/cards/${cardId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || "삭제 실패" };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 명함 수정 */
export async function updateCard(
  cardId: string,
  card: BusinessCard,
): Promise<ApiResponse<BusinessCard>> {
  try {
    const res = await fetch(`${API_BASE}/api/cards/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(card),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || "수정 실패" };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 티켓 삭제 */
export async function deleteTicket(
  ticketId: string,
): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || "삭제 실패" };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 포스터 삭제 */
export async function deletePoster(
  posterId: string,
): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/api/posters/${posterId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || "삭제 실패" };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 티켓 수정 */
export async function updateTicket(
  ticketId: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<TicketResponse>> {
  try {
    const res = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || "수정 실패" };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 포스터 수정 */
export async function updatePoster(
  posterId: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<PosterResponse>> {
  try {
    const res = await fetch(`${API_BASE}/api/posters/${posterId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || "수정 실패" };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 내 티켓 목록 조회 */
export async function getMyTickets(
  page = 0,
  size = 20,
): Promise<ApiResponse<TicketResponse[]>> {
  try {
    const res = await fetch(
      `${API_BASE}/api/tickets?page=${page}&size=${size}`,
      { headers: getAuthHeaders() },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `조회 실패 (${res.status})`,
      };
    }
    // Spring Page<> 응답: { content: [...], totalPages, ... }
    const items = Array.isArray(json.data)
      ? json.data
      : json.data?.content || [];
    return { success: true, data: items };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 내 포스터 목록 조회 */
export async function getMyPosters(
  page = 0,
  size = 20,
): Promise<ApiResponse<PosterResponse[]>> {
  try {
    const res = await fetch(
      `${API_BASE}/api/posters?page=${page}&size=${size}`,
      { headers: getAuthHeaders() },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `조회 실패 (${res.status})`,
      };
    }
    // Spring Page<> 응답: { content: [...], totalPages, ... }
    const items = Array.isArray(json.data)
      ? json.data
      : json.data?.content || [];
    return { success: true, data: items };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 내 계정 정보 조회 (provider 확인용) */
export async function getMe(): Promise<
  ApiResponse<{
    id: string;
    email: string;
    name: string;
    picture?: string;
    provider?: string;
    createdAt?: string | number[];
  }>
> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `조회 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 닉네임 변경 */
export async function changeName(
  name: string,
): Promise<
  ApiResponse<{
    id: string;
    email: string;
    name: string;
    picture?: string;
    provider?: string;
  }>
> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `변경 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 비밀번호 변경 (현재 비번 확인 후 새 비번 설정) */
export async function changePassword(
  current: string,
  next: string,
): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/auth/me/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const json = await res.json().catch(() => null);
    if (res.status === 429) {
      return {
        success: false,
        error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      };
    }
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `변경 실패 (${res.status})`,
      };
    }
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 회원 탈퇴 */
export async function deleteAccount(
  password?: string,
): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(password ? { password } : {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `회원 탈퇴 실패 (${res.status})`,
      };
    }
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** Google Calendar 연동 상태 조회 */
export async function getGoogleCalendarConnected(
  userId: string,
): Promise<ApiResponse<{ userId: string; connected: boolean }>> {
  try {
    const res = await fetch(
      `${API_BASE}/api/google-calendar/connected/${userId}`,
      { headers: getAuthHeaders() },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `조회 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** Google Calendar OAuth 시작 URL 조회 */
export async function getGoogleCalendarConnectUrl(): Promise<
  ApiResponse<{ url: string }>
> {
  try {
    const res = await fetch(`${API_BASE}/api/google-calendar/connect-url`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `연동 URL 조회 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** Google Calendar 연동 해제 */
export async function disconnectGoogleCalendar(
  userId: string,
): Promise<ApiResponse<{ userId: string; connected: boolean }>> {
  try {
    const res = await fetch(
      `${API_BASE}/api/google-calendar/tokens/${userId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      },
    );
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `연동 해제 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 검색 기록 전체 삭제 */
export async function clearSearchHistories(): Promise<ApiResponse<number>> {
  try {
    const res = await fetch(`${API_BASE}/api/search-histories`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `삭제 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data || 0 };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 내가 저장한 문서 데이터 전체 삭제 */
export async function deleteMyDocuments(): Promise<
  ApiResponse<{
    deletedBusinessCards: number;
    deletedTickets: number;
    deletedPosters: number;
    deletedReceipts: number;
    deletedSearchHistories: number;
    deletedGoogleCalendarMappings: number;
    deletedNotifications: number;
  }>
> {
  try {
    const res = await fetch(`${API_BASE}/api/me/documents`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `삭제 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
};

type PageResponse<T> = {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

export async function getNotifications(
  page = 0,
  size = 10,
): Promise<ApiResponse<PageResponse<NotificationItem>>> {
  try {
    const res = await fetch(
      `${API_BASE}/api/notifications?page=${page}&size=${size}`,
      {
        headers: getAuthHeaders(),
      },
    );
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      clearAuthSession();
      return {
        success: false,
        error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      };
    }
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `알림 조회 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

export async function getUnreadNotificationCount(): Promise<
  ApiResponse<number>
> {
  try {
    const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      clearAuthSession();
      return {
        success: false,
        error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      };
    }
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `알림 개수 조회 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data?.count || 0 };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<ApiResponse<NotificationItem>> {
  try {
    const res = await fetch(
      `${API_BASE}/api/notifications/${notificationId}/read`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
      },
    );
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      clearAuthSession();
      return {
        success: false,
        error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      };
    }
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `알림 읽음 처리 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

export async function markAllNotificationsAsRead(): Promise<
  ApiResponse<number>
> {
  try {
    const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      clearAuthSession();
      return {
        success: false,
        error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      };
    }
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `전체 읽음 처리 실패 (${res.status})`,
      };
    }
    return { success: true, data: json.data?.updatedCount || 0 };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

export async function deleteNotification(
  notificationId: string,
): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      clearAuthSession();
      return {
        success: false,
        error: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
      };
    }
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || `알림 삭제 실패 (${res.status})`,
      };
    }
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

/** 키워드로 명함 검색 */
export async function searchCards(
  query: string,
): Promise<ApiResponse<BusinessCard[]>> {
  const encoded = encodeURIComponent(query);
  return runSearch<BusinessCard>(
    `/api/cards/search?q=${encoded}&topK=50`,
    normalizeBusinessCard,
  );
}

/** 키워드로 티켓 검색 */
export async function searchTickets(
  query: string,
): Promise<ApiResponse<TicketResponse[]>> {
  const encoded = encodeURIComponent(query);
  return runSearch<TicketResponse>(
    `/api/tickets/search?q=${encoded}&topK=50`,
    normalizeTicketResponse,
  );
}

/** 키워드로 포스터 검색 */
export async function searchPosters(
  query: string,
): Promise<ApiResponse<PosterResponse[]>> {
  const encoded = encodeURIComponent(query);
  return runSearch<PosterResponse>(
    `/api/posters/search?q=${encoded}&topK=50`,
    normalizePosterResponse,
  );
}

async function runSearch<T>(
  path: string,
  normalizer?: (item: T) => T,
): Promise<ApiResponse<T[]>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success) {
      // 검색 실패 메시지는 백엔드 인코딩 이슈가 있어도 깨지지 않도록
      // 상태 코드 기반의 고정 문구를 우선 사용한다.
      return {
        success: false,
        error: `검색 결과를 불러오지 못했습니다. (${res.status})`,
      };
    }

    const rawItems = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.content)
        ? json.data.content
        : [];

    const items = normalizer
      ? rawItems.map((item: T) => normalizer(item))
      : rawItems;

    return { success: true, data: items };
  } catch {
    return { success: false, error: "백엔드 서버에 연결할 수 없습니다." };
  }
}

function normalizeTicketResponse(
  ticket: TicketResponse & { createdAt?: string | number[] },
): TicketResponse {
  return {
    ...ticket,
    createdAt: normalizeDateTime(ticket.createdAt) || "",
  };
}

function normalizePosterResponse(
  poster: PosterResponse & { createdAt?: string | number[] },
): PosterResponse {
  return {
    ...poster,
    createdAt: normalizeDateTime(poster.createdAt) || "",
  };
}

/** 영수증 수정 */
export async function updateReceipt(
  receiptId: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<ReceiptResponse>> {
  try {
    const res = await fetch(`${API_BASE}/api/receipts/${receiptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || "수정 실패" };
    }
    return { success: true, data: json.data };
  } catch {
    return { success: false, error: "서버 연결 실패" };
  }
}

/** 키워드로 영수증 검색 */
export async function searchReceipts(
  query: string,
): Promise<ApiResponse<ReceiptResponse[]>> {
  const encoded = encodeURIComponent(query);
  return runSearch<ReceiptResponse>(
    `/api/receipts/search?q=${encoded}&topK=50`,
    normalizeReceiptResponse,
  );
}

function normalizeReceiptResponse(
  receipt: ReceiptResponse & { createdAt?: string | number[] },
): ReceiptResponse {
  return {
    ...receipt,
    createdAt: normalizeDateTime(receipt.createdAt) || "",
  };
}
