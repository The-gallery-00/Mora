'use client'

import { Divider } from './Divider'
import { SocialButtons } from './SocialButtons'
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
  const titleSpacingByMode = {
    login: 20,
    signup: 20,
  } as const

  const formTitle = mode === 'login' ? '로그인' : '회원가입'
  const buttonLabel = mode === 'login' ? '로그인' : '가입하기'
  const bottomText = mode === 'login' ? '계정이 없으신가요?' : '계정이 있으신가요?'
  const bottomLink = mode === 'login' ? '회원가입' : '로그인'

  return (
    <form onSubmit={onSubmit} className="flex w-[415.5px] flex-col gap-[16px]">
      <h1
        className="text-center text-[24px] font-bold leading-[1.1] text-[#15293d]"
        style={{ marginBottom: `${titleSpacingByMode[mode]}px` }}
      >
        {formTitle}
      </h1>

      <TextInput type="email" value={email} onChange={onEmailChange} placeholder="이메일" />
      <TextInput type="password" value={password} onChange={onPasswordChange} placeholder="비밀번호" />
      <button
        type="submit"
        disabled={loading}
        className="h-[56px] rounded-[14px] bg-[#15293d] text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? '처리 중...' : buttonLabel}
      </button>
      {error && <p className="text-center text-[14px] leading-[20px] text-[#dc2626]">{error}</p>}

      <Divider />

      <SocialButtons apiBase={apiBase} variant={mode === 'login' ? 'icon' : 'full'} />

      <p className="text-center text-[16px] text-[#505050]">
        {bottomText}{' '}
        <span className="cursor-pointer font-semibold text-[#0077b6]" onClick={onLinkClick}>
          {bottomLink}
        </span>
      </p>
    </form>
  )
}
