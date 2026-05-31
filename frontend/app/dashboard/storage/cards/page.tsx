'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMyCards, deleteCard, updateCard } from '@/lib/api'
import type { BusinessCard } from '@/types'

const IMAGE_BASE = process.env.NEXT_PUBLIC_OCR_URL || 'http://localhost:8000'

export default function StorageCardsPage() {
  const router = useRouter()
  const [cards, setCards] = useState<BusinessCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<BusinessCard | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<BusinessCard | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function openDrawer(card: BusinessCard | null) {
    setSelectedCard(card)
    setIsEditing(false)
    setEditDraft(null)
    setEditError(null)
  }

  function startEdit() {
    if (!selectedCard) return
    setEditDraft({ ...selectedCard })
    setIsEditing(true)
    setEditError(null)
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditDraft(null)
    setEditError(null)
  }

  async function saveEdit() {
    if (!editDraft?.id) return
    setIsSaving(true)
    setEditError(null)
    const res = await updateCard(editDraft.id, editDraft)
    setIsSaving(false)
    if (!res.success) {
      setEditError(res.error || '수정 실패')
      return
    }
    const updated = res.data!
    setCards(prev => prev.map(c => (c.id === updated.id ? updated : c)))
    setSelectedCard(updated)
    setIsEditing(false)
    setEditDraft(null)
  }

  useEffect(() => {
    async function fetchCards() {
      setIsLoading(true)
      const res = await getMyCards()
      if (res.success) {
        setCards(Array.isArray(res.data) ? res.data : [])
      }
      setIsLoading(false)
    }
    fetchCards()
  }, [])

  const sortedCards = [...cards].sort((a, b) => {
    const da = new Date(a.createdAt || 0).getTime()
    const db = new Date(b.createdAt || 0).getTime()
    return sortOrder === 'newest' ? db - da : da - db
  })

  async function handleDelete(id: string) {
    const res = await deleteCard(id)
    if (res.success) {
      setCards(prev => prev.filter(c => c.id !== id))
      if (selectedCard?.id === id) openDrawer(null)
    }
    setDeleteTargetId(null)
  }

  // 날짜별 그룹핑
  const groupedCards: Record<string, BusinessCard[]> = {}
  for (const card of sortedCards) {
    const dateKey = typeof card.createdAt === 'string' ? card.createdAt.split('T')[0] : '날짜 없음'
    if (!groupedCards[dateKey]) groupedCards[dateKey] = []
    groupedCards[dateKey].push(card)
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 24,
        minHeight: 'calc(100vh - 128px)',
      }}>
        {/* ── 왼쪽 사이드바 ── */}
        <div>
          <div style={{
            borderRadius: 12, border: '1px solid #CBD5E1', padding: '20px 16px',
            background: '#FFFFFF', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15293D" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#15293D' }}>내 명함</span>
            </div>
            <button
              onClick={() => router.push('/dashboard/upload')}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                border: 'none', background: '#0077B6', color: '#FFF',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              등록하기
            </button>
          </div>

          <div style={{
            borderRadius: 12, border: '1px solid #CBD5E1', padding: '16px',
            background: '#FFFFFF',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15293D" strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#15293D' }}>명함첩</span>
            </div>
            {['전체 명함', '회사', '거래처', '영업'].map((group, i) => (
              <button
                key={group}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', borderRadius: 6,
                  border: 'none', cursor: 'pointer',
                  background: i === 0 ? '#F0F9FF' : 'transparent',
                  color: i === 0 ? '#0077B6' : '#505050',
                  fontSize: 13, fontWeight: i === 0 ? 600 : 400,
                  marginBottom: 2,
                }}
              >
                {group}
              </button>
            ))}
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                marginTop: 8, border: 'none', background: 'transparent',
                color: '#0077B6', fontSize: 13, cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <span style={{ fontSize: 16 }}>+</span> 그룹 추가
            </button>
          </div>
        </div>

        {/* ── 오른쪽 명함 리스트 ── */}
        <div style={{
          borderRadius: 12, border: '1px solid #CBD5E1', padding: '24px 28px',
          background: '#FFFFFF',
        }}>
          {/* 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#15293D' }}>
              전체명함 ({cards.length})
            </h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                padding: '6px 14px', borderRadius: 6,
                border: '1px solid #CBD5E1', background: '#FFF',
                fontSize: 13, color: '#505050', cursor: 'pointer',
              }}>
                명함 관리
              </button>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: '1px solid #CBD5E1', background: '#FFF',
                  fontSize: 13, color: '#505050', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="newest">등록일 순</option>
                <option value="oldest">오래된 순</option>
              </select>
            </div>
          </div>

          {/* 로딩 */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#999', fontSize: 14 }}>
              불러오는 중...
            </div>
          )}

          {/* 빈 상태 */}
          {!isLoading && cards.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: 14, color: '#999' }}>아직 저장된 명함이 없습니다</p>
              <button
                onClick={() => router.push('/dashboard/upload')}
                style={{
                  marginTop: 16, padding: '10px 24px', borderRadius: 8,
                  border: 'none', background: '#0077B6', color: '#FFF',
                  fontSize: 14, cursor: 'pointer',
                }}
              >
                명함 스캔하기
              </button>
            </div>
          )}

          {/* 명함 리스트 (날짜별 그룹) */}
          {!isLoading && Object.entries(groupedCards).map(([dateKey, dateCards]) => (
            <div key={dateKey} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>{dateKey}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {dateCards.map(card => (
                  <div
                    key={card.id}
                    onClick={() => openDrawer(selectedCard?.id === card.id ? null : card)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                      alignItems: 'center',
                      gap: 16,
                      padding: '16px 12px',
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      background: selectedCard?.id === card.id ? '#F0F9FF' : 'transparent',
                      borderRadius: 8,
                      transition: 'background 0.1s',
                      position: 'relative',
                    }}
                  >
                    {/* 명함 이미지 또는 아이콘 */}
                    <div style={{
                      width: 72, height: 48, borderRadius: 6,
                      background: '#F1F5F9', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #E2E8F0',
                    }}>
                      {card.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.imageUrl.startsWith('http') ? card.imageUrl : `${IMAGE_BASE}${card.imageUrl}`}
                          alt={card.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                          <line x1="8" y1="18" x2="16" y2="18" />
                          <line x1="8" y1="20" x2="14" y2="20" />
                        </svg>
                      )}
                    </div>

                    {/* 이름 + 회사 */}
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#15293D' }}>
                        {card.name || '-'}
                      </p>
                      <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {card.company || '-'}
                      </p>
                    </div>

                    {/* 직책 + 부서 */}
                    <div>
                      <p style={{ fontSize: 13, color: '#333' }}>
                        {card.position || '-'}
                      </p>
                      <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {(card as unknown as Record<string, string>).department || '-'}
                      </p>
                    </div>

                    {/* 전화번호 */}
                    <div>
                      <p style={{ fontSize: 13, color: '#333' }}>
                        {card.phone || '-'}
                      </p>
                      {(card as unknown as Record<string, string>).officePhone && (
                        <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                          {(card as unknown as Record<string, string>).officePhone}
                        </p>
                      )}
                    </div>

                    {/* 이메일 */}
                    <p style={{ fontSize: 13, color: '#333' }}>
                      {card.email || '-'}
                    </p>

                    {/* 삭제 버튼 */}
                    {deleteTargetId === card.id ? (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                          display: 'flex', gap: 4,
                        }}
                      >
                        <button
                          onClick={() => handleDelete(card.id!)}
                          style={{
                            padding: '4px 10px', borderRadius: 4, border: 'none',
                            background: '#DC2626', color: '#FFF', fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          삭제
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(null)}
                          style={{
                            padding: '4px 10px', borderRadius: 4,
                            border: '1px solid #CBD5E1', background: '#FFF',
                            color: '#505050', fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTargetId(card.id!) }}
                        style={{
                          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                          width: 28, height: 28, borderRadius: 6,
                          border: '1px solid #E2E8F0', background: '#FFF',
                          color: '#999', fontSize: 13, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 상세 서랍 */}
      {selectedCard && (() => {
        const view = isEditing && editDraft ? editDraft : selectedCard
        const fields: Array<{ key: keyof BusinessCard; label: string; multiline?: boolean; editable?: boolean }> = [
          { key: 'name', label: '이름', editable: true },
          { key: 'company', label: '회사명', editable: true },
          { key: 'position', label: '직책', editable: true },
          { key: 'phone', label: '전화번호', editable: true },
          { key: 'email', label: '이메일', editable: true },
          { key: 'rawOcrText', label: 'OCR 원문', multiline: true, editable: false },
        ]
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', justifyContent: 'flex-end',
            }}
          >
            <div
              onClick={() => openDrawer(null)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
            />
            <div style={{
              position: 'relative', width: 420, height: '100%',
              background: '#FFFFFF', borderLeft: '1px solid #CBD5E1',
              padding: '28px 28px 28px 28px', overflowY: 'auto',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              <div style={{
                position: 'sticky', top: -28, marginTop: -28, marginLeft: -28, marginRight: -28,
                background: '#FFFFFF', padding: '20px 28px',
                borderBottom: '1px solid #F1F5F9', zIndex: 1,
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#15293D' }}>
                  {isEditing ? '명함 수정' : '명함 상세'}
                </h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!isEditing && (
                    <button
                      onClick={startEdit}
                      style={{
                        padding: '7px 14px', borderRadius: 6, border: 'none',
                        background: '#0077B6', color: '#FFF',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      수정
                    </button>
                  )}
                  <button
                    onClick={() => openDrawer(null)}
                    title="닫기"
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: '1px solid #CBD5E1', background: '#FFF',
                      cursor: 'pointer', fontSize: 14, color: '#999',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              </div>

              {selectedCard.imageUrl && (
                <div style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: '1px solid #E2E8F0',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedCard.imageUrl.startsWith('http') ? selectedCard.imageUrl : `${IMAGE_BASE}${selectedCard.imageUrl}`}
                    alt={selectedCard.name}
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: isEditing ? 14 : 0 }}>
                {fields.map(f => {
                  const raw = view[f.key] as string | undefined
                  const editable = isEditing && f.editable
                  return (
                    <div key={f.label} style={{
                      padding: isEditing ? 0 : '12px 0',
                      borderBottom: isEditing ? 'none' : '1px solid #F1F5F9',
                    }}>
                      <p style={{ fontSize: 11, color: '#999', marginBottom: editable ? 6 : 4 }}>{f.label}</p>
                      {editable && f.multiline ? (
                        <textarea
                          value={raw || ''}
                          onChange={e => setEditDraft(d => d && { ...d, [f.key]: e.target.value } as BusinessCard)}
                          rows={5}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: 6,
                            border: '1px solid #CBD5E1', background: '#FAFBFC',
                            fontSize: 14, color: '#333', outline: 'none',
                            resize: 'vertical', fontFamily: 'inherit',
                          }}
                        />
                      ) : editable ? (
                        <input
                          value={raw || ''}
                          onChange={e => setEditDraft(d => d && { ...d, [f.key]: e.target.value } as BusinessCard)}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: 6,
                            border: '1px solid #CBD5E1', background: '#FAFBFC',
                            fontSize: 14, color: '#333', outline: 'none',
                          }}
                        />
                      ) : (
                        <p style={{ fontSize: 14, color: '#333', whiteSpace: 'pre-wrap' }}>
                          {raw || '-'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {isEditing && (
                <>
                  {editError && (
                    <p style={{ fontSize: 12, color: '#DC2626' }}>{editError}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={cancelEdit}
                      disabled={isSaving}
                      style={{
                        padding: '10px 18px', borderRadius: 6,
                        border: '1px solid #CBD5E1', background: '#FFF',
                        color: '#333', fontSize: 13, fontWeight: 600,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      취소
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={isSaving}
                      style={{
                        padding: '10px 18px', borderRadius: 6, border: 'none',
                        background: '#0077B6', color: '#FFF',
                        fontSize: 13, fontWeight: 600,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      {isSaving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
