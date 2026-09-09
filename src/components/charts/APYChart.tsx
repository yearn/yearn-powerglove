import { ChevronDown } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { CHART_PALETTE } from '@/components/charts/chart-container'
import {
  getTimeframeLimit,
  PPS_HISTORICAL_APY_PERIODS,
  type PpsHistoricalApyKey,
  type PpsHistoricalApyPoint
} from '@/components/charts/chart-utils'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/components/ui/use-mobile'
import { cn } from '@/lib/utils'
import type { ChartDataPoint } from '@/types/dataTypes'

export type APYSeriesKey =
  | 'derivedApy'
  | 'sevenDayApy'
  | 'thirtyDayApy'
  | PpsHistoricalApyKey
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
  pps90DayApy: 3,
  pps180DayApy: 4,
  ppsOneYearApy: 5,
  ppsAllTimeApy: 6,
  estimatedApy: 8,
  estimatedApy30dAvg: 9,
  yBoldEstimatedApy: 10,
  oracleApy: 11,
  oracleApy30dAvg: 12
}

const SERIES_DASH_PATTERNS: Partial<Record<APYSeriesKey, string>> = {
  pps90DayApy: '8 4',
  pps180DayApy: '4 4',
  ppsOneYearApy: '2 4',
  ppsAllTimeApy: '12 3 2 3',
  yBoldEstimatedApy: '12 4',
  estimatedApy: '12 4',
  estimatedApy30dAvg: '12 4',
  oracleApy30dAvg: '12 4'
}

const getSeriesDashPattern = (seriesKey: APYSeriesKey, locked = false) => {
  if (locked && seriesKey === 'estimatedApy30dAvg') return '2 4'
  return SERIES_DASH_PATTERNS[seriesKey]
}

const isPpsHistoricalApySeries = (seriesKey: APYSeriesKey): seriesKey is PpsHistoricalApyKey =>
  PPS_HISTORICAL_APY_PERIODS.some((period) => period.key === seriesKey)

const SERIES_BASE_CONFIG: Record<
  APYSeriesKey,
  { chartLabel: string; legendLabel: string; color: string; description: string }
> = {
  derivedApy: {
    chartLabel: '1-day APY %',
    legendLabel: '1-day APY',
    color: 'var(--chart-3)',
    description: 'Annualized return from the latest 1-day price-per-share change.'
  },
  sevenDayApy: {
    chartLabel: '7-day APY %',
    legendLabel: '7-day APY',
    color: 'var(--chart-2)',
    description: 'Annualized return from the latest 7-day price-per-share change.'
  },
  thirtyDayApy: {
    chartLabel: '30-day APY %',
    legendLabel: '30-day APY',
    color: 'var(--chart-1)',
    description: 'Annualized return from the latest 30-day price-per-share change.'
  },
  pps90DayApy: {
    chartLabel: '90-day APY %',
    legendLabel: '90-day APY',
    color: '#657fc7',
    description: 'Rolling annualized PPS return over each complete 90-day window.'
  },
  pps180DayApy: {
    chartLabel: '180-day APY %',
    legendLabel: '180-day APY',
    color: '#5f709f',
    description: 'Rolling annualized PPS return over each complete 180-day window.'
  },
  ppsOneYearApy: {
    chartLabel: '1-year APY %',
    legendLabel: '1-year APY',
    color: '#56617e',
    description: 'Rolling annualized PPS return over each complete one-year window.'
  },
  ppsAllTimeApy: {
    chartLabel: 'All-time APY %',
    legendLabel: 'All-time APY',
    color: '#485269',
    description: 'Annualized PPS return from the first observation through each chart date.'
  },
  estimatedApy: {
    chartLabel: 'Estimated APY %',
    legendLabel: 'Estimated APY',
    color: 'var(--chart-1)',
    description: 'Forward-looking APY from the vault estimation model.'
  },
  estimatedApy30dAvg: {
    chartLabel: 'Estimated APY (30d avg) %',
    legendLabel: 'Estimated APY (30d avg)',
    color: 'var(--chart-4)',
    description: '30-day average of the estimated APY.'
  },
  yBoldEstimatedApy: {
    chartLabel: 'Estimated APY %',
    legendLabel: 'Estimated APY',
    color: 'var(--chart-1)',
    description: 'The larger of the 7-day PPS APY and fee-adjusted Oracle APY.'
  },
  oracleApy: {
    chartLabel: 'Oracle APY %',
    legendLabel: 'Oracle APY',
    color: 'var(--chart-4)',
    description: 'Fee-adjusted APY from the vault APR Oracle.'
  },
  oracleApy30dAvg: {
    chartLabel: 'Oracle APY (30d avg) %',
    legendLabel: 'Oracle APY (30d avg)',
    color: 'var(--chart-4)',
    description: '30-day average of the fee-adjusted Oracle APY.'
  }
}

const LOCKED_SERIES_COLORS: Record<APYSeriesKey, string> = {
  derivedApy: '#ff8fbb',
  sevenDayApy: '#ffb3d1',
  thirtyDayApy: '#ff6ba5',
  pps90DayApy: '#f6b7d1',
  pps180DayApy: '#eb96bb',
  ppsOneYearApy: '#db729f',
  ppsAllTimeApy: '#c94d83',
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
  'pps90DayApy',
  'pps180DayApy',
  'ppsOneYearApy',
  'ppsAllTimeApy',
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
  pps90DayApy: overrides?.pps90DayApy ?? false,
  pps180DayApy: overrides?.pps180DayApy ?? false,
  ppsOneYearApy: overrides?.ppsOneYearApy ?? false,
  ppsAllTimeApy: overrides?.ppsAllTimeApy ?? true,
  estimatedApy: overrides?.estimatedApy ?? false,
  estimatedApy30dAvg: overrides?.estimatedApy30dAvg ?? false,
  yBoldEstimatedApy: overrides?.yBoldEstimatedApy ?? true,
  oracleApy: overrides?.oracleApy ?? false,
  oracleApy30dAvg: overrides?.oracleApy30dAvg ?? false
})

export const getAvailableApySeries = ({
  historicalApySeries,
  lockedHistoricalApySeries,
  hasOracleApy,
  hasOracleApy30dAvg,
  hasYBoldEstimatedApy = false,
  hasEstimatedApy = false,
  hasEstimatedApy30dAvg = false
}: {
  historicalApySeries?: PpsHistoricalApyPoint[] | null
  lockedHistoricalApySeries?: PpsHistoricalApyPoint[] | null
  hasOracleApy: boolean
  hasOracleApy30dAvg: boolean
  hasYBoldEstimatedApy?: boolean
  hasEstimatedApy?: boolean
  hasEstimatedApy30dAvg?: boolean
}): APYSeriesKey[] => {
  return SERIES_ORDER.filter((seriesKey) => {
    if (isPpsHistoricalApySeries(seriesKey)) {
      return [historicalApySeries, lockedHistoricalApySeries].some((series) =>
        series?.some((point) => typeof point[seriesKey] === 'number' && Number.isFinite(point[seriesKey]))
      )
    }
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
  historicalApySeries?: PpsHistoricalApyPoint[] | null
  lockedHistoricalApySeries?: PpsHistoricalApyPoint[] | null
  primaryLabel?: string
  seriesScope?: 'both' | 'primary' | 'comparison'
}

interface APYSeriesSelectorProps {
  visibleSeries: APYVisibleSeries
  onVisibleSeriesChange: (nextVisibleSeries: APYVisibleSeries) => void
  historicalApySeries?: PpsHistoricalApyPoint[] | null
  lockedHistoricalApySeries?: PpsHistoricalApyPoint[] | null
  hasOracleApy: boolean
  hasOracleApy30dAvg: boolean
  hasYBoldEstimatedApy?: boolean
  hasEstimatedApy?: boolean
  hasEstimatedApy30dAvg?: boolean
  className?: string
}

const ROLLING_HISTORICAL_SERIES: APYSeriesKey[] = [
  'derivedApy',
  'sevenDayApy',
  'thirtyDayApy',
  ...PPS_HISTORICAL_APY_PERIODS.map((period) => period.key)
]
const ESTIMATE_SERIES: APYSeriesKey[] = [
  'estimatedApy',
  'estimatedApy30dAvg',
  'yBoldEstimatedApy',
  'oracleApy',
  'oracleApy30dAvg'
]

const SERIES_LINE_SAMPLE_COLORS: Partial<Record<APYSeriesKey, string>> = {
  derivedApy: CHART_PALETTE.secondary,
  sevenDayApy: CHART_PALETTE.primary,
  thirtyDayApy: CHART_PALETTE.primary,
  estimatedApy: CHART_PALETTE.primary,
  yBoldEstimatedApy: CHART_PALETTE.primary,
  estimatedApy30dAvg: CHART_PALETTE.neutral,
  oracleApy: CHART_PALETTE.neutral,
  oracleApy30dAvg: CHART_PALETTE.neutral
}

function SeriesLineSample({ seriesKey }: { seriesKey: APYSeriesKey }) {
  return (
    <svg aria-hidden="true" width="26" height="8" viewBox="0 0 26 8" className="shrink-0">
      <line
        x1="1"
        y1="4"
        x2="25"
        y2="4"
        stroke={SERIES_LINE_SAMPLE_COLORS[seriesKey] ?? SERIES_BASE_CONFIG[seriesKey].color}
        strokeWidth="2"
        strokeDasharray={getSeriesDashPattern(seriesKey)}
      />
    </svg>
  )
}

interface ApySeriesDropdownProps {
  label: string
  groups: Array<{ label: string; seriesKeys: APYSeriesKey[]; showUnavailable?: boolean }>
  availableSeries: Set<APYSeriesKey>
  visibleSeries: APYVisibleSeries
  onSeriesToggle: (seriesKey: APYSeriesKey, checked: boolean) => void
}

function ApySeriesDropdown({ label, groups, availableSeries, visibleSeries, onSeriesToggle }: ApySeriesDropdownProps) {
  const [open, setOpen] = useState(false)
  const seriesKeys = groups.flatMap((group) => group.seriesKeys)
  const availableCount = seriesKeys.filter((seriesKey) => availableSeries.has(seriesKey)).length
  const selectedCount = seriesKeys.filter(
    (seriesKey) => availableSeries.has(seriesKey) && visibleSeries[seriesKey]
  ).length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={availableCount === 0}
          aria-label={`${label} values, ${selectedCount} selected`}
          className="flex h-10 w-full min-w-44 items-center justify-between gap-4 rounded-md border border-border bg-white px-3 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0657f9]/35 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          <span>{label}</span>
          <span className="ml-auto text-xs font-normal tabular-nums text-gray-500">
            {availableCount === 0 ? 'Unavailable' : `${selectedCount} selected`}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-border bg-white p-1.5 shadow-lg"
      >
        {groups.map((group, groupIndex) => {
          const options = group.showUnavailable
            ? group.seriesKeys
            : group.seriesKeys.filter((seriesKey) => availableSeries.has(seriesKey))

          if (options.length === 0) return null

          return (
            <React.Fragment key={group.label}>
              {groupIndex > 0 ? <DropdownMenuSeparator className="my-1.5" /> : null}
              <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">
                {group.label}
              </DropdownMenuLabel>
              {options.map((seriesKey) => {
                const available = availableSeries.has(seriesKey)
                const meta = SERIES_BASE_CONFIG[seriesKey]

                return (
                  <DropdownMenuCheckboxItem
                    key={seriesKey}
                    checked={available && visibleSeries[seriesKey]}
                    disabled={!available}
                    onCheckedChange={(checked) => onSeriesToggle(seriesKey, checked === true)}
                    onSelect={(event) => event.preventDefault()}
                    className="items-start rounded-sm py-2 pl-8 pr-2 text-[#0657f9] focus:bg-gray-50 focus:text-[#0657f9] data-[disabled]:opacity-45"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <SeriesLineSample seriesKey={seriesKey} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900">{meta.legendLabel}</span>
                          {!available ? <span className="text-[11px] text-gray-500">Unavailable</span> : null}
                        </div>
                        <p className="mt-0.5 text-xs leading-4 text-gray-500">{meta.description}</p>
                      </div>
                    </div>
                  </DropdownMenuCheckboxItem>
                )
              })}
            </React.Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function APYSeriesSelector({
  visibleSeries,
  onVisibleSeriesChange,
  historicalApySeries,
  lockedHistoricalApySeries,
  hasOracleApy,
  hasOracleApy30dAvg,
  hasYBoldEstimatedApy = false,
  hasEstimatedApy = false,
  hasEstimatedApy30dAvg = false,
  className
}: APYSeriesSelectorProps) {
  const toggleSeries = (seriesKey: APYSeriesKey, checked: boolean) =>
    onVisibleSeriesChange({
      ...visibleSeries,
      [seriesKey]: checked
    })

  const availableSeries = new Set(
    getAvailableApySeries({
      historicalApySeries,
      lockedHistoricalApySeries,
      hasOracleApy,
      hasOracleApy30dAvg,
      hasYBoldEstimatedApy,
      hasEstimatedApy,
      hasEstimatedApy30dAvg
    })
  )

  return (
    <div className={cn('flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row', className)}>
      <ApySeriesDropdown
        label="Historical"
        groups={[{ label: 'Rolling history', seriesKeys: ROLLING_HISTORICAL_SERIES, showUnavailable: true }]}
        availableSeries={availableSeries}
        visibleSeries={visibleSeries}
        onSeriesToggle={toggleSeries}
      />
      <ApySeriesDropdown
        label="Oracle & estimates"
        groups={[{ label: 'Forward-looking values', seriesKeys: ESTIMATE_SERIES }]}
        availableSeries={availableSeries}
        visibleSeries={visibleSeries}
        onSeriesToggle={toggleSeries}
      />
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
    historicalApySeries,
    lockedHistoricalApySeries,
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
    const availableApySeries = useMemo(
      () =>
        new Set(
          getAvailableApySeries({
            historicalApySeries,
            lockedHistoricalApySeries,
            hasOracleApy,
            hasOracleApy30dAvg,
            hasYBoldEstimatedApy,
            hasEstimatedApy,
            hasEstimatedApy30dAvg
          })
        ),
      [
        historicalApySeries,
        lockedHistoricalApySeries,
        hasOracleApy,
        hasOracleApy30dAvg,
        hasYBoldEstimatedApy,
        hasEstimatedApy,
        hasEstimatedApy30dAvg
      ]
    )
    const showPrimary = seriesScope !== 'comparison'
    const showComparison = seriesScope !== 'primary' && Boolean(comparisonChartData?.length)

    const comparisonByDate = useMemo(
      () => new Map((comparisonChartData ?? []).map((point) => [point.date, point])),
      [comparisonChartData]
    )
    const historicalApyByDate = useMemo(
      () => new Map((historicalApySeries ?? []).map((point) => [point.date, point])),
      [historicalApySeries]
    )
    const lockedHistoricalApyByDate = useMemo(
      () => new Map((lockedHistoricalApySeries ?? []).map((point) => [point.date, point])),
      [lockedHistoricalApySeries]
    )

    const chartSeriesData = useMemo(
      () =>
        filteredData.map((point) => {
          const comparisonPoint = comparisonByDate.get(point.date)
          const historicalApyPoint = historicalApyByDate.get(point.date)
          const lockedHistoricalApyPoint = lockedHistoricalApyByDate.get(point.date)
          const nextPoint: ChartDataPoint = { ...point }

          for (const period of PPS_HISTORICAL_APY_PERIODS) {
            const primaryValue = historicalApyPoint?.[period.key]
            const lockedValue = lockedHistoricalApyPoint?.[period.key]

            if (typeof primaryValue === 'number' && Number.isFinite(primaryValue)) {
              nextPoint[period.key] = primaryValue
            }
            if (typeof lockedValue === 'number' && Number.isFinite(lockedValue)) {
              nextPoint[`locked${period.key}`] = lockedValue
            }
          }

          if (comparisonPoint) {
            for (const seriesKey of SERIES_ORDER) {
              if (comparisonPoint[seriesKey] !== undefined) {
                nextPoint[`locked${seriesKey}`] = comparisonPoint[seriesKey]
              }
            }
          }

          return nextPoint
        }),
      [filteredData, comparisonByDate, historicalApyByDate, lockedHistoricalApyByDate]
    )

    const chartConfig = useMemo<ChartConfig>(() => {
      return Object.entries(SERIES_BASE_CONFIG).reduce((acc, [key, meta]) => {
        const seriesKey = key as APYSeriesKey
        if (!availableApySeries.has(seriesKey)) {
          return acc
        }
        acc[key] = {
          label: primaryLabel ? `${primaryLabel} ${meta.chartLabel}` : meta.chartLabel,
          color: hideAxes ? 'black' : meta.color
        }
        if (comparisonChartData?.length) {
          acc[`locked${key}`] = {
            label: `${comparisonLabel} ${meta.chartLabel}`,
            color: hideAxes ? 'black' : LOCKED_SERIES_COLORS[seriesKey]
          }
        }
        return acc
      }, {} as ChartConfig)
    }, [hideAxes, availableApySeries, comparisonChartData?.length, comparisonLabel, primaryLabel])

    const getSeriesLabel = (name: string) => {
      if (name.startsWith('locked')) {
        const unlockedSeriesKey = (name.charAt(6).toLowerCase() + name.slice(7)) as APYSeriesKey
        return `${comparisonLabel} ${seriesConfig[unlockedSeriesKey]?.legendLabel ?? name}`
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
      const strokeDasharray = getSeriesDashPattern(seriesKey, locked)

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
                        : isPpsHistoricalApySeries(seriesKey)
                          ? 1.25
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
                              const isLocked = String(item.dataKey).startsWith('locked')
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
                                        strokeDasharray={getSeriesDashPattern(seriesKey, isLocked)}
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
                {PPS_HISTORICAL_APY_PERIODS.map((period) => {
                  if (!availableApySeries.has(period.key) || !resolvedVisibleSeries[period.key]) return null

                  return (
                    <React.Fragment key={period.key}>
                      {showPrimary ? renderSeriesLine(period.key) : null}
                      {showComparison ? renderSeriesLine(period.key, true) : null}
                    </React.Fragment>
                  )
                })}
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
              historicalApySeries={historicalApySeries}
              lockedHistoricalApySeries={lockedHistoricalApySeries}
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
