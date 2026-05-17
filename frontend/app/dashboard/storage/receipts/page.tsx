'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 가계부 (Receipts → Ledger) page — interim UI on mock data.
 * TODO: replace mock arrays with real API once /receipts endpoint ships.
 */

type LedgerType = 'INCOME' | 'EXPENSE'

interface LedgerRow {
  id: string
  type: LedgerType
  date: string         // YYYY.MM.DD (요일)
  category: string
  payment: string
  vendor: string
  amount: number       // positive numeric; sign rendered from type
  memo: string
  items?: { name: string; qty: number; unit: number }[]
}

const MOCK_ROWS: LedgerRow[] = [
  {
    id: 'r1', type: 'EXPENSE',
    date: '2026. 5. 16. (토)', category: '카페', payment: '신한카드',
    vendor: '스타벅스 강남R점', amount: 12500, memo: '아메리카노(R) 외 2건',
    items: [
      { name: '아메리카노 (R)', qty: 1, unit: 4500 },
      { name: '카페라떼 (R)',  qty: 1, unit: 5000 },
      { name: '플레인 크루아상', qty: 1, unit: 3000 },
    ],
  },
  {
    id: 'r2', type: 'EXPENSE',
    date: '2026. 5. 15. (금)', category: '식비', payment: '현금',
    vendor: 'GS25 역삼점', amount: 8400, memo: '도시락 + 음료',
  },
  {
    id: 'r3', type: 'INCOME',
    date: '2026. 5. 10. (일)', category: '용돈', payment: '계좌이체',
    vendor: '부모님', amount: 200000, memo: '5월 용돈',
  },
]

const C = {
  navy: '#15293D',
  border: '#CBD5E1',
  borderSoft: '#E2E8F0',
  text: '#334155',
  mute: '#64748B',
  faint: '#94A3B8',
  surface: '#F8FAFC',
  primary: '#3B82F6',
  income: '#16A34A',
  incomeSoft: '#DCFCE7',
  expense: '#DC2626',
  expenseSoft: '#FEE2E2',
}

const won = (n: number) => '₩ ' + n.toLocaleString('en-US')

export default function ReceiptsLedgerPage() {
  const router = useRouter()
  const [active, setActive] = useState<'all' | LedgerType>('all')
  const [drawerRow, setDrawerRow] = useState<LedgerRow | null>(null)

  const rows = useMemo(
    () => (active === 'all' ? MOCK_ROWS : MOCK_ROWS.filter(r => r.type === active)),
    [active],
  )

  const totals = useMemo(() => {
    let expense = 0, income = 0
    for (const r of MOCK_ROWS) {
      if (r.type === 'EXPENSE') expense += r.amount
      else income += r.amount
    }
    return { expense, income, budgetLeft: 2500000 - expense }
  }, [])

  return (
    <div style={{ padding: '40px 40px 80px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>가계부</h1>
        <button
          onClick={() => router.push('/dashboard/upload')}
          style={{
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: C.primary, color: '#FFF',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          등록하기
        </button>
      </header>

      {/* KPI cards */}
      <section
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16, marginBottom: 20,
        }}
      >
        <KPI label="이달 지출" value={won(totals.expense)} sub="지난달 대비 +8.2%" valueColor={C.expense} />
        <KPI label="이달 수입" value={won(totals.income)} sub={`예산 잔액 ${won(totals.budgetLeft)}`} valueColor={C.income} />
      </section>

      {/* Filter pills */}
      <section
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12, marginBottom: 20, flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <FilterPill label="전체" active={active === 'all'} onClick={() => setActive('all')} />
          <FilterPill label="지출" active={active === 'EXPENSE'} onClick={() => setActive('EXPENSE')} />
          <FilterPill label="수입" active={active === 'INCOME'} onClick={() => setActive('INCOME')} />
          <FilterPill label="카테고리: 전체" />
          <FilterPill label="결제수단: 전체" />
        </div>
        <FilterPill label="2026년 5월" />
      </section>

      {/* Ledger card */}
      <section
        style={{
          background: '#FFF', border: `1px solid ${C.borderSoft}`,
          borderRadius: 12, overflow: 'hidden',
        }}
      >
        <LedgerHeader />
        {rows.map(r => (
          <LedgerRowComp key={r.id} row={r} onClick={() => setDrawerRow(r)} />
        ))}
        {rows.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center', fontSize: 13, color: C.faint }}>
            해당 조건의 거래가 없습니다
          </div>
        )}
      </section>

      {/* Detail drawer */}
      {drawerRow && <DetailDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />}
    </div>
  )
}

/* ============== Sub components ============== */

function KPI({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor: string }) {
  return (
    <div
      style={{
        padding: '20px 24px', background: '#FFF',
        border: `1px solid ${C.borderSoft}`, borderRadius: 12,
      }}
    >
      <p style={{ fontSize: 12, color: C.faint, marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: valueColor }}>{value}</span>
        {sub && <span style={{ fontSize: 12, color: C.faint }}>{sub}</span>}
      </div>
    </div>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 8,
        background: active ? '#EFF6FF' : '#FFF',
        border: `1px solid ${active ? '#93C5FD' : C.borderSoft}`,
        color: active ? '#2563EB' : '#334155',
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {label} <span style={{ fontSize: 10, color: C.faint }}>▼</span>
    </button>
  )
}

function LedgerHeader() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '70px 140px 110px 120px 1fr 140px 1fr 60px',
        alignItems: 'center', gap: 16,
        padding: '10px 24px', background: C.surface,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: C.mute }}>분류</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.mute }}>날짜</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.mute }}>카테고리</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.mute }}>결제수단</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.mute }}>거래처</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.mute, textAlign: 'right' }}>금액</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.mute }}>메모</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.mute, textAlign: 'right' }}></span>
    </div>
  )
}

function LedgerRowComp({ row, onClick }: { row: LedgerRow; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const income = row.type === 'INCOME'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '70px 140px 110px 120px 1fr 140px 1fr 60px',
        alignItems: 'center', gap: 16,
        padding: '14px 24px', cursor: 'pointer',
        borderTop: `1px solid #F1F5F9`,
        background: hover ? C.surface : '#FFF',
        transition: 'background 0.12s',
      }}
    >
      <span>
        <span
          style={{
            display: 'inline-block', padding: '4px 8px', borderRadius: 4,
            background: income ? C.incomeSoft : C.expenseSoft,
            color: income ? '#166534' : '#991B1B',
            fontSize: 11, fontWeight: 600,
          }}
        >
          {income ? '수입' : '지출'}
        </span>
      </span>
      <span style={{ fontSize: 13, color: C.text }}>{row.date}</span>
      <span style={{ fontSize: 13, color: C.text }}>{row.category}</span>
      <span style={{ fontSize: 13, color: C.text }}>{row.payment}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{row.vendor}</span>
      <span
        style={{
          fontSize: 14, fontWeight: 600, textAlign: 'right',
          color: income ? C.income : C.expense,
        }}
      >
        {income ? '+ ' : '- '}{won(row.amount)}
      </span>
      <span style={{ fontSize: 13, color: C.mute }}>{row.memo}</span>
      <span style={{ fontSize: 16, color: C.faint, textAlign: 'right' }}>···</span>
    </div>
  )
}

function DetailDrawer({ row, onClose }: { row: LedgerRow; onClose: () => void }) {
  const income = row.type === 'INCOME'
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15, 23, 42, 0.32)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, height: '100%',
          background: '#FFF', borderLeft: `1px solid ${C.borderSoft}`,
          boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.08)',
          display: 'flex', flexDirection: 'column',
          animation: 'mora-slide-in 0.22s ease-out',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: `1px solid #F1F5F9`,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.navy, marginBottom: 4 }}>거래 상세</h2>
            <p style={{ fontSize: 12, color: C.faint }}>{row.date} · {row.category}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32, height: 32, borderRadius: 6, border: 'none',
              background: C.surface, color: C.mute, cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            ✕
          </button>
        </header>

        {/* Body — scrollable */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Hero */}
          <div
            style={{
              background: income ? C.incomeSoft : '#FEF2F2',
              border: `1px solid ${income ? '#BBF7D0' : '#FECACA'}`,
              borderRadius: 12, padding: 20,
            }}
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <Badge label={income ? '수입' : '지출'} bg={income ? C.incomeSoft : '#FECACA'} color={income ? '#166534' : '#991B1B'} />
              <Badge label={row.category} bg="#FFEDD5" color="#9A3412" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 10 }}>{row.vendor}</p>
            <p
              style={{
                fontSize: 28, fontWeight: 800,
                color: income ? C.income : C.expense,
              }}
            >
              {income ? '+ ' : '- '}{won(row.amount)}
            </p>
          </div>

          {/* Meta rows */}
          <div style={{ background: C.surface, borderRadius: 10, overflow: 'hidden' }}>
            <MetaRow k="날짜" v={row.date} />
            <MetaRow k="카테고리" v={row.category} />
            <MetaRow k="결제수단" v={row.payment} />
            <MetaRow k="거래처" v={row.vendor} />
            <MetaRow k="메모" v={row.memo} last />
          </div>

          {/* OCR purchase items */}
          {row.items && row.items.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>
                  구매 항목 <span style={{ color: C.faint, fontWeight: 400 }}>({row.items.length})</span>
                </span>
                <span
                  style={{
                    padding: '2px 8px', borderRadius: 4,
                    background: '#EFF6FF', color: '#2563EB',
                    fontSize: 10, fontWeight: 700,
                  }}
                >
                  OCR
                </span>
              </div>
              <div
                style={{
                  border: `1px solid ${C.borderSoft}`, borderRadius: 10,
                  overflow: 'hidden', background: '#FFF',
                }}
              >
                {/* Items header */}
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 36px 80px 80px',
                    gap: 8, padding: '10px 14px', background: C.surface,
                    fontSize: 11, fontWeight: 600, color: C.mute,
                  }}
                >
                  <span>상품</span>
                  <span style={{ textAlign: 'right' }}>수량</span>
                  <span style={{ textAlign: 'right' }}>단가</span>
                  <span style={{ textAlign: 'right' }}>소계</span>
                </div>
                {row.items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 36px 80px 80px',
                      gap: 8, padding: '10px 14px',
                      borderTop: idx > 0 ? `1px solid #F1F5F9` : 'none',
                      fontSize: 13, color: C.navy,
                    }}
                  >
                    <span>{it.name}</span>
                    <span style={{ textAlign: 'right', color: C.mute, fontSize: 12 }}>{it.qty}</span>
                    <span style={{ textAlign: 'right', color: C.mute, fontSize: 12 }}>{won(it.unit)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{won(it.unit * it.qty)}</span>
                  </div>
                ))}
                {/* Subtotal footer */}
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', background: '#FEF2F2',
                  }}
                >
                  <span style={{ fontSize: 12, color: C.mute, fontWeight: 600 }}>합계</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.expense }}>{won(row.amount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {/* TODO: open edit form */}}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 8,
                background: C.primary, color: '#FFF', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => {/* TODO: open delete confirm */}}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 8,
                background: '#FFF', color: C.text,
                border: `1px solid ${C.borderSoft}`,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </aside>

      {/* slide-in keyframes injected once per mount */}
      <style>{`
        @keyframes mora-slide-in {
          from { transform: translateX(24px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function MetaRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px',
        borderBottom: last ? 'none' : `1px solid ${C.borderSoft}`,
      }}
    >
      <span style={{ fontSize: 12, color: C.mute }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{v}</span>
    </div>
  )
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      style={{
        padding: '4px 8px', borderRadius: 4,
        background: bg, color, fontSize: 11, fontWeight: 600,
      }}
    >
      {label}
    </span>
  )
}
