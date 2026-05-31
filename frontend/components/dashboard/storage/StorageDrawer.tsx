'use client'

import { useEffect, useState } from 'react'
import type { BaseItem } from '@/types/storage'

export interface StorageDrawerField {
  key?: string
  label: string
  value?: string
  editable?: boolean
  multiline?: boolean
}

interface StorageDrawerProps {
  item: BaseItem | null
  open: boolean
  onClose: () => void
  title: string
  fields: StorageDrawerField[]
  isEditing?: boolean
  isSaving?: boolean
  error?: string | null
  onStartEdit?: () => void
  onCancelEdit?: () => void
  onSaveEdit?: () => void
  onChangeField?: (key: string, value: string) => void
}

function Field({
  field,
  isEditing,
  onChangeField,
}: {
  field: StorageDrawerField
  isEditing: boolean
  onChangeField?: (key: string, value: string) => void
}) {
  const canEdit = isEditing && field.editable && field.key && onChangeField

  return (
    <div
      style={{
        padding: canEdit ? '0 0 12px' : '12px 0',
        borderBottom: '1px solid #F1F5F9',
      }}
    >
      <p style={{ fontSize: 11, color: '#999', marginBottom: canEdit ? 6 : 4 }}>{field.label}</p>

      {canEdit && field.multiline ? (
        <textarea
          value={field.value || ''}
          onChange={(e) => onChangeField(field.key!, e.target.value)}
          rows={5}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid #CBD5E1',
            background: '#FAFBFC',
            fontSize: 14,
            color: '#333',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: '22px',
          }}
        />
      ) : canEdit ? (
        <input
          value={field.value || ''}
          onChange={(e) => onChangeField(field.key!, e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid #CBD5E1',
            background: '#FAFBFC',
            fontSize: 14,
            color: '#333',
            outline: 'none',
          }}
        />
      ) : (
        <p style={{ fontSize: 14, color: '#333', whiteSpace: 'pre-wrap', lineHeight: '22px' }}>
          {(field.value || '-').trim() || '-'}
        </p>
      )}
    </div>
  )
}

export default function StorageDrawer({
  item,
  open,
  onClose,
  title,
  fields,
  isEditing = false,
  isSaving = false,
  error = null,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onChangeField,
}: StorageDrawerProps) {
  const [failedImageItemId, setFailedImageItemId] = useState<string | null>(null)
  const imageUrl = item?.imageUrl || ''

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
        aria-hidden
      />

      <aside
        style={{
          position: 'relative',
          width: 420,
          maxWidth: '100%',
          height: '100%',
          background: '#FFFFFF',
          borderLeft: '1px solid #CBD5E1',
          padding: '28px',
          overflowY: 'auto',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: -28,
            marginTop: -28,
            marginLeft: -28,
            marginRight: -28,
            background: '#FFFFFF',
            padding: '20px 28px',
            borderBottom: '1px solid #F1F5F9',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#15293D' }}>{title}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!isEditing && onStartEdit && (
                <button
                  type="button"
                  onClick={onStartEdit}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#0077B6',
                    color: '#FFF',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  수정
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid #CBD5E1',
                  background: '#FFF',
                  cursor: 'pointer',
                  fontSize: 16,
                  color: '#999',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
                aria-label="상세 닫기"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {item ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  flexShrink: 0,
                }}
              >
                {imageUrl && failedImageItemId !== item.id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={item.title}
                    onError={() => setFailedImageItemId(item.id)}
                    style={{
                      width: '100%',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      minHeight: 160,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#999',
                      fontSize: 13,
                    }}
                  >
                    이미지가 없습니다
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {fields.map((field, idx) => (
                  <Field
                    key={`${field.key || field.label}-${idx}`}
                    field={field}
                    isEditing={isEditing}
                    onChangeField={onChangeField}
                  />
                ))}
              </div>
            </div>

            {isEditing && (
              <>
                {error && <p style={{ fontSize: 12, color: '#DC2626' }}>{error}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    disabled={isSaving}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#FFF',
                      color: '#333',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={onSaveEdit}
                    disabled={isSaving}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#0077B6',
                      color: '#FFF',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      opacity: isSaving ? 0.6 : 1,
                    }}
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </>
            )}
          </>
        ) : null}
      </aside>
    </div>
  )
}
