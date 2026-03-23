import React, { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { getTimeframeLimit } from '@/components/charts/chart-utils'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { useIsMobile } from '@/components/ui/use-mobile'
import { cn } from '@/lib/utils'
import type { ChartDataPoint } from '@/types/dataTypes'

export type APYSeriesKey =
  | 'derivedApy'
  | 'sevenDayApy'
  | 'thirtyDayApy'
  | 'oracleApr'
  | 'oracleApy30dAvg'
export type APYVisibleSeries = Record<APYSeriesKey, boolean>

const TOOLTIP_ORDER: Record<APYSeriesKey, number> = {
  derivedApy: 0,
  sevenDayApy: 1,
  thirtyDayApy: 2,
  oracleApr: 3,
  oracleApy30dAvg: 4,
}

const isDashedSeries = (seriesKey: APYSeriesKey) =>
  seriesKey === 'thirtyDayApy' || seriesKey === 'oracleApy30dAvg'

const SERIES_BASE_CONFIG: Record<
  APYSeriesKey,
  { chartLabel: string; legendLabel: string; color: string }
> = {
  derivedApy: {
    chartLabel: '1-day APY %',
    legendLabel: '1-day APY',
    color: 'var(--chart-3)',
  },
  sevenDayApy: {
    chartLabel: '7-day APY %',
    legendLabel: '7-day APY',
    color: 'var(--chart-2)',
  },
  thirtyDayApy: {
    chartLabel: '30-day APY %',
    legendLabel: '30-day APY',
    color: 'var(--chart-1)',
  },
  oracleApr: {
    chartLabel: 'Oracle APR %',
    legendLabel: 'Oracle APR',
    color: 'var(--chart-4)',
  },
  oracleApy30dAvg: {
    chartLabel: 'Oracle APY (30d avg) %',
    legendLabel: 'Oracle APY (30d avg)',
    color: 'var(--chart-4)',
  },
}

const SERIES_ORDER: APYSeriesKey[] = [
  'derivedApy',
  'sevenDayApy',
  'thirtyDayApy',
  'oracleApr',
  'oracleApy30dAvg',
]

export const buildApyVisibleSeries = (
  overrides?: Partial<Record<APYSeriesKey, boolean>>,
): APYVisibleSeries => ({
  derivedApy: overrides?.derivedApy ?? true,
  sevenDayApy: overrides?.sevenDayApy ?? true,
  thirtyDayApy: overrides?.thirtyDayApy ?? true,
  oracleApr: overrides?.oracleApr ?? false,
  oracleApy30dAvg: overrides?.oracleApy30dAvg ?? false,
})

export const getAvailableApySeries = ({
  hasOracleApr,
  hasOracleApy30dAvg,
}: {
  hasOracleApr: boolean
  hasOracleApy30dAvg: boolean
}): APYSeriesKey[] => {
  return SERIES_ORDER.filter((seriesKey) => {
    if (seriesKey === 'oracleApr') return hasOracleApr
    if (seriesKey === 'oracleApy30dAvg') return hasOracleApy30dAvg
    return true
  })
}

interface APYChartProps {
  chartData: ChartDataPoint[]
  timeframe: string
  hideAxes?: boolean
  hideTooltip?: boolean
  chartMargin?: Partial<{
    top: number
    right: number
    left: number
    bottom: number
  }>
  yAxisWidth?: number
  defaultVisibleSeries?: Partial<Record<APYSeriesKey, boolean>>
  visibleSeries?: APYVisibleSeries
  onVisibleSeriesChange?: (nextVisibleSeries: APYVisibleSeries) => void
  hideSeriesControls?: boolean
}

interface APYSeriesSelectorProps {
  visibleSeries: APYVisibleSeries
  onVisibleSeriesChange: (nextVisibleSeries: APYVisibleSeries) => void
  hasOracleApr: boolean
  hasOracleApy30dAvg: boolean
  className?: string
  itemClassName?: string
  idPrefix?: string
  compact?: boolean
}

export function APYSeriesSelector({
  visibleSeries,
  onVisibleSeriesChange,
  hasOracleApr,
  hasOracleApy30dAvg,
  className,
  itemClassName,
  idPrefix = 'toggle',
  compact = false,
}: APYSeriesSelectorProps) {
  const toggleSeries = (seriesKey: APYSeriesKey, checked: boolean) =>
    onVisibleSeriesChange({
      ...visibleSeries,
      [seriesKey]: checked,
    })

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-md bg-white/90 px-3 py-2 text-xs sm:w-fit sm:px-4',
        className,
      )}
    >
      {getAvailableApySeries({ hasOracleApr, hasOracleApy30dAvg }).map(
        (seriesKey) => (
          <div
            key={seriesKey}
            className={cn(
              'flex min-w-[8.75rem] items-center gap-2 sm:min-w-0',
              itemClassName,
            )}
          >
            {compact ? (
              <label
                key={`compact-${seriesKey}`}
                className="flex cursor-pointer items-center gap-2 text-left"
                htmlFor={`${idPrefix}-${seriesKey}-compact`}
              >
                <Checkbox
                  id={`${idPrefix}-${seriesKey}-compact`}
                  checked={visibleSeries[seriesKey]}
                  className="h-4 w-4 rounded-[4px] border border-gray-400 bg-white text-gray-700 data-[state=checked]:border-gray-700 data-[state=checked]:bg-white data-[state=checked]:text-gray-800"
                  onCheckedChange={(checked) =>
                    toggleSeries(seriesKey, !!checked)
                  }
                />
                <span>{SERIES_BASE_CONFIG[seriesKey].legendLabel}</span>
              </label>
            ) : (
              <>
                <Checkbox
                  id={`${idPrefix}-${seriesKey}`}
                  checked={visibleSeries[seriesKey]}
                  className="h-4 w-4 rounded-[4px] border border-gray-400 bg-white text-gray-700 data-[state=checked]:border-gray-700 data-[state=checked]:bg-white data-[state=checked]:text-gray-800"
                  onCheckedChange={(checked) =>
                    toggleSeries(seriesKey, !!checked)
                  }
                />
                <label
                  htmlFor={`${idPrefix}-${seriesKey}`}
                  className="flex items-center gap-1"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-3.5 w-3.5 rounded-sm border border-gray-200"
                    style={{
                      backgroundColor: SERIES_BASE_CONFIG[seriesKey].color,
                    }}
                  />
                  {SERIES_BASE_CONFIG[seriesKey].legendLabel}
                </label>
              </>
            )}
          </div>
        ),
      )}
    </div>
  )
}

export const APYChart: React.FC<APYChartProps> = React.memo(
  ({
    chartData,
    timeframe,
    hideAxes,
    hideTooltip,
    chartMargin,
    yAxisWidth,
    defaultVisibleSeries,
    visibleSeries,
    onVisibleSeriesChange,
    hideSeriesControls,
  }) => {
    const isMobile = useIsMobile()
    const [internalVisibleSeries, setInternalVisibleSeries] =
      useState<APYVisibleSeries>(() =>
        buildApyVisibleSeries(defaultVisibleSeries),
      )

    const seriesConfig = SERIES_BASE_CONFIG
    const resolvedVisibleSeries = visibleSeries ?? internalVisibleSeries
    const setSeriesVisibility = (nextVisibleSeries: APYVisibleSeries) => {
      onVisibleSeriesChange?.(nextVisibleSeries)
      if (!visibleSeries) {
        setInternalVisibleSeries(nextVisibleSeries)
      }
    }

    const filteredData = useMemo(
      () => chartData.slice(-getTimeframeLimit(timeframe)),
      [chartData, timeframe],
    )
    const chartBottomPadding = isMobile ? 12 : 16
    const yAxisMargin = yAxisWidth ?? (isMobile ? 44 : 60)

    const hasOracleApr = useMemo(() => {
      return filteredData.some((point) => typeof point.oracleApr === 'number')
    }, [filteredData])

    const hasOracleApy30dAvg = useMemo(() => {
      return filteredData.some(
        (point) => typeof point.oracleApy30dAvg === 'number',
      )
    }, [filteredData])

    const chartConfig = useMemo<ChartConfig>(() => {
      return Object.entries(SERIES_BASE_CONFIG).reduce((acc, [key, meta]) => {
        if (key === 'oracleApr' && !hasOracleApr) {
          return acc
        }
        if (key === 'oracleApy30dAvg' && !hasOracleApy30dAvg) {
          return acc
        }
        acc[key] = {
          label: meta.chartLabel,
          color: hideAxes ? 'black' : meta.color,
        }
        return acc
      }, {} as ChartConfig)
    }, [hideAxes, hasOracleApr, hasOracleApy30dAvg])

    const getSeriesLabel = (name: string) =>
      seriesConfig[name as APYSeriesKey]?.legendLabel || name

    return (
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <ChartContainer config={chartConfig} style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={filteredData}
                margin={{
                  top: chartMargin?.top ?? 12,
                  right: chartMargin?.right ?? (isMobile ? 8 : 20),
                  left: chartMargin?.left ?? (isMobile ? -20 : 0),
                  bottom:
                    chartMargin?.bottom ?? (hideAxes ? 8 : chartBottomPadding),
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  minTickGap={isMobile ? 32 : 24}
                  interval={hideAxes ? 'preserveStartEnd' : undefined}
                  tick={
                    hideAxes
                      ? false
                      : {
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: isMobile ? 11 : 12,
                        }
                  }
                  axisLine={
                    hideAxes
                      ? false
                      : { stroke: 'hsl(var(--muted-foreground))' }
                  }
                  tickLine={
                    hideAxes
                      ? false
                      : { stroke: 'hsl(var(--muted-foreground))' }
                  }
                />
                <YAxis
                  width={isMobile ? 44 : yAxisMargin}
                  domain={[0, 'auto']}
                  tickFormatter={(value) => `${value}%`}
                  label={
                    hideAxes || isMobile
                      ? undefined
                      : {
                          value: 'Annualized %',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 10,
                          style: {
                            textAnchor: 'middle',
                            fill: hideAxes
                              ? 'transparent'
                              : 'hsl(var(--muted-foreground))',
                          },
                        }
                  }
                  tick={
                    hideAxes
                      ? false
                      : {
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: isMobile ? 11 : 12,
                        }
                  }
                  axisLine={
                    hideAxes
                      ? false
                      : { stroke: 'hsl(var(--muted-foreground))' }
                  }
                  tickLine={
                    hideAxes
                      ? false
                      : { stroke: 'hsl(var(--muted-foreground))' }
                  }
                />
                {!hideTooltip && (
                  <ChartTooltip
                    content={({ active, label, payload }) => {
                      if (!active || !payload?.length) return null

                      const sorted = [...payload].sort((a, b) => {
                        const aKey = a.dataKey as APYSeriesKey
                        const bKey = b.dataKey as APYSeriesKey
                        return (
                          (TOOLTIP_ORDER[aKey] ?? 999) -
                          (TOOLTIP_ORDER[bKey] ?? 999)
                        )
                      })

                      return (
                        <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                          <div className="font-medium">{label}</div>
                          <div className="grid gap-1.5">
                            {sorted.map((item) => {
                              const seriesKey = item.dataKey as APYSeriesKey
                              const raw = item.value
                              const value =
                                typeof raw === 'number'
                                  ? `${raw.toFixed(2)}%`
                                  : raw

                              const color =
                                (item.color as string | undefined) ||
                                (item.stroke as string | undefined) ||
                                'currentColor'

                              return (
                                <div
                                  key={`${item.dataKey}`}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-2">
                                    <svg
                                      aria-hidden="true"
                                      width={18}
                                      height={6}
                                      viewBox="0 0 18 6"
                                      className="shrink-0"
                                    >
                                      <line
                                        x1="0"
                                        y1="3"
                                        x2="18"
                                        y2="3"
                                        stroke={color}
                                        strokeWidth="2"
                                        strokeDasharray={
                                          isDashedSeries(seriesKey)
                                            ? '12 4'
                                            : undefined
                                        }
                                        strokeLinecap="butt"
                                      />
                                    </svg>
                                    <span>
                                      {getSeriesLabel(String(item.dataKey))}
                                    </span>
                                  </div>
                                  <span className="tabular-nums">{value}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }}
                  />
                )}
                {resolvedVisibleSeries.sevenDayApy && (
                  <Line
                    type="monotone"
                    dataKey="sevenDayApy"
                    stroke="var(--color-sevenDayApy)"
                    strokeWidth={hideAxes ? 1 : 1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {resolvedVisibleSeries.thirtyDayApy && (
                  <Line
                    type="monotone"
                    dataKey="thirtyDayApy"
                    stroke="var(--color-thirtyDayApy)"
                    strokeDasharray="12 4"
                    strokeWidth={hideAxes ? 1 : 2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {resolvedVisibleSeries.derivedApy && (
                  <Line
                    type="monotone"
                    dataKey="derivedApy"
                    stroke="var(--color-derivedApy)"
                    strokeWidth={hideAxes ? 1 : 1}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {hasOracleApr && resolvedVisibleSeries.oracleApr && (
                  <Line
                    type="monotone"
                    dataKey="oracleApr"
                    stroke="var(--color-oracleApr)"
                    strokeWidth={hideAxes ? 1 : 2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {hasOracleApy30dAvg &&
                  resolvedVisibleSeries.oracleApy30dAvg && (
                    <Line
                      type="monotone"
                      dataKey="oracleApy30dAvg"
                      stroke="var(--color-oracleApy30dAvg)"
                      strokeDasharray="12 4"
                      strokeWidth={hideAxes ? 1 : 2.75}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        {!hideAxes && !hideSeriesControls && (
          <div className="mt-3 flex justify-center">
            <APYSeriesSelector
              visibleSeries={resolvedVisibleSeries}
              onVisibleSeriesChange={setSeriesVisibility}
              hasOracleApr={hasOracleApr}
              hasOracleApy30dAvg={hasOracleApy30dAvg}
            />
          </div>
        )}
      </div>
    )
  },
)

export default APYChart
