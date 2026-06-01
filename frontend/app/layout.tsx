// ═══════════════════════════════════════════════════════════════
// layout.tsx — 루트 레이아웃 (전체 앱의 HTML 뼈대)
// ═══════════════════════════════════════════════════════════════
//
// [역할]
// Next.js App Router의 최상위 레이아웃 파일로, 모든 페이지에 공통 적용되는
// HTML 구조(<html>, <body>)와 글로벌 폰트, 메타데이터를 정의한다.
//
// [코드 흐름]
// 1) next/font/google에서 Patua_One(로고용)과 Noto_Sans_KR(본문용) 폰트를 로드
// 2) CSS 변수(--font-logo, --font-body)로 등록하여 앱 전체에서 사용 가능하게 함
// 3) metadata 객체로 페이지 제목·설명·파비콘을 설정 (SEO 및 브라우저 탭에 반영)
// 4) RootLayout 컴포넌트가 children(하위 페이지)을 <body> 안에 렌더링
//
// [컴포넌트/함수 목록]
// - RootLayout(): 모든 페이지를 감싸는 최상위 레이아웃 컴포넌트
//
// [사용된 라이브러리/훅]
// ───────────────────────────────────────────
// Metadata (next)          — 페이지 <head>에 title, description, icon 등을 선언적으로 설정
// Patua_One (next/font)    — Google Fonts에서 로고용 영문 폰트를 자동 최적화하여 로드
// Noto_Sans_KR (next/font) — Google Fonts에서 한글 본문 폰트를 자동 최적화하여 로드
// ───────────────────────────────────────────

import type { Metadata } from 'next'
import { Patua_One, Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import ChatbotWidget from '@/components/common/ChatbotWidget'

// 로고에 사용할 영문 세리프 폰트 (weight 400만 사용)
const patuaOne = Patua_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-logo',
})

// 본문에 사용할 한글 폰트 (Next.js가 필요한 weight를 자동으로 가져옴)
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-body',
})

// Next.js가 자동으로 <head>에 반영하는 메타데이터
export const metadata: Metadata = {
  title: 'MORA — 명함 스캔 & 검색',
  description: '명함을 스캔하면 AI가 자동으로 정리하고, 언제든 검색할 수 있습니다.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // lang="ko"로 한국어 문서 선언, smooth scroll 동작 활성화
    <html lang="ko" data-scroll-behavior="smooth">
      {/* 두 폰트의 CSS 변수를 body에 적용하고 Tailwind의 font-sans + antialiased 사용 */}
      <body className={`${patuaOne.variable} ${notoSansKR.variable} font-sans antialiased`}>
        {children}
        <ChatbotWidget />
      </body>
    </html>
  )
}
