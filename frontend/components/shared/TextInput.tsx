'use client'

// ============================================================================
// TextInput
// ----------------------------------------------------------------------------
// 역할:
// - 인증 폼에서 사용하는 공통 입력 필드(email/password 전용)
//
// 스타일 구조:
// - 배경 레이어, 보더 레이어, 그림자 레이어를 분리해 디자인을 재현
// - 실제 input은 투명 배경으로 두고 상단(z-10) 레이어에서 입력 처리
//
// 치수 기준:
// - 높이 h-[56px]로 로그인 버튼과 동일한 높이 유지
// - !pl-4 / !pr-4로 좌우 16px 패딩 우선 적용
// ============================================================================
interface TextInputProps {
  type: 'email' | 'password'
  value: string
  placeholder: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function TextInput({ type, value, placeholder, onChange }: TextInputProps) {
  return (
    // 배경/보더/그림자를 레이어로 분리해 피그마 원본 질감을 재현
    <div className="relative rounded-[14px] w-full">
      <div aria-hidden="true" className="absolute inset-0 bg-[#f8fafc] rounded-[14px]" />
      <div aria-hidden="true" className="absolute inset-0 rounded-[14px] border border-[#cbd5e1]" />
      <div className="relative z-10">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          // !pl-4 / !pr-4: 외부 우선순위 충돌이 있어도 좌우 16px 패딩 유지
          className={`w-full h-[56px] bg-transparent border-none outline-none !pl-4 !pr-4 font-medium text-[16px] leading-[24px] ${
            value ? 'text-[#111]' : 'text-[#999]'
          } placeholder:text-[#999]`}
          required
        />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_4px_4px_0px_rgba(0,0,0,0.25)]" />
    </div>
  )
}
