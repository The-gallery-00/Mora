'use client'

import { useState, useCallback, useRef } from 'react'
import { scanImage, saveCard } from '@/lib/api'
import type { DocumentType, ScanResult, RawBlock } from '@/types'

const DOCUMENT_FIELD_SCHEMAS: Record<DocumentType, Record<string, string>> = {
  BUSINESS_CARD: {
    name: '이름', english_name: '영문 이름', company_name: '회사명',
    department: '부서', job_title: '직책', mobile_phone: '휴대폰',
    office_phone: '유선 전화', fax: '팩스', email: '이메일',
    address: '주소', website: '웹사이트', zip_code: '우편번호',
  },
  POSTER: {
    title: '제목', organizer_name: '주최자', event_start_date: '행사 시작일',
    event_end_date: '행사 종료일', contact_phone: '연락처 전화',
    contact_email: '연락처 이메일', location: '장소', website_url: '웹사이트 URL',
  },
  RECEIPT: {
    store_name: '업체 이름', purchase_date: '구매일자', total_amount: '합계금액',
  },
  TICKET: {
    transport_type: '교통수단', departure_location: '출발지',
    departure_date: '출발일', departure_time: '출발 시간',
    arrival_location: '도착지', arrival_date: '도착일', arrival_time: '도착 시간',
  },
  ETC: {},
}

const COMMON_FIELD_MAP: Record<string, string[]> = {
  mobile_phone: ['contact_phone', 'office_phone'],
  contact_phone: ['mobile_phone', 'office_phone'],
  office_phone: ['mobile_phone', 'contact_phone'],
  email: ['contact_email'],
  contact_email: ['email'],
  website: ['website_url'],
  website_url: ['website'],
}

const TYPE_LABELS: Record<DocumentType, string> = {
  BUSINESS_CARD: '명함',
  POSTER: '포스터',
  RECEIPT: '영수증',
  TICKET: '티켓',
  ETC: '기타',
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const [documentType, setDocumentType] = useState<DocumentType>('ETC')
  const [confidence, setConfidence] = useState(0)
  const [ocrScanResult, setOcrScanResult] = useState<ScanResult | null>(null)

  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({})
  const [isScanned, setIsScanned] = useState(false)

  // bbox overlay
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setError(null)
    setSaveMessage(null)
    setIsScanned(false)
    setIsSaved(false)
    setSelectedBlockIndex(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }, [handleFile])

  const handleScan = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)

    const res = await scanImage(file)
    setIsLoading(false)

    if (res.success) {
      const { type, confidence: conf, parsed, fields, imageUrl: imgUrl } = res.data
      setOcrScanResult(res.data)
      setDocumentType(type)
      setConfidence(conf)
      setImageUrl(imgUrl)

      const labels = Object.keys(fields).length > 0 ? fields : DOCUMENT_FIELD_SCHEMAS[type]
      setFieldLabels(labels)

      const initialFields: Record<string, string> = {}
      for (const key of Object.keys(labels)) {
        initialFields[key] = parsed[key] || ''
      }
      setEditFields(initialFields)
      setIsScanned(true)
    } else {
      setError(res.error)
    }
  }

  const handleTypeChange = (newType: DocumentType) => {
    const newSchema = DOCUMENT_FIELD_SCHEMAS[newType]
    const newFields: Record<string, string> = {}
    for (const key of Object.keys(newSchema)) {
      if (editFields[key] !== undefined && editFields[key] !== '') {
        newFields[key] = editFields[key]
      } else if (COMMON_FIELD_MAP[key]) {
        const sourceKey = COMMON_FIELD_MAP[key].find(k => editFields[k] && editFields[k] !== '')
        newFields[key] = sourceKey ? editFields[sourceKey] : (ocrScanResult?.parsed[key] ?? '')
      } else {
        newFields[key] = ocrScanResult?.parsed[key] ?? ''
      }
    }
    setDocumentType(newType)
    setFieldLabels(newSchema)
    setEditFields(newFields)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveMessage(null)
    const res = await saveCard(documentType, editFields, imageUrl,
      ocrScanResult?.rawTexts || [],
      ocrScanResult?.rawBlocks || [],
      confidence,
      file)
    setIsSaving(false)

    if (res.success) {
      setSaveMessage(res.message || null)
      setIsSaved(true)
    } else {
      setError(res.error || '저장 실패')
    }
  }

  const handleReset = () => {
    setFile(null); setPreview(null); setIsScanned(false); setOcrScanResult(null)
    setIsSaved(false); setError(null); setSaveMessage(null); setImageUrl('')
    setDocumentType('ETC'); setConfidence(0)
    setEditFields({}); setFieldLabels({}); setSelectedBlockIndex(null)
  }

  // bbox 렌더링 헬퍼 — 이미지 wrapper가 position:relative, img가 block
  // wrapper 크기 = img 렌더 크기이므로 단순 비율 계산만 필요
  function renderBboxOverlay() {
    if (selectedBlockIndex === null || !ocrScanResult?.rawBlocks) return null
    const block = ocrScanResult.rawBlocks.find(b => b.block_index === selectedBlockIndex)
    if (!block?.bbox || !imageContainerRef.current) return null
    const img = imageContainerRef.current.querySelector('img')
    if (!img) return null

    // 렌더된 이미지 크기 (wrapper = img 크기)
    const displayW = img.clientWidth
    const displayH = img.clientHeight

    // OCR이 처리한 이미지 크기 (bbox 좌표 기준)
    const ocrW = ocrScanResult.imageSize?.width || img.naturalWidth
    const ocrH = ocrScanResult.imageSize?.height || img.naturalHeight

    const scaleX = displayW / ocrW
    const scaleY = displayH / ocrH
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
          border: '2px solid #0077B6',
          background: 'rgba(0,119,182,0.12)',
          borderRadius: 4, pointerEvents: 'none',
          transition: 'all 0.2s ease',
        }} />
        <div style={{
          position: 'absolute', left, top: Math.max(top - 24, 0),
          background: '#0077B6', color: 'white',
          fontSize: 11, fontWeight: 700, padding: '2px 8px',
          borderRadius: 4, whiteSpace: 'nowrap',
        }}>
          {block.text} — {(block.confidence * 100).toFixed(1)}%
        </div>
      </>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#15293D' }}>문서 업로드</h1>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15293D" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p style={{ marginTop: 4, fontSize: 14, color: '#505050' }}>
          이미지를 올리면 OCR로 텍스트를 추출합니다
        </p>
      </div>

      {/* 에러 */}
      {error && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 10,
          background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* 저장 완료 */}
      {isSaved && (
        <div style={{
          padding: 48, borderRadius: 16, textAlign: 'center',
          border: '1px solid #CBD5E1', background: '#F0F9FF',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#0077B6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: '#FFF', fontSize: 28,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#15293D' }}>저장되었습니다</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: '#505050' }}>
            {TYPE_LABELS[documentType]} · {Object.values(editFields).filter(Boolean).slice(0, 2).join(' · ')}
          </p>
          {saveMessage && (
            <div style={{
              margin: '20px auto 0', maxWidth: 520, padding: '12px 16px',
              borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A',
              color: '#92400E', fontSize: 13, lineHeight: 1.5, textAlign: 'left',
            }}>
              {saveMessage}
            </div>
          )}
          <button onClick={handleReset} style={{
            marginTop: 24, padding: '12px 32px', borderRadius: 10, border: 'none',
            background: '#0077B6', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            다른 이미지 스캔
          </button>
        </div>
      )}

      {/* 메인 영역: 좌 이미지 / 우 정보or파싱 */}
      {!isSaved && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          marginBottom: 32,
        }}>
          {/* ── 왼쪽: 이미지 영역 ── */}
          <div style={{
            borderRadius: 16, border: '1px solid #CBD5E1', padding: 24,
            background: '#FFFFFF', display: 'flex', flexDirection: 'column',
          }}>
            {/* 드래그 영역 또는 이미지 미리보기 */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{
                flex: 1, minHeight: 300,
                borderRadius: 12,
                border: preview ? 'none' : `2px dashed ${isDragOver ? '#0077B6' : '#CBD5E1'}`,
                background: preview ? '#F1F5F9' : (isDragOver ? '#F0F9FF' : '#F8FAFC'),
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                transition: 'all 0.15s',
              }}
            >
              {preview ? (
                <div
                  ref={imageContainerRef}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    maxWidth: '100%',
                  }}
                >
                  <img
                    src={preview}
                    alt="업로드 이미지"
                    style={{
                      maxWidth: '100%', maxHeight: 500,
                      display: 'block',
                    }}
                  />
                  {renderBboxOverlay()}
                </div>
              ) : (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <p style={{ fontSize: 14, color: '#999', marginBottom: 16 }}>
                    이미지를 여기에 드래그하세요
                  </p>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 20px', borderRadius: 8,
                    border: '1px solid #CBD5E1', background: '#FFFFFF',
                    fontSize: 14, color: '#505050', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 16 }}>+</span> 파일 선택
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) handleFile(f)
                    }} />
                  </label>
                </>
              )}
            </div>

            {/* 스캔 시작하기 버튼 */}
            <button
              onClick={handleScan}
              disabled={!file || isLoading}
              style={{
                marginTop: 16, width: '100%', padding: '14px 0',
                borderRadius: 10, border: '1px solid #CBD5E1',
                background: file && !isLoading ? '#FFFFFF' : '#F8FAFC',
                color: file ? '#15293D' : '#999',
                fontSize: 15, fontWeight: 600, cursor: file && !isLoading ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
            >
              {isLoading ? '스캔 중...' : '스캔 시작하기'}
            </button>
          </div>

          {/* ── 오른쪽: 정보 또는 파싱 폼 ── */}
          <div style={{
            borderRadius: 16, border: '1px solid #CBD5E1', padding: 24,
            background: isScanned
              ? 'linear-gradient(180deg, #FFFFFF 0%, #E8F4FD 100%)'
              : '#F8FAFC',
            display: 'flex', flexDirection: 'column',
          }}>
            {!isScanned ? (
              /* 스캔 전: 지원 형식 + 업로드 팁 + 처리 과정 */
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#15293D', marginBottom: 12 }}>
                  지원 형식
                </h3>
                <ul style={{ fontSize: 14, color: '#505050', paddingLeft: 20, marginBottom: 24, lineHeight: 2 }}>
                  <li>JPG, PNG, PDF 지원</li>
                  <li>최대 20MB</li>
                </ul>

                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#15293D', marginBottom: 12 }}>
                  업로드 팁
                </h3>
                <ul style={{ fontSize: 14, color: '#505050', paddingLeft: 20, marginBottom: 24, lineHeight: 2 }}>
                  <li>선명하고 깨끗한 이미지 사용을 권장합니다.</li>
                  <li>빛 반사나 그림자가 없는 정면 촬영을 권장합니다.</li>
                  <li>텍스트가 잘 보이도록 고해상도 이미지를 사용하세요.</li>
                </ul>

                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#15293D', marginBottom: 16 }}>
                  처리 과정
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {[
                    { icon: '↑', label: '업로드' },
                    { icon: '◎', label: 'OCR 추출' },
                    { icon: '▤', label: '정보 구조화' },
                    { icon: '✓', label: '결과 확인' },
                  ].map((step, i) => (
                    <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          border: '2px solid #0077B6', background: '#F0F9FF',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, color: '#0077B6', margin: '0 auto 6px',
                        }}>
                          {step.icon}
                        </div>
                        <span style={{ fontSize: 12, color: '#505050' }}>{step.label}</span>
                      </div>
                      {i < 3 && (
                        <span style={{ margin: '0 4px', marginBottom: 20, color: '#CBD5E1', fontSize: 12 }}>···</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* 스캔 후: 파싱 폼 */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* 문서 종류 + 신뢰도 */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 20,
                }}>
                  <select
                    value={documentType}
                    onChange={(e) => handleTypeChange(e.target.value as DocumentType)}
                    style={{
                      padding: '8px 12px', borderRadius: 8,
                      border: '1px solid #CBD5E1', background: '#FFFFFF',
                      fontSize: 14, color: '#15293D', outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="BUSINESS_CARD">명함</option>
                    <option value="POSTER">포스터</option>
                    <option value="RECEIPT">영수증</option>
                    <option value="TICKET">티켓</option>
                    <option value="ETC">기타</option>
                  </select>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    신뢰도 {(confidence * 100).toFixed(1)}%
                  </span>
                </div>

                {/* 필드 폼 (피그마: 라벨 왼쪽, input 오른쪽, 연파랑 배경) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, overflowY: 'auto' }}>
                  {Object.entries(fieldLabels).map(([key, label]) => (
                    <div
                      key={key}
                      style={{
                        display: 'flex', alignItems: 'center',
                        borderBottom: '1px solid rgba(203,213,225,0.5)',
                        padding: '0',
                      }}
                    >
                      <span style={{
                        width: 90, flexShrink: 0,
                        fontSize: 13, fontWeight: 600, color: '#15293D',
                        padding: '12px 12px 12px 0',
                        textAlign: 'left',
                      }}>
                        {label}
                      </span>
                      <input
                        type="text"
                        value={editFields[key] || ''}
                        onChange={(e) => setEditFields(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{
                          flex: 1, padding: '12px',
                          border: 'none', background: 'rgba(206,233,255,0.3)',
                          borderRadius: 0,
                          fontSize: 14, color: '#333', outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {documentType === 'ETC' && (
                  <p style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '20px 0' }}>
                    기타 문서는 아직 필드 스키마가 정의되지 않았습니다.
                  </p>
                )}

                {/* 저장 / 다시 스캔 */}
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button onClick={handleSave} disabled={isSaving} style={{
                    flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
                    background: '#0077B6', color: 'white', fontSize: 14, fontWeight: 600,
                    cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1,
                  }}>
                    {isSaving ? '저장 중...' : '확인 & 저장'}
                  </button>
                  <button onClick={handleReset} style={{
                    flex: 1, padding: '13px 0', borderRadius: 10,
                    border: '1px solid #CBD5E1', background: '#FFFFFF',
                    color: '#505050', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  }}>
                    다시 스캔
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 하단: 최근 업로드된 문서 (raw OCR + bbox overlay) ── */}
      {isScanned && !isSaved && ocrScanResult?.rawBlocks && ocrScanResult.rawBlocks.length > 0 && (
        <div style={{
          borderRadius: 16, border: '1px solid #CBD5E1', padding: 24,
          background: '#FFFFFF',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#15293D', marginBottom: 14 }}>
            최근 업로드된 문서
            <span style={{ fontSize: 12, color: '#999', fontWeight: 400, marginLeft: 8 }}>
              클릭하면 이미지에서 위치가 표시됩니다
            </span>
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                    background: isSelected ? '#E8F4FD' : '#F8FAFC',
                    border: isSelected ? '1px solid #0077B6' : '1px solid #E2E8F0',
                    fontSize: 13, fontFamily: 'monospace',
                    color: isSelected ? '#0077B6' : '#505050',
                    transition: 'all 0.15s ease',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {block.text}
                  <span style={{
                    marginLeft: 6, fontSize: 10,
                    color: isSelected ? '#0077B6' : '#999',
                  }}>
                    {(block.confidence * 100).toFixed(0)}%
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
