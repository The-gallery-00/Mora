// ═══════════════════════════════════════════════════════════════
// dashboard/upload/page.tsx — 이미지 업로드 & OCR 스캔 페이지
// ═══════════════════════════════════════════════════════════════
//
// [역할]
// 사용자가 이미지를 업로드하면 OCR로 텍스트를 추출하고,
// 문서 종류(명함/포스터/영수증/티켓 등)에 맞는 필드를 편집한 뒤
// DB에 저장할 수 있는 페이지.
// 드래그앤드롭 및 파일 선택 모두 지원한다.
//
// [코드 흐름]
// 1) 사용자가 이미지를 드래그앤드롭하거나 "파일 선택" 버튼으로 업로드
// 2) handleFile()이 File 객체를 받아 FileReader로 미리보기 생성
// 3) "이미지 스캔하기" 클릭 → handleScan()이 scanImage() API 호출
// 4) OCR 결과가 돌아오면 문서 종류별 필드를 편집 가능하게 표시
// 5) 문서 종류 변경 시 handleTypeChange()가 공통 필드(phone, email 등) 값 유지
// 6) "확인 & 저장" 클릭 → handleSave()가 saveCard() API 호출
// 7) 저장 성공 시 완료 화면 표시 → "다른 이미지 스캔" 버튼으로 초기화
//
// [컴포넌트/함수 목록]
// - UploadPage():      업로드 → 스캔 → 편집 → 저장 전체 플로우를 관리하는 페이지 컴포넌트
// - handleFile():      File 객체를 받아 상태를 초기화하고 미리보기(base64)를 생성
// - handleDrop():      드래그앤드롭 이벤트에서 이미지 파일을 추출하여 handleFile 호출
// - handleScan():      scanImage() API를 호출하고 결과를 편집 필드에 세팅
// - handleTypeChange(): 문서 종류 변경 시 새 스키마의 필드를 적용하되 공통 필드 값 유지
// - handleSave():      수정된 데이터를 saveCard() API로 저장
// - handleReset():     모든 상태를 초기화하여 새 업로드를 시작
//
// [사용된 라이브러리/훅]
// ───────────────────────────────────────────
// useState()          — file, preview, isLoading, editFields 등 다수의 UI 상태 관리
// useCallback()       — handleFile, handleDrop 함수를 메모이제이션하여 불필요한 재생성 방지
// scanImage() (api)   — FormData에 이미지를 담아 /api/scan 엔드포인트에 OCR 요청
// saveCard() (api)    — 문서 데이터를 /api/save 엔드포인트에 저장
// DocumentType (type) — 문서 종류 타입 ('BUSINESS_CARD' | 'POSTER' | 'RECEIPT' | ...)
// ScanResult (type)   — OCR 스캔 결과 인터페이스 (type, confidence, parsed, fields, ...)
// FileReader (Web API)— 이미지 파일을 base64 Data URL로 변환하여 미리보기에 사용
// ───────────────────────────────────────────

'use client'

import { useState, useCallback, useRef } from 'react'
import { scanImage, saveCard } from '@/lib/api'
import type { DocumentType, ScanResult, RawBlock } from '@/types'

// 문서 종류별 필드 스키마 (백엔드 field_schema.py FIELD_LABELS_KO와 동일)
const DOCUMENT_FIELD_SCHEMAS: Record<DocumentType, Record<string, string>> = {
  BUSINESS_CARD: {
    name: '이름', english_name: '영문 이름', company_name: '회사명',
    department: '부서', job_title: '직책', mobile_phone: '휴대폰',
    office_phone: '사무실 전화', fax: '팩스', email: '이메일',
    address: '주소', website: '웹사이트', zip_code: '우편번호',
  },
  POSTER: {
    title: '제목', organizer_name: '주최자', event_start_date: '행사 시작일',
    event_end_date: '행사 종료일', contact_phone: '연락처 전화',
    contact_email: '연락처 이메일', location: '장소', website_url: '웹사이트 URL',
  },
  RECEIPT: {
    store_name: '가게 이름', purchase_date: '구매일자', total_amount: '합계금액',
  },
  TICKET: {
    transport_type: '교통수단', departure_location: '출발지',
    departure_date: '출발일', departure_time: '출발 시간',
    arrival_location: '도착지', arrival_date: '도착일', arrival_time: '도착 시간',
  },
  ETC: {},
}

// 문서 종류 간 의미적으로 동일한 필드 매핑 (타입 전환 시 값 보존용)
const COMMON_FIELD_MAP: Record<string, string[]> = {
  mobile_phone: ['contact_phone', 'office_phone'],
  contact_phone: ['mobile_phone', 'office_phone'],
  office_phone: ['mobile_phone', 'contact_phone'],
  email: ['contact_email'],
  contact_email: ['email'],
  website: ['website_url'],
  website_url: ['website'],
}

export default function UploadPage() {
  // === 파일 및 미리보기 관련 상태 ===
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // === 문서 분류 관련 상태 ===
  const [documentType, setDocumentType] = useState<DocumentType>('ETC')
  const [confidence, setConfidence] = useState(0)
  const [ocrScanResult, setOcrScanResult] = useState<ScanResult | null>(null)

  // === OCR 결과를 사용자가 수정할 수 있는 편집 필드 ===
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({})

  // === 스캔 완료 여부 (UI 전환용) ===
  const [isScanned, setIsScanned] = useState(false)

  // === 디버그: 선택된 raw block bbox 오버레이 ===
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // 파일 선택 또는 드롭 시 호출 — 상태 초기화 + FileReader로 미리보기 생성
  const handleFile = useCallback((f: File) => {
    setFile(f)
    setError(null)
    setIsScanned(false)
    setIsSaved(false)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [])

  // 드래그앤드롭 이벤트 핸들러 — 이미지 파일만 허용
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }, [handleFile])

  // OCR 스캔 실행 — scanImage API 호출 후 분류 결과 + 파싱 결과 세팅
  const handleScan = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)

    const res = await scanImage(file)
    setIsLoading(false)

    if (res.success) {
      const { type, confidence: conf, parsed, fields, rawTexts, imageUrl: imgUrl } = res.data
      setOcrScanResult(res.data)
      setDocumentType(type)
      setConfidence(conf)
      setImageUrl(imgUrl)

      // 백엔드 fields가 있으면 사용, 없으면 프론트 스키마로 폴백
      const labels = Object.keys(fields).length > 0 ? fields : DOCUMENT_FIELD_SCHEMAS[type]
      setFieldLabels(labels)

      // 스키마 필드 기준으로 편집 필드 초기화
      const initialFields: Record<string, string> = {}
      for (const key of Object.keys(labels)) {
        initialFields[key] = parsed[key] || ''
      }
      setEditFields(initialFields)

      // UI 전환
      setIsScanned(true)
    } else {
      setError(res.error)
    }
  }

  // 문서 종류 변경 시 공통 필드(phone, email 등) 값 유지
  const handleTypeChange = (newType: DocumentType) => {
    const newSchema = DOCUMENT_FIELD_SCHEMAS[newType]
    const newFields: Record<string, string> = {}
    for (const key of Object.keys(newSchema)) {
      // 1) 동일 키 이름이 있으면 직접 복사
      if (editFields[key] !== undefined && editFields[key] !== '') {
        newFields[key] = editFields[key]
      }
      // 2) 동일 키 없으면 COMMON_FIELD_MAP에서 등가 필드 찾기
      else if (COMMON_FIELD_MAP[key]) {
        const sourceKey = COMMON_FIELD_MAP[key].find(k => editFields[k] && editFields[k] !== '')
        newFields[key] = sourceKey ? editFields[sourceKey] : (ocrScanResult?.parsed[key] ?? '')
      }
      // 3) 원본 파싱값 → 빈 문자열 순으로 폴백
      else {
        newFields[key] = ocrScanResult?.parsed[key] ?? ''
      }
    }
    setDocumentType(newType)
    setFieldLabels(newSchema)
    setEditFields(newFields)
  }

  // 수정된 데이터를 DB에 저장
  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    // editFields 전체를 documentType과 함께 전달 + NER 학습 데이터 축적
    const res = await saveCard(documentType, editFields, imageUrl,
      ocrScanResult?.rawTexts || [],
      ocrScanResult?.rawBlocks || [])
    setIsSaving(false)

    if (res.success) {
      setIsSaved(true)
    } else {
      setError(res.error || '저장 실패')
    }
  }

  // 모든 상태를 초기화하여 새 업로드를 시작
  const handleReset = () => {
    setFile(null); setPreview(null); setIsScanned(false); setOcrScanResult(null)
    setIsSaved(false); setError(null); setImageUrl('')
    setDocumentType('ETC'); setConfidence(0)
    setEditFields({}); setFieldLabels({})
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>문서 업로드</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
        이미지를 올리면 OCR로 텍스트를 추출합니다.
      </p>

      {/* ── 업로드 영역: 드래그앤드롭 + 파일 선택 ── */}
      {!isScanned && !isSaved && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            style={{
              marginTop: 32, padding: preview ? 24 : 60, borderRadius: 16,
              border: `2px dashed ${isDragOver ? '#FF8A3D' : 'rgba(255,255,255,0.1)'}`,
              background: isDragOver ? 'rgba(255,138,61,0.05)' : 'rgba(255,255,255,0.02)',
              textAlign: 'center',
            }}
          >
            {preview ? (
              <img src={preview} alt="Preview" style={{ maxHeight: 280, borderRadius: 12, margin: '0 auto' }} />
            ) : (
              <>
                <div style={{ fontSize: 48, color: 'rgba(255,255,255,0.15)', marginBottom: 12 }}>↑</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>이미지를 여기에 드래그하세요</p>
              </>
            )}
            <label style={{
              display: 'inline-block', marginTop: 16, padding: '10px 20px', borderRadius: 10,
              background: 'rgba(255,255,255,0.05)', fontSize: 14, color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            }}>
              파일 선택
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                const f = e.target.files?.[0]; if (f) handleFile(f)
              }} />
            </label>
          </div>
          {file && (
            <button onClick={handleScan} disabled={isLoading} style={{
              width: '100%', marginTop: 20, padding: '16px 0', borderRadius: 12, border: 'none',
              background: '#FF8A3D', color: 'white', fontSize: 15, fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1,
            }}>
              {isLoading ? '스캔 중...' : '이미지 스캔하기'}
            </button>
          )}
        </>
      )}

      {/* 에러 메시지 표시 */}
      {error && (
        <div style={{ marginTop: 20, padding: '14px 20px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* ── OCR 결과: 원본 이미지 + 수정 폼 ── */}
      {isScanned && !isSaved && (
        <div style={{ marginTop: 32 }}>
          {preview && (
            <div
              ref={imageContainerRef}
              style={{ marginBottom: 24, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}
            >
              <img src={preview} alt="원본 이미지" style={{ width: '100%', display: 'block' }} />
              {/* bbox 오버레이: 선택된 블록의 영역을 이미지 위에 표시 */}
              {selectedBlockIndex !== null && ocrScanResult?.rawBlocks && (() => {
                const block = ocrScanResult.rawBlocks.find(b => b.block_index === selectedBlockIndex)
                if (!block?.bbox || !imageContainerRef.current) return null
                const img = imageContainerRef.current.querySelector('img')
                if (!img) return null
                const displayWidth = img.clientWidth
                const displayHeight = img.clientHeight
                // bbox 좌표는 OCR 전처리(리사이즈) 후 이미지 기준이므로
                // imageSize(OCR 처리 시 실제 크기)를 기준으로 스케일 계산
                const ocrWidth = ocrScanResult.imageSize?.width || img.naturalWidth
                const ocrHeight = ocrScanResult.imageSize?.height || img.naturalHeight
                const scaleX = displayWidth / ocrWidth
                const scaleY = displayHeight / ocrHeight
                const xs = block.bbox.map(p => p[0] * scaleX)
                const ys = block.bbox.map(p => p[1] * scaleY)
                const left = Math.min(...xs)
                const top = Math.min(...ys)
                const width = Math.max(...xs) - left
                const height = Math.max(...ys) - top
                return (
                  <>
                    <div style={{
                      position: 'absolute', left, top, width, height,
                      border: '2px solid #FF8A3D',
                      background: 'rgba(255,138,61,0.15)',
                      borderRadius: 4,
                      pointerEvents: 'none',
                      transition: 'all 0.2s ease',
                    }} />
                    <div style={{
                      position: 'absolute', left, top: Math.max(top - 22, 0),
                      background: '#FF8A3D', color: 'white',
                      fontSize: 11, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 4, whiteSpace: 'nowrap',
                    }}>
                      {block.text} — {(block.confidence * 100).toFixed(1)}%
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          <div style={{
            padding: 32, borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>
              OCR 결과 확인
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 28 }}>
              위 사진을 보고 틀린 부분이 있으면 수정한 후 저장하세요.
            </p>

            {/* 문서 종류 선택 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <span style={{ width: 90, fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'right', flexShrink: 0 }}>
                문서 종류
              </span>
              <select
                value={documentType}
                onChange={(e) => handleTypeChange(e.target.value as DocumentType)}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
                  fontSize: 14, color: 'white', outline: 'none',
                }}
              >
                <option value="BUSINESS_CARD" style={{ background: '#1a1a2e', color: 'white' }}>명함</option>
                <option value="POSTER" style={{ background: '#1a1a2e', color: 'white' }}>포스터</option>
                <option value="RECEIPT" style={{ background: '#1a1a2e', color: 'white' }}>영수증</option>
                <option value="TICKET" style={{ background: '#1a1a2e', color: 'white' }}>티켓</option>
                <option value="ETC" style={{ background: '#1a1a2e', color: 'white' }}>기타</option>
              </select>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {(confidence * 100).toFixed(1)}%
              </span>
            </div>

            {/* 문서 종류에 따른 편집 필드 */}
            {Object.keys(fieldLabels).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Object.entries(fieldLabels).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ width: 90, fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'right', flexShrink: 0 }}>
                    {label}
                  </span>
                  <input
                    type="text"
                    value={editFields[key] || ''}
                    onChange={(e) => setEditFields(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{
                      flex: 1, padding: '14px 16px', borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
                      fontSize: 14, color: 'white', outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
            )}

            {/* ETC 타입: 스키마 없음 안내 */}
            {documentType === 'ETC' && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>
                기타 문서는 아직 필드 스키마가 정의되지 않았습니다.
              </p>
            )}

            {/* OCR 원본 텍스트 블록 — 클릭 시 이미지 위에 bbox 표시 */}
            {ocrScanResult?.rawBlocks && ocrScanResult.rawBlocks.length > 0 && (
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                  OCR 원본 텍스트 <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', fontWeight: 400 }}>(클릭하면 위치 표시)</span>
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ocrScanResult.rawBlocks.map((block) => {
                    const isSelected = selectedBlockIndex === block.block_index
                    return (
                      <span
                        key={block.block_index}
                        onClick={() => {
                          setSelectedBlockIndex(isSelected ? null : block.block_index)
                          if (!isSelected) {
                            imageContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }
                        }}
                        style={{
                          padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                          background: isSelected ? 'rgba(255,138,61,0.15)' : 'rgba(255,255,255,0.03)',
                          border: isSelected ? '1px solid #FF8A3D' : '1px solid transparent',
                          fontSize: 12, fontFamily: 'monospace',
                          color: isSelected ? '#FF8A3D' : 'rgba(255,255,255,0.45)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {block.text}
                        <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
                          {(block.confidence * 100).toFixed(0)}%
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 저장/다시 스캔 버튼 */}
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button onClick={handleSave} disabled={isSaving} style={{
                flex: 1, padding: '16px 0', borderRadius: 12, border: 'none',
                background: '#FF8A3D', color: 'white', fontSize: 15, fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.5 : 1,
              }}>
                {isSaving ? '저장 중...' : '확인 & 저장'}
              </button>
              <button onClick={handleReset} style={{
                flex: 1, padding: '16px 0', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              }}>다시 스캔</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 저장 완료 화면 ── */}
      {isSaved && (
        <div style={{
          marginTop: 32, padding: 40, borderRadius: 16, textAlign: 'center',
          border: '1px solid rgba(255,138,61,0.2)', background: 'rgba(255,138,61,0.05)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>저장되었습니다</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {Object.values(editFields).filter(Boolean).slice(0, 2).join(' · ')}
          </p>
          <button onClick={handleReset} style={{
            marginTop: 24, padding: '14px 32px', borderRadius: 12, border: 'none',
            background: '#FF8A3D', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>다른 이미지 스캔</button>
        </div>
      )}
    </div>
  )
}
