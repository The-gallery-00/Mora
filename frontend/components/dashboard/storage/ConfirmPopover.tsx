'use client'

interface ConfirmPopoverProps {
  open: boolean
  message?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmPopover({
  open,
  message = '삭제하시겠습니까?',
  onConfirm,
  onCancel,
}: ConfirmPopoverProps) {
  if (!open) return null

  return (
    <div
      className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-white/10 bg-[#111B28] p-3 shadow-2xl"
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="false"
    >
      <p className="text-xs text-white/80">{message}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-[#FF8A3D] px-2 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          확인
        </button>
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10"
        >
          취소
        </button>
      </div>
    </div>
  )
}

