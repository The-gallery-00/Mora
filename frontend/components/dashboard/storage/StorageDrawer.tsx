'use client'

import { useEffect, useState } from 'react'
import type { BaseItem } from '@/types/storage'

interface StorageDrawerProps {
  item: BaseItem | null
  open: boolean
  onClose: () => void
  title: string
  fields: Array<{ label: string; value?: string }>
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-5 py-5">
      <p className="text-xs font-medium text-white/45">{label}</p>
      <p className="mt-3 text-base leading-8 text-white/90">{value?.trim() || '-'}</p>
    </div>
  )
}

export default function StorageDrawer({ item, open, onClose, title, fields }: StorageDrawerProps) {
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

  return (
    <div
      className={`fixed inset-0 z-[100] transition ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 h-full w-full bg-black/70 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="서랍 닫기 오버레이"
      />

      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[440px] overflow-y-auto border-l border-white/10 bg-[#0F1A28] p-9 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.02] text-white/70 transition hover:text-white"
            aria-label="서랍 닫기"
          >
            X
          </button>
        </div>

        {item ? (
          <div className="mt-10 space-y-9">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1521]">
              {imageUrl && failedImageItemId !== item.id ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={item.title}
                  onError={() => setFailedImageItemId(item.id)}
                  className="h-60 w-full object-cover"
                />
              ) : (
                <div className="flex h-60 w-full items-center justify-center text-sm text-white/35">
                  이미지가 없습니다
                </div>
              )}
            </div>

            <div className="space-y-6">
              {fields.map((field) => (
                <Field key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          </div>
        ) : null}
      </aside>

    </div>
  )
}
