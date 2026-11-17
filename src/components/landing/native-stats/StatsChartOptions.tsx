import { SlidersHorizontal, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useIsMobile } from '@/components/ui/use-mobile'

/** Keep the same controls and state on desktop and in the mobile options drawer. */
export function StatsChartOptions({ title, children }: { title: string; children: ReactNode }) {
  const mobile = useIsMobile()
  if (!mobile) return <div className="stats-chart-options">{children}</div>
  return (
    <Drawer shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <button type="button" className="page-btn stats-chart-options-trigger" aria-label={`${title} options`}>
          <SlidersHorizontal size={14} aria-hidden="true" /> Options
        </button>
      </DrawerTrigger>
      <DrawerContent showHandle={false} className="pg-stats stats-chart-options-drawer" aria-describedby={undefined}>
        <div className="stats-chart-options-heading">
          <DrawerTitle>{title} options</DrawerTitle>
          <DrawerClose asChild>
            <button type="button" className="page-btn" aria-label="Close chart options">
              <X size={18} aria-hidden="true" />
            </button>
          </DrawerClose>
        </div>
        <div className="stats-chart-options-body">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}

export function StatsTableColumnSelector({
  value,
  onChange,
  columns,
  label
}: {
  value: string
  onChange: (value: string) => void
  columns: Array<{ value: string; label: string }>
  label: string
}) {
  return (
    <label className="stats-mobile-column-selector">
      <span>Show</span>
      <select
        className="filter-select"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {columns.map((column) => (
          <option key={column.value} value={column.value}>
            {column.label}
          </option>
        ))}
      </select>
    </label>
  )
}
