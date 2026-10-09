import { ChevronDown, Info } from 'lucide-react'
import { Fragment, type ReactNode, useContext, useEffect, useId, useMemo, useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { ChartDateRange } from '@/components/charts/chart-utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { buildBlueShadePalette } from '@/lib/theme-blue-palette'
import { ChainTvlHistory } from './ChainTvlHistory'
import { ChartTypeToggle, type StatsChartType } from './ChartTypeToggle'
import { FeeDateSlider } from './FeeTimeRangeSlider'
import { feeSliderValues } from './fee-range-slider'
import { CAT_COLORS, CHAIN_NAMES, CHAIN_SHORT, CHART_COLORS, fmt, SkeletonCards, useFetch } from './hooks'
import { StatsChartControls } from './StatsChartControls'
import { StatsContext } from './StatsContext'
import {
  buildConstantPriceTvlUrl,
  buildTvlHistoryUrl,
  DAY_SECONDS,
  getAvailableChartSeries,
  getPriceNeutralCoverageLabel,
  getTvlHistoryErrorMessage,
  isPriceNeutralOverlayVisible,
  labelVersionHistoryChart,
  mergePriceNeutralTotal,
  type OverallTvlHistoryBreakdown,
  PRICE_NEUTRAL_TOTAL_SERIES,
  selectConstantPriceChart
} from './tvl-history'
import {
  buildAdjustedChainTvl,
  type LegacyTvlSummary,
  normalizeTvlSummary,
  resolveChainId,
  toggleSelectedChain
} from './tvl-summary'
import type { ConstantPriceTvlHistory, TvlHistoryRun } from './types'

const TVL_HISTORY_TOP_SERIES_COUNT = 10
const TVL_HISTORY_REMAINING_CHAIN_SERIES = 'All other chains'
const TVL_HISTORY_REMAINING_VERSION_SERIES = 'All other versions'
const TVL_HISTORY_TOTAL_SERIES = 'Total TVL'
const TVL_HISTORY_MIN_COMPLETE_SERIES_RATIO = 0.5

function formatDate(timestamp: number | string): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(timestamp: number | string): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function getWarningCount(meta: Record<string, unknown>): number {
  const warnings = meta.warnings
  if (Array.isArray(warnings)) return warnings.length
  if (typeof warnings === 'number' && Number.isFinite(warnings)) return warnings
  if (typeof meta.warningCount === 'number' && Number.isFinite(meta.warningCount)) return meta.warningCount
  return 0
}

function formatHistoryGroup(groupBy: string | undefined): string {
  if (groupBy === 'chain') return 'chain'
  if (groupBy === 'vault') return 'vault'
  if (groupBy === 'category') return 'version'
  return groupBy ?? 'series'
}

function hasSeriesValue(row: Record<string, unknown>, series: string): boolean {
  const value = row[series]
  return typeof value === 'number' && Number.isFinite(value)
}

function countSeriesValues(row: TvlHistoryRun['chart'][number]): number {
  return Object.entries(row).filter(
    ([key, value]) => key !== 'timestamp' && typeof value === 'number' && Number.isFinite(value)
  ).length
}

export function filterPartialHistoryRows(rows: TvlHistoryRun['chart'], seriesCount: number): TvlHistoryRun['chart'] {
  if (rows.length < 2 || seriesCount <= 0) return rows

  const minCompleteSeriesCount = Math.max(1, Math.floor(seriesCount * TVL_HISTORY_MIN_COMPLETE_SERIES_RATIO))
  const firstCompleteRow = rows.findIndex((row) => countSeriesValues(row) >= minCompleteSeriesCount)
  if (firstCompleteRow < 0) return rows

  return rows.filter((row, index) => index < firstCompleteRow || countSeriesValues(row) >= minCompleteSeriesCount)
}

function getLatestRowTotal(rows: TvlHistoryRun['chart'], seriesKeys: string[]): number {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const total = seriesKeys.reduce((sum, series) => {
      const value = rows[index]?.[series]
      return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
    }, 0)

    if (total > 0) return total
  }

  return 0
}

function scaleRows(rows: TvlHistoryRun['chart'], seriesKeys: string[], scaleFactor: number): TvlHistoryRun['chart'] {
  if (!Number.isFinite(scaleFactor) || Math.abs(scaleFactor - 1) < 0.000001) return rows

  return rows.map((row) => {
    const nextRow = { ...row }
    for (const series of seriesKeys) {
      const value = nextRow[series]
      if (typeof value === 'number' && Number.isFinite(value)) nextRow[series] = value * scaleFactor
    }
    return nextRow
  })
}

function addZeroStartPoints(rows: TvlHistoryRun['chart'], seriesKeys: string[]): TvlHistoryRun['chart'] {
  const chartRows = rows.map((row) => ({ ...row }))

  for (const series of seriesKeys) {
    const firstValueIndex = chartRows.findIndex((row) => hasSeriesValue(row, series))
    if (firstValueIndex > 0 && !hasSeriesValue(chartRows[firstValueIndex - 1], series)) {
      chartRows[firstValueIndex - 1][series] = 0
    }
  }

  return chartRows
}

function getLatestSeriesValue(rows: TvlHistoryRun['chart'], series: string): number {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = rows[index]?.[series]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }

  return 0
}

function buildTopTvlHistoryChart(
  rows: TvlHistoryRun['chart'],
  seriesKeys: string[],
  remainingSeries: string
): { rows: TvlHistoryRun['chart']; series: string[] } {
  const rankedSeries = [...seriesKeys].sort((a, b) => getLatestSeriesValue(rows, b) - getLatestSeriesValue(rows, a))
  const topSeries = rankedSeries.slice(0, TVL_HISTORY_TOP_SERIES_COUNT)
  const otherSeries = rankedSeries.slice(TVL_HISTORY_TOP_SERIES_COUNT)
  const hasOtherSeries = otherSeries.length > 0

  const chartRows = rows.map((row) => {
    const nextRow: TvlHistoryRun['chart'][number] = { timestamp: row.timestamp }

    for (const series of topSeries) {
      if (hasSeriesValue(row, series)) nextRow[series] = row[series]
    }

    if (hasOtherSeries) {
      const otherTvl = otherSeries.reduce((sum, series) => {
        const value = row[series]
        return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
      }, 0)

      if (otherTvl > 0) nextRow[remainingSeries] = otherTvl
    }

    return nextRow
  })

  return {
    rows: chartRows,
    series: hasOtherSeries ? [...topSeries, remainingSeries] : topSeries
  }
}

function getStackRenderSeries(seriesKeys: string[], remainingSeries: string): string[] {
  const topSeries = seriesKeys.filter((series) => series !== remainingSeries)
  const hasRemainingSeries = seriesKeys.includes(remainingSeries)
  return [...topSeries.slice().reverse(), ...(hasRemainingSeries ? [remainingSeries] : [])]
}

function getHistoryBarSize(rowCount: number): number {
  if (rowCount <= 12) return 34
  if (rowCount <= 32) return 22
  return 14
}

function addTotalTvlSeries(rows: TvlHistoryRun['chart'], seriesKeys: string[]): TvlHistoryRun['chart'] {
  return rows.map((row) => {
    const total = seriesKeys.reduce((sum, series) => {
      const value = row[series]
      return typeof value === 'number' && Number.isFinite(value) ? sum + value : sum
    }, 0)

    return { ...row, [TVL_HISTORY_TOTAL_SERIES]: total }
  })
}

function getNumberRecordValue(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getCanonicalTotalByTimestamp(run: TvlHistoryRun | null, scaleFactor = 1): Record<number, number> {
  if (!run) return {}

  const currentSnapshot = run.meta.currentSnapshot
  if (!currentSnapshot || typeof currentSnapshot !== 'object') return {}

  const snapshotRecord = currentSnapshot as Record<string, unknown>
  const timestamp = getNumberRecordValue(snapshotRecord, 'timestamp')
  const adjustedTotal =
    getNumberRecordValue(snapshotRecord, 'adjustedTotalTvlUsd') ?? getNumberRecordValue(run.meta, 'adjustedTotalTvlUsd')

  return timestamp && adjustedTotal !== null ? { [timestamp]: adjustedTotal * scaleFactor } : {}
}

export function TvlHistoryTooltip({
  active,
  label,
  payload,
  canonicalTotalByTimestamp,
  remainingSeries,
  comparisonSeries
}: {
  active?: boolean
  label?: number | string
  payload?: Payload<ValueType, NameType>[]
  canonicalTotalByTimestamp: Record<number, number>
  remainingSeries: string
  comparisonSeries?: string
}) {
  if (!active || !payload?.length) return null

  const payloadRows = payload
    .filter((item) => typeof item.value === 'number' && Number.isFinite(item.value))
    .map((item) => ({
      name: String(item.name ?? item.dataKey ?? ''),
      value: item.value as number,
      color: item.color
    }))
  const totalPayload = payloadRows.find((item) => item.name === TVL_HISTORY_TOTAL_SERIES)
  const comparisonPayload = comparisonSeries ? payloadRows.find((item) => item.name === comparisonSeries) : undefined
  const detailRows = payloadRows.filter(
    (item) => item.name !== TVL_HISTORY_TOTAL_SERIES && item.name !== comparisonSeries && item.value > 0
  )
  const rows = [
    ...detailRows.filter((item) => item.name === remainingSeries),
    ...detailRows.filter((item) => item.name !== remainingSeries).reverse()
  ]
  const summedTotal = rows.reduce((sum, item) => sum + item.value, 0)
  const timestamp = Number(label)
  const canonicalTotal = Number.isFinite(timestamp) ? canonicalTotalByTimestamp[timestamp] : undefined
  const total = canonicalTotal ?? totalPayload?.value ?? (rows.length > 0 ? summedTotal : null)

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '0.65rem 0.75rem',
        minWidth: 220
      }}
    >
      <div className="mb-2 text-xs font-medium text-foreground">{label ? formatFullDate(label) : 'TVL'}</div>
      <div className="mb-2 grid gap-1.5 border-b border-border pb-2 text-xs">
        {total !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Actual TVL</span>
            <span className="font-semibold tabular-nums text-foreground" data-testid="tvl-history-tooltip-total">
              {fmt(total)}
            </span>
          </div>
        )}
        {comparisonPayload && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{comparisonSeries}</span>
            <span
              className="font-semibold tabular-nums text-foreground"
              data-testid="tvl-history-tooltip-price-neutral"
            >
              {fmt(comparisonPayload.value)}
            </span>
          </div>
        )}
      </div>
      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {rows.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="legend-dot" style={{ background: item.color }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-foreground">{fmt(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TvlOverview({ chainSelector }: { chainSelector: ReactNode }) {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext)
  const isDark = useRootDarkMode()
  const {
    data: rawData,
    loading,
    error,
    fetchedAt,
    retry
  } = useFetch<LegacyTvlSummary>(chainFilter === 'all' ? '/api/tvl' : `/api/tvl?chainId=${chainFilter}`)
  const [tvlHistoryBreakdown, setTvlHistoryBreakdown] = useState<OverallTvlHistoryBreakdown>('chain')
  const [selectedRange, setSelectedRange] = useState<ChartDateRange | null>(null)
  const [showPriceNeutral, setShowPriceNeutral] = useState(true)
  const [tvlHistoryView, setTvlHistoryView] = useState<StatsChartType>('bar')
  const [selectedHistoryChain, setSelectedHistoryChain] = useState<string | null>(null)
  const [historyEndAnchor] = useState(() => Math.floor(Date.now() / 1000))
  const tvlHistoryMode = 'external'
  const tvlHistoryInterval = 'weekly'
  const fullHistoryFilters = new URLSearchParams({
    groupBy: 'chain',
    mode: tvlHistoryMode,
    interval: tvlHistoryInterval
  })
  if (rawData?.datasetId) fullHistoryFilters.set('datasetId', rawData.datasetId)
  const {
    data: fullHistory,
    error: timelineError,
    retry: retryTimeline
  } = useFetch<TvlHistoryRun>(`/api/tvl/history/runs/latest?${fullHistoryFilters}`, {
    enabled: Boolean(rawData)
  })
  const timelineBounds = fullHistory
    ? {
        start: new Date(fullHistory.range.from * 1000).toISOString().slice(0, 10),
        end: new Date(fullHistory.range.to * 1000).toISOString().slice(0, 10)
      }
    : null
  const sliderValues = timelineBounds ? feeSliderValues(timelineBounds, selectedRange, 365) : null
  const selectedBounds = sliderValues
    ? {
        from: sliderValues[0] * DAY_SECONDS,
        to: sliderValues[1] * DAY_SECONDS + DAY_SECONDS - 1
      }
    : { from: historyEndAnchor - 365 * DAY_SECONDS, to: historyEndAnchor }
  const baseTvlHistoryUrl = buildTvlHistoryUrl({
    breakdown: tvlHistoryBreakdown,
    mode: tvlHistoryMode,
    interval: tvlHistoryInterval
  })
  const tvlHistoryFilters = new URLSearchParams(baseTvlHistoryUrl.split('?')[1])
  if (rawData?.datasetId) tvlHistoryFilters.set('datasetId', rawData.datasetId)
  if (chainFilter !== 'all') tvlHistoryFilters.set('chainId', chainFilter)
  const tvlHistoryUrl = `/api/tvl/history/runs/latest?${tvlHistoryFilters}`
  const {
    data: rawTvlHistory,
    loading: tvlHistoryLoading,
    error: tvlHistoryError,
    retry: retryTvlHistory
  } = useFetch<TvlHistoryRun>(tvlHistoryUrl, { enabled: Boolean(rawData) })
  const constantPriceFilters = new URLSearchParams(buildConstantPriceTvlUrl(selectedBounds).split('?')[1])
  if (rawData?.datasetId) constantPriceFilters.set('datasetId', rawData.datasetId)
  if (chainFilter !== 'all') constantPriceFilters.set('chainId', chainFilter)
  const constantPriceUrl = `/api/tvl/history/runs/latest/constant-price?${constantPriceFilters}`
  const {
    data: constantPriceHistory,
    loading: constantPriceLoading,
    error: constantPriceError,
    status: constantPriceStatus,
    retry: retryConstantPrice
  } = useFetch<ConstantPriceTvlHistory>(constantPriceUrl, {
    enabled: Boolean(rawTvlHistory) && showPriceNeutral && tvlHistoryView === 'line'
  })
  const [isTvlHistoryInspecting, setIsTvlHistoryInspecting] = useState(false)
  const tvlHistoryTotalFillId = `tvl-history-total-fill-${useId().replace(/:/g, '')}`
  const data = useMemo(() => (rawData ? normalizeTvlSummary(rawData) : null), [rawData])
  const tvlHistoryColors = useMemo(() => buildBlueShadePalette(isDark), [isDark])

  useEffect(() => {
    if (fetchedAt) setLastFetchedAt(fetchedAt)
  }, [fetchedAt, setLastFetchedAt])

  const chainData = useMemo(
    () =>
      data
        ? buildAdjustedChainTvl(
            data,
            chainFilter === 'all' ? 'all' : (CHAIN_NAMES[Number(chainFilter)] ?? chainFilter)
          ).map(({ chain, tvl }) => ({
            chain,
            label: CHAIN_NAMES[Number(chain)] || CHAIN_SHORT[Number(chain)] || chain,
            chainId: resolveChainId(chain, CHAIN_NAMES),
            tvl
          }))
        : [],
    [data, chainFilter]
  )

  const tvlHistoryRemainingSeries = {
    chain: TVL_HISTORY_REMAINING_CHAIN_SERIES,
    category: TVL_HISTORY_REMAINING_VERSION_SERIES
  }[tvlHistoryBreakdown]
  const tvlHistoryScaleFactor = useMemo(() => {
    if (!rawTvlHistory || rawTvlHistory.mode !== 'raw' || !data?.totalTvl) return 1
    const completeRows = rawData?.datasetId
      ? rawTvlHistory.chart
      : filterPartialHistoryRows(rawTvlHistory.chart, rawTvlHistory.series.length)
    const latestTotal = getLatestRowTotal(completeRows, rawTvlHistory.series)
    return latestTotal > 0 ? data.totalTvl / latestTotal : 1
  }, [data?.totalTvl, rawTvlHistory, rawData?.datasetId])
  const tvlHistoryChart = useMemo(() => {
    if (!rawTvlHistory) return { rows: [], series: [] }
    const completeRows = rawData?.datasetId
      ? rawTvlHistory.chart
      : filterPartialHistoryRows(rawTvlHistory.chart, rawTvlHistory.series.length)
    const scaledRows = scaleRows(completeRows, rawTvlHistory.series, tvlHistoryScaleFactor)
    const topTvlHistory = buildTopTvlHistoryChart(scaledRows, rawTvlHistory.series, tvlHistoryRemainingSeries)
    const labeledHistory =
      tvlHistoryBreakdown === 'category'
        ? labelVersionHistoryChart(topTvlHistory.rows, topTvlHistory.series)
        : topTvlHistory
    const rangedRows = labeledHistory.rows.filter(
      (row) => row.timestamp >= selectedBounds.from && row.timestamp <= selectedBounds.to
    )
    return {
      rows:
        rawData?.datasetId || tvlHistoryBreakdown === 'category'
          ? rangedRows
          : addZeroStartPoints(rangedRows, labeledHistory.series),
      series: labeledHistory.series
    }
  }, [
    rawTvlHistory,
    rawData?.datasetId,
    tvlHistoryBreakdown,
    selectedBounds.from,
    selectedBounds.to,
    tvlHistoryRemainingSeries,
    tvlHistoryScaleFactor
  ])
  const tvlHistoryRows = useMemo(
    () => addTotalTvlSeries(tvlHistoryChart.rows, tvlHistoryChart.series),
    [tvlHistoryChart.rows, tvlHistoryChart.series]
  )
  const tvlHistorySeries = tvlHistoryChart.series
  const tvlHistoryStackSeries = useMemo(
    () => getStackRenderSeries(tvlHistorySeries, tvlHistoryRemainingSeries),
    [tvlHistoryRemainingSeries, tvlHistorySeries]
  )
  const tvlHistoryCanonicalTotalByTimestamp = useMemo(
    () => getCanonicalTotalByTimestamp(rawTvlHistory, tvlHistoryScaleFactor),
    [rawTvlHistory, tvlHistoryScaleFactor]
  )
  const tvlHistoryColorBySeries = useMemo(
    () =>
      Object.fromEntries(
        tvlHistorySeries.map((series, index) => [
          series,
          tvlHistoryBreakdown === 'category'
            ? (CAT_COLORS[series.toLowerCase()] ?? tvlHistoryColors[index % tvlHistoryColors.length])
            : tvlHistoryColors[index % tvlHistoryColors.length]
        ])
      ),
    [tvlHistoryBreakdown, tvlHistoryColors, tvlHistorySeries]
  )
  const constantPriceChart = useMemo(() => {
    if (!constantPriceHistory) return { rows: [], series: [] }
    const sourceRows = selectConstantPriceChart(constantPriceHistory, 'constant-price')
    const series = getAvailableChartSeries(sourceRows)
    const completeRows = rawData?.datasetId ? sourceRows : filterPartialHistoryRows(sourceRows, series.length)
    return buildTopTvlHistoryChart(completeRows, series, TVL_HISTORY_REMAINING_CHAIN_SERIES)
  }, [constantPriceHistory, rawData?.datasetId])
  const isPriceNeutralVisible = isPriceNeutralOverlayVisible(tvlHistoryView, showPriceNeutral)
  const displayedHistoryRows = useMemo(
    () =>
      isPriceNeutralVisible && constantPriceHistory
        ? mergePriceNeutralTotal(tvlHistoryRows, constantPriceChart.rows, constantPriceChart.series)
        : tvlHistoryRows,
    [constantPriceChart.rows, constantPriceChart.series, constantPriceHistory, isPriceNeutralVisible, tvlHistoryRows]
  )
  const hasTvlHistory = displayedHistoryRows.length > 0 && tvlHistorySeries.length > 0
  const tvlHistoryRangeLabel = rawTvlHistory
    ? `${formatFullDate(rawTvlHistory.range.from)} - ${formatFullDate(rawTvlHistory.range.to)}`
    : '-'
  const constantPriceCoverageLabel = constantPriceHistory
    ? getPriceNeutralCoverageLabel(constantPriceHistory.meta)
    : null
  const warningCount = rawTvlHistory ? getWarningCount(rawTvlHistory.meta) : 0
  const tvlHistoryBarSize = getHistoryBarSize(displayedHistoryRows.length)
  const controls = (
    <StatsChartControls>
      {chainSelector}
      <ChartTypeToggle value={tvlHistoryView} onValueChange={setTvlHistoryView} label="TVL" />
      {timelineBounds ? (
        <FeeDateSlider
          bounds={timelineBounds}
          selected={selectedRange}
          onApply={setSelectedRange}
          minDurationDays={365}
        />
      ) : timelineError ? (
        <div className="fee-range-timeline text-dim">
          Timeline could not be loaded.{' '}
          <button type="button" className="page-btn" onClick={retryTimeline}>
            Retry timeline
          </button>
        </div>
      ) : (
        <output className="fee-range-timeline text-dim">Loading timeline…</output>
      )}
    </StatsChartControls>
  )

  if (loading)
    return (
      <>
        {controls}
        <SkeletonCards count={1} />
      </>
    )
  if (error)
    return (
      <>
        {controls}
        <div className="error-retry">
          <div className="error-message">Error: {error}</div>
          <button className="page-btn" onClick={retry}>
            Retry
          </button>
        </div>
      </>
    )
  if (!data) return <>{controls}</>

  const maxChainTvl = Math.max(1, ...chainData.map(({ tvl }) => tvl))

  return (
    <>
      {controls}
      <div className="tvl-summary mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="value shrink-0">{fmt(data.totalTvl)}</div>
          <div className="sub">
            {data.vaultCount.active} active vault{data.vaultCount.active === 1 ? '' : 's'} across{' '}
            {Object.keys(data.tvlByChain).length} chain{Object.keys(data.tvlByChain).length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2>TVL History</h2>
            <div className="sub">
              Saved run grouped by {formatHistoryGroup(rawTvlHistory?.groupBy)};{' '}
              {tvlHistoryBreakdown === 'category'
                ? `${tvlHistorySeries.length} versions`
                : `top ${Math.min(TVL_HISTORY_TOP_SERIES_COUNT, tvlHistorySeries.length)} ${tvlHistorySeries.length === 1 ? 'chain' : 'chains'} by latest TVL`}
            </div>
          </div>
          <div className="tvl-history-header-actions">
            {rawTvlHistory?.id && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="tvl-history-icon-btn" aria-label="TVL history run details">
                    <Info size={15} strokeWidth={1.8} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="tvl-history-info-popover">
                  <div className="label">Run details</div>
                  <div className="mt-2 grid gap-2 text-xs">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Run</span>
                      <span className="font-medium tabular-nums">#{rawTvlHistory.id}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Interval</span>
                      <span className="font-medium">{rawTvlHistory.interval}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Mode</span>
                      <span className="font-medium">{rawTvlHistory.mode}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Points</span>
                      <span className="font-medium tabular-nums">{rawTvlHistory.pointCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Range</span>
                      <span className="font-medium tabular-nums">{tvlHistoryRangeLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Warnings</span>
                      <span className="font-medium tabular-nums">{warningCount}</span>
                    </div>
                    {Array.isArray(rawTvlHistory.meta.seriesWithoutRawHistory) &&
                      rawTvlHistory.meta.seriesWithoutRawHistory.length > 0 && (
                        <div className="text-muted-foreground">
                          {rawTvlHistory.meta.seriesWithoutRawHistory
                            .map((series) => String(series).toUpperCase())
                            .join(', ')}{' '}
                          has no raw history before the current snapshot.
                        </div>
                      )}
                    {constantPriceHistory && (
                      <>
                        <div className="mt-1 border-t border-border pt-2 text-muted-foreground">
                          Price-neutral TVL values underlying assets at each vault&apos;s first available valid price in
                          the selected timeframe. It removes later price movement, but includes earned yield.
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Reference window</span>
                          <span className="font-medium tabular-nums">
                            {constantPriceHistory.meta.referenceWindowPoints} valid prices
                          </span>
                        </div>
                        {constantPriceCoverageLabel && (
                          <div className="text-muted-foreground">{constantPriceCoverageLabel}</div>
                        )}
                      </>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="tvl-history-controls" aria-label="TVL history controls">
          <Tabs
            value={tvlHistoryBreakdown}
            onValueChange={(value) => setTvlHistoryBreakdown(value as OverallTvlHistoryBreakdown)}
          >
            <TabsList className="tvl-history-tabs" aria-label="TVL history breakdown">
              <TabsTrigger className="tvl-history-tab" value="chain">
                Chains
              </TabsTrigger>
              <TabsTrigger className="tvl-history-tab" value="category">
                Version
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {tvlHistoryView === 'line' && (
            <div className="tvl-history-series-switch" aria-label="TVL history series">
              <span className="tvl-history-series-label">
                <span className="tvl-history-series-swatch actual" aria-hidden="true" />
                Actual TVL
              </span>
              <button
                type="button"
                className={showPriceNeutral ? 'active' : undefined}
                aria-pressed={showPriceNeutral}
                onClick={() => setShowPriceNeutral((current) => !current)}
              >
                <span className="tvl-history-series-swatch price-neutral" aria-hidden="true" />
                {constantPriceLoading && showPriceNeutral ? 'Loading price-neutral…' : 'Price-neutral TVL'}
              </button>
            </div>
          )}
        </div>

        {tvlHistoryBreakdown === 'category' && tvlHistorySeries.length > 0 && (
          <div className="tvl-history-version-legend" aria-label="TVL version series">
            {tvlHistorySeries.map((series) => (
              <span key={series}>
                <span
                  className="legend-dot"
                  style={{ background: tvlHistoryColorBySeries[series] }}
                  aria-hidden="true"
                />
                {series}
              </span>
            ))}
          </div>
        )}

        {tvlHistoryLoading && (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            Loading TVL history...
          </div>
        )}

        {tvlHistoryError && (
          <div className="error-retry">
            <div className="error-message">Error loading TVL history: {tvlHistoryError}</div>
            <button className="page-btn" onClick={retryTvlHistory}>
              Retry
            </button>
          </div>
        )}

        {!tvlHistoryLoading && !tvlHistoryError && !hasTvlHistory && (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            No TVL history data for this selected timeframe.
          </div>
        )}

        {!tvlHistoryLoading && !tvlHistoryError && hasTvlHistory && (
          <div
            className={`chart-container tvl-history-chart${isTvlHistoryInspecting ? ' is-inspecting' : ''}`}
            data-price-neutral-overlay={isPriceNeutralVisible && Boolean(constantPriceHistory)}
            style={{ height: 320 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={displayedHistoryRows}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                onMouseMove={() => setIsTvlHistoryInspecting(true)}
                onMouseLeave={() => setIsTvlHistoryInspecting(false)}
              >
                <defs>
                  <linearGradient id={tvlHistoryTotalFillId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
                    <stop offset="72%" stopColor="var(--accent)" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatDate}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(displayedHistoryRows.length / 8) - 1)}
                  minTickGap={16}
                />
                <YAxis
                  tickFormatter={(value: number) => fmt(value, 0)}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  content={
                    <TvlHistoryTooltip
                      canonicalTotalByTimestamp={tvlHistoryCanonicalTotalByTimestamp}
                      remainingSeries={tvlHistoryRemainingSeries}
                      comparisonSeries={isPriceNeutralVisible ? PRICE_NEUTRAL_TOTAL_SERIES : undefined}
                    />
                  }
                  cursor={
                    tvlHistoryView === 'bar' ? { fill: 'rgba(6, 87, 249, 0.06)' } : { stroke: 'rgba(17, 24, 39, 0.25)' }
                  }
                />
                {tvlHistoryView === 'line' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey={TVL_HISTORY_TOTAL_SERIES}
                      stroke="none"
                      fill={`url(#${tvlHistoryTotalFillId})`}
                      fillOpacity={1}
                      connectNulls
                      isAnimationActive={false}
                    />
                    {tvlHistoryStackSeries.map((series) => (
                      <Area
                        key={series}
                        className="tvl-history-detail-area"
                        type="monotone"
                        dataKey={series}
                        stackId="tvl"
                        stroke={tvlHistoryColorBySeries[series]}
                        fill={tvlHistoryColorBySeries[series]}
                        fillOpacity={0.16}
                        strokeOpacity={0.54}
                        strokeWidth={1.25}
                        isAnimationActive={false}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey={TVL_HISTORY_TOTAL_SERIES}
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 1.5, stroke: 'var(--surface)', fill: 'var(--accent)' }}
                      connectNulls
                      isAnimationActive={false}
                    />
                    {isPriceNeutralVisible && constantPriceHistory && (
                      <Line
                        type="monotone"
                        dataKey={PRICE_NEUTRAL_TOTAL_SERIES}
                        stroke="var(--chart-lavender, #6f83c7)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={{
                          r: 4,
                          strokeWidth: 1.5,
                          stroke: 'var(--surface)',
                          fill: 'var(--chart-lavender, #6f83c7)'
                        }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    )}
                  </>
                )}
                {tvlHistoryView === 'bar' &&
                  tvlHistoryStackSeries.map((series, index) => (
                    <Bar
                      key={series}
                      dataKey={series}
                      stackId="tvl"
                      fill={tvlHistoryColorBySeries[series]}
                      fillOpacity={series === tvlHistoryRemainingSeries ? 0.28 : 0.78}
                      stroke="transparent"
                      maxBarSize={tvlHistoryBarSize}
                      radius={index === tvlHistoryStackSeries.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {isPriceNeutralVisible && constantPriceError && (
          <div className="tvl-history-comparison-error">
            <span>
              {getTvlHistoryErrorMessage({
                isConstantPrice: true,
                status: constantPriceStatus,
                error: constantPriceError
              })}
            </span>
            <button type="button" onClick={retryConstantPrice}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── TVL by Chain ── */}
      <div className="card">
        <h2>TVL by Chain</h2>
        <div style={{ marginTop: '0.25rem' }}>
          {chainData.map((c, i) => {
            const isExpanded = selectedHistoryChain === c.chain
            return (
              <Fragment key={c.chain}>
                <button
                  type="button"
                  className={`stat-row chain-stat-row${isExpanded ? ' is-selected' : ''}`}
                  aria-expanded={isExpanded}
                  aria-controls={c.chainId ? `chain-history-${c.chainId}` : undefined}
                  disabled={c.chainId === null}
                  onClick={() => setSelectedHistoryChain((current) => toggleSelectedChain(current, c.chain))}
                >
                  <span className="stat-label chain-stat-label">
                    <span className="legend-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {c.label}
                  </span>
                  <span className="chain-stat-bar">
                    <span className="inline-bar">
                      <span className="inline-bar-track">
                        <span
                          className="inline-bar-fill"
                          style={{
                            width: `${(Math.max(0, c.tvl) / maxChainTvl) * 100}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length]
                          }}
                        />
                      </span>
                    </span>
                  </span>
                  <span className="stat-value">{fmt(c.tvl)}</span>
                  <ChevronDown className="chain-stat-chevron" size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
                {isExpanded && c.chainId !== null && (
                  <ChainTvlHistory
                    chainId={c.chainId}
                    chainLabel={c.label}
                    datasetId={rawData?.datasetId}
                    allTimeRange={selectedBounds}
                    selectedRange={selectedBounds}
                    renderType={tvlHistoryView}
                  />
                )}
              </Fragment>
            )
          })}
          {chainData.length === 0 && (
            <div className="text-dim" style={{ textAlign: 'center', padding: '1rem' }}>
              No data for selected chain
            </div>
          )}
        </div>
      </div>
    </>
  )
}
