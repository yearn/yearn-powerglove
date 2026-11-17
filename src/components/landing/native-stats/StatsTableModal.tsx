import { type ReactNode, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export function StatsTableModal({
  title,
  open,
  onOpenChange,
  children,
  summary
}: {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  summary: ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {summary}
      <DialogContent
        ref={contentRef}
        className="pg-stats stats-table-modal"
        aria-describedby={undefined}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          contentRef.current?.focus({ preventScroll: true })
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}
