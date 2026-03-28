// ═══════════════════════════════════════════════════════════════
// dashboard/upload/page.tsx — 명함 업로드 & OCR 스캔 페이지
// ═══════════════════════════════════════════════════════════════
//
// [역할]
// 사용자가 명함 이미지를 업로드하면 OCR로 텍스트를 추출하고,
// 결과를 확인/수정한 뒤 DB에 저장할 수 있는 페이지.
// 드래그앤드롭 및 파일 선택 모두 지원한다.
//
// [코드 흐름]
// 1) 사용자가 이미지를 드래그앤드롭하거나 "파일 선택" 버튼으로 업로드
// 2) handleFile()이 File 객체를 받아 FileReader로 미리보기 생성
// 3) "명함 스캔하기" 클릭 → handleScan()이 scanCard() API 호출
// 4) OCR 결과가 돌아오면 각 필드(이름, 회사, 직책, 전화, 이메일) 편집 가능
// 5) "확인 & 저장" 클릭 → handleSave()가 saveCard() API 호출
// 6) 저장 성공 시 완료 화면 표시 → "다른 명함 스캔" 버튼으로 초기화
//
// [컴포넌트/함수 목록]
// - UploadPage():   업로드 → 스캔 → 편집 → 저장 전체 플로우를 관리하는 페이지 컴포넌트
// - handleFile():   File 객체를 받아 상태를 초기화하고 미리보기(base64)를 생성
// - handleDrop():   드래그앤드롭 이벤트에서 이미지 파일을 추출하여 handleFile 호출
// - handleScan():   scanCard() API를 호출하고 결과를 편집 필드에 세팅
// - handleSave():   수정된 명함 데이터를 saveCard() API로 저장
// - handleReset():  모든 상태를 초기화하여 새 명함 업로드를 시작
//
// [사용된 라이브러리/훅]
// ───────────────────────────────────────────
// useState()          — file, preview, isLoading, isSaving, error, scanResult 등 다수의 UI 상태 관리
// useCallback()       — handleFile, handleDrop 함수를 메모이제이션하여 불필요한 재생성 방지
// scanCard() (api)    — FormData에 이미지를 담아 /api/scan 엔드포인트에 OCR 요청
// saveCard() (api)    — 명함 데이터를 /api/save 엔드포인트에 저장
// BusinessCard (type) — 명함 데이터의 타입 정의 (name, company, position, phone, email 등)
// FileReader (Web API)— 이미지 파일을 base64 Data URL로 변환하여 미리보기에 사용
// ───────────────────────────────────────────

'use client'

import { useState, useCallback } from 'react'
import { scanImage, scanCard, saveCard } from '@/lib/api'
import type { BusinessCard, DocumentType, ScanResult } from '@/types'

export default function UploadPage() {
  // === 파일 및 미리보기 관련 상태 ===
  const [file, setFile] = useState<File | null>(null)          // 선택된 이미지 파일
  const [preview, setPreview] = useState<string | null>(null)  // base64 미리보기 URL
  const [isLoading, setIsLoading] = useState(false)                // OCR 스캔 중 여부
  const [isSaving, setIsSaving] = useState(false)                  // DB 저장 중 여부
  const [error, setError] = useState<string | null>(null)      // 에러 메시지
  const [scanResult, setScanResult] = useState<BusinessCard | null>(null)  // OCR 결과 데이터
  const [imageUrl, setImageUrl] = useState('')                 // 서버에 저장된 이미지 경로
  const [isSaved, setIsSaved] = useState(false)                    // 저장 완료 여부
  const [isDragOver, setIsDragOver] = useState(false)              // 드래그 오버 상태 (UI 피드백용)

  // === 문서 분류 관련 상태 ===
  const [documentType, setDocumentType] = useState<DocumentType>('ETC')
  const [confidence, setConfidence] = useState(0)
  const [ocrScanResult, setOcrScanResult] = useState<ScanResult | null>(null)

  // === OCR 결과를 사용자가 수정할 수 있는 편집 필드 ===
  const [editName, setEditName] = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // 파일 선택 또는 드롭 시 호출 — 상태 초기화 + FileReader로 미리보기 생성
  const handleFile = useCallback((f: File) => {
    setFile(f)
    setError(null)
    setScanResult(null)
    setIsSaved(false)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)  // base64 Data URL
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
      const { type, confidence: conf, parsed, rawTexts, imageUrl: imgUrl } = res.data
      setOcrScanResult(res.data)
      setDocumentType(type)
      setConfidence(conf)
      setImageUrl(imgUrl)

      // 명함일 경우 기존 편집 필드에 세팅
      if (type === 'BUSINESS_CARD') {
        const cardData: BusinessCard = {
          name: parsed.name || '',
          company: parsed.company || '',
          position: parsed.position || '',
          phone: parsed.phone || parsed.fax || '',
          email: parsed.email || '',
          raw_texts: rawTexts,
          imageUrl: imgUrl,
        }
        setScanResult(cardData)
        setEditName(cardData.name)
        setEditCompany(cardData.company)
        setEditPosition(cardData.position)
        setEditPhone(cardData.phone)
        setEditEmail(cardData.email)
      } else {
        // 명함이 아닌 경우에도 scanResult 세팅 (UI 전환용)
        setScanResult({
          name: '', company: '', position: '', phone: '', email: '',
          raw_texts: rawTexts,
          imageUrl: imgUrl,
        })
      }
    } else {
      setError(res.error)
    }
  }

  // 수정된 명함 데이터를 DB에 저장
  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    const card: BusinessCard = {
      name: editName, company: editCompany, position: editPosition,
      phone: editPhone, email: editEmail,
    }

    const res = await saveCard(card, imageUrl)
    setIsSaving(false)

    if (res.success) {
      setIsSaved(true)  // 저장 완료 화면으로 전환
    } else {
      setError(res.error || '저장 실패')
    }
  }

  // 모든 상태를 초기화하여 새 업로드를 시작
  const handleReset = () => {
    setFile(null); setPreview(null); setScanResult(null); setOcrScanResult(null)
    setIsSaved(false); setError(null); setImageUrl('')
    setDocumentType('ETC'); setConfidence(0)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>명함 업로드</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
        명함 이미지를 올리면 OCR로 텍스트를 추출합니다.
      </p>

      {/* ── 업로드 영역: 드래그앤드롭 + 파일 선택 ── */}
      {!scanResult && !isSaved && (
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
              // 선택된 이미지의 미리보기
              <img src={preview} alt="Preview" style={{ maxHeight: 280, borderRadius: 12, margin: '0 auto' }} />
            ) : (
              // 이미지 미선택 시 안내 문구
              <>
                <div style={{ fontSize: 48, color: 'rgba(255,255,255,0.15)', marginBottom: 12 }}>↑</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>이미지를 여기에 드래그하세요</p>
              </>
            )}
            {/* 숨겨진 file input을 label로 감싸서 "파일 선택" 버튼처럼 사용 */}
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
          {/* 파일이 선택된 경우에만 스캔 버튼 표시 */}
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
      {scanResult && !isSaved && (
        <div style={{ marginTop: 32 }}>
          {/* 업로드한 원본 명함 이미지 */}
          {preview && (
            <div style={{ marginBottom: 24, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src={preview} alt="명함 원본" style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          {/* 수정 가능한 OCR 결과 폼 */}
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
              <span style={{ width: 72, fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'right', flexShrink: 0 }}>
                문서 종류
              </span>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
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

            {/* 명함일 때: 기존 편집 필드 */}
            {documentType === 'BUSINESS_CARD' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: '이름', value: editName, set: setEditName },
                { label: '회사', value: editCompany, set: setEditCompany },
                { label: '직책', value: editPosition, set: setEditPosition },
                { label: '전화번호', value: editPhone, set: setEditPhone },
                { label: '이메일', value: editEmail, set: setEditEmail },
              ].map((field) => (
                <div key={field.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ width: 72, fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'right', flexShrink: 0 }}>
                    {field.label}
                  </span>
                  <input
                    type="text" value={field.value} onChange={(e) => field.set(e.target.value)}
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

            {/* 명함이 아닐 때: 파싱된 필드 표시 */}
            {documentType !== 'BUSINESS_CARD' && ocrScanResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {documentType === 'POSTER' && '포스터 파싱 결과'}
                {documentType === 'RECEIPT' && '영수증 파싱 결과'}
                {documentType === 'TICKET' && '티켓 파싱 결과'}
                {documentType === 'ETC' && '분류되지 않은 문서'}
              </p>
              {Object.entries(ocrScanResult.parsed).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ width: 72, fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'right', flexShrink: 0 }}>
                    {key}
                  </span>
                  <span style={{
                    flex: 1, padding: '14px 16px', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
                    fontSize: 14, color: 'white',
                  }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            )}

            {/* OCR 원본 텍스트 블록 — AI가 추출한 원시 텍스트 조각들을 태그 형태로 표시 */}
            {scanResult.raw_texts && scanResult.raw_texts.length > 0 && (
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                  OCR 원본 텍스트
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {scanResult.raw_texts.map((t, i) => (
                    <span key={i} style={{
                      padding: '6px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)', fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace',
                    }}>{t}</span>
                  ))}
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
          <p style={{ marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{editName} · {editCompany}</p>
          <button onClick={handleReset} style={{
            marginTop: 24, padding: '14px 32px', borderRadius: 12, border: 'none',
            background: '#FF8A3D', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>다른 명함 스캔</button>
        </div>
      )}
    </div>
  )
}
