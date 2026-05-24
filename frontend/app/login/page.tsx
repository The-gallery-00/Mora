'use client'

// ============================================================================
// LoginPage (/login)
// ----------------------------------------------------------------------------
// 역할:
// - 이메일/비밀번호 로그인 화면을 렌더링하고 인증 API를 호출한다.
// - 성공 시 토큰/사용자 정보를 localStorage에 저장한 뒤 대시보드로 이동한다.
//
// 동작 흐름:
// 1) AuthForm에서 이메일/비밀번호 입력
// 2) handleSubmit에서 /auth/login 호출
// 3) 응답에서 token 추출 후 localStorage 저장 (mora_token, mora_user)
// 4) /dashboard로 이동
//
// 참고:
// - UI 뼈대(폼 레이아웃)는 AuthForm/Hero 컴포넌트로 분리되어 있어
//   이 파일은 "페이지 상태 + 로그인 로직"에 집중한다.
// ============================================================================
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthForm } from '@/components/shared/AuthForm'
import { Hero } from '@/components/shared/Hero'

// 인증 API 기본 주소 (환경변수 미설정 시 로컬 Spring 서버 사용)
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export default function LoginPage() {
  // 로그인 입력 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (localStorage.getItem('mora_token')) {
      router.replace('/dashboard')
    }
  }, [router])

  // 이메일/비밀번호 로그인 요청 후 토큰 저장
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // 백엔드 표준 에러 포맷(data.error / data.data.error) 모두 대응
        setError(data.error || data.data?.error || '로그인에 실패했습니다')
        return
      }

      const authData = data.data || data
      const token = authData.token

      if (!token) {
        setError('토큰을 받지 못했습니다')
        return
      }

      // 대시보드 레이아웃에서 사용 중인 키 이름과 동일하게 저장
      localStorage.setItem('mora_token', token)
      localStorage.setItem(
        'mora_user',
        JSON.stringify({
          id: authData.userId ?? authData.id,
          email: authData.email ?? email,
          name: authData.name ?? email.split('@')[0],
        }),
      )
      window.dispatchEvent(new Event('mora-session-change'))

      router.replace('/dashboard')
    } catch {
      setError('서버에 연결할 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white relative min-h-screen">
      {/* 원본 디자인 기준: 중앙 고정 2열(브랜딩 + 인증 폼) 레이아웃 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-[140px] items-start">
        <Hero />
        <AuthForm
          mode="login"
          email={email}
          password={password}
          loading={loading}
          error={error}
          apiBase={API}
          onEmailChange={(event) => setEmail(event.target.value)}
          onPasswordChange={(event) => setPassword(event.target.value)}
          onLinkClick={() => router.push('/signup')}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
