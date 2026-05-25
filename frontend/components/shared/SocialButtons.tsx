'use client'

import { svgPaths } from '@/lib/svgPaths'

type SocialButtonsVariant = 'icon' | 'full'
type SocialProvider = 'naver' | 'kakao' | 'google'

interface SocialButtonProps {
  providerName: string
  label: string
  className: string
  icon: React.ReactNode
  href: string
  variant: SocialButtonsVariant
  border?: boolean
  borderColor?: string
}

interface SocialButtonsProps {
  apiBase: string
  variant: SocialButtonsVariant
}

function NaverIcon({ color = '#2DB400' }: { color?: string }) {
  return (
    <span className="relative h-[22px] w-[22px]">
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full" fill="none">
        <path d={svgPaths.p3354e280} fill={color} />
      </svg>
    </span>
  )
}

function KakaoIcon() {
  return (
    <span className="relative h-[22px] w-[22px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 24 24" fill="none">
        <path d={svgPaths.p37bfff00} fill="#3C1E1E" />
      </svg>
    </span>
  )
}

function GoogleIcon() {
  return (
    <span className="relative h-[22px] w-[22px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 24 24" fill="none">
        <path d={svgPaths.p9a95980} fill="#4285F4" />
        <path d={svgPaths.pffc4c00} fill="#34A853" />
        <path d={svgPaths.p75ae700} fill="#FBBC05" />
        <path d={svgPaths.p25a44c00} fill="#EA4335" />
      </svg>
    </span>
  )
}

function SocialButton({
  providerName,
  label,
  className,
  icon,
  href,
  variant,
  border,
  borderColor = '#d1d5db',
}: SocialButtonProps) {
  const isIcon = variant === 'icon'
  const shapeClass = isIcon
    ? 'h-[56px] w-[56px] rounded-full transition-transform duration-150 hover:-translate-y-[1px]'
    : 'h-[56px] w-full rounded-[14px] gap-[12px] text-[16px] font-semibold'

  return (
    <button
      type="button"
      aria-label={`${providerName} 계정으로 시작하기`}
      title={`${providerName} 로그인`}
      onClick={() => {
        window.location.href = href
      }}
      className={`${className} relative flex items-center justify-center ${shapeClass}`}
    >
      {icon}
      {!isIcon && <span>{label}</span>}
      {border && (
        <span
          className={`pointer-events-none absolute inset-0 ${isIcon ? 'rounded-full' : 'rounded-[14px]'} border`}
          style={{ borderColor }}
        />
      )}
    </button>
  )
}

function getProviderConfig(provider: SocialProvider, variant: SocialButtonsVariant) {
  if (provider === 'naver') {
    if (variant === 'icon') {
      return {
        providerName: '네이버',
        label: '네이버로 시작하기',
        className: 'bg-white',
        icon: <NaverIcon />,
        border: true,
        borderColor: '#d1d5db',
      }
    }

    return {
      providerName: '네이버',
      label: '네이버로 시작하기',
      className: 'bg-[#54cf48] text-white',
      icon: <NaverIcon color="#ffffff" />,
      border: false,
      borderColor: '#d1d5db',
    }
  }

  if (provider === 'kakao') {
    return {
      providerName: '카카오',
      label: '카카오로 시작하기',
      className: 'bg-[#fee500] text-[#3c1e1e]',
      icon: <KakaoIcon />,
      border: false,
      borderColor: '#d1d5db',
    }
  }

  if (variant === 'icon') {
    return {
      providerName: '구글',
      label: 'Google로 시작하기',
      className: 'bg-white text-[#15293d]',
      icon: <GoogleIcon />,
      border: true,
      borderColor: '#d1d5db',
    }
  }

  return {
    providerName: '구글',
    label: 'Google로 시작하기',
    className: 'bg-white text-[#15293d]',
    icon: <GoogleIcon />,
    border: true,
    borderColor: '#505050',
  }
}

export function SocialButtons({ apiBase, variant }: SocialButtonsProps) {
  const providers: SocialProvider[] = variant === 'icon' ? ['google', 'kakao', 'naver'] : ['google', 'kakao', 'naver']

  if (variant === 'icon') {
    return (
      <div className="flex items-center justify-center gap-[18px] py-[4px]">
        {providers.map((provider) => {
          const config = getProviderConfig(provider, variant)
          return (
            <SocialButton
              key={provider}
              providerName={config.providerName}
              label={config.label}
              className={config.className}
              icon={config.icon}
              href={`${apiBase}/auth/${provider}/login`}
              variant={variant}
              border={config.border}
              borderColor={config.borderColor}
            />
          )
        })}
      </div>
    )
  }

  return (
    <>
      {providers.map((provider) => {
        const config = getProviderConfig(provider, variant)
        return (
          <SocialButton
            key={provider}
            providerName={config.providerName}
            label={config.label}
            className={config.className}
            icon={config.icon}
            href={`${apiBase}/auth/${provider}/login`}
            variant={variant}
            border={config.border}
            borderColor={config.borderColor}
          />
        )
      })}
    </>
  )
}
