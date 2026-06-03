'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, FileText, FolderTree, Search, ScanText } from 'lucide-react'
import StorageDrawer, { type StorageDrawerField } from '@/components/dashboard/storage/StorageDrawer'
import {
  searchCards,
  searchPosters,
  searchTickets,
  updateCard,
  updatePoster,
  updateTicket,
} from '@/lib/api'
import type { BaseItem } from '@/types/storage'
import type { BusinessCard, PosterResponse, ReceiptResponse, TicketResponse } from '@/types'

type SearchType = 'BUSINESS_CARD' | 'POSTER' | 'RECEIPT' | 'TICKET'
type SortKey = 'latest' | 'relevance'
type SearchRaw = BusinessCard | TicketResponse | PosterResponse | ReceiptResponse
type EditDraft = Partial<Record<string, string>>

type ResultItem = {
  id: string
  type: SearchType
  title: string
  subtitle?: string
  imageUrl?: string
  createdAt?: string | number[]
  similarity?: number
  facts: Array<{ label: string; value: string }>
  preview: string
  raw: SearchRaw
}

const C = {
  navy: '#15293D',
  text: '#334155',
  mute: '#64748B',
  faint: '#94A3B8',
  border: '#CBD5E1',
  borderSoft: '#E2E8F0',
  surface: '#F8FAFC',
  blueBg: '#EFF6FF',
  blueText: '#2563EB',
} as const

const TYPE_META: Record<SearchType, { label: string; icon: React.ReactNode }> = {
  BUSINESS_CARD: { label: '명함', icon: <FileText size={14} strokeWidth={1.8} /> },
  POSTER: { label: '포스터', icon: <FolderTree size={14} strokeWidth={1.8} /> },
  RECEIPT: { label: '영수증', icon: <ScanText size={14} strokeWidth={1.8} /> },
  TICKET: { label: '티켓', icon: <Calendar size={14} strokeWidth={1.8} /> },
}

const PAGE_SIZE = 10
const OCR_BASE = (process.env.NEXT_PUBLIC_OCR_URL || 'http://localhost:8000').replace(/\/+$/, '')

function isSearchType(value: string | null): value is SearchType {
  return value === 'BUSINESS_CARD' || value === 'POSTER' || value === 'RECEIPT' || value === 'TICKET'
}

function toStorageItemType(type: SearchType): BaseItem['type'] {
  if (type === 'BUSINESS_CARD') return 'card'
  if (type === 'POSTER') return 'poster'
  if (type === 'RECEIPT') return 'receipt'
  return 'ticket'
}

function formatDate(value: unknown): string {
  if (!value) return '-'

  if (Array.isArray(value) && value.length >= 3) {
    const yyyy = String(value[0])
    const mm = String(value[1]).padStart(2, '0')
    const dd = String(value[2]).padStart(2, '0')
    return `${yyyy}.${mm}.${dd}`
  }

  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[1]}.${m[2]}.${m[3]}`
  }

  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function toAbsImageUrl(raw?: string): string | undefined {
  if (!raw) return undefined
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${OCR_BASE}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function parseJsonObject(input?: string): Record<string, unknown> {
  if (!input) return {}
  try {
    const parsed = JSON.parse(input)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function formatAmount(amount: number | string | undefined): string {
  if (amount === undefined || amount === null || amount === '') return '-'
  const n = typeof amount === 'number' ? amount : Number(amount)
  if (Number.isNaN(n)) return String(amount)
  return n.toLocaleString('ko-KR')
}

function parseAmount(value: string): number | null {
  const normalized = value.replace(/[^\d.-]/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function highlightText(text: string, keyword: string) {
  if (!keyword) return text
  const lower = text.toLowerCase()
  const token = keyword.toLowerCase()
  const index = lower.indexOf(token)
  if (index < 0) return text

  const head = text.slice(0, index)
  const match = text.slice(index, index + keyword.length)
  const tail = text.slice(index + keyword.length)

  return (
    <>
      {head}
      <span style={{ color: C.blueText, fontWeight: 700 }}>{match}</span>
      {tail}
    </>
  )
}

function normalizeCard(card: BusinessCard): ResultItem {
  const preview = card.rawOcrText || `${card.name} / ${card.company} / ${card.position} / ${card.phone}`
  return {
    id: String(card.id || `${card.name}-${card.email}-${card.phone}`),
    type: 'BUSINESS_CARD',
    title: card.name || '-',
    subtitle: card.company || '',
    imageUrl: toAbsImageUrl(card.imageUrl),
    createdAt: card.createdAt,
    similarity: card.similarity,
    facts: [
      { label: '직함', value: card.position || '-' },
      { label: '회사', value: card.company || '-' },
      { label: '연락처', value: card.phone || '-' },
      { label: '이메일', value: card.email || '-' },
      { label: '저장일', value: formatDate(card.createdAt) },
    ],
    preview,
    raw: card,
  }
}

function normalizeTicket(ticket: TicketResponse): ResultItem {
  const parsed = parseJsonObject(ticket.parsedJson)
  const parsedImage = typeof parsed.imageUrl === 'string' ? parsed.imageUrl : ''
  const preview = ticket.rawText || `${ticket.transportType} / ${ticket.departureLocation} / ${ticket.arrivalLocation}`
  return {
    id: String(ticket.id),
    type: 'TICKET',
    title: `${ticket.departureLocation || '-'} -> ${ticket.arrivalLocation || '-'}`,
    subtitle: ticket.transportType || '',
    imageUrl: toAbsImageUrl(parsedImage),
    createdAt: ticket.createdAt,
    similarity: ticket.similarity,
    facts: [
      { label: '이동수단', value: ticket.transportType || '-' },
      { label: '출발지', value: ticket.departureLocation || '-' },
      { label: '출발일', value: ticket.departureDate || '-' },
      { label: '출발시간', value: ticket.departureTime || '-' },
      { label: '도착지', value: ticket.arrivalLocation || '-' },
      { label: '도착일', value: ticket.arrivalDate || '-' },
      { label: '도착시간', value: ticket.arrivalTime || '-' },
      { label: '저장일', value: formatDate(ticket.createdAt) },
    ],
    preview,
    raw: ticket,
  }
}

function normalizePoster(poster: PosterResponse): ResultItem {
  const parsed = parseJsonObject(poster.parsedJson)
  const parsedImage = typeof parsed.imageUrl === 'string' ? parsed.imageUrl : ''
  const preview = poster.rawText || `${poster.title} / ${poster.organizerName} / ${poster.location}`
  return {
    id: String(poster.id),
    type: 'POSTER',
    title: poster.title || '-',
    subtitle: poster.organizerName || '',
    imageUrl: toAbsImageUrl(parsedImage),
    createdAt: poster.createdAt,
    similarity: poster.similarity,
    facts: [
      { label: '주최', value: poster.organizerName || '-' },
      { label: '행사 시작일', value: poster.eventStartDate || '-' },
      { label: '행사 종료일', value: poster.eventEndDate || '-' },
      { label: '장소', value: poster.location || '-' },
      { label: '연락처', value: poster.contactPhone || '-' },
      { label: '이메일', value: poster.contactEmail || '-' },
      { label: '참가비', value: poster.fee || '-' },
      { label: '웹사이트', value: poster.websiteUrl || '-' },
      { label: '저장일', value: formatDate(poster.createdAt) },
    ],
    preview,
    raw: poster,
  }
}

function normalizeReceipt(receipt: ReceiptResponse): ResultItem {
  const parsed = parseJsonObject(receipt.parsedJson)
  const parsedImage = typeof parsed.imageUrl === 'string' ? parsed.imageUrl : ''
  const preview = receipt.rawText || `${receipt.merchantName} / ${receipt.totalAmount} / ${receipt.paymentMethod}`
  return {
    id: String(receipt.id),
    type: 'RECEIPT',
    title: receipt.merchantName || '-',
    subtitle: receipt.merchantAddress || '',
    imageUrl: toAbsImageUrl(parsedImage),
    createdAt: receipt.createdAt,
    similarity: receipt.similarity,
    facts: [
      { label: '상호명', value: receipt.merchantName || '-' },
      { label: '주소', value: receipt.merchantAddress || '-' },
      { label: '구매일', value: receipt.purchaseDate || '-' },
      { label: '구매시간', value: receipt.purchaseTime || '-' },
      { label: '결제수단', value: receipt.paymentMethod || '-' },
      { label: '카드사', value: receipt.cardCompany || '-' },
      { label: '총액', value: `${formatAmount(receipt.totalAmount)} ${receipt.currencyCode || 'KRW'}` },
      { label: '저장일', value: formatDate(receipt.createdAt) },
    ],
    preview,
    raw: receipt,
  }
}

function buildEditDraft(item: ResultItem): EditDraft {
  if (item.type === 'BUSINESS_CARD') {
    const raw = item.raw as BusinessCard
    return {
      name: raw.name || '',
      company: raw.company || '',
      position: raw.position || '',
      phone: raw.phone || '',
      email: raw.email || '',
    }
  }

  if (item.type === 'TICKET') {
    const raw = item.raw as TicketResponse
    return {
      transportType: raw.transportType || '',
      departureLocation: raw.departureLocation || '',
      departureDate: raw.departureDate || '',
      departureTime: raw.departureTime || '',
      arrivalLocation: raw.arrivalLocation || '',
      arrivalDate: raw.arrivalDate || '',
      arrivalTime: raw.arrivalTime || '',
    }
  }

  if (item.type === 'POSTER') {
    const raw = item.raw as PosterResponse
    return {
      title: raw.title || '',
      organizerName: raw.organizerName || '',
      eventStartDate: raw.eventStartDate || '',
      eventEndDate: raw.eventEndDate || '',
      location: raw.location || '',
      contactPhone: raw.contactPhone || '',
      contactEmail: raw.contactEmail || '',
      fee: raw.fee || '',
      websiteUrl: raw.websiteUrl || '',
      description: raw.description || '',
    }
  }

  const raw = item.raw as ReceiptResponse
  return {
    merchantName: raw.merchantName || '',
    merchantAddress: raw.merchantAddress || '',
    purchaseDate: raw.purchaseDate || '',
    purchaseTime: raw.purchaseTime || '',
    paymentMethod: raw.paymentMethod || '',
    cardCompany: raw.cardCompany || '',
    totalAmount: String(raw.totalAmount ?? ''),
    currencyCode: raw.currencyCode || 'KRW',
  }
}

function buildDrawerFields(item: ResultItem, isEditing: boolean, draft: EditDraft): StorageDrawerField[] {
  if (item.type === 'BUSINESS_CARD') {
    return [
      { key: 'name', label: '이름', value: isEditing ? draft.name : (item.raw as BusinessCard).name, editable: true },
      { key: 'company', label: '회사명', value: isEditing ? draft.company : (item.raw as BusinessCard).company, editable: true },
      { key: 'position', label: '직함', value: isEditing ? draft.position : (item.raw as BusinessCard).position, editable: true },
      { key: 'phone', label: '전화번호', value: isEditing ? draft.phone : (item.raw as BusinessCard).phone, editable: true },
      { key: 'email', label: '이메일', value: isEditing ? draft.email : (item.raw as BusinessCard).email, editable: true },
      { label: '저장일', value: formatDate(item.createdAt) },
      { label: 'OCR 원문', value: (item.raw as BusinessCard).rawOcrText || item.preview, multiline: true },
    ]
  }

  if (item.type === 'TICKET') {
    const raw = item.raw as TicketResponse
    return [
      { key: 'transportType', label: '이동수단', value: isEditing ? draft.transportType : raw.transportType, editable: true },
      { key: 'departureLocation', label: '출발지', value: isEditing ? draft.departureLocation : raw.departureLocation, editable: true },
      { key: 'departureDate', label: '출발일', value: isEditing ? draft.departureDate : raw.departureDate, editable: true },
      { key: 'departureTime', label: '출발시간', value: isEditing ? draft.departureTime : raw.departureTime, editable: true },
      { key: 'arrivalLocation', label: '도착지', value: isEditing ? draft.arrivalLocation : raw.arrivalLocation, editable: true },
      { key: 'arrivalDate', label: '도착일', value: isEditing ? draft.arrivalDate : raw.arrivalDate, editable: true },
      { key: 'arrivalTime', label: '도착시간', value: isEditing ? draft.arrivalTime : raw.arrivalTime, editable: true },
      { label: '저장일', value: formatDate(item.createdAt) },
      { label: 'OCR 원문', value: raw.rawText || item.preview, multiline: true },
    ]
  }

  if (item.type === 'POSTER') {
    const raw = item.raw as PosterResponse
    return [
      { key: 'title', label: '제목', value: isEditing ? draft.title : raw.title, editable: true },
      { key: 'organizerName', label: '주최', value: isEditing ? draft.organizerName : raw.organizerName, editable: true },
      { key: 'eventStartDate', label: '행사 시작일', value: isEditing ? draft.eventStartDate : raw.eventStartDate, editable: true },
      { key: 'eventEndDate', label: '행사 종료일', value: isEditing ? draft.eventEndDate : raw.eventEndDate, editable: true },
      { key: 'location', label: '장소', value: isEditing ? draft.location : raw.location, editable: true },
      { key: 'contactPhone', label: '연락처', value: isEditing ? draft.contactPhone : raw.contactPhone, editable: true },
      { key: 'contactEmail', label: '이메일', value: isEditing ? draft.contactEmail : raw.contactEmail, editable: true },
      { key: 'fee', label: '참가비', value: isEditing ? draft.fee : raw.fee, editable: true },
      { key: 'websiteUrl', label: '웹사이트', value: isEditing ? draft.websiteUrl : raw.websiteUrl, editable: true },
      { key: 'description', label: '설명', value: isEditing ? draft.description : raw.description, editable: true, multiline: true },
      { label: '저장일', value: formatDate(item.createdAt) },
      { label: 'OCR 원문', value: raw.rawText || item.preview, multiline: true },
    ]
  }

  const raw = item.raw as ReceiptResponse
  return [
    { key: 'merchantName', label: '상호명', value: isEditing ? draft.merchantName : raw.merchantName, editable: true },
    { key: 'merchantAddress', label: '주소', value: isEditing ? draft.merchantAddress : raw.merchantAddress, editable: true },
    { key: 'purchaseDate', label: '구매일', value: isEditing ? draft.purchaseDate : raw.purchaseDate, editable: true },
    { key: 'purchaseTime', label: '구매시간', value: isEditing ? draft.purchaseTime : raw.purchaseTime, editable: true },
    { key: 'paymentMethod', label: '결제수단', value: isEditing ? draft.paymentMethod : raw.paymentMethod, editable: true },
    { key: 'cardCompany', label: '카드사', value: isEditing ? draft.cardCompany : raw.cardCompany, editable: true },
    { key: 'totalAmount', label: '총액', value: isEditing ? draft.totalAmount : String(raw.totalAmount ?? ''), editable: true },
    { key: 'currencyCode', label: '통화', value: isEditing ? draft.currencyCode : raw.currencyCode, editable: true },
    { label: '저장일', value: formatDate(item.createdAt) },
    { label: 'OCR 원문', value: raw.rawText || item.preview, multiline: true },
  ]
}

export default function SearchResultPage() {
  const searchParams = useSearchParams()
  const query = (searchParams.get('q') || '').trim()
  const selectedType: SearchType = isSearchType(searchParams.get('type'))
    ? (searchParams.get('type') as SearchType)
    : 'BUSINESS_CARD'

  const [items, setItems] = useState<ResultItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('latest')
  const [page, setPage] = useState(1)

  const [selectedItem, setSelectedItem] = useState<ResultItem | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({})

  function openDrawer(item: ResultItem | null) {
    setSelectedItem(item)
    setIsEditing(false)
    setIsSaving(false)
    setEditError(null)
    setEditDraft(item ? buildEditDraft(item) : {})
  }

  function startEdit() {
    if (!selectedItem) return
    setEditDraft(buildEditDraft(selectedItem))
    setIsEditing(true)
    setEditError(null)
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditError(null)
    setEditDraft(selectedItem ? buildEditDraft(selectedItem) : {})
  }

  async function saveEdit() {
    if (!selectedItem) return

    setIsSaving(true)
    setEditError(null)

    if (selectedItem.type === 'BUSINESS_CARD') {
      const raw = selectedItem.raw as BusinessCard
      const cardId = String(raw.id || selectedItem.id)
      const payload: BusinessCard = {
        ...raw,
        name: editDraft.name ?? raw.name,
        company: editDraft.company ?? raw.company,
        position: editDraft.position ?? raw.position,
        phone: editDraft.phone ?? raw.phone,
        email: editDraft.email ?? raw.email,
      }
      const res = await updateCard(cardId, payload)
      setIsSaving(false)
      if (!res.success) return setEditError(res.error || '수정 실패')
      const nextItem = normalizeCard(res.data)
      setItems((prev) => prev.map((it) => (it.type === nextItem.type && it.id === nextItem.id ? nextItem : it)))
      setSelectedItem(nextItem)
      setIsEditing(false)
      return
    }

    if (selectedItem.type === 'TICKET') {
      const raw = selectedItem.raw as TicketResponse
      const payload: Record<string, unknown> = {
        transportType: editDraft.transportType ?? raw.transportType,
        departureLocation: editDraft.departureLocation ?? raw.departureLocation,
        departureDate: editDraft.departureDate ?? raw.departureDate,
        departureTime: editDraft.departureTime ?? raw.departureTime,
        arrivalLocation: editDraft.arrivalLocation ?? raw.arrivalLocation,
        arrivalDate: editDraft.arrivalDate ?? raw.arrivalDate,
        arrivalTime: editDraft.arrivalTime ?? raw.arrivalTime,
      }
      const res = await updateTicket(String(raw.id), payload)
      setIsSaving(false)
      if (!res.success) return setEditError(res.error || '수정 실패')
      const nextItem = normalizeTicket(res.data)
      setItems((prev) => prev.map((it) => (it.type === nextItem.type && it.id === nextItem.id ? nextItem : it)))
      setSelectedItem(nextItem)
      setIsEditing(false)
      return
    }

    if (selectedItem.type === 'POSTER') {
      const raw = selectedItem.raw as PosterResponse
      const payload: Record<string, unknown> = {
        title: editDraft.title ?? raw.title,
        organizerName: editDraft.organizerName ?? raw.organizerName,
        eventStartDate: editDraft.eventStartDate ?? raw.eventStartDate,
        eventEndDate: editDraft.eventEndDate ?? raw.eventEndDate,
        location: editDraft.location ?? raw.location,
        contactPhone: editDraft.contactPhone ?? raw.contactPhone,
        contactEmail: editDraft.contactEmail ?? raw.contactEmail,
        fee: editDraft.fee ?? raw.fee,
        websiteUrl: editDraft.websiteUrl ?? raw.websiteUrl,
        description: editDraft.description ?? raw.description,
      }
      const res = await updatePoster(String(raw.id), payload)
      setIsSaving(false)
      if (!res.success) return setEditError(res.error || '수정 실패')
      const nextItem = normalizePoster(res.data)
      setItems((prev) => prev.map((it) => (it.type === nextItem.type && it.id === nextItem.id ? nextItem : it)))
      setSelectedItem(nextItem)
      setIsEditing(false)
      return
    }

    const raw = selectedItem.raw as ReceiptResponse
    const parsedAmount = parseAmount(editDraft.totalAmount ?? String(raw.totalAmount ?? ''))
    const payload: Record<string, unknown> = {
      merchantName: editDraft.merchantName ?? raw.merchantName,
      merchantAddress: editDraft.merchantAddress ?? raw.merchantAddress,
      purchaseDate: editDraft.purchaseDate ?? raw.purchaseDate,
      purchaseTime: editDraft.purchaseTime ?? raw.purchaseTime,
      paymentMethod: editDraft.paymentMethod ?? raw.paymentMethod,
      cardCompany: editDraft.cardCompany ?? raw.cardCompany,
      currencyCode: editDraft.currencyCode ?? raw.currencyCode,
      totalAmount: parsedAmount ?? raw.totalAmount,
    }
  }

  useEffect(() => {
    let alive = true

    async function run() {
      if (!query) {
        setItems([])
        setError(null)
        openDrawer(null)
        return
      }

      setIsLoading(true)
      setError(null)
      setPage(1)
      openDrawer(null)

      let next: ResultItem[] = []

      if (selectedType === 'BUSINESS_CARD') {
        const res = await searchCards(query)
        if (!alive) return
        if (!res.success) {
          setError(res.error)
          setItems([])
          setIsLoading(false)
          return
        }
        next = res.data.map(normalizeCard)
      } else if (selectedType === 'TICKET') {
        const res = await searchTickets(query)
        if (!alive) return
        if (!res.success) {
          setError(res.error)
          setItems([])
          setIsLoading(false)
          return
        }
        next = res.data.map(normalizeTicket)
      } else if (selectedType === 'POSTER') {
        const res = await searchPosters(query)
        if (!alive) return
        if (!res.success) {
          setError(res.error)
          setItems([])
          setIsLoading(false)
          return
        }
        next = res.data.map(normalizePoster)
      } 

      setItems(next)
      setIsLoading(false)
    }

    run()
    return () => {
      alive = false
    }
  }, [query, selectedType])

  const sorted = useMemo(() => {
    const copied = [...items]
    if (sortKey === 'relevance') {
      copied.sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      return copied
    }

    copied.sort((a, b) => {
      const ad = new Date(String(a.createdAt || '')).getTime()
      const bd = new Date(String(b.createdAt || '')).getTime()
      return (Number.isNaN(bd) ? 0 : bd) - (Number.isNaN(ad) ? 0 : ad)
    })
    return copied
  }, [items, sortKey])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const drawerItem: BaseItem | null = useMemo(() => {
    if (!selectedItem) return null
    return {
      id: selectedItem.id,
      type: toStorageItemType(selectedItem.type),
      title: selectedItem.title,
      imageUrl: selectedItem.imageUrl || '',
      createdAt: typeof selectedItem.createdAt === 'string' ? selectedItem.createdAt : formatDate(selectedItem.createdAt),
    }
  }, [selectedItem])

  const drawerFields = useMemo(() => {
    if (!selectedItem) return []
    return buildDrawerFields(selectedItem, isEditing, editDraft)
  }, [selectedItem, isEditing, editDraft])

  return (
    <div style={{ padding: '32px 40px 56px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, lineHeight: '48px', fontWeight: 800, color: C.navy, marginBottom: 10 }}>검색 결과</h1>
      <p style={{ fontSize: 15, color: C.mute, marginBottom: 20 }}>
        {TYPE_META[selectedType].label} 문서 중 "{query || '-'}" 관련된 결과를 찾았어요.
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Chip icon={TYPE_META[selectedType].icon} label={`유형 ${TYPE_META[selectedType].label}`} />
          <Chip icon={<Search size={14} strokeWidth={1.8} />} label={`검색어 ${query || '-'}`} />
          <Chip icon={<FileText size={14} strokeWidth={1.8} />} label={`총 ${sorted.length}개 결과`} />
        </div>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            height: 40,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            padding: '0 12px',
            color: C.text,
            background: '#FFF',
            fontSize: 14,
            outline: 'none',
          }}
        >
          <option value="latest">최신순</option>
          <option value="relevance">관련도순</option>
        </select>
      </div>

      {error && (
        <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', padding: 14, borderRadius: 12 }}>
          {error}
        </div>
      )}

      {isLoading && (
        <div style={{ border: `1px solid ${C.borderSoft}`, background: '#FFF', borderRadius: 14, padding: 22, color: C.mute }}>
          검색 중...
        </div>
      )}

      {!isLoading && !error && query && sorted.length === 0 && (
        <div style={{ border: `1px solid ${C.borderSoft}`, background: '#FFF', borderRadius: 14, padding: '48px 20px', textAlign: 'center', color: C.mute }}>
          조건에 맞는 결과가 없습니다.
        </div>
      )}

      {!isLoading && !error && paged.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {paged.map((item) => (
            <article
              key={`${item.type}-${item.id}`}
              style={{
                border: `1px solid ${C.borderSoft}`,
                background: '#FFF',
                borderRadius: 14,
                padding: 16,
                display: 'grid',
                gridTemplateColumns: '260px 1fr auto',
                gap: 18,
                alignItems: 'stretch',
              }}
            >
              <Preview item={item} />

              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 24, lineHeight: '40px', fontWeight: 800, color: C.navy, marginBottom: 6 }}>{item.title}</h3>
                {item.subtitle && <p style={{ fontSize: 14, color: C.mute, marginBottom: 10 }}>{item.subtitle}</p>}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginBottom: 10 }}>
                  {item.facts.map((f, idx) => (
                    <span key={idx} style={{ fontSize: 14, color: C.text }}>
                      <span style={{ color: C.mute }}>{f.label}</span> {f.value}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.borderSoft}`,
                    borderRadius: 10,
                    padding: '8px 10px',
                    color: C.mute,
                    fontSize: 14,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {highlightText(`"... ${item.preview} ..."`, query)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.blueText,
                    background: C.blueBg,
                    borderRadius: 6,
                    padding: '4px 8px',
                  }}
                >
                  {TYPE_META[item.type].label}
                </span>
                <button
                  type="button"
                  onClick={() => openDrawer(item)}
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    padding: '0 16px',
                    background: '#FFF',
                    color: C.text,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  상세보기
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!isLoading && !error && sorted.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <PageButton disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</PageButton>
          {Array.from({ length: totalPages }).map((_, idx) => {
            const n = idx + 1
            const active = n === currentPage
            return (
              <PageButton key={n} active={active} onClick={() => setPage(n)}>
                {n}
              </PageButton>
            )
          })}
          <PageButton disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</PageButton>
        </div>
      )}

      <StorageDrawer
        item={drawerItem}
        open={Boolean(selectedItem)}
        onClose={() => openDrawer(null)}
        title={selectedItem ? `${TYPE_META[selectedItem.type].label} 상세` : '상세'}
        fields={drawerFields}
        isEditing={isEditing}
        isSaving={isSaving}
        error={editError}
        onStartEdit={selectedItem ? startEdit : undefined}
        onCancelEdit={cancelEdit}
        onSaveEdit={saveEdit}
        onChangeField={(key, value) => setEditDraft((prev) => ({ ...prev, [key]: value }))}
      />
    </div>
  )
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 34,
        borderRadius: 9,
        border: `1px solid ${C.borderSoft}`,
        background: '#FFF',
        color: C.mute,
        padding: '0 10px',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {icon}
      {label}
    </span>
  )
}

function Preview({ item }: { item: ResultItem }) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.title}
        style={{
          width: '100%',
          height: 150,
          objectFit: 'cover',
          borderRadius: 10,
          border: `1px solid ${C.borderSoft}`,
          background: '#FFF',
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: 150,
        borderRadius: 10,
        border: `1px solid ${C.borderSoft}`,
        background: C.surface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
        color: C.faint,
      }}
    >
      {TYPE_META[item.type].icon}
      <span style={{ fontSize: 12, fontWeight: 600 }}>{TYPE_META[item.type].label}</span>
    </div>
  )
}

function PageButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        border: `1px solid ${active ? C.blueText : C.borderSoft}`,
        background: active ? '#EFF6FF' : '#FFF',
        color: active ? C.blueText : C.mute,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}
