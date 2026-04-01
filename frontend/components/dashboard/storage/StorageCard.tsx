'use client'

import ConfirmPopover from '@/components/dashboard/storage/ConfirmPopover'
import type { BaseItem } from '@/types/storage'

interface StorageCardProps<T extends BaseItem> {
  item: T
  subtitle?: string
  meta?: string
  isDeleteConfirmOpen: boolean
  onOpenDetail?: (item: T) => void
  onDeleteClick: (itemId: string) => void
  onConfirmDelete: (itemId: string) => void
  onCancelDelete: () => void
}

export default function StorageCard<T extends BaseItem>({
  item,
  subtitle,
  meta,
  isDeleteConfirmOpen,
  onOpenDetail,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
}: StorageCardProps<T>) {
  const displayTitle = item.title.replace(/\s*(명함|티켓|포스터|영수증)\s*$/, '')

  return (
    <article
      onClick={() => onOpenDetail?.(item)}
      className="group relative cursor-pointer overflow-visible rounded-2xl border border-white/5 bg-white/[0.02] transition hover:border-white/10"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onDeleteClick(item.id)
        }}
        className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/45 text-sm text-white/70 transition hover:bg-black/60 hover:text-white"
        aria-label="항목 삭제"
      >
        X
      </button>

      <ConfirmPopover
        open={isDeleteConfirmOpen}
        onConfirm={() => onConfirmDelete(item.id)}
        onCancel={onCancelDelete}
      />

      <div className="overflow-hidden rounded-t-2xl border-b border-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={displayTitle} className="h-36 w-full object-cover" />
      </div>

      <div className="px-6 py-6">
        <div className="mt-4 rounded-xl bg-white/[0.03] px-6 py-6">
          <div className="space-y-4">
            <h3 className="truncate text-lg font-bold leading-8 text-white">{displayTitle}</h3>
            {subtitle ? <p className="text-sm leading-8 text-[#FF8A3D]">{subtitle}</p> : null}
            {meta ? <p className="text-sm leading-8 text-white/45">{meta}</p> : null}
          </div>
        </div>
      </div>
    </article>
  )
}
