'use client'

// ============================================================================
// SocialButtons
// ----------------------------------------------------------------------------
// 역할:
// - 네이버/카카오/구글 소셜 로그인 버튼 세트를 제공한다.
// - 각 버튼 클릭 시 백엔드 OAuth 시작 엔드포인트로 이동한다.
//
// 구성:
// - provider별 아이콘 컴포넌트 (NaverIcon, KakaoIcon, GoogleIcon)
// - 공통 버튼 래퍼(SocialButton)
// - provider 전용 버튼(NaverButton/KakaoButton/GoogleButton)
//
// 참고:
// - SVG path 데이터는 lib/svgPaths.ts에 분리해 아이콘 코드 가독성 유지
// ============================================================================
import { svgPaths } from '@/lib/svgPaths'

// 네이버 아이콘 path는 svgPaths.ts에서 중앙 관리
function NaverIcon() {
  return (
    <span className="relative h-[24px] w-[24px]">
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full" fill="none">
        <g>
          <path d={svgPaths.p3354e280} fill="#C9693D" />
          <path d={svgPaths.p3354e280} fill="#FFF" />
        </g>
      </svg>
    </span>
  )
}

function KakaoIcon() {
  return (
    <span className="relative h-[24px] w-[24px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 24 24" fill="none">
        <g>
          <path d={svgPaths.p37bfff00} fill="#3C1E1E" />
        </g>
      </svg>
    </span>
  )
}

function GoogleIcon() {
  return (
    <span className="relative h-[24px] w-[24px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 24 24" fill="none">
        <g>
          <path d={svgPaths.p9a95980} fill="#4285F4" />
          <path d={svgPaths.pffc4c00} fill="#34A853" />
          <path d={svgPaths.p75ae700} fill="#FBBC05" />
          <path d={svgPaths.p25a44c00} fill="#EA4335" />
        </g>
      </svg>
    </span>
  )
}

interface SocialButtonProps {
  label: string
  className: string
  icon: React.ReactNode
  href: string
  border?: boolean
}

export function SocialButton({ label, className, icon, href, border }: SocialButtonProps) {
  return (
    <button
      type="button"
      // OAuth 시작 엔드포인트로 전체 페이지 이동
      onClick={() => {
        window.location.href = href
      }}
      className={`${className} relative flex items-center justify-center gap-[12px] h-[56px] rounded-[14px] text-[16px] font-semibold`}
    >
      {icon}
      <span>{label}</span>
      {border && <span className="absolute inset-0 rounded-[14px] border border-[#505050] pointer-events-none" />}
    </button>
  )
}

interface SocialButtonsProps {
  apiBase: string
}

// provider별 엔드포인트만 다르고 공통 버튼 컴포넌트를 재사용
export function NaverButton({ apiBase }: SocialButtonsProps) {
  return (
    <SocialButton
      label="네이버로 로그인하기"
      className="bg-[#54cf48] text-white w-full"
      icon={<NaverIcon />}
      href={`${apiBase}/auth/naver/login`}
    />
  )
}

export function KakaoButton({ apiBase }: SocialButtonsProps) {
  return (
    <SocialButton
      label="카카오로 로그인하기"
      className="bg-[#fee500] text-[#3c1e1e] w-full"
      icon={<KakaoIcon />}
      href={`${apiBase}/auth/kakao/login`}
    />
  )
}

export function GoogleButton({ apiBase }: SocialButtonsProps) {
  return (
    <SocialButton
      label="Google로 로그인하기"
      className="bg-white text-[#15293d] w-full"
      icon={<GoogleIcon />}
      border
      href={`${apiBase}/auth/google/login`}
    />
  )
}
