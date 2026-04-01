'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const NAV_ITEMS = [
  { label: '업로드', href: '/dashboard/upload', icon: '⬆️' },
  { label: '검색', href: '/dashboard/search', icon: '🔎' },
]

const STORAGE_ITEMS = [
  { label: '명함', href: '/dashboard/storage/cards' },
  { label: '티켓', href: '/dashboard/storage/tickets' },
  { label: '포스터', href: '/dashboard/storage/posters' },
  { label: '영수증', href: '/dashboard/storage/receipts' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isStorageOpen, setIsStorageOpen] = useState(pathname.startsWith('/dashboard/storage'))

  const isStorageActive = pathname.startsWith('/dashboard/storage')
  const isStorageVisible = isStorageOpen || isStorageActive

  const session = useMemo(() => {
    if (typeof window === 'undefined') {
      return { ready: false, hasToken: false, userName: '' }
    }

    const token = localStorage.getItem('mora_token')
    let userName = ''
    const user = localStorage.getItem('mora_user')

    if (user) {
      try {
        userName = JSON.parse(user).name || ''
      } catch {}
    }

    return { ready: true, hasToken: !!token, userName }
  }, [])

  useEffect(() => {
    if (session.ready && !session.hasToken) {
      router.replace('/login')
    }
  }, [router, session.hasToken, session.ready])

  function handleLogout() {
    localStorage.removeItem('mora_token')
    localStorage.removeItem('mora_user')
    router.replace('/')
  }

  if (!session.ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B1521' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>로딩 중...</p>
      </div>
    )
  }

  if (!session.hasToken) {
    return null
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0B1521' }}>
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 260,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          background: '#0a1018',
        }}
      >
        <div style={{ height: 80, display: 'flex', alignItems: 'center', padding: '0 28px' }}>
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-logo)',
              fontSize: 22,
              color: '#FF8A3D',
              textDecoration: 'none',
              letterSpacing: 3,
            }}
          >
            MORA
          </Link>
        </div>

        {session.userName ? (
          <div style={{ padding: '0 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{session.userName}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>환영합니다</p>
          </div>
        ) : null}

        <nav style={{ flex: 1, padding: '20px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 500,
                    textDecoration: 'none',
                    background: isActive ? 'rgba(255,138,61,0.1)' : 'transparent',
                    color: isActive ? '#FF8A3D' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}

            <div>
              <button
                type="button"
                onClick={() => setIsStorageOpen((prev) => !prev)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 500,
                  background: isStorageActive ? 'rgba(255,138,61,0.1)' : 'transparent',
                  color: isStorageActive ? '#FF8A3D' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>🗂️</span>
                  보관함
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    transform: isStorageVisible ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    color: isStorageActive ? '#FF8A3D' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  ▾
                </span>
              </button>

              <div
                style={{
                  overflow: 'hidden',
                  maxHeight: isStorageVisible ? 220 : 0,
                  opacity: isStorageVisible ? 1 : 0,
                  transition: 'max-height 0.25s ease, opacity 0.2s ease',
                }}
              >
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 14 }}>
                  {STORAGE_ITEMS.map((item) => {
                    const isSubActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: 10,
                          fontSize: 14,
                          textDecoration: 'none',
                          background: isSubActive ? 'rgba(255,138,61,0.08)' : 'transparent',
                          color: isSubActive ? '#FF8A3D' : 'rgba(255,255,255,0.45)',
                          transition: 'all 0.2s',
                        }}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.25)',
              transition: 'all 0.2s',
            }}
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 260, flex: 1, padding: 48 }}>{children}</main>
    </div>
  )
}
