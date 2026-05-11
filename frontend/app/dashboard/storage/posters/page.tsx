'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMyPosters, deletePoster } from '@/lib/api'
import type { PosterResponse } from '@/types'

export default function StoragePostersPage() {
  const router = useRouter()
  const [posters, setPosters] = useState<PosterResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPoster, setSelectedPoster] = useState<PosterResponse | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      setIsLoading(true)
      const res = await getMyPosters(0, 100)
      if (res.success) setPosters(res.data)
      setIsLoading(false)
    }
    fetch()
  }, [])

  async function handleDelete(id: string) {
    const res = await deletePoster(id)
    if (res.success) {
      setPosters(prev => prev.filter(p => p.id !== id))
      if (selectedPoster?.id === id) setSelectedPoster(null)
    }
    setDeleteTargetId(null)
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#15293D' }}>
          포스터 ({posters.length})
        </h1>
        <button
          onClick={() => router.push('/dashboard/upload')}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: '#0077B6', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          등록하기
        </button>
      </div>

      {isLoading && <p style={{ color: '#999', fontSize: 14, textAlign: 'center', padding: '60px 0' }}>불러오는 중...</p>}

      {!isLoading && posters.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', borderRadius: 12, border: '1px solid #CBD5E1' }}>
          <p style={{ fontSize: 14, color: '#999' }}>아직 저장된 포스터가 없습니다</p>
        </div>
      )}

      {!isLoading && posters.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posters.map(p => (
            <div
              key={p.id}
              onClick={() => setSelectedPoster(selectedPoster?.id === p.id ? null : p)}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                alignItems: 'center', gap: 16,
                padding: '16px 20px', borderRadius: 12,
                border: selectedPoster?.id === p.id ? '1px solid #0077B6' : '1px solid #CBD5E1',
                background: selectedPoster?.id === p.id ? '#F0F9FF' : '#FFFFFF',
                cursor: 'pointer', transition: 'all 0.1s',
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#15293D' }}>
                  {p.title || '-'}
                </p>
                <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  {p.organizerName || ''}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#999' }}>장소</p>
                <p style={{ fontSize: 13, color: '#333', marginTop: 2 }}>{p.location || '-'}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#999' }}>기간</p>
                <p style={{ fontSize: 13, color: '#333', marginTop: 2 }}>
                  {p.eventStartDate || '-'} ~ {p.eventEndDate || ''}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: '#999' }}>
                  {p.createdAt ? new Date(p.createdAt).toLocaleDateString('ko-KR') : ''}
                </p>
              </div>

              {deleteTargetId === p.id ? (
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleDelete(p.id)} style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none',
                    background: '#DC2626', color: '#FFF', fontSize: 12, cursor: 'pointer',
                  }}>삭제</button>
                  <button onClick={() => setDeleteTargetId(null)} style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid #CBD5E1',
                    background: '#FFF', color: '#505050', fontSize: 12, cursor: 'pointer',
                  }}>취소</button>
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); setDeleteTargetId(p.id) }}
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: '1px solid #E2E8F0',
                    background: '#FFF', color: '#999', fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedPoster && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelectedPoster(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{
            position: 'relative', width: 400, height: '100%', background: '#FFF',
            borderLeft: '1px solid #CBD5E1', padding: 28, overflowY: 'auto',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#15293D' }}>포스터 상세</h2>
              <button onClick={() => setSelectedPoster(null)} style={{
                width: 32, height: 32, borderRadius: '50%', border: '1px solid #CBD5E1',
                background: '#FFF', cursor: 'pointer', fontSize: 14, color: '#999',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
            {[
              { label: '제목', value: selectedPoster.title },
              { label: '주최자', value: selectedPoster.organizerName },
              { label: '시작일', value: selectedPoster.eventStartDate },
              { label: '종료일', value: selectedPoster.eventEndDate },
              { label: '장소', value: selectedPoster.location },
              { label: '연락처', value: selectedPoster.contactPhone },
              { label: '이메일', value: selectedPoster.contactEmail },
              { label: '참가비', value: selectedPoster.fee },
              { label: '웹사이트', value: selectedPoster.websiteUrl },
              { label: '설명', value: selectedPoster.description },
            ].map(f => (
              <div key={f.label} style={{ padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                <p style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{f.label}</p>
                <p style={{ fontSize: 14, color: '#333', whiteSpace: 'pre-wrap' }}>{f.value || '-'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
