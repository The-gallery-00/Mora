'use client'

// ============================================================================
// FeatureChip
// ----------------------------------------------------------------------------
// 역할:
// - Hero 하단에 반복 렌더링되는 작은 카테고리 배지(아이콘 + 라벨)
//
// props:
// - label: 화면에 표시할 문서 타입 텍스트
//
// 스타일:
// - 상단 48x48 라운드 박스 + 중앙 점 아이콘
// - 하단에 작은 설명 라벨 텍스트
// ============================================================================
interface FeatureChipProps {
  label: string
}

export function FeatureChip({ label }: FeatureChipProps) {
  return (
    // 작은 문서 카테고리 배지(점 아이콘 + 라벨)
    <div className="flex flex-col gap-[12px] h-[80px] items-center shrink-0 w-[48px]">
      <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[12px] bg-[rgba(0,119,182,0.08)]">
        <div className="h-[8px] w-[8px] rounded-[4px] bg-[#0077b6]" />
      </div>
      <p className="text-[#15293d] text-[13px] leading-[19.5px] text-center">{label}</p>
    </div>
  )
}
