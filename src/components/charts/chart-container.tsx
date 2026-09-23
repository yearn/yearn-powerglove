import type React from 'react'

export const CHART_PALETTE = {
  primary: '#46a2ff',
  secondary: '#94adf2',
  neutral: '#b0b5bf'
} as const

interface ChartContainerProps {
  children: React.ReactNode
  className?: string
  heightClassName?: string
}

export function FixedHeightChartContainer({
  children,
  className = '',
  heightClassName = 'h-[280px] sm:h-[360px] lg:h-[400px]'
}: ChartContainerProps) {
  return (
    <div className={`${className} relative ${heightClassName}`}>
      <div
        className="absolute inset-0"
        style={
          {
            '--chart-1': CHART_PALETTE.primary,
            '--chart-2': CHART_PALETTE.primary,
            '--chart-3': CHART_PALETTE.secondary,
            '--chart-4': CHART_PALETTE.neutral
          } as React.CSSProperties
        }
      >
        <div className="h-full w-full">
          <style>{`
            .aspect-video {
              aspect-ratio: auto !important;
              height: 100% !important;
            }
          `}</style>
          {children}
        </div>
      </div>
    </div>
  )
}
