'use client'

import StorageCard from '@/components/dashboard/storage/StorageCard'
import type { BaseItem } from '@/types/storage'

interface StorageGridProps<T extends BaseItem> {
  items: T[]
  emptyMessage: string
  getSubtitle?: (item: T) => string | undefined
  getMeta?: (item: T) => string | undefined
  deleteTargetId: string | null
  onOpenDetail?: (item: T) => void
  onDeleteClick: (itemId: string) => void
  onConfirmDelete: (itemId: string) => void
  onCancelDelete: () => void
}

export default function StorageGrid<T extends BaseItem>({
  items,
  emptyMessage,
  getSubtitle,
  getMeta,
  deleteTargetId,
  onOpenDetail,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
}: StorageGridProps<T>) {
  if (items.length === 0) {
    return (
      <div className="mt-28 text-center">
        <p className="text-5xl opacity-15">□</p>
        <p className="mt-8 text-base leading-8 text-white/35">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
      {items.map((item) => (
        <StorageCard
          key={item.id}
          item={item}
          subtitle={getSubtitle?.(item)}
          meta={getMeta?.(item)}
          isDeleteConfirmOpen={deleteTargetId === item.id}
          onOpenDetail={onOpenDetail}
          onDeleteClick={onDeleteClick}
          onConfirmDelete={onConfirmDelete}
          onCancelDelete={onCancelDelete}
        />
      ))}
    </div>
  )
}
