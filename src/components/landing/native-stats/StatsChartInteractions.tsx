import { X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { DefaultTooltipContent, type TooltipProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'

type ChartTooltipProps = TooltipProps<ValueType, NameType>

export function useMobileChartTooltip(mobile: boolean) {
  const [dismissed, setDismissed] = useState(false)
  const reopen = () => setDismissed(false)
  useEffect(() => {
    if (!mobile) return
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('.stats-mobile-tooltip')) setDismissed(true)
    }
    // Dismiss the previous chart before a tap opens a new chart's tooltip.
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [mobile])
  return {
    // A fresh tap on the plot opens a tooltip again after dismissal.
    chartEvents: { onClick: reopen },
    tooltipProps: {
      active: mobile && dismissed ? false : undefined,
      trigger: mobile ? ('click' as const) : undefined,
      wrapperStyle: mobile
        ? {
            pointerEvents: 'auto' as const,
            position: 'fixed' as const,
            top: 'auto',
            bottom: 16,
            left: 16,
            transform: 'none',
            zIndex: 40
          }
        : undefined
    },
    dismiss: () => setDismissed(true)
  }
}

export function StatsTooltipContent({
  mobile,
  onClose,
  renderContent,
  ...props
}: ChartTooltipProps & {
  mobile: boolean
  onClose: () => void
  renderContent?: (props: ChartTooltipProps) => ReactNode
}) {
  if (!props.active || !props.payload?.length) return null
  const content = renderContent ? renderContent(props) : <DefaultTooltipContent {...props} />
  if (!mobile) return content
  return (
    <div className="stats-mobile-tooltip">
      <button
        type="button"
        className="stats-tooltip-close"
        aria-label="Close chart tooltip"
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
      >
        <X size={16} aria-hidden="true" />
      </button>
      {content}
    </div>
  )
}

export function MobileYAxisTick({
  x = 0,
  y = 0,
  payload,
  formatter,
  right = false
}: {
  x?: number
  y?: number
  payload?: { value: number }
  formatter: (value: number) => string
  right?: boolean
}) {
  if (!payload) return null
  const label = formatter(payload.value)
  const width = label.length * 7 + 8
  return (
    <g className="stats-mobile-y-axis-label">
      <rect x={right ? x - width + 4 : x - 4} y={y - 9} width={width} height={18} fill="white" />
      <text x={x} y={y} dy="0.32em" textAnchor={right ? 'end' : 'start'} fill="var(--text-3)" fontSize={11}>
        {label}
      </text>
    </g>
  )
}
