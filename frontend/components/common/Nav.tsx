'use client'

import { useEffect, useState, useSyncExternalStore, MouseEvent } from 'react'
import Link from 'next/link'

function readIsLoggedIn() {
  if (typeof window === 'undefined') {
    return false
  }

  return !!localStorage.getItem('mora_token')
}

function subscribeAuth(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('mora-session-change', onStoreChange)
  window.addEventListener('pageshow', onStoreChange)
  window.addEventListener('focus', onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('mora-session-change', onStoreChange)
    window.removeEventListener('pageshow', onStoreChange)
    window.removeEventListener('focus', onStoreChange)
  }
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const isLoggedIn = useSyncExternalStore(subscribeAuth, readIsLoggedIn, () => false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogoClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (window.location.pathname === '/') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'all 0.3s',
        background: scrolled ? 'rgba(11,21,33,0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        {/* MORA 로고 */}
        <Link href="/" onClick={handleLogoClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img
            src="/icons/mora-logo-lg.svg"
            alt="MORA"
            width={36}
            height={36}
            style={{ filter: scrolled ? 'brightness(0) invert(1)' : 'none' }}
          />
          <span style={{ fontFamily: 'var(--font-logo)', fontSize: 24, color: scrolled ? 'white' : '#15293D', letterSpacing: 3 }}>
            MORA
          </span>
        </Link>

        {/* 앵커 링크 — 페이지 내 섹션으로 스크롤 이동 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#how" style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none' }}>사용법</a>
          <a href="#features" style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>기능</a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                background: scrolled ? 'white' :'#15293D',
                fontSize: 14,
                fontWeight: 600,
                color: scrolled ? '#15293D' : 'white',
                textDecoration: 'none',
              }}
            >
              대시보드로 이동
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: scrolled ? 'white' :'#15293D',
                  fontSize: 14,
                  fontWeight: 600,
                  color: scrolled ? '#15293D': 'white',
                  textDecoration: 'none',
                }}
              >
                로그인
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
