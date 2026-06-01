'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const SEARCH_CATEGORIES = [
  { label: '명함', value: 'BUSINESS_CARD' },
  { label: '티켓', value: 'TICKET' },
  { label: '포스터', value: 'POSTER' },
  { label: '영수증', value: 'RECEIPT' },
]

const STORAGE_ITEMS = [
  { label: '명함', href: '/dashboard/storage/cards' },
  { label: '티켓', href: '/dashboard/storage/tickets' },
  { label: '포스터', href: '/dashboard/storage/posters' },
  { label: '영수증', href: '/dashboard/storage/receipts' },
]

type Session = {
  ready: boolean
  hasToken: boolean
  userName: string
}

const EMPTY_SESSION: Session = { ready: false, hasToken: false, userName: '' }
let cachedToken: string | null | undefined
let cachedUser: string | null | undefined
let cachedSession = EMPTY_SESSION

function readSession(): Session {
  if (typeof window === 'undefined') {
    return EMPTY_SESSION
  }

  const token = localStorage.getItem('mora_token')
  const user = localStorage.getItem('mora_user')

  if (token === cachedToken && user === cachedUser) {
    return cachedSession
  }

  let userName = ''

  if (user) {
    try {
      userName = JSON.parse(user).name || ''
    } catch {}
  }

  cachedToken = token
  cachedUser = user
  cachedSession = { ready: true, hasToken: !!token, userName }

  return cachedSession
}

function subscribeSession(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('mora-session-change', onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('mora-session-change', onStoreChange)
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isStorageOpen, setIsStorageOpen] = useState(false)
  const [activeStorageIndex, setActiveStorageIndex] = useState(0)
  const [searchCategory, setSearchCategory] = useState('BUSINESS_CARD')
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0)
  const session = useSyncExternalStore(subscribeSession, readSession, () => EMPTY_SESSION)
  const storageRef = useRef<HTMLDivElement>(null)
  const storageTriggerRef = useRef<HTMLButtonElement>(null)
  const storageOptionRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const categoryRef = useRef<HTMLDivElement>(null)
  const categoryTriggerRef = useRef<HTMLButtonElement>(null)
  const categoryOptionRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenFromOAuth = params.get('token')
    const userIdFromOAuth = params.get('userId')
    const emailFromOAuth = params.get('email')
    const nameFromOAuth = params.get('name')

    if (tokenFromOAuth) {
      localStorage.setItem('mora_token', tokenFromOAuth)
      localStorage.setItem(
        'mora_user',
        JSON.stringify({
          id: userIdFromOAuth || '',
          email: emailFromOAuth || '',
          name: nameFromOAuth || emailFromOAuth?.split('@')[0] || '',
        }),
      )
      window.history.replaceState(null, '', window.location.pathname)
    }

    window.dispatchEvent(new Event('mora-session-change'))
  }, [])

  useEffect(() => {
    if (session.ready && !session.hasToken) {
      router.replace('/login')
    }
  }, [router, session.hasToken, session.ready])

  // 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (storageRef.current && !storageRef.current.contains(e.target as Node)) {
        setIsStorageOpen(false)
      }
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isStorageOpen) {
      storageOptionRefs.current[activeStorageIndex]?.focus()
    }
  }, [activeStorageIndex, isStorageOpen])

  useEffect(() => {
    if (isCategoryOpen) {
      categoryOptionRefs.current[activeCategoryIndex]?.focus()
    }
  }, [activeCategoryIndex, isCategoryOpen])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery)}&type=${searchCategory}`)
    }
  }

  function openStorageMenu() {
    const selectedIndex = STORAGE_ITEMS.findIndex(item => item.href === pathname)
    setActiveStorageIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setIsStorageOpen(true)
  }

  function closeStorageMenu() {
    setIsStorageOpen(false)
    requestAnimationFrame(() => {
      storageTriggerRef.current?.focus()
    })
  }

  function moveActiveStorage(direction: 1 | -1) {
    setActiveStorageIndex(prev => (prev + direction + STORAGE_ITEMS.length) % STORAGE_ITEMS.length)
  }

  function handleStorageTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (isStorageOpen) {
        moveActiveStorage(1)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (isStorageOpen) {
        moveActiveStorage(-1)
      }
      return
    }

    if (e.key === 'Escape') {
      setIsStorageOpen(false)
    }
  }

  function handleStorageOptionKeyDown(e: React.KeyboardEvent<HTMLAnchorElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActiveStorage(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActiveStorage(-1)
      return
    }

    if (e.key === 'Escape') {
      closeStorageMenu()
    }
  }

  function openCategoryMenu() {
    const selectedIndex = SEARCH_CATEGORIES.findIndex(cat => cat.value === searchCategory)
    setActiveCategoryIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setIsCategoryOpen(true)
  }

  function selectCategory(index: number) {
    setSearchCategory(SEARCH_CATEGORIES[index].value)
    setIsCategoryOpen(false)
    requestAnimationFrame(() => {
      categoryTriggerRef.current?.focus()
    })
  }

  function moveActiveCategory(direction: 1 | -1) {
    setActiveCategoryIndex(prev => (prev + direction + SEARCH_CATEGORIES.length) % SEARCH_CATEGORIES.length)
  }

  function handleCategoryTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (isCategoryOpen) {
        moveActiveCategory(1)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (isCategoryOpen) {
        moveActiveCategory(-1)
      }
      return
    }

    if (e.key === 'Escape') {
      setIsCategoryOpen(false)
    }
  }

  function handleCategoryOptionKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActiveCategory(1)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActiveCategory(-1)
      return
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectCategory(index)
      return
    }

    if (e.key === 'Escape') {
      setIsCategoryOpen(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('mora_token')
    localStorage.removeItem('mora_user')
    window.dispatchEvent(new Event('mora-session-change'))
    router.replace('/login')
  }

  if (!session.ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        <p style={{ color: '#999999', fontSize: 14 }}>로딩 중...</p>
      </div>
    )
  }

  if (!session.hasToken) {
    return null
  }

  const currentCategory = SEARCH_CATEGORIES.find(c => c.value === searchCategory)

  return (
    <div style={{ minWidth: 1200, minHeight: '100vh', background: '#FFFFFF' }}>
      {/* 상단 네비게이션 */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 'max(0px, calc((100vw - 1200px) / 2))',
          width: 1200,
          boxSizing: 'border-box',
          height: 64,
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          padding: '0 40px',
          zIndex: 1000,
          gap: 24,
        }}
      >
        {/* 로고 */}
        <Link
          href="/dashboard"
          style={{
            fontFamily: 'var(--font-logo)',
            fontSize: 24,
            color: '#162B3F',
            textDecoration: 'none',
            letterSpacing: 2,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          MORA
        </Link>

        {/* 검색바 */}
        <form
          onSubmit={handleSearch}
          style={{
            flex: 1,
            maxWidth: 480,
            display: 'flex',
            alignItems: 'center',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: 8,
            height: 40,
            overflow: 'visible',
            position: 'relative',
          }}
        >
          {/* 카테고리 드롭다운 */}
          <div ref={categoryRef} style={{ position: 'relative', flexShrink: 0, width: 76 }}>
            <button
              ref={categoryTriggerRef}
              type="button"
              onClick={() => {
                if (isCategoryOpen) {
                  setIsCategoryOpen(false)
                } else {
                  openCategoryMenu()
                }
              }}
              onKeyDown={handleCategoryTriggerKeyDown}
              aria-expanded={isCategoryOpen}
              aria-haspopup="listbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '0 12px',
                width: '100%',
                height: 38,
                border: 'none',
                borderRight: '1px solid #CBD5E1',
                background: 'transparent',
                fontSize: 13,
                color: '#505050',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                outline: 'none',
              }}
            >
              {currentCategory?.label}
              <span style={{ fontSize: 10, color: '#999' }}>▾</span>
            </button>
            {isCategoryOpen && (
              <div
                role="listbox"
                aria-label="문서 타입"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  minWidth: 76,
                  zIndex: 100,
                }}
              >
                {SEARCH_CATEGORIES.map((cat, index) => (
                  <button
                    key={cat.value}
                    ref={el => {
                      categoryOptionRefs.current[index] = el
                    }}
                    type="button"
                    role="option"
                    aria-selected={searchCategory === cat.value}
                    onClick={() => selectCategory(index)}
                    onKeyDown={e => handleCategoryOptionKeyDown(e, index)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 16px',
                      border: 'none',
                      background: activeCategoryIndex === index ? '#F0F9FF' : 'transparent',
                      fontSize: 13,
                      color: activeCategoryIndex === index ? '#0077B6' : '#333',
                      cursor: 'pointer',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      outline: 'none',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 검색어 입력 */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="검색어를 입력하세요"
            style={{
              flex: 1,
              height: '100%',
              border: 'none',
              background: 'transparent',
              padding: '0 12px',
              fontSize: 14,
              color: '#111',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              width: 36,
              height: 36,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#505050',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </form>

        {/* 오른쪽 메뉴 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {/* 업로드 */}
          <Link
            href="/dashboard/upload"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              color: pathname.startsWith('/dashboard/upload') ? '#0077B6' : '#505050',
              background: pathname.startsWith('/dashboard/upload') ? '#F0F9FF' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            업로드
          </Link>

          {/* 보관함 드롭다운 */}
          <div ref={storageRef} style={{ position: 'relative' }}>
            <button
              ref={storageTriggerRef}
              type="button"
              onClick={() => {
                if (isStorageOpen) {
                  setIsStorageOpen(false)
                } else {
                  openStorageMenu()
                }
              }}
              onKeyDown={handleStorageTriggerKeyDown}
              aria-expanded={isStorageOpen}
              aria-haspopup="listbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                color: pathname.startsWith('/dashboard/storage') ? '#0077B6' : '#505050',
                background: pathname.startsWith('/dashboard/storage') ? '#F0F9FF' : 'transparent',
                transition: 'all 0.15s',
                outline: 'none',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              보관함
              <span style={{ fontSize: 10, color: '#999' }}>▾</span>
            </button>
            {isStorageOpen && (
              <div
                role="listbox"
                aria-label="보관함"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  width: '100%',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  zIndex: 100,
                }}
              >
                {STORAGE_ITEMS.map((item, index) => (
                  <Link
                    key={item.href}
                    ref={el => {
                      storageOptionRefs.current[index] = el
                    }}
                    href={item.href}
                    role="option"
                    aria-selected={pathname === item.href}
                    onClick={closeStorageMenu}
                    onKeyDown={handleStorageOptionKeyDown}
                    style={{
                      display: 'block',
                      padding: '8px 12px',
                      fontSize: 13,
                      textDecoration: 'none',
                      color: activeStorageIndex === index ? '#0077B6' : '#333',
                      background: activeStorageIndex === index ? '#F0F9FF' : 'transparent',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      outline: 'none',
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 알림 아이콘 */}
          <button
            type="button"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#505050',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </button>

          {/* 프로필 */}
          <Link
            href="/dashboard/settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 8,
              marginLeft: 4,
              cursor: 'pointer',
              background: pathname.startsWith('/dashboard/settings') ? '#F0F9FF' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
            aria-label="내 프로필 및 설정"
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#15293D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {session.userName ? session.userName[0] : 'U'}
            </div>
            <span
              style={{
                fontSize: 13,
                color: pathname.startsWith('/dashboard/settings') ? '#0077B6' : '#333',
                fontWeight: 500,
              }}
            >
              {session.userName || '사용자'}
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#505050',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 64,
          left: 0,
          right: 0,
          height: 1,
          background: '#CBD5E1',
          zIndex: 999,
        }}
      />

      <main style={{ paddingTop: 64, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
