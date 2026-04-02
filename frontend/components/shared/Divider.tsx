'use client'

// ============================================================================
// Divider
// ----------------------------------------------------------------------------
// 역할:
// - 이메일/비밀번호 로그인 영역과 소셜 로그인 영역 사이의 구분선
//
// 구현 방식:
// - 전체 가로선(absolute) 위에 "또는" 텍스트 박스를 겹쳐서
//   시각적으로 선이 끊겨 보이도록 처리
// ============================================================================
export function Divider() {
  return (
    // 소셜 로그인 영역과 일반 로그인 폼 사이의 시각적 구분선
    <div className="relative w-full h-[20px] flex items-center justify-center">
      <div className="absolute inset-x-0 h-px bg-[#767676]" />
      <div className="relative px-[20px] bg-white text-[#3c4045] text-[13px]">또는</div>
    </div>
  )
}
