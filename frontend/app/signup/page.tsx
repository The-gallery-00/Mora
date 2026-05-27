'use client'

// ============================================================================
// SignupPage (/signup)
// ----------------------------------------------------------------------------
// 역할:
// - 이메일/비밀번호 회원가입 요청을 처리한다.
// - 회원가입 성공 시 세션 정보를 localStorage에 저장하고 대시보드로 이동한다.
//
// 화면 구성:
// - 왼쪽: Hero(로고/이미지)
// - 오른쪽: AuthForm(입력 폼)
// - 좌/우 영역은 absolute로 분리해 서로 위치 영향을 주지 않도록 고정
// ============================================================================
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthForm } from '@/components/shared/AuthForm'
import { Hero } from '@/components/shared/Hero'

// 인증 API 기본 주소(환경변수가 없으면 로컬 백엔드 사용)
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export default function SignupPage() {
  // 폼 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // 이미 로그인된 경우 대시보드로 리다이렉트
  useEffect(() => {
    if (localStorage.getItem('mora_token')) {
      router.replace('/dashboard')
    }
  }, [router])

  // 회원가입 요청 처리
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name: email.split('@')[0] || 'mora-user',
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // 백엔드 에러 포맷(data.error / data.data.error) 모두 대응
        setError(data.error || data.data?.error || '회원가입에 실패했습니다')
        return
      }

      const authData = data.data || data
      const token = authData.token

      if (!token) {
        setError('토큰을 받지 못했습니다')
        return
      }

      // 전역 세션 상태에서 사용하는 키로 저장
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
      setError('서버와 연결할 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white relative min-h-screen">
      <div className="absolute left-1/2 top-1/2 h-[560px] w-[880px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-0 top-0">
          <Hero />
        </div>
        <div className="absolute right-0 top-0">
          <AuthForm
            mode="signup"
            email={email}
            password={password}
            loading={loading}
            error={error}
            apiBase={API}
            onEmailChange={(event) => setEmail(event.target.value)}
            onPasswordChange={(event) => setPassword(event.target.value)}
            onLinkClick={() => router.push('/login')}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
