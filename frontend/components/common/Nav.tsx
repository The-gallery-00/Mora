'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
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
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-logo)',
            fontSize: 24,
            color: '#FF8A3D',
            textDecoration: 'none',
            letterSpacing: 3,
          }}
        >
          MORA
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a
            href="#how"
            style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
          >
            사용법
          </a>
          <a
            href="#feature"
            style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
          >
            기능
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                background: '#FF8A3D',
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
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
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.7)',
                  textDecoration: 'none',
                }}
              >
                로그인
              </Link>
              <Link
                href="/login"
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: '#FF8A3D',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white',
                  textDecoration: 'none',
                }}
              >
                시작하기
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
