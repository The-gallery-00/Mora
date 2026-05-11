'use client'

import { useRouter } from 'next/navigation'

export default function StorageReceiptsPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#15293D' }}>영수증</h1>
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

      <div style={{
        textAlign: 'center', padding: '80px 0', borderRadius: 12,
        border: '1px solid #CBD5E1', background: '#FFFFFF',
      }}>
        <p style={{ fontSize: 14, color: '#999' }}>아직 저장된 영수증이 없습니다</p>
        <p style={{ fontSize: 12, color: '#CBD5E1', marginTop: 8 }}>
          영수증 전용 저장 API가 준비되면 연동됩니다
        </p>
      </div>
    </div>
  )
}
