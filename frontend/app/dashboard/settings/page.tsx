'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  changeName as apiChangeName,
  changePassword as apiChangePassword,
  disconnectGoogleCalendar,
  getGoogleCalendarConnected,
  getGoogleCalendarConnectUrl,
  getMe,
} from '@/lib/api'

const CompactCtx = createContext(false)

interface StoredUser {
  id?: string
  name?: string
  email?: string
  avatar?: string       // base64 dataURL
  joinedAt?: string
  provider?: string     // "local" | "google" | "kakao" | "naver"
}

// Read user from localStorage (set by login/signup) — fall back to demo values
function loadStoredUser(): StoredUser {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('mora_user') || '{}') } catch { return {} }
}

function saveStoredUser(patch: Partial<StoredUser>) {
  if (typeof window === 'undefined') return
  const cur = loadStoredUser()
  const next = { ...cur, ...patch }
  localStorage.setItem('mora_user', JSON.stringify(next))
}

const PREFS_KEY = 'mora_settings_prefs'

interface Prefs {
  toggles: Record<ToggleKey, boolean>
  theme: Theme
}

const DEFAULT_PREFS: Prefs = {
  toggles: {
    gcal: false,
    contacts: false,
    compact: false,
    notifOcr: true,
    notifSchedule: true,
    notifSync: false,
  },
  theme: 'light',
}

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return {
      toggles: { ...DEFAULT_PREFS.toggles, ...(raw.toggles || {}) },
      theme: raw.theme === 'dark' ? 'dark' : 'light',
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(p: Prefs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PREFS_KEY, JSON.stringify(p))
}

type ToggleKey =
  | 'gcal'
  | 'contacts'
  | 'compact'
  | 'notifOcr'
  | 'notifSchedule'
  | 'notifSync'

type Theme = 'light' | 'dark'
type ModalKind = null | 'password' | 'nickname' | 'confirmDelete' | 'confirmLeave'

const C = {
  navy: '#15293D',
  border: '#CBD5E1',
  borderSoft: '#E2E8F0',
  cardBg: '#FFFFFF',
  surface: '#F8FAFC',
  text: '#334155',
  mute: '#64748B',
  faint: '#94A3B8',
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  dangerFaint: '#FEF2F2',
  success: '#16A34A',
  successSoft: '#DCFCE7',
} as const

export default function SettingsPage() {
  const router = useRouter()

  // Live user state — lazy init from localStorage (avoids set-state-in-effect)
  const [nickname, setNickname] = useState<string>(() => loadStoredUser().name || 'leechoeun')
  // Email is read-only until /me/email verification flow exists on backend
  const [email] = useState<string>(() => loadStoredUser().email || 'mvp6276@gmail.com')
  const [avatar, setAvatar] = useState<string | undefined>(() => loadStoredUser().avatar)
  const [joinedAt] = useState('2025. 11. 03.')
  // 소셜 전용 계정에서는 비밀번호 변경을 차단해야 하므로 provider를 별도로 추적한다.
  const [provider, setProvider] = useState<string>(() => loadStoredUser().provider || 'local')
  const [userId, setUserId] = useState<string>(() => loadStoredUser().id || '')
  const [calendarBusy, setCalendarBusy] = useState(false)
  const isLocalAccount = provider === 'local'

  // 마운트 시 /auth/me를 호출해 최신 provider/name을 동기화한다.
  // localStorage 값이 오래됐거나 OAuth 콜백 시 provider가 빠진 경우를 보정한다.
  useEffect(() => {
    let cancelled = false
    getMe().then(async res => {
      if (cancelled || !res.success) return
      const me = res.data
      if (me.id) setUserId(me.id)
      if (me.provider) setProvider(me.provider)
      if (me.name) setNickname(me.name)
      saveStoredUser({ id: me.id, name: me.name, email: me.email, provider: me.provider })

      if (me.id) {
        const connectedRes = await getGoogleCalendarConnected(me.id)
        if (!cancelled && connectedRes.success) {
          setToggles(prev => ({ ...prev, gcal: connectedRes.data.connected }))
        }
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const calendar = params.get('calendar')
    if (calendar === 'connected') {
      setToggles(prev => ({ ...prev, gcal: true }))
    }
    if (calendar === 'failed') {
      alert(params.get('message') || '구글 캘린더 연동에 실패했습니다.')
    }
  }, [])
  // TODO: replace stats with selector on real data once /me/stats endpoint ships
  const stats = useMemo(
    () => ({ docs: 12, integrationsActive: 1, integrationsTotal: 2, lastSyncLabel: '6분 전' }),
    [],
  )

  // Prefs (toggles + theme) — lazy init + persist on change
  const initialPrefs = useMemo(() => loadPrefs(), [])
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(initialPrefs.toggles)
  const [theme, setTheme] = useState<Theme>(initialPrefs.theme)
  const [modal, setModal] = useState<ModalKind>(null)

  // Persist prefs whenever toggles/theme change
  useEffect(() => {
    savePrefs({ toggles, theme })
  }, [toggles, theme])

  // Apply theme to <html> so global styles can react (CSS hook for future)
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Compact mode shrinks row padding live (passed down to Row via prop)
  const compact = toggles.compact

  // Hidden file input for avatar upload
  const fileRef = useRef<HTMLInputElement>(null)
  function pickImage() {
    fileRef.current?.click()
  }
  function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 선택할 수 있습니다.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('2MB 이하 이미지만 업로드할 수 있습니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      setAvatar(dataUrl)
      saveStoredUser({ avatar: dataUrl })
      // TODO: POST to /me/avatar once endpoint exists
    }
    reader.readAsDataURL(file)
    // reset so picking the same file again still triggers change
    e.target.value = ''
  }

  async function handleNicknameSave(next: string) {
    const trimmed = next.trim()
    if (!trimmed) return
    const res = await apiChangeName(trimmed)
    if (!res.success) {
      alert(res.error || '닉네임 변경에 실패했습니다.')
      return
    }
    setNickname(res.data.name)
    saveStoredUser({ name: res.data.name })
    setModal(null)
  }

  function flip(k: ToggleKey) {
    setToggles(prev => ({ ...prev, [k]: !prev[k] }))
  }

  async function handleGoogleCalendarToggle() {
    if (calendarBusy) return
    if (!userId) {
      alert('로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.')
      return
    }

    setCalendarBusy(true)
    try {
      if (toggles.gcal) {
        const res = await disconnectGoogleCalendar(userId)
        if (!res.success) {
          alert(res.error || '구글 캘린더 연동 해제에 실패했습니다.')
          return
        }
        setToggles(prev => ({ ...prev, gcal: false }))
        return
      }

      const res = await getGoogleCalendarConnectUrl()
      if (!res.success) {
        alert(res.error || '구글 캘린더 연동 URL을 가져오지 못했습니다.')
        return
      }
      if (!res.data.url) {
        alert('구글 캘린더 연동 URL을 가져오지 못했습니다.')
        return
      }
      window.location.href = res.data.url
    } finally {
      setCalendarBusy(false)
    }
  }

  // TODO: wire to /auth/logout endpoint
  function handleLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mora_token')
      localStorage.removeItem('mora_user')
    }
    router.replace('/')
  }

  return (
    <CompactCtx.Provider value={compact}>
    <div style={{ padding: '40px 40px 80px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page title */}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.navy, marginBottom: 6 }}>설정</h1>
        <p style={{ fontSize: 13, color: C.mute }}>계정 정보, 서비스 연동, 데이터 관리 방식을 설정할 수 있습니다.</p>
      </header>

      {/* Profile card */}
      <ProfileCard
        nickname={nickname}
        email={email}
        avatar={avatar}
        joinedAt={joinedAt}
        stats={stats}
        onChangeImage={pickImage}
        onChangeNickname={() => setModal('nickname')}
      />

      {/* Hidden file input for avatar */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onImagePicked}
        style={{ display: 'none' }}
      />

      {/* 2-col grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: 20,
          marginTop: 24,
        }}
      >
        {/* LEFT */}
        <Column>
          <Card title="계정 설정" subtitle="계정 식별 정보를 관리합니다.">
            <Row
              icon={<IconLetter ch="U" bg="#DBEAFE" fg="#2563EB" />}
              title="닉네임"
              desc={nickname}
              right={<Chevron label="변경" onClick={() => setModal('nickname')} />}
            />
            <Row
              icon={<IconLetter ch="@" bg="#DCFCE7" fg="#166534" />}
              title="이메일"
              desc={email}
              right={<Chevron label="변경" onClick={() => {/* TODO: open email modal once endpoint ready */}} />}
            />
            <Row
              icon={<IconLetter ch="🔒" bg="#FEE2E2" fg="#991B1B" />}
              title="비밀번호"
              desc={isLocalAccount ? '마지막 변경 3개월 전' : '소셜 계정은 비밀번호가 없습니다'}
              right={
                <Chevron
                  label="변경"
                  onClick={() => {
                    if (!isLocalAccount) {
                      alert('소셜 로그인(구글/카카오/네이버) 계정은 비밀번호를 변경할 수 없습니다.')
                      return
                    }
                    setModal('password')
                  }}
                />
              }
            />
          </Card>

          <Card title="연동 설정" subtitle="OCR로 추출한 일정·연락처를 외부 서비스와 동기화합니다.">
            <Row
              icon={<IconLetter ch="📅" bg="#DBEAFE" fg="#2563EB" />}
              title="Google Calendar"
              desc="추출된 일정을 캘린더로 자동 전송"
              right={
                <RightGroup>
                  <Pill label={toggles.gcal ? '연동됨' : '미연동'} on={toggles.gcal} />
                  <Toggle on={toggles.gcal} onClick={handleGoogleCalendarToggle} disabled={calendarBusy} />
                </RightGroup>
              }
            />
            <Row
              icon={<IconLetter ch="☎" bg="#FFEDD5" fg="#9A3412" />}
              title="연락처"
              desc="명함에서 인식된 연락처 저장"
              right={
                <RightGroup>
                  <Pill label={toggles.contacts ? '연동됨' : '미연동'} on={toggles.contacts} />
                  <Toggle on={toggles.contacts} onClick={() => flip('contacts')} />
                </RightGroup>
              }
            />
          </Card>

          <Card title="데이터 관리" subtitle="검색 기록 및 업로드한 자료를 정리합니다.">
            <Row
              icon={<IconLetter ch="⌕" bg="#F1F5F9" fg="#475569" />}
              title="검색 기록"
              desc="저장된 모든 검색어를 삭제합니다."
              right={<Chevron label="지우기" danger onClick={() => setModal('confirmDelete')} />}
            />
            <Row
              icon={<IconLetter ch="☁" bg="#DBEAFE" fg="#2563EB" />}
              title="업로드 데이터 관리"
              desc="보관함의 원본 자료를 점검합니다."
              right={<Chevron label="열기" onClick={() => router.push('/dashboard/storage/cards')} />}
            />
            <Row
              tone="danger"
              icon={<IconLetter ch="⚠" bg="#FEE2E2" fg="#B91C1C" />}
              title="내 데이터 전체 삭제"
              desc="복구할 수 없습니다. 신중히 진행하세요."
              right={<Chevron label="삭제" danger onClick={() => setModal('confirmDelete')} />}
            />
          </Card>
        </Column>

        {/* RIGHT */}
        <Column>
          <Card title="알림 설정" subtitle="브라우저 푸시 및 인앱 알림을 제어합니다.">
            <Row
              icon={<IconLetter ch="✓" bg="#DCFCE7" fg="#166534" />}
              title="OCR 처리 완료"
              desc="문서 분석이 끝나면 알려드립니다."
              right={<Toggle on={toggles.notifOcr} onClick={() => flip('notifOcr')} />}
            />
            <Row
              icon={<IconLetter ch="📅" bg="#DBEAFE" fg="#2563EB" />}
              title="일정 등록"
              desc="캘린더 등록이 완료될 때."
              right={<Toggle on={toggles.notifSchedule} onClick={() => flip('notifSchedule')} />}
            />
            <Row
              icon={<IconLetter ch="⟳" bg="#EDE9FE" fg="#6D28D9" />}
              title="데이터 동기화"
              desc="외부 서비스 동기화 상태 변화."
              right={<Toggle on={toggles.notifSync} onClick={() => flip('notifSync')} />}
            />
          </Card>

          <Card title="화면 설정" subtitle="테마와 표시 옵션을 변경합니다.">
            <Row
              icon={<IconLetter ch="☀" bg="#FEF3C7" fg="#B45309" />}
              title="테마"
              desc={theme === 'light' ? '현재 라이트 모드' : '현재 다크 모드'}
              right={<Segmented value={theme} onChange={setTheme} />}
            />
            <Row
              icon={<IconLetter ch="▤" bg="#F1F5F9" fg="#475569" />}
              title="컴팩트 보기"
              desc="리스트 행 간격을 좁힙니다."
              right={<Toggle on={toggles.compact} onClick={() => flip('compact')} />}
            />
          </Card>

          <Card title="고객 지원" subtitle="문의·약관·앱 정보를 확인합니다.">
            <Row
              icon={<IconLetter ch="💬" bg="#DBEAFE" fg="#2563EB" />}
              title="문의하기"
              desc="이메일로 문의를 보냅니다."
              right={<Chevron label="열기" onClick={() => window.open('mailto:support@mora.app')} />}
            />
            <Row
              icon={<IconLetter ch="§" bg="#F1F5F9" fg="#475569" />}
              title="이용약관"
              desc="서비스 이용약관을 확인합니다."
              right={<Chevron label="보기" onClick={() => {/* TODO: navigate to terms */}} />}
            />
            <Row
              icon={<IconLetter ch="🛡" bg="#DCFCE7" fg="#166534" />}
              title="개인정보 처리방침"
              desc="데이터 처리 방식을 확인합니다."
              right={<Chevron label="보기" onClick={() => {/* TODO: navigate to privacy */}} />}
            />
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 8px', marginTop: 4,
              }}
            >
              <span style={{ fontSize: 12, color: C.mute }}>앱 버전</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>v1.2.3 (build 248)</span>
            </div>
          </Card>
        </Column>
      </div>

      {/* Full-width 계정 액션 */}
      <section
        style={{
          marginTop: 24,
          background: C.cardBg,
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 16,
          padding: '22px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 4 }}>계정 액션</h3>
          <p style={{ fontSize: 12, color: C.faint }}>세션 종료 및 회원 탈퇴를 진행합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <GhostButton onClick={handleLogout}>로그아웃</GhostButton>
          <DangerButton onClick={() => setModal('confirmLeave')}>회원 탈퇴</DangerButton>
        </div>
      </section>

      {/* Modals */}
      {modal === 'password' && <PasswordModal onClose={() => setModal(null)} />}
      {modal === 'nickname' && (
        <NicknameModal
          current={nickname}
          onClose={() => setModal(null)}
          onSave={handleNicknameSave}
        />
      )}
      {modal === 'confirmDelete' && (
        <ConfirmModal
          icon="⚠"
          title="검색 기록을 모두 삭제할까요?"
          description="이 작업은 되돌릴 수 없습니다. 계속하려면 확인을 눌러주세요."
          confirmLabel="삭제"
          onClose={() => setModal(null)}
          onConfirm={() => {
            // TODO: call delete API
            setModal(null)
          }}
        />
      )}
      {modal === 'confirmLeave' && (
        <ConfirmModal
          icon="⚠"
          title="정말 탈퇴하시겠어요?"
          description="이 작업은 되돌릴 수 없습니다. 계속하려면 계정 비밀번호를 입력하세요."
          confirmLabel="확인 후 진행"
          requirePassword
          onClose={() => setModal(null)}
          onConfirm={() => {
            // TODO: call /auth/withdraw endpoint
            setModal(null)
          }}
        />
      )}
    </div>
    </CompactCtx.Provider>
  )
}

/* ============== Subcomponents ============== */

function ProfileCard({
  nickname, email, avatar, joinedAt, stats, onChangeImage, onChangeNickname,
}: {
  nickname: string
  email: string
  avatar?: string
  joinedAt: string
  stats: { docs: number; integrationsActive: number; integrationsTotal: number; lastSyncLabel: string }
  onChangeImage: () => void
  onChangeNickname: () => void
}) {
  return (
    <section
      style={{
        background: C.cardBg,
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 16,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: avatar ? `center / cover no-repeat url(${avatar})` : C.navy,
            color: '#FFF', fontSize: 32, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {!avatar && nickname[0]}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>{nickname}</h2>
            <StatusBadge />
          </div>
          <p style={{ fontSize: 13, color: C.mute, marginBottom: 4 }}>{email}</p>
          <p style={{ fontSize: 12, color: C.faint }}>{joinedAt} 가입</p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <GhostButton onClick={onChangeImage}>이미지 변경</GhostButton>
          <GhostButton onClick={onChangeNickname}>닉네임 수정</GhostButton>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <StatTile icon="📄" iconBg="#DBEAFE" iconFg="#2563EB" label="보관 문서" value={String(stats.docs)} hint="건" />
        <StatTile icon="🔗" iconBg="#DCFCE7" iconFg="#166534" label="연동 서비스" value={String(stats.integrationsActive)} hint={`/ ${stats.integrationsTotal}`} />
        <StatTile icon="⟳" iconBg="#EDE9FE" iconFg="#6D28D9" label="마지막 동기화" value={stats.lastSyncLabel} />
      </div>
    </section>
  )
}

function StatusBadge() {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 999, background: C.successSoft,
        fontSize: 11, fontWeight: 600, color: '#166534',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }} />
      활성
    </span>
  )
}

function StatTile({
  icon, iconBg, iconFg, label, value, hint,
}: {
  icon: string; iconBg: string; iconFg: string
  label: string; value: string; hint?: string
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: 16, background: C.surface, borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: 10,
          background: iconBg, color: iconFg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, color: C.mute, marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>
          {value} {hint && <span style={{ fontSize: 11, fontWeight: 400, color: C.faint }}>{hint}</span>}
        </p>
      </div>
    </div>
  )
}

function Column({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: C.cardBg, border: `1px solid ${C.borderSoft}`,
        borderRadius: 16, padding: 22,
      }}
    >
      <header style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 4 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: C.faint }}>{subtitle}</p>}
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    </section>
  )
}

function Row({
  icon, title, desc, right, tone,
}: {
  icon: React.ReactNode
  title: string
  desc?: string
  right: React.ReactNode
  tone?: 'danger'
}) {
  const [hover, setHover] = useState(false)
  const compact = useContext(CompactCtx)
  const danger = tone === 'danger'
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 10 : 12,
        padding: compact ? '5px 8px' : '10px 8px',
        borderRadius: 10,
        background: danger
          ? '#FEFAFA'
          : hover
            ? C.surface
            : 'transparent',
        transition: 'background 0.15s, padding 0.15s',
      }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{title}</p>
        {desc && <p style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{desc}</p>}
      </div>
      {right}
    </div>
  )
}

function IconLetter({ ch, bg, fg }: { ch: string; bg: string; fg: string }) {
  return (
    <div
      style={{
        width: 36, height: 36, borderRadius: 10,
        background: bg, color: fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 600, flexShrink: 0,
      }}
    >
      {ch}
    </div>
  )
}

function RightGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{children}</div>
}

function Pill({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      style={{
        padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
        background: on ? C.successSoft : '#F1F5F9',
        color: on ? '#166534' : C.mute,
      }}
    >
      {label}
    </span>
  )
}

function Toggle({ on, onClick, disabled = false }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      style={{
        width: 40, height: 22, borderRadius: 999, border: 'none',
        background: on ? C.primary : C.border,
        position: 'relative', cursor: disabled ? 'wait' : 'pointer', transition: 'background 0.15s',
        opacity: disabled ? 0.6 : 1,
        padding: 0, flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute', top: 3, left: on ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#FFF',
          transition: 'left 0.15s',
        }}
      />
    </button>
  )
}

function Chevron({ label, onClick, danger }: { label: string; onClick?: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false)
  const bg = danger
    ? hover ? '#FEE2E2' : C.dangerFaint
    : hover ? '#E2E8F0' : C.surface
  const color = danger ? '#B91C1C' : '#475569'
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 10px 6px 12px', borderRadius: 8, border: 'none',
        background: bg, color, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      {label}
      <span style={{ fontSize: 14, lineHeight: 1 }}>›</span>
    </button>
  )
}

function Segmented({ value, onChange }: { value: Theme; onChange: (v: Theme) => void }) {
  const opts: { v: Theme; label: string }[] = [
    { v: 'light', label: '라이트' },
    { v: 'dark', label: '다크' },
  ]
  return (
    <div style={{ display: 'inline-flex', padding: 3, gap: 2, background: '#F1F5F9', borderRadius: 8 }}>
      {opts.map(o => {
        const active = o.v === value
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              fontSize: 12, fontWeight: 600,
              background: active ? '#FFF' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
              color: active ? C.navy : C.mute,
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '9px 14px', borderRadius: 8,
        background: hover ? C.surface : '#FFF',
        border: `1px solid ${C.borderSoft}`,
        color: C.text, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function DangerButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '9px 18px', borderRadius: 8,
        background: hover ? '#FEE2E2' : C.dangerFaint,
        border: `1px solid #FECACA`,
        color: '#B91C1C', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

/* ============== Modals ============== */

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.cardBg, borderRadius: 16,
          border: `1px solid ${C.borderSoft}`,
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
          width: '100%', maxWidth: 460, padding: '28px 28px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matchError = confirm.length > 0 && next !== confirm
  const diffError = next.length > 0 && current.length > 0 && next === current
  // 버튼은 3개 필드 모두 채워졌으면 활성화. 일치/길이/중복 검증은 submit 시점에 한 번 더.
  const canSubmit =
    !submitting &&
    current.length > 0 &&
    next.length > 0 &&
    confirm.length > 0

  async function handleSubmit() {
    if (submitting) return
    setError(null)
    if (next.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (next === current) {
      setError('현재 비밀번호와 다르게 설정해주세요.')
      return
    }
    setSubmitting(true)
    const res = await apiChangePassword(current, next)
    setSubmitting(false)
    if (!res.success) {
      setError(res.error || '비밀번호 변경에 실패했습니다.')
      return
    }
    alert('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.')
    onClose()
  }

  return (
    <ModalShell onClose={onClose}>
      <div
        style={{
          width: 44, height: 44, borderRadius: '50%', background: '#DBEAFE',
          color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700,
        }}
      >
        🔒
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>비밀번호 변경</h2>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: C.mute }}>
        보안을 위해 현재 비밀번호를 확인한 뒤 새 비밀번호를 설정합니다.
      </p>

      <Field label="현재 비밀번호">
        <PasswordInput
          value={current}
          onChange={setCurrent}
          placeholder="••••••••"
          autoFocus
          name="mora-current-pw"
          autoComplete="off"
        />
      </Field>
      <Field
        label="새로운 비밀번호"
        hint={diffError ? '현재 비밀번호와 다르게 설정해주세요.' : '8자 이상'}
      >
        <PasswordInput
          value={next}
          onChange={setNext}
          placeholder="8자 이상"
          name="mora-new-pw"
          autoComplete="new-password"
        />
      </Field>
      <Field
        label="새로운 비밀번호 확인"
        hint={matchError ? '새 비밀번호가 일치하지 않습니다.' : undefined}
      >
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          placeholder="한 번 더 입력"
          name="mora-confirm-pw"
          autoComplete="new-password"
        />
      </Field>

      {error && (
        <p style={{ fontSize: 12, color: C.danger, margin: 0 }}>{error}</p>
      )}

      <ModalActions
        onCancel={onClose}
        confirmLabel={submitting ? '변경 중…' : '변경'}
        confirmDisabled={!canSubmit}
        confirmTone="navy"
        onConfirm={handleSubmit}
      />
    </ModalShell>
  )
}

function NicknameModal({
  current, onClose, onSave,
}: {
  current: string
  onClose: () => void
  onSave: (next: string) => void
}) {
  const [value, setValue] = useState(current)
  const trimmed = value.trim()
  const valid = trimmed.length >= 2 && trimmed.length <= 20 && /^[a-zA-Z0-9가-힣_.-]+$/.test(trimmed)
  const changed = trimmed !== current
  return (
    <ModalShell onClose={onClose}>
      <div
        style={{
          width: 44, height: 44, borderRadius: '50%', background: '#DBEAFE',
          color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700,
        }}
      >
        U
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>닉네임 변경</h2>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: C.mute }}>
        다른 사용자에게 표시될 이름입니다. 2~20자, 한글·영문·숫자·_.- 사용 가능.
      </p>

      <Field label="새 닉네임" hint={!valid && trimmed.length > 0 ? '허용되지 않은 문자가 포함되어 있거나 글자 수가 맞지 않습니다.' : undefined}>
        <input
          type="text"
          value={value}
          autoFocus
          onChange={e => setValue(e.target.value)}
          placeholder="새 닉네임"
          maxLength={20}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            fontSize: 14, color: C.navy, outline: 'none',
          }}
        />
      </Field>

      <ModalActions
        onCancel={onClose}
        confirmLabel="저장"
        confirmDisabled={!valid || !changed}
        confirmTone="navy"
        onConfirm={() => onSave(trimmed)}
      />
    </ModalShell>
  )
}

function ConfirmModal({
  icon, title, description, confirmLabel, onClose, onConfirm, requirePassword,
}: {
  icon: string
  title: string
  description: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => void
  requirePassword?: boolean
}) {
  const [pw, setPw] = useState('')
  const canSubmit = !requirePassword || pw.length > 0
  return (
    <ModalShell onClose={onClose}>
      <div
        style={{
          width: 48, height: 48, borderRadius: '50%', background: C.dangerSoft,
          color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700,
        }}
      >
        {icon}
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{title}</h2>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: C.mute }}>{description}</p>

      {requirePassword && (
        <Field label="비밀번호">
          <PasswordInput value={pw} onChange={setPw} placeholder="••••••••" autoFocus />
        </Field>
      )}

      <ModalActions
        onCancel={onClose}
        confirmLabel={confirmLabel}
        confirmDisabled={!canSubmit}
        confirmTone="danger"
        onConfirm={onConfirm}
      />
    </ModalShell>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: C.faint }}>{hint}</p>}
    </div>
  )
}

function PasswordInput({
  value, onChange, placeholder, autoFocus, name, autoComplete,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  name?: string
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  const [focused, setFocused] = useState(false)
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px', borderRadius: 10,
        background: C.surface,
        border: `1px solid ${focused ? '#93C5FD' : C.borderSoft}`,
        transition: 'border 0.15s',
      }}
    >
      <input
        type={show ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        name={name}
        autoComplete={autoComplete ?? 'new-password'}
        data-lpignore="true"
        data-1p-ignore=""
        style={{
          flex: 1, border: 'none', background: 'transparent', outline: 'none',
          fontSize: 14, color: C.navy,
        }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 14, color: C.faint, padding: 0,
        }}
        aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
      >
        {show ? '🙈' : '👁'}
      </button>
    </div>
  )
}

function ModalActions({
  onCancel, onConfirm, confirmLabel, confirmDisabled, confirmTone,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  confirmDisabled?: boolean
  confirmTone: 'navy' | 'danger'
}) {
  const tone = confirmTone === 'danger'
    ? { bg: confirmDisabled ? '#FCA5A5' : C.danger, color: '#FFF' }
    : { bg: confirmDisabled ? '#475569' : C.navy, color: '#FFF' }
  return (
    <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          flex: 1, padding: '12px 0', borderRadius: 10,
          background: '#FFF', border: `1px solid ${C.borderSoft}`,
          color: C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        취소
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        style={{
          flex: 1, padding: '12px 0', borderRadius: 10,
          background: tone.bg, color: tone.color, border: 'none',
          fontSize: 13, fontWeight: 700,
          cursor: confirmDisabled ? 'not-allowed' : 'pointer',
          opacity: confirmDisabled ? 0.7 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
