import React, { useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import type { AllocationPoint, AllocationStrategyMeta } from '@/lib/historical-allocation'
import { cn } from '@/lib/utils'

interface HistoricalAllocationChartProps {
  points: AllocationPoint[]
  strategies: AllocationStrategyMeta[]
}

// Cap rendered samples for paint performance on long-lived vaults without
// distorting the overall shape (keeps the first and last points).
const MAX_RENDERED_POINTS = 600

type ChartMoveState = {
  activePayload?: ReadonlyArray<{ dataKey?: string; value?: number | string }> | null
}

export const HistoricalAllocationChart: React.FC<HistoricalAllocationChartProps> = React.memo(
  ({ points, strategies }) => {
    const isMobile = useIsMobile()
    const containerRef = useRef<HTMLDivElement>(null)
    // Single source of truth for the "focused" strategy. Drives the chart band,
    // tooltip rows, and legend simultaneously. null = nothing focused.
    const [activeKey, setActiveKey] = useState<string | null>(null)

    const config = useMemo<ChartConfig>(() => {
      const next: ChartConfig = {}
      for (const strategy of strategies) {
        next[strategy.key] = { label: strategy.label, color: strategy.color }
      }
      return next
    }, [strategies])

    const data = useMemo(() => {
      if (points.length <= MAX_RENDERED_POINTS) return points
      const step = Math.ceil(points.length / MAX_RENDERED_POINTS)
      return points.filter((_, index) => index % step === 0 || index === points.length - 1)
    }, [points])

    // Detect which stacked band the cursor is inside, using the rendered grid
    // rect as the plot bounds and the tooltip payload's per-series values as the
    // band boundaries (the y-axis is fixed at 0–100%).
    const handleChartMouseMove = (nextState: ChartMoveState | undefined, clientY: number | undefined) => {
      const container = containerRef.current
      const grid = container?.querySelector('g.recharts-cartesian-grid') as SVGGElement | null
      if (!container || !grid || clientY === undefined) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      const gridTop = gridRect.top - containerRect.top
      const gridBottom = gridRect.bottom - containerRect.top
      const cursorY = clientY - containerRect.top

      if (cursorY < gridTop || cursorY > gridBottom) {
        setActiveKey(null)
        return
      }

      const span = Math.max(1, gridBottom - gridTop)
      // Top of the chart = 100%, bottom = 0%.
      const cursorValue = 100 * (1 - (cursorY - gridTop) / span)

      const payload = nextState?.activePayload ?? []
      const valueByKey = new Map<string, number>()
      for (const entry of payload) {
        const key = entry?.dataKey
        const numericValue = Number(entry?.value ?? 0)
        if (key) valueByKey.set(key, Number.isFinite(numericValue) ? numericValue : 0)
      }

      let cumulative = 0
      let lastNonZeroKey: string | null = null
      for (const strategy of strategies) {
        const bandValue = valueByKey.get(strategy.key) ?? 0
        if (bandValue > 0) lastNonZeroKey = strategy.key
        const lower = cumulative
        const upper = cumulative + bandValue
        cumulative = upper
        if (cursorValue >= lower - 1e-9 && cursorValue <= upper + 1e-9) {
          setActiveKey(strategy.key)
          return
        }
      }

      // Cursor landed above the top of the (sub-100%) stack — focus the top band.
      setActiveKey(lastNonZeroKey)
    }

    const tooltipFormatter = (value: number | string, name: string, item: { dataKey?: unknown; color?: string }) => {
      const key = typeof item?.dataKey === 'string' ? item.dataKey : `${name}`
      const label = config[key]?.label ?? `${name}`
      const color = config[key]?.color ?? item?.color
      const dimmed = activeKey !== null && activeKey !== key

      return (
        <div
          className={cn(
            'flex w-full items-center justify-between gap-3 leading-none transition-opacity',
            dimmed && 'opacity-40'
          )}
        >
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
            <span className={cn('text-muted-foreground', activeKey === key && 'font-medium text-foreground')}>
              {label}
            </span>
          </div>
          <span className="font-mono font-medium tabular-nums">{Number(value).toFixed(1)}%</span>
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <ChartContainer ref={containerRef} config={config} style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{
                  top: 12,
                  right: isMobile ? 8 : 20,
                  left: isMobile ? -8 : 0,
                  bottom: 16
                }}
                onMouseMove={(state, event) =>
                  handleChartMouseMove(
                    state as ChartMoveState | undefined,
                    (event as { clientY?: number } | undefined)?.clientY
                  )
                }
                onMouseLeave={() => setActiveKey(null)}
              >
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  minTickGap={isMobile ? 32 : 24}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: isMobile ? 11 : 12
                  }}
                  axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  width={isMobile ? 44 : 52}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: isMobile ? 11 : 12
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip
                  cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipDate ?? ''}
                      formatter={tooltipFormatter as React.ComponentProps<typeof ChartTooltipContent>['formatter']}
                    />
                  }
                />
                {strategies.map((strategy) => {
                  const focused = activeKey === null || activeKey === strategy.key
                  return (
                    <Area
                      key={strategy.key}
                      type="monotone"
                      dataKey={strategy.key}
                      stackId="a"
                      stroke={strategy.color}
                      fill={strategy.color}
                      fillOpacity={focused ? (activeKey === null ? 0.85 : 0.95) : 0.12}
                      strokeWidth={focused && activeKey === strategy.key ? 2 : 1}
                      isAnimationActive={false}
                    />
                  )
                })}
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2">
          {strategies.map((strategy) => {
            const dimmed = activeKey !== null && activeKey !== strategy.key
            const focused = activeKey === strategy.key
            return (
              <div
                key={strategy.key}
                onMouseEnter={() => setActiveKey(strategy.key)}
                onMouseLeave={() => setActiveKey(null)}
                className={cn('flex cursor-default items-center gap-1.5 transition-opacity', dimmed && 'opacity-40')}
              >
                <span
                  aria-hidden="true"
                  className={cn('h-2 w-2 shrink-0 rounded-[2px]', focused && 'h-2.5 w-2.5')}
                  style={{ backgroundColor: strategy.color }}
                />
                <span
                  className={cn(
                    'max-w-[150px] truncate text-xs text-muted-foreground',
                    focused && 'font-medium text-foreground'
                  )}
                >
                  {strategy.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)

export default HistoricalAllocationChart
