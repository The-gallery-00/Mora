// ═══════════════════════════════════════════════════════════════
// app/page.tsx — Landing (clean AI SaaS layout)
// Hero → Stats → Features → How it works → Use cases → CTA → Footer
// ═══════════════════════════════════════════════════════════════

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/common/Nav'

const C = {
  navy: '#15293D',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  surface: '#F8FAFC',
  text: '#334155',
  mute: '#64748B',
  faint: '#94A3B8',
  primary: '#3B82F6',
  primaryDark: '#1D4ED8',
  ink: '#0F172A',
} as const

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', color: C.ink }}>
      <Nav />
      <main>
        <Hero />
        <StatsStrip />
        <ScrollPinnedShowcase />
        <FeatureGrid />
        <HowItWorks />
        <UseCases />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

/* ============== Hero ============== */

function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        padding: '120px 24px 80px',
        background:
          'radial-gradient(1200px 600px at 50% -10%, #EFF6FF 0%, transparent 60%), #FFFFFF',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <Eyebrow text="AI OCR · 문서 정리 자동화" />
        <h1
          style={{
            fontSize: 'clamp(36px, 5.6vw, 64px)',
            lineHeight: 1.12,
            fontWeight: 800,
            color: C.navy,
            letterSpacing: '-0.02em',
            margin: '20px auto 22px',
            maxWidth: 900,
          }}
        >
          쌓여만 가는 문서, <br />
          MORA가 한 번에 정리합니다.
        </h1>
        <p
          style={{
            fontSize: 'clamp(15px, 1.6vw, 18px)',
            lineHeight: 1.6,
            color: C.mute,
            maxWidth: 640,
            margin: '0 auto 36px',
          }}
        >
          명함·티켓·포스터·영수증을 사진 한 장으로 인식해서 자동 분류·검색·동기화까지.
          더 이상 사진첩을 뒤지지 마세요.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <PrimaryCTA href="/signup">무료로 시작하기</PrimaryCTA>
          <SecondaryCTA href="#how">사용법 보기</SecondaryCTA>
        </div>

        <p style={{ marginTop: 16, fontSize: 12, color: C.faint }}>
          신용카드 불필요 · 30초 가입 · OCR 분석 무제한
        </p>

        <ProductMockup />
      </div>
    </section>
  )
}

function Eyebrow({ text }: { text: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        background: '#EFF6FF',
        border: '1px solid #DBEAFE',
        color: C.primaryDark,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary }} />
      {text}
    </span>
  )
}

function PrimaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 22px',
        borderRadius: 12,
        background: C.navy,
        color: '#FFF',
        fontSize: 15,
        fontWeight: 700,
        textDecoration: 'none',
        boxShadow: '0 8px 16px rgba(15, 23, 42, 0.12)',
      }}
    >
      {children}
      <span style={{ fontSize: 16 }}>→</span>
    </Link>
  )
}

function SecondaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 22px',
        borderRadius: 12,
        background: '#FFFFFF',
        color: C.text,
        border: `1px solid ${C.borderStrong}`,
        fontSize: 15,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )
}

function ProductMockup() {
  return (
    <div
      style={{
        marginTop: 64,
        display: 'flex',
        gap: 32,
        justifyContent: 'center',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
      }}
    >
      <PhoneFrame tilt={-3} z={1}>
        <PhoneDashboard />
      </PhoneFrame>
      <PhoneFrame tilt={3} z={2}>
        <PhoneReceiptDetail />
      </PhoneFrame>
    </div>
  )
}

function PhoneFrame({ children, tilt = 0, z = 1 }: { children: React.ReactNode; tilt?: number; z?: number }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 300,
        height: 620,
        padding: 12,
        background: '#0F172A',
        borderRadius: 44,
        boxShadow:
          '0 30px 60px -20px rgba(15, 23, 42, 0.35), inset 0 0 0 2px rgba(255,255,255,0.06)',
        transform: `rotate(${tilt}deg)`,
        zIndex: z,
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 110,
          height: 26,
          background: '#0F172A',
          borderRadius: 14,
          zIndex: 3,
        }}
      />
      {/* Screen */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          borderRadius: 32,
          overflow: 'hidden',
          position: 'relative',
          textAlign: 'left',
        }}
      >
        {/* Status bar */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 44,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 28px',
            fontSize: 12,
            fontWeight: 700,
            color: C.navy,
            zIndex: 2,
          }}
        >
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
            <span>5G</span>
            <span>●●●●</span>
          </span>
        </div>
        <div style={{ paddingTop: 44, height: '100%', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function PhoneDashboard() {
  return (
    <div style={{ padding: '12px 16px', background: '#FAFBFC', height: '100%' }}>
      {/* App header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-logo)', fontSize: 18, fontWeight: 700, color: C.navy, letterSpacing: 2 }}>MORA</span>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.navy }} />
      </div>

      {/* KPI tiles row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <MiniTile label="이번 달" value="148건" />
        <MiniTile label="정확도" value="98.4%" />
      </div>

      {/* Recent list */}
      <div
        style={{
          background: '#FFFFFF',
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <strong style={{ fontSize: 12, color: C.navy }}>최근 업로드</strong>
          <span style={{ fontSize: 10, color: C.faint }}>오늘 14:32</span>
        </div>
        <MiniRow tone="card"    label="명함"   title="박지훈"            sub="토스 디자이너" />
        <MiniRow tone="ticket"  label="티켓"   title="KTX 서울→부산"   sub="11/04 09:00" />
        <MiniRow tone="receipt" label="영수증" title="스타벅스 강남R"   sub="₩12,500" />
        <MiniRow tone="poster"  label="포스터" title="제2회 인디뮤직"   sub="D-6" />
      </div>

      {/* Bottom nav */}
      <div
        style={{
          position: 'absolute',
          bottom: 14, left: 16, right: 16,
          display: 'flex',
          justifyContent: 'space-around',
          padding: '10px 0',
          background: '#FFFFFF',
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          fontSize: 11,
          color: C.mute,
        }}
      >
        <span style={{ color: C.navy, fontWeight: 700 }}>홈</span>
        <span>업로드</span>
        <span>보관함</span>
        <span>설정</span>
      </div>
    </div>
  )
}

function PhoneReceiptDetail() {
  return (
    <div style={{ padding: '12px 16px', background: '#FFFFFF', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, color: C.mute }}>←</span>
        <strong style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>거래 상세</strong>
        <span style={{ fontSize: 14, color: C.mute }}>···</span>
      </div>

      {/* Hero */}
      <div
        style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <MiniBadge label="지출" bg="#FEE2E2" color="#991B1B" />
          <MiniBadge label="카페" bg="#FFEDD5" color="#9A3412" />
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 4 }}>스타벅스 강남R점</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>- ₩ 12,500</p>
      </div>

      {/* Meta */}
      <div style={{ background: '#F8FAFC', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
        <MiniMeta k="날짜"     v="2026. 5. 16. (토)" />
        <MiniMeta k="결제수단" v="신한카드 ****1234" />
        <MiniMeta k="메모"     v="아메리카노 외 2건" last />
      </div>

      {/* OCR items */}
      <p style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 6 }}>
        구매 항목 <span style={{ color: C.faint, fontWeight: 400 }}>(3)</span>
        <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB', fontSize: 9, fontWeight: 700 }}>OCR</span>
      </p>
      <div
        style={{
          background: '#FFFFFF',
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 10,
          fontSize: 11,
        }}
      >
        <MiniItem name="아메리카노 (R)"     price="₩4,500" />
        <MiniItem name="카페라떼 (R)"       price="₩5,000" />
        <MiniItem name="플레인 크루아상"     price="₩3,000" />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px 0', borderTop: '1px solid #F1F5F9', marginTop: 4 }}>
          <span style={{ color: C.mute, fontWeight: 700 }}>합계</span>
          <span style={{ color: '#DC2626', fontWeight: 800 }}>₩ 12,500</span>
        </div>
      </div>
    </div>
  )
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '10px 12px',
      }}
    >
      <p style={{ fontSize: 10, color: C.mute, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>{value}</p>
    </div>
  )
}

function MiniRow({
  tone, label, title, sub,
}: {
  tone: 'card' | 'ticket' | 'receipt' | 'poster'
  label: string
  title: string
  sub: string
}) {
  const palette = {
    card:    { bg: '#E8EDF3', fg: '#15293D' },
    ticket:  { bg: '#E9E5FA', fg: '#6746AF' },
    receipt: { bg: '#FEE2E2', fg: '#991B1B' },
    poster:  { bg: '#FEF3C7', fg: '#B45309' },
  }[tone]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0',
        borderTop: `1px solid #F1F5F9`,
      }}
    >
      <MiniBadge label={label} bg={palette.bg} color={palette.fg} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{title}</p>
        <p style={{ fontSize: 9, color: C.mute }}>{sub}</p>
      </div>
    </div>
  )
}

function MiniBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: bg,
        color,
        fontSize: 9,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  )
}

function MiniMeta({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 12px',
        fontSize: 11,
        borderBottom: last ? 'none' : `1px solid ${C.border}`,
      }}
    >
      <span style={{ color: C.mute }}>{k}</span>
      <span style={{ color: C.navy, fontWeight: 600 }}>{v}</span>
    </div>
  )
}

function MiniItem({ name, price }: { name: string; price: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 4px' }}>
      <span style={{ color: C.navy }}>{name}</span>
      <span style={{ color: C.mute }}>{price}</span>
    </div>
  )
}

/* ============== Stats strip ============== */

function StatsStrip() {
  const stats = [
    { value: '5만+',  label: 'OCR 처리된 문서' },
    { value: '12종',  label: '자동 인식 카테고리' },
    { value: '98.4%', label: 'NER 인식 정확도' },
    { value: '< 2초', label: '평균 처리 시간' },
  ]
  return (
    <section style={{ padding: '24px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          textAlign: 'center',
        }}
      >
        {stats.map(s => (
          <div key={s.label}>
            <p style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{s.value}</p>
            <p style={{ fontSize: 12, color: C.mute, marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ============== Feature grid ============== */

function FeatureGrid() {
  const features = [
    { icon: '📷', iconBg: '#DBEAFE', iconFg: '#2563EB', title: '한 장 찍으면 끝',     body: '카메라로 찍거나 사진을 끌어다 놓으세요. 명함·티켓·영수증을 자동으로 구분합니다.' },
    { icon: '🧠', iconBg: '#EDE9FE', iconFg: '#6D28D9', title: 'OCR + NER 결합',     body: '글자만 읽는 게 아닙니다. 사람·날짜·금액·장소를 의미 단위로 추출해서 구조화합니다.' },
    { icon: '🔍', iconBg: '#DCFCE7', iconFg: '#166534', title: '카테고리 통합 검색', body: '"3월 부산 출장 영수증"처럼 자연어로 찾으세요. 명함·티켓·문서를 한 번에 검색합니다.' },
    { icon: '🔗', iconBg: '#FFEDD5', iconFg: '#9A3412', title: 'Google Calendar 연동', body: '추출된 일정은 캘린더로 자동 전송. 명함은 연락처로, 영수증은 가계부로 흘러갑니다.' },
    { icon: '🛡', iconBg: '#FEE2E2', iconFg: '#B91C1C', title: '내 데이터는 내 통제', body: '검색 기록 삭제, 데이터 전체 다운로드/삭제 모두 한 클릭. 위치는 항상 투명하게.' },
    { icon: '⚡', iconBg: '#FEF3C7', iconFg: '#B45309', title: '2초 이내 처리',       body: '평균 처리 시간 < 2초. 회의 끝나고 명함 받자마자 폰만 들어도 정리 완료.' },
  ]
  return (
    <section style={{ padding: '96px 24px', background: '#FFFFFF' }}>
      <SectionHead
        eyebrow="Features"
        title="필요한 것만, 깔끔하게"
        subtitle="복잡한 노트 앱도, 화려한 OCR 데모도 아닌, 정확하게 한 가지 — 흩어진 종이를 검색 가능한 데이터로 바꿉니다."
      />
      <div
        style={{
          maxWidth: 1100,
          margin: '48px auto 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}
      >
        {features.map(f => (
          <article
            key={f.title}
            style={{
              padding: 28,
              background: '#FFFFFF',
              border: `1px solid ${C.border}`,
              borderRadius: 16,
            }}
          >
            <div
              style={{
                width: 44, height: 44, borderRadius: 12,
                background: f.iconBg, color: f.iconFg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, marginBottom: 16,
              }}
            >
              {f.icon}
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: C.mute }}>{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ============== How it works ============== */

function HowItWorks() {
  const steps = [
    { n: '01', title: '사진을 올린다',   body: '드래그&드롭, 카메라, PDF 업로드. 어떤 입력이든 받습니다.' },
    { n: '02', title: 'MORA가 읽는다',   body: 'OCR로 글자를, NER로 의미 단위(사람·날짜·금액)를 추출합니다.' },
    { n: '03', title: '바로 검색한다',   body: '"지난주 회의에서 받은 명함"처럼 평소 말투로 찾으세요.' },
  ]
  return (
    <section id="how" style={{ padding: '96px 24px', background: C.surface }}>
      <SectionHead
        eyebrow="How it works"
        title="찍고 → 인식 → 검색"
        subtitle="3단계면 끝. 폴더 만들 필요도, 태그 달 필요도 없습니다."
      />
      <div
        style={{
          maxWidth: 1100,
          margin: '48px auto 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {steps.map(s => (
          <article
            key={s.n}
            style={{
              position: 'relative',
              padding: 32,
              background: '#FFFFFF',
              border: `1px solid ${C.border}`,
              borderRadius: 16,
            }}
          >
            <span
              style={{
                position: 'absolute', top: 18, right: 22,
                fontSize: 40, fontWeight: 800, color: '#E2E8F0', lineHeight: 1,
              }}
            >
              {s.n}
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 10, maxWidth: 200 }}>{s.title}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: C.mute }}>{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ============== Use cases ============== */

function UseCases() {
  const cases = [
    { emoji: '💼', label: '명함',   desc: '회의·전시·미팅 후 받은 명함을 사진 한 장으로 연락처에 저장.' },
    { emoji: '🎟', label: '티켓',   desc: 'KTX·공연·항공 티켓의 출발 시간, 좌석을 자동으로 캘린더에 등록.' },
    { emoji: '🧾', label: '영수증', desc: '카페·식비·교통비를 자동으로 가계부 항목으로 정리.' },
    { emoji: '📌', label: '포스터', desc: '관심 있는 전시·공연 포스터를 보관하고 마감일을 알림으로.' },
  ]
  return (
    <section style={{ padding: '96px 24px', background: '#FFFFFF' }}>
      <SectionHead
        eyebrow="Use cases"
        title="이런 종이, 매일 마주치죠"
        subtitle="MORA는 일상에서 흔히 나오는 4가지 종류를 깊이 있게 다룹니다."
      />
      <div
        style={{
          maxWidth: 1100,
          margin: '48px auto 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {cases.map(c => (
          <article
            key={c.label}
            style={{
              padding: 24,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 10 }}>{c.emoji}</p>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{c.label}</h3>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: C.mute }}>{c.desc}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ============== Final CTA ============== */

function FinalCTA() {
  const router = useRouter()
  return (
    <section style={{ padding: '96px 24px', background: '#FFFFFF' }}>
      <div
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: '56px 40px',
          background: 'linear-gradient(135deg, #0F172A 0%, #15293D 50%, #1E3A5F 100%)',
          color: '#FFFFFF',
          borderRadius: 20,
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, lineHeight: 1.2, marginBottom: 14 }}>
          오늘 받은 명함, 영영 잃어버리기 전에.
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', maxWidth: 540, margin: '0 auto 28px' }}>
          30초 가입하고 첫 사진을 올려보세요. 결과를 보고 결정해도 늦지 않습니다.
        </p>
        <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => router.push('/signup')}
            style={{
              padding: '14px 22px', borderRadius: 12,
              background: '#FFFFFF', color: C.navy, border: 'none',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            무료로 시작하기 →
          </button>
          <Link
            href="/login"
            style={{
              padding: '14px 22px', borderRadius: 12,
              background: 'transparent', color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.3)',
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
            }}
          >
            로그인
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ============== Section head ============== */

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
      <span
        style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: C.primary,
        }}
      >
        {eyebrow}
      </span>
      <h2
        style={{
          fontSize: 'clamp(26px, 3.4vw, 38px)',
          fontWeight: 800, color: C.navy, letterSpacing: '-0.015em',
          margin: '10px 0 12px', lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: C.mute }}>{subtitle}</p>
    </div>
  )
}

/* ============== Scroll-pinned showcase ============== */

interface ScrollStep {
  eyebrow: string
  title: string
  body: string
  render: () => React.ReactNode
}

function ScrollPinnedShowcase() {
  const [active, setActive] = useState(0)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idx = Number((e.target as HTMLElement).dataset.idx)
          if (!best || e.intersectionRatio > best.ratio) {
            best = { idx, ratio: e.intersectionRatio }
          }
        }
        if (best) setActive(best.idx)
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    stepRefs.current.forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const steps: ScrollStep[] = [
    {
      eyebrow: 'STEP 01',
      title: '사진 한 장 올린다',
      body: '카메라, 드래그&드롭, PDF — 어떤 입력이든 받습니다. 명함이든 영수증이든 그대로 던져주세요.',
      render: () => <UploadScreen />,
    },
    {
      eyebrow: 'STEP 02',
      title: 'MORA가 읽는다',
      body: 'OCR이 글자를, NER이 의미 단위(사람·날짜·금액·장소)를 동시에 추출합니다. 평균 2초.',
      render: () => <ParseScreen />,
    },
    {
      eyebrow: 'STEP 03',
      title: '카테고리로 자동 분류',
      body: '명함은 연락처로, 티켓은 캘린더로, 영수증은 가계부로 — 손대지 않아도 알아서 흘러갑니다.',
      render: () => <ListScreen />,
    },
    {
      eyebrow: 'STEP 04',
      title: '검색·요약은 자연어로',
      body: '"3월 부산 출장 영수증"처럼 평소 말투로 찾으세요. 카테고리 통합 검색 + AI 요약 제공.',
      render: () => <LedgerScreen />,
    },
  ]

  return (
    <section style={{ padding: '40px 24px', background: '#FFFFFF' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 64,
        }}
      >
        {/* Left: text steps stacked, each near-full-viewport */}
        <div>
          {steps.map((s, i) => (
            <div
              key={i}
              ref={el => { stepRefs.current[i] = el }}
              data-idx={i}
              style={{
                minHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 18,
                opacity: active === i ? 1 : 0.32,
                transform: active === i ? 'translateX(0)' : 'translateX(-12px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
              }}
            >
              <span
                style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: C.primary,
                }}
              >
                {s.eyebrow}
              </span>
              <h3
                style={{
                  fontSize: 'clamp(28px, 3.4vw, 40px)',
                  fontWeight: 800, color: C.navy, lineHeight: 1.2,
                  letterSpacing: '-0.015em',
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: 16, lineHeight: 1.6, color: C.mute,
                  maxWidth: 460,
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>

        {/* Right: sticky phone — grid cell IS the containing block */}
        <div
          style={{
            position: 'sticky',
            top: 100,
            height: 'calc(100vh - 120px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'start',
          }}
        >
          <PhoneShell>
            {steps.map((s, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: active === i ? 1 : 0,
                  transform: active === i ? 'translateY(0)' : 'translateY(12px)',
                  transition: 'opacity 0.45s ease, transform 0.45s ease',
                  pointerEvents: active === i ? 'auto' : 'none',
                }}
              >
                {s.render()}
              </div>
            ))}

            {/* Progress dots */}
            <div
              style={{
                position: 'absolute',
                bottom: 18, left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex', gap: 6, zIndex: 10,
              }}
            >
              {steps.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: active === i ? 18 : 6,
                    height: 6,
                    borderRadius: 999,
                    background: active === i ? C.navy : '#CBD5E1',
                    transition: 'all 0.3s',
                  }}
                />
              ))}
            </div>
          </PhoneShell>
        </div>
      </div>
    </section>
  )
}

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 320,
        height: 660,
        padding: 12,
        background: '#0F172A',
        borderRadius: 44,
        boxShadow:
          '0 30px 60px -20px rgba(15, 23, 42, 0.32), inset 0 0 0 2px rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 110,
          height: 26,
          background: '#0F172A',
          borderRadius: 14,
          zIndex: 3,
        }}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          borderRadius: 32,
          overflow: 'hidden',
        }}
      >
        {/* Status bar */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, height: 44,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0 28px', fontSize: 12, fontWeight: 700, color: C.navy,
            zIndex: 5,
          }}
        >
          <span>9:41</span>
          <span style={{ fontSize: 11 }}>5G ●●●●</span>
        </div>
        {children}
      </div>
    </div>
  )
}

/* --- 4 phone screens --- */

function ScreenWrap({ children, bg = '#FAFBFC' }: { children: React.ReactNode; bg?: string }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, paddingTop: 44,
        background: bg, display: 'flex', flexDirection: 'column',
        textAlign: 'left',
      }}
    >
      {children}
    </div>
  )
}

function UploadScreen() {
  return (
    <ScreenWrap>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-logo)', fontSize: 18, fontWeight: 700, color: C.navy, letterSpacing: 2 }}>MORA</span>
        <span style={{ fontSize: 13, color: C.mute }}>업로드</span>
      </div>
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 240, height: 240, borderRadius: 18,
            border: `2px dashed ${C.borderStrong}`, background: '#FFFFFF',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: 40 }}>📷</span>
          <span style={{ fontSize: 13, color: C.mute, fontWeight: 600 }}>사진을 끌어다 놓으세요</span>
          <span style={{ fontSize: 10, color: C.faint }}>jpg · png · pdf · 최대 10MB</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              padding: '10px 18px', borderRadius: 10, background: C.navy, color: '#FFF',
              border: 'none', fontSize: 12, fontWeight: 700,
            }}
          >
            카메라
          </button>
          <button
            style={{
              padding: '10px 18px', borderRadius: 10, background: '#FFF', color: C.text,
              border: `1px solid ${C.borderStrong}`, fontSize: 12, fontWeight: 600,
            }}
          >
            앨범
          </button>
        </div>
      </div>
    </ScreenWrap>
  )
}

function ParseScreen() {
  return (
    <ScreenWrap bg="#FFFFFF">
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 13, color: C.mute }}>← 인식 중</span>
        <span style={{ fontSize: 11, color: C.faint }}>1/1</span>
      </div>
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            background: '#F8FAFC', borderRadius: 12, padding: 14,
            border: `1px solid ${C.border}`, position: 'relative',
            minHeight: 180,
          }}
        >
          <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 9, color: C.faint, fontWeight: 600 }}>RECEIPT.JPG</div>
          {/* Fake receipt lines */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ParseLine left="스타벅스 강남R점" right="2026.05.16 08:45" />
            <ParseLine left="아메리카노 (R)" right="4,500" />
            <ParseLine left="카페라떼 (R)" right="5,000" />
            <ParseLine left="플레인 크루아상" right="3,000" />
            <div style={{ borderTop: `1px dashed ${C.borderStrong}`, marginTop: 6 }} />
            <ParseLine left="합계" right="12,500" bold />
          </div>
        </div>
        {/* Parsing chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="발행처 ✓" tone="ok" />
          <Chip label="금액 ✓" tone="ok" />
          <Chip label="결제일 ✓" tone="ok" />
          <Chip label="카테고리 분류 중…" tone="loading" />
        </div>
        <div
          style={{
            background: '#EFF6FF', borderRadius: 10, padding: '10px 12px',
            fontSize: 11, color: '#1D4ED8', fontWeight: 600,
          }}
        >
          🧠 NER 모델 — 4개 엔티티 추출 (98.4%)
        </div>
      </div>
    </ScreenWrap>
  )
}

function ParseLine({ left, right, bold }: { left: string; right: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 12 : 11, fontWeight: bold ? 700 : 500, color: bold ? C.navy : C.text }}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  )
}

function Chip({ label, tone }: { label: string; tone: 'ok' | 'loading' }) {
  const colors = tone === 'ok'
    ? { bg: '#DCFCE7', fg: '#166534' }
    : { bg: '#FEF3C7', fg: '#B45309' }
  return (
    <span
      style={{
        padding: '4px 8px', borderRadius: 999,
        background: colors.bg, color: colors.fg,
        fontSize: 10, fontWeight: 700,
      }}
    >
      {label}
    </span>
  )
}

function ListScreen() {
  const rows = [
    { label: '명함',   bg: '#E8EDF3', fg: '#15293D',  title: '박지훈',          sub: '토스 디자이너' },
    { label: '티켓',   bg: '#E9E5FA', fg: '#6746AF',  title: 'KTX 서울→부산',  sub: '11/04 09:00' },
    { label: '영수증', bg: '#FEE2E2', fg: '#991B1B',  title: '스타벅스 강남R점', sub: '₩12,500' },
    { label: '포스터', bg: '#FEF3C7', fg: '#B45309',  title: '제2회 인디뮤직',  sub: 'D-6' },
  ]
  return (
    <ScreenWrap>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>보관함</span>
        <span style={{ fontSize: 11, color: C.faint }}>전체 1,204건</span>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {['전체', '명함', '티켓', '영수증', '포스터'].map((t, i) => (
          <span
            key={t}
            style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: i === 0 ? C.navy : '#FFFFFF',
              color: i === 0 ? '#FFFFFF' : C.text,
              border: i === 0 ? 'none' : `1px solid ${C.border}`,
              flexShrink: 0,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div
            key={r.title}
            style={{
              background: '#FFFFFF', border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 12,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <span
              style={{
                padding: '3px 7px', borderRadius: 4,
                background: r.bg, color: r.fg,
                fontSize: 9, fontWeight: 700,
              }}
            >
              {r.label}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{r.title}</p>
              <p style={{ fontSize: 10, color: C.mute }}>{r.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </ScreenWrap>
  )
}

function LedgerScreen() {
  return (
    <ScreenWrap bg="#FFFFFF">
      <div style={{ padding: '12px 16px' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#F1F5F9', borderRadius: 10, padding: '10px 12px',
          }}
        >
          <span style={{ fontSize: 14 }}>🔍</span>
          <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>3월 부산 출장 영수증</span>
        </div>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 10, color: C.faint, fontWeight: 700 }}>AI 요약 ✨</p>
        <div
          style={{
            background: '#EFF6FF', border: `1px solid #DBEAFE`,
            borderRadius: 12, padding: 12,
            fontSize: 11, color: '#1D4ED8', lineHeight: 1.6, fontWeight: 500,
          }}
        >
          3월 부산 출장 중 영수증 8건 · 총 ₩214,300 · 식비 비중 62%. 가장 큰 지출은 5/12 횟집 (₩68,000).
        </div>
        <p style={{ fontSize: 10, color: C.faint, fontWeight: 700, marginTop: 4 }}>관련 거래</p>
        {[
          { d: '3.12 (화)', v: '동래 해물탕',  amt: '-₩68,000' },
          { d: '3.13 (수)', v: '광안리 카페',  amt: '-₩9,800'  },
          { d: '3.14 (목)', v: 'KTX 부산→서울', amt: '-₩59,800' },
        ].map(r => (
          <div
            key={r.v}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', background: '#F8FAFC', borderRadius: 10,
            }}
          >
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{r.v}</p>
              <p style={{ fontSize: 9, color: C.mute }}>{r.d}</p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#DC2626' }}>{r.amt}</span>
          </div>
        ))}
      </div>
    </ScreenWrap>
  )
}

/* ============== Footer ============== */

function Footer() {
  return (
    <footer
      style={{
        padding: '48px 24px 36px',
        background: '#FFFFFF',
        borderTop: `1px solid ${C.border}`,
        color: C.faint,
      }}
    >
      <div
        style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 20, flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-logo)', fontSize: 18, color: C.navy, letterSpacing: 2, fontWeight: 700 }}>
            MORA
          </p>
          <p style={{ fontSize: 11, marginTop: 4 }}>OCR-driven document organizer · 2026</p>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 12 }}>
          <Link href="/login"  style={{ color: C.mute, textDecoration: 'none' }}>로그인</Link>
          <Link href="/signup" style={{ color: C.mute, textDecoration: 'none' }}>시작하기</Link>
          <a href="https://github.com/lavermeanyou/Mora" target="_blank" rel="noreferrer" style={{ color: C.mute, textDecoration: 'none' }}>
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
