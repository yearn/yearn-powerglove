import React, { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getTimeframeLimit } from '@/components/charts/chart-utils'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { useIsMobile } from '@/components/ui/use-mobile'
import { cn } from '@/lib/utils'
import type { ChartDataPoint } from '@/types/dataTypes'

export type APYSeriesKey =
  | 'derivedApy'
  | 'sevenDayApy'
  | 'thirtyDayApy'
  | 'ppsPeriodApy'
  | 'estimatedApy'
  | 'estimatedApy30dAvg'
  | 'yBoldEstimatedApy'
  | 'oracleApy'
  | 'oracleApy30dAvg'
export type APYVisibleSeries = Record<APYSeriesKey, boolean>

const TOOLTIP_ORDER: Record<APYSeriesKey, number> = {
  derivedApy: 0,
  sevenDayApy: 1,
  thirtyDayApy: 2,
  ppsPeriodApy: 3,
  estimatedApy: 4,
  estimatedApy30dAvg: 5,
  yBoldEstimatedApy: 6,
  oracleApy: 7,
  oracleApy30dAvg: 8
}

const isDashedSeries = (seriesKey: APYSeriesKey) =>
  seriesKey === 'yBoldEstimatedApy' ||
  seriesKey === 'estimatedApy' ||
  seriesKey === 'ppsPeriodApy' ||
  seriesKey === 'estimatedApy30dAvg' ||
  seriesKey === 'oracleApy30dAvg'

const SERIES_BASE_CONFIG: Record<APYSeriesKey, { chartLabel: string; legendLabel: string; color: string }> = {
  derivedApy: {
    chartLabel: '1-day APY %',
    legendLabel: '1-day APY',
    color: 'var(--chart-3)'
  },
  sevenDayApy: {
    chartLabel: '7-day APY %',
    legendLabel: '7-day APY',
    color: 'var(--chart-2)'
  },
  thirtyDayApy: {
    chartLabel: '30-day APY %',
    legendLabel: '30-day APY',
    color: 'var(--chart-1)'
  },
  ppsPeriodApy: {
    chartLabel: 'Period APY %',
    legendLabel: 'Period APY',
    color: '#6d90f2'
  },
  estimatedApy: {
    chartLabel: 'Estimated APY %',
    legendLabel: 'Estimated APY',
    color: 'var(--chart-1)'
  },
  estimatedApy30dAvg: {
    chartLabel: 'Estimated APY (30d avg) %',
    legendLabel: 'Estimated APY (30d avg)',
    color: 'var(--chart-4)'
  },
  yBoldEstimatedApy: {
    chartLabel: 'Estimated APY %',
    legendLabel: 'Estimated APY',
    color: 'var(--chart-1)'
  },
  oracleApy: {
    chartLabel: 'Oracle APY %',
    legendLabel: 'Oracle APY',
    color: 'var(--chart-4)'
  },
  oracleApy30dAvg: {
    chartLabel: 'Oracle APY (30d avg) %',
    legendLabel: 'Oracle APY (30d avg)',
    color: 'var(--chart-4)'
  }
}

const LOCKED_SERIES_COLORS: Record<APYSeriesKey, string> = {
  derivedApy: '#ff8fbb',
  sevenDayApy: '#ffb3d1',
  thirtyDayApy: '#ff6ba5',
  ppsPeriodApy: '#ffd6e7',
  estimatedApy: '#d21162',
  estimatedApy30dAvg: 'var(--chart-4)',
  yBoldEstimatedApy: 'var(--chart-1)',
  oracleApy: '#ff4d94',
  oracleApy30dAvg: '#d21162'
}

const SERIES_ORDER: APYSeriesKey[] = [
  'derivedApy',
  'sevenDayApy',
  'thirtyDayApy',
  'ppsPeriodApy',
  'estimatedApy',
  'estimatedApy30dAvg',
  'yBoldEstimatedApy',
  'oracleApy',
  'oracleApy30dAvg'
]

export const buildApyVisibleSeries = (overrides?: Partial<Record<APYSeriesKey, boolean>>): APYVisibleSeries => ({
  derivedApy: overrides?.derivedApy ?? true,
  sevenDayApy: overrides?.sevenDayApy ?? true,
  thirtyDayApy: overrides?.thirtyDayApy ?? true,
  ppsPeriodApy: overrides?.ppsPeriodApy ?? true,
  estimatedApy: overrides?.estimatedApy ?? false,
  estimatedApy30dAvg: overrides?.estimatedApy30dAvg ?? false,
  yBoldEstimatedApy: overrides?.yBoldEstimatedApy ?? true,
  oracleApy: overrides?.oracleApy ?? false,
  oracleApy30dAvg: overrides?.oracleApy30dAvg ?? false
})

export const getAvailableApySeries = ({
  hasPpsPeriodApy,
  hasOracleApy,
  hasOracleApy30dAvg,
  hasYBoldEstimatedApy = false,
  hasEstimatedApy = false,
  hasEstimatedApy30dAvg = false
}: {
  hasPpsPeriodApy: boolean
  hasOracleApy: boolean
  hasOracleApy30dAvg: boolean
  hasYBoldEstimatedApy?: boolean
  hasEstimatedApy?: boolean
  hasEstimatedApy30dAvg?: boolean
}): APYSeriesKey[] => {
  return SERIES_ORDER.filter((seriesKey) => {
    if (seriesKey === 'ppsPeriodApy') return hasPpsPeriodApy
    if (seriesKey === 'estimatedApy') return hasEstimatedApy
    if (seriesKey === 'estimatedApy30dAvg') return hasEstimatedApy30dAvg
    if (seriesKey === 'yBoldEstimatedApy') return hasYBoldEstimatedApy
    if (seriesKey === 'oracleApy') return hasOracleApy
    if (seriesKey === 'oracleApy30dAvg') return hasOracleApy30dAvg
    return true
  })
}

interface APYChartProps {
  chartData: ChartDataPoint[]
  comparisonChartData?: ChartDataPoint[]
  comparisonLabel?: string
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
  ppsPeriodApy?: number | null
  lockedPpsPeriodApy?: number | null
  primaryLabel?: string
  seriesScope?: 'both' | 'primary' | 'comparison'
}

interface APYSeriesSelectorProps {
  visibleSeries: APYVisibleSeries
  onVisibleSeriesChange: (nextVisibleSeries: APYVisibleSeries) => void
  hasPpsPeriodApy: boolean
  hasOracleApy: boolean
  hasOracleApy30dAvg: boolean
  hasYBoldEstimatedApy?: boolean
  hasEstimatedApy?: boolean
  hasEstimatedApy30dAvg?: boolean
  className?: string
  itemClassName?: string
  idPrefix?: string
  compact?: boolean
}

export function APYSeriesSelector({
  visibleSeries,
  onVisibleSeriesChange,
  hasPpsPeriodApy,
  hasOracleApy,
  hasOracleApy30dAvg,
  hasYBoldEstimatedApy = false,
  hasEstimatedApy = false,
  hasEstimatedApy30dAvg = false,
  className,
  itemClassName,
  idPrefix = 'toggle',
  compact = false
}: APYSeriesSelectorProps) {
  const toggleSeries = (seriesKey: APYSeriesKey, checked: boolean) =>
    onVisibleSeriesChange({
      ...visibleSeries,
      [seriesKey]: checked
    })

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-md bg-white/90 px-3 py-2 text-xs sm:w-fit sm:px-4',
        className
      )}
    >
      {getAvailableApySeries({
        hasPpsPeriodApy,
        hasOracleApy,
        hasOracleApy30dAvg,
        hasYBoldEstimatedApy,
        hasEstimatedApy,
        hasEstimatedApy30dAvg
      }).map((seriesKey) => (
        <div key={seriesKey} className={cn('flex min-w-[8.75rem] items-center gap-2 sm:min-w-0', itemClassName)}>
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
                onCheckedChange={(checked) => toggleSeries(seriesKey, !!checked)}
              />
              <span>{SERIES_BASE_CONFIG[seriesKey].legendLabel}</span>
            </label>
          ) : (
            <>
              <Checkbox
                id={`${idPrefix}-${seriesKey}`}
                checked={visibleSeries[seriesKey]}
                className="h-4 w-4 rounded-[4px] border border-gray-400 bg-white text-gray-700 data-[state=checked]:border-gray-700 data-[state=checked]:bg-white data-[state=checked]:text-gray-800"
                onCheckedChange={(checked) => toggleSeries(seriesKey, !!checked)}
              />
              <label htmlFor={`${idPrefix}-${seriesKey}`} className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="inline-block h-3.5 w-3.5 rounded-sm border border-gray-200"
                  style={{
                    backgroundColor: SERIES_BASE_CONFIG[seriesKey].color
                  }}
                />
                {SERIES_BASE_CONFIG[seriesKey].legendLabel}
              </label>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

export const APYChart: React.FC<APYChartProps> = React.memo(
  ({
    chartData,
    comparisonChartData,
    comparisonLabel = 'Locked yvUSD',
    timeframe,
    hideAxes,
    hideTooltip,
    chartMargin,
    yAxisWidth,
    defaultVisibleSeries,
    visibleSeries,
    onVisibleSeriesChange,
    hideSeriesControls,
    ppsPeriodApy,
    lockedPpsPeriodApy,
    primaryLabel,
    seriesScope = 'both'
  }) => {
    const isMobile = useIsMobile()
    const [internalVisibleSeries, setInternalVisibleSeries] = useState<APYVisibleSeries>(() =>
      buildApyVisibleSeries(defaultVisibleSeries)
    )

    const seriesConfig = SERIES_BASE_CONFIG
    const resolvedVisibleSeries = visibleSeries ?? internalVisibleSeries
    const setSeriesVisibility = (nextVisibleSeries: APYVisibleSeries) => {
      onVisibleSeriesChange?.(nextVisibleSeries)
      if (!visibleSeries) {
        setInternalVisibleSeries(nextVisibleSeries)
      }
    }

    const filteredData = useMemo(() => chartData.slice(-getTimeframeLimit(timeframe)), [chartData, timeframe])
    const chartBottomPadding = isMobile ? 12 : 16
    const yAxisMargin = yAxisWidth ?? (isMobile ? 44 : 60)
    const hasPpsPeriodApy = typeof ppsPeriodApy === 'number' && Number.isFinite(ppsPeriodApy)

    const hasOracleApy = useMemo(() => {
      return (
        filteredData.some((point) => typeof point.oracleApy === 'number') ||
        (comparisonChartData ?? []).some((point) => typeof point.oracleApy === 'number')
      )
    }, [filteredData, comparisonChartData])

    const hasOracleApy30dAvg = useMemo(() => {
      return filteredData.some((point) => typeof point.oracleApy30dAvg === 'number')
    }, [filteredData])

    const hasYBoldEstimatedApy = useMemo(() => {
      return filteredData.some((point) => typeof point.yBoldEstimatedApy === 'number')
    }, [filteredData])

    const hasEstimatedApy = useMemo(
      () =>
        filteredData.some((point) => typeof point.estimatedApy === 'number') ||
        (comparisonChartData ?? []).some((point) => typeof point.estimatedApy === 'number'),
      [filteredData, comparisonChartData]
    )
    const hasEstimatedApy30dAvg = useMemo(
      () =>
        filteredData.some((point) => typeof point.estimatedApy30dAvg === 'number') ||
        (comparisonChartData ?? []).some((point) => typeof point.estimatedApy30dAvg === 'number'),
      [filteredData, comparisonChartData]
    )
    const showPrimary = seriesScope !== 'comparison'
    const showComparison = seriesScope !== 'primary' && Boolean(comparisonChartData?.length)

    const comparisonByDate = useMemo(
      () => new Map((comparisonChartData ?? []).map((point) => [point.date, point])),
      [comparisonChartData]
    )

    const chartSeriesData = useMemo(
      () =>
        filteredData.map((point) => {
          const comparisonPoint = comparisonByDate.get(point.date)
          const nextPoint: ChartDataPoint = hasPpsPeriodApy ? { ...point, ppsPeriodApy } : { ...point }

          if (comparisonPoint) {
            for (const seriesKey of SERIES_ORDER) {
              if (comparisonPoint[seriesKey] !== undefined) {
                nextPoint[`locked${seriesKey}`] = comparisonPoint[seriesKey]
              }
            }
          }

          if (typeof lockedPpsPeriodApy === 'number' && Number.isFinite(lockedPpsPeriodApy)) {
            nextPoint.lockedPpsPeriodApy = lockedPpsPeriodApy
          }

          return nextPoint
        }),
      [filteredData, comparisonByDate, hasPpsPeriodApy, ppsPeriodApy, lockedPpsPeriodApy]
    )

    const chartConfig = useMemo<ChartConfig>(() => {
      return Object.entries(SERIES_BASE_CONFIG).reduce((acc, [key, meta]) => {
        if (key === 'ppsPeriodApy' && !hasPpsPeriodApy) {
          return acc
        }
        if (key === 'oracleApy' && !hasOracleApy) {
          return acc
        }
        if (key === 'oracleApy30dAvg' && !hasOracleApy30dAvg) {
          return acc
        }
        if (key === 'estimatedApy' && !hasEstimatedApy) {
          return acc
        }
        if (key === 'estimatedApy30dAvg' && !hasEstimatedApy30dAvg) {
          return acc
        }
        if (key === 'yBoldEstimatedApy' && !hasYBoldEstimatedApy) {
          return acc
        }
        acc[key] = {
          label: primaryLabel ? `${primaryLabel} ${meta.chartLabel}` : meta.chartLabel,
          color: hideAxes ? 'black' : meta.color
        }
        if (comparisonChartData?.length) {
          acc[`locked${key}`] = {
            label: `${comparisonLabel} ${meta.chartLabel}`,
            color: hideAxes ? 'black' : LOCKED_SERIES_COLORS[key as APYSeriesKey]
          }
        }
        return acc
      }, {} as ChartConfig)
    }, [
      hideAxes,
      hasPpsPeriodApy,
      hasOracleApy,
      hasOracleApy30dAvg,
      hasEstimatedApy,
      hasEstimatedApy30dAvg,
      hasYBoldEstimatedApy,
      comparisonChartData?.length,
      comparisonLabel,
      primaryLabel
    ])

    const getTimeframeLabel = (value: string) => {
      if (value === '30d') return '30D'
      if (value === '90d') return '90D'
      if (value === '1y') return '1Y'
      if (value === 'all') return 'All Time'
      return value
    }

    const getSeriesLabel = (name: string) => {
      if (name.startsWith('locked')) {
        const unlockedSeriesKey = (name.charAt(6).toLowerCase() + name.slice(7)) as APYSeriesKey
        return `${comparisonLabel} ${seriesConfig[unlockedSeriesKey]?.legendLabel ?? name}`
      }
      if (name === 'ppsPeriodApy') {
        return `${primaryLabel ? `${primaryLabel} ` : ''}${getTimeframeLabel(timeframe)} APY`
      }
      const label = seriesConfig[name as APYSeriesKey]?.legendLabel || name
      return primaryLabel ? `${primaryLabel} ${label}` : label
    }

    const getTooltipSeriesKey = (dataKey: string): APYSeriesKey => {
      if (dataKey.startsWith('locked')) {
        return (dataKey.charAt(6).toLowerCase() + dataKey.slice(7)) as APYSeriesKey
      }

      return dataKey as APYSeriesKey
    }

    const renderSeriesLine = (seriesKey: APYSeriesKey, locked = false) => {
      const dataKey = locked ? `locked${seriesKey}` : seriesKey
      const colorKey = locked ? `locked${seriesKey}` : seriesKey
      const strokeDasharray =
        seriesKey === 'estimatedApy30dAvg' && locked ? '2 4' : isDashedSeries(seriesKey) ? '12 4' : undefined

      return (
        <Line
          key={dataKey}
          type="monotone"
          dataKey={dataKey}
          stroke={`var(--color-${colorKey})`}
          strokeDasharray={strokeDasharray}
          strokeWidth={
            hideAxes
              ? 1
              : seriesKey === 'yBoldEstimatedApy' || seriesKey === 'estimatedApy' || seriesKey === 'oracleApy'
                ? 1.5
                : seriesKey === 'oracleApy30dAvg' || seriesKey === 'estimatedApy30dAvg'
                  ? 2.75
                  : seriesKey === 'thirtyDayApy'
                    ? 3.5
                    : seriesKey === 'derivedApy'
                      ? 2.5
                      : seriesKey === 'sevenDayApy'
                        ? 2
                        : seriesKey === 'ppsPeriodApy'
                          ? 0.5
                          : 1
          }
          dot={false}
          isAnimationActive={false}
        />
      )
    }

    return (
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <ChartContainer config={chartConfig} style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartSeriesData}
                margin={{
                  top: chartMargin?.top ?? 12,
                  right: chartMargin?.right ?? (isMobile ? 8 : 20),
                  left: chartMargin?.left ?? (isMobile ? -20 : 0),
                  bottom: chartMargin?.bottom ?? (hideAxes ? 8 : chartBottomPadding)
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
                          fontSize: isMobile ? 11 : 12
                        }
                  }
                  axisLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
                  tickLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
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
                            fill: hideAxes ? 'transparent' : 'hsl(var(--muted-foreground))'
                          }
                        }
                  }
                  tick={
                    hideAxes
                      ? false
                      : {
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: isMobile ? 11 : 12
                        }
                  }
                  axisLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
                  tickLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
                />
                {!hideTooltip && (
                  <ChartTooltip
                    content={({ active, label, payload }) => {
                      if (!active || !payload?.length) return null

                      const sorted = [...payload].sort((a, b) => {
                        const aKey = getTooltipSeriesKey(String(a.dataKey))
                        const bKey = getTooltipSeriesKey(String(b.dataKey))
                        return (TOOLTIP_ORDER[aKey] ?? 999) - (TOOLTIP_ORDER[bKey] ?? 999)
                      })

                      return (
                        <div className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                          <div className="font-medium">{label}</div>
                          <div className="grid gap-1.5">
                            {sorted.map((item) => {
                              const seriesKey = getTooltipSeriesKey(String(item.dataKey))
                              const isLockedEstimatedAverage =
                                String(item.dataKey).startsWith('locked') && seriesKey === 'estimatedApy30dAvg'
                              const raw = item.value
                              const value = typeof raw === 'number' ? `${raw.toFixed(2)}%` : raw

                              const color =
                                (item.color as string | undefined) ||
                                (item.stroke as string | undefined) ||
                                'currentColor'

                              return (
                                <div key={`${item.dataKey}`} className="flex items-center justify-between gap-3">
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
                                        strokeWidth={
                                          seriesKey === 'yBoldEstimatedApy' ||
                                          seriesKey === 'estimatedApy' ||
                                          seriesKey === 'oracleApy'
                                            ? 1.5
                                            : seriesKey === 'thirtyDayApy'
                                              ? 3.5
                                              : seriesKey === 'derivedApy'
                                                ? 2.5
                                                : 2
                                        }
                                        strokeDasharray={
                                          isLockedEstimatedAverage
                                            ? '2 4'
                                            : isDashedSeries(seriesKey)
                                              ? '12 4'
                                              : undefined
                                        }
                                        strokeLinecap="butt"
                                      />
                                    </svg>
                                    <span>{getSeriesLabel(String(item.dataKey))}</span>
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
                  <>
                    {showPrimary ? renderSeriesLine('sevenDayApy') : null}
                    {showComparison ? renderSeriesLine('sevenDayApy', true) : null}
                  </>
                )}
                {resolvedVisibleSeries.thirtyDayApy && (
                  <>
                    {showPrimary ? renderSeriesLine('thirtyDayApy') : null}
                    {showComparison ? renderSeriesLine('thirtyDayApy', true) : null}
                  </>
                )}
                {hasPpsPeriodApy && resolvedVisibleSeries.ppsPeriodApy && (
                  <>
                    {showPrimary ? renderSeriesLine('ppsPeriodApy') : null}
                    {showComparison && typeof lockedPpsPeriodApy === 'number'
                      ? renderSeriesLine('ppsPeriodApy', true)
                      : null}
                  </>
                )}
                {resolvedVisibleSeries.derivedApy && (
                  <>
                    {showPrimary ? renderSeriesLine('derivedApy') : null}
                    {showComparison ? renderSeriesLine('derivedApy', true) : null}
                  </>
                )}
                {hasOracleApy && resolvedVisibleSeries.oracleApy && (
                  <>
                    {showPrimary ? renderSeriesLine('oracleApy') : null}
                    {showComparison ? renderSeriesLine('oracleApy', true) : null}
                  </>
                )}
                {hasOracleApy30dAvg && resolvedVisibleSeries.oracleApy30dAvg && (
                  <>
                    {showPrimary ? renderSeriesLine('oracleApy30dAvg') : null}
                    {showComparison ? renderSeriesLine('oracleApy30dAvg', true) : null}
                  </>
                )}
                {hasYBoldEstimatedApy &&
                  resolvedVisibleSeries.yBoldEstimatedApy &&
                  showPrimary &&
                  renderSeriesLine('yBoldEstimatedApy')}
                {hasEstimatedApy && resolvedVisibleSeries.estimatedApy && (
                  <>
                    {showPrimary ? renderSeriesLine('estimatedApy') : null}
                    {showComparison ? renderSeriesLine('estimatedApy', true) : null}
                  </>
                )}
                {hasEstimatedApy30dAvg && resolvedVisibleSeries.estimatedApy30dAvg && (
                  <>
                    {showPrimary ? renderSeriesLine('estimatedApy30dAvg') : null}
                    {showComparison ? renderSeriesLine('estimatedApy30dAvg', true) : null}
                  </>
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
              hasPpsPeriodApy={hasPpsPeriodApy}
              hasOracleApy={hasOracleApy}
              hasOracleApy30dAvg={hasOracleApy30dAvg}
              hasYBoldEstimatedApy={hasYBoldEstimatedApy}
              hasEstimatedApy={hasEstimatedApy}
              hasEstimatedApy30dAvg={hasEstimatedApy30dAvg}
            />
          </div>
        )}
      </div>
    )
  }
)

export default APYChart
