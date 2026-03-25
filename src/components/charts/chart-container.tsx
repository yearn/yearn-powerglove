import type React from 'react'

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
            '--chart-1': '#46a2ff',
            '--chart-2': '#46a2ff',
            '--chart-3': '#94adf2',
            '--chart-4': '#b0b5bf'
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
