import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'

export function StatsFilterDrawer({
  title,
  trigger,
  children
}: {
  title: string
  trigger: ReactElement
  children: ReactNode
}) {
  return (
    <Drawer shouldScaleBackground={false}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent showHandle={false} className="pg-stats stats-chart-options-drawer" aria-describedby={undefined}>
        <div className="stats-chart-options-heading">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerClose asChild>
            <button type="button" className="page-btn" aria-label={`Close ${title.toLowerCase()}`}>
              <X size={18} aria-hidden="true" />
            </button>
          </DrawerClose>
        </div>
        <div className="stats-chart-options-body stats-filter-drawer-body" data-vaul-no-drag>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
