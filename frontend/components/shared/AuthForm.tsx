'use client'

// ============================================================================
// AuthForm
// ----------------------------------------------------------------------------
// 역할:
// - 로그인/회원가입 화면에서 공통으로 쓰는 인증 입력 폼 컴포넌트
// - 이메일/비밀번호 입력, 제출 버튼, 소셜 로그인 버튼, 하단 모드 전환 링크를 제공
//
// 설계 포인트:
// - mode 값(login/signup)에 따라 버튼/문구만 바꾸고 동일 레이아웃 재사용
// - 실제 제출 로직(onSubmit), 상태(email/password/loading/error)는
//   페이지 컴포넌트에서 주입받아 화면과 비즈니스 로직을 분리
// ============================================================================
import { Divider } from './Divider'
import { GoogleButton, KakaoButton, NaverButton } from './SocialButtons'
import { TextInput } from './TextInput'

interface AuthFormProps {
  mode: 'login' | 'signup'
  email: string
  password: string
  loading: boolean
  error: string
  apiBase: string
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onLinkClick: () => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
}

export function AuthForm({
  mode,
  email,
  password,
  loading,
  error,
  apiBase,
  onEmailChange,
  onPasswordChange,
  onLinkClick,
  onSubmit,
}: AuthFormProps) {
  // 페이지 모드(login/signup)에 따라 문구만 변경하고 UI 골격은 재사용
  const buttonLabel = mode === 'login' ? '로그인' : '가입하기'
  const bottomText = mode === 'login' ? '계정이 없으신가요?' : '계정이 있으신가요?'
  const bottomLink = mode === 'login' ? '회원가입' : '로그인'

  return (
    // 제출 로직은 상위 페이지에서 주입받아 로그인/회원가입을 분리 처리
    <form onSubmit={onSubmit} className="flex flex-col gap-[16px] w-[415.5px]">
      <TextInput type="email" value={email} onChange={onEmailChange} placeholder="이메일" />
      <TextInput type="password" value={password} onChange={onPasswordChange} placeholder="비밀번호" />
      <button
        type="submit"
        disabled={loading}
        className="bg-[#15293d] h-[56px] rounded-[14px] font-semibold text-[16px] text-white disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? '처리 중...' : buttonLabel}
      </button>
      {error && <p className="text-[14px] leading-[20px] text-[#dc2626] text-center">{error}</p>}
      {/* 일반 로그인과 소셜 로그인 영역을 시각적으로 분리 */}
      <Divider />
      <NaverButton apiBase={apiBase} />
      <KakaoButton apiBase={apiBase} />
      <GoogleButton apiBase={apiBase} />
      <p className="text-[16px] text-[#505050] text-center">
        {bottomText}{' '}
        <span className="text-[#0077b6] font-semibold cursor-pointer" onClick={onLinkClick}>
          {bottomLink}
        </span>
      </p>
    </form>
  )
}
