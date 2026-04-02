'use client'

// ============================================================================
// Hero (Auth Left Panel)
// ----------------------------------------------------------------------------
// 역할:
// - 로그인/회원가입 화면 왼쪽에 보이는 브랜드 소개 영역
// - 로고, 핵심 카피, 문서 카테고리(FeatureChip) 목록을 표시
//
// 스타일 포인트:
// - 문구 줄바꿈이 바뀌지 않도록 whitespace-nowrap 사용
// - 상단 로고/중앙 문구/하단 칩 목록을 세로로 균등 배치
// ============================================================================
import { FeatureChip } from './FeatureChip'

// 랜딩/인증 공통으로 보여줄 핵심 문서 타입
const featureItems = ['명함', '포스터', '티켓', '영수증']

export function Hero() {
  return (
    // 인증 화면 좌측 브랜딩 영역
    <div className="flex flex-col h-[495px] items-center justify-between w-[368px]">
      <div className="h-[75px] w-[368px]">
        <p className="font-['Patua_One'] text-[#15293d] text-[64px] text-center">MORA</p>
      </div>
      {/* 문장 줄바꿈이 바뀌지 않도록 nowrap + 내용 기반 폭 사용 */}
      <div className="w-fit flex flex-col gap-2 text-center">
        <p className="font-semibold text-[#111] text-[24px] whitespace-nowrap">흩어진 정보를, 한곳에</p>
        <p className="font-medium text-[#505050] text-[20px] whitespace-nowrap">일상의 모든 기록을 간편하게 보관하세요</p>
      </div>
      <div className="flex flex-wrap gap-[24px_36px] w-[300px] justify-center">
        {featureItems.map((item) => (
          <FeatureChip key={item} label={item} />
        ))}
      </div>
    </div>
  )
}
