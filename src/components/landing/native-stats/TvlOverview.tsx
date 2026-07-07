import { Link } from '@tanstack/react-router'
import { BarChart3, Info, LineChart } from 'lucide-react'
import { useContext, useEffect, useId, useMemo, useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { buildBlueShadePalette } from '@/lib/theme-blue-palette'
import {
  CAT_COLORS,
  CHAIN_NAMES,
  CHAIN_SHORT,
  CHART_COLORS,
  exportCSV,
  fmt,
  powergloveVaultPath,
  SkeletonCards,
  useFetch
} from './hooks'
import { StatsContext } from './StatsContext'
import type { TvlHistoryRun, TvlSummary } from './types'

type LegacyTvlSummary = Omit<
  TvlSummary,
  'activeVaultTvl' | 'retiredVaultTvl' | 'overlapExcluded' | 'vaultBridgeExcluded'
> & {
  activeVaultTvl?: number
  retiredVaultTvl?: number
  overlapExcluded?: number
  vaultBridgeExcluded?: number
  activeTvl?: number
  retiredTvl?: number
  overlapAmount?: number
  crossChainOverlap?: number
}

function normalizeTvlSummary(data: LegacyTvlSummary): TvlSummary {
  return {
    ...data,
    activeVaultTvl: data.activeVaultTvl ?? data.activeTvl ?? 0,
    retiredVaultTvl: data.retiredVaultTvl ?? data.retiredTvl ?? 0,
    overlapExcluded: data.overlapExcluded ?? data.overlapAmount ?? 0,
    vaultBridgeExcluded: data.vaultBridgeExcluded ?? data.crossChainOverlap ?? 0
  }
}

const TVL_HISTORY_TOP_SERIES_COUNT = 10
const TVL_HISTORY_REMAINING_VAULT_SERIES = 'Remaining vaults'
const TVL_HISTORY_REMAINING_CHAIN_SERIES = 'Remaining chains'
const TVL_HISTORY_TOTAL_SERIES = 'Total TVL'
const TVL_HISTORY_MIN_COMPLETE_SERIES_RATIO = 0.5
const DAY_SECONDS = 86_400

type TvlHistoryBreakdown = 'vault' | 'chain'
type TvlHistoryRange = '30d' | '90d' | '365d' | 'all'
type TvlHistoryView = 'line' | 'bar'
type TvlHistoryMode = 'raw' | 'external'
type TvlHistoryInterval = 'daily' | '3day' | 'weekly'

const TVL_HISTORY_RANGE_OPTIONS: Array<{ value: TvlHistoryRange; label: string; days?: number }> = [
  { value: '30d', label: '30D', days: 30 },
  { value: '90d', label: '90D', days: 90 },
  { value: '365d', label: '365D', days: 365 },
  { value: 'all', label: 'All Time' }
]

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

function filterPartialTerminalRows(rows: TvlHistoryRun['chart'], seriesCount: number): TvlHistoryRun['chart'] {
  if (rows.length < 2 || seriesCount <= 0) return rows

  const minCompleteSeriesCount = Math.max(1, Math.floor(seriesCount * TVL_HISTORY_MIN_COMPLETE_SERIES_RATIO))
  let endIndex = rows.length

  while (endIndex > 1 && countSeriesValues(rows[endIndex - 1]) < minCompleteSeriesCount) {
    endIndex -= 1
  }

  return rows.slice(0, endIndex)
}

function filterRowsByRange(rows: TvlHistoryRun['chart'], range: TvlHistoryRange): TvlHistoryRun['chart'] {
  const option = TVL_HISTORY_RANGE_OPTIONS.find((item) => item.value === range)
  if (!option?.days || rows.length === 0) return rows

  const latestTimestamp = rows.reduce((latest, row) => Math.max(latest, row.timestamp), 0)
  const minTimestamp = latestTimestamp - option.days * DAY_SECONDS
  return rows.filter((row) => row.timestamp >= minTimestamp)
}

function getHistoryInterval(range: TvlHistoryRange): TvlHistoryInterval {
  if (range === '30d') return 'daily'
  if (range === '90d') return '3day'
  return 'weekly'
}

function getHistoryMode(range: TvlHistoryRange): TvlHistoryMode {
  return range === '30d' || range === '90d' ? 'raw' : 'external'
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
  return [...(hasRemainingSeries ? [remainingSeries] : []), ...topSeries.slice().reverse()]
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

function TvlHistoryTooltip({
  active,
  label,
  payload,
  canonicalTotalByTimestamp
}: {
  active?: boolean
  label?: number | string
  payload?: Payload<ValueType, NameType>[]
  canonicalTotalByTimestamp: Record<number, number>
}) {
  if (!active || !payload?.length) return null

  const rows = payload
    .filter((item) => typeof item.value === 'number' && Number.isFinite(item.value))
    .map((item) => ({
      name: String(item.name ?? item.dataKey ?? ''),
      value: item.value as number,
      color: item.color
    }))
    .filter((item) => item.name !== TVL_HISTORY_TOTAL_SERIES && item.value > 0)
  const summedTotal = rows.reduce((sum, item) => sum + item.value, 0)
  const timestamp = Number(label)
  const canonicalTotal = Number.isFinite(timestamp) ? canonicalTotalByTimestamp[timestamp] : undefined
  const total = canonicalTotal ?? summedTotal

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
      <div className="mb-2 flex items-center justify-between gap-4 border-b border-border pb-2 text-xs">
        <span className="text-muted-foreground">Total TVL</span>
        <span className="font-semibold tabular-nums text-foreground">{fmt(total)}</span>
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

export function TvlOverview() {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext)
  const isDark = useRootDarkMode()
  const { data: rawData, loading, error, fetchedAt, retry } = useFetch<LegacyTvlSummary>('/api/tvl')
  const [tvlHistoryBreakdown, setTvlHistoryBreakdown] = useState<TvlHistoryBreakdown>('vault')
  const [tvlHistoryRange, setTvlHistoryRange] = useState<TvlHistoryRange>('all')
  const [tvlHistoryView, setTvlHistoryView] = useState<TvlHistoryView>('line')
  const tvlHistoryMode = getHistoryMode(tvlHistoryRange)
  const tvlHistoryInterval = getHistoryInterval(tvlHistoryRange)
  const tvlHistoryUrl = `/api/tvl/history/runs/latest?groupBy=${tvlHistoryBreakdown}&mode=${tvlHistoryMode}&interval=${tvlHistoryInterval}`
  const {
    data: rawTvlHistory,
    loading: tvlHistoryLoading,
    error: tvlHistoryError,
    retry: retryTvlHistory
  } = useFetch<TvlHistoryRun>(tvlHistoryUrl)
  const [isRetiredVaultsOpen, setIsRetiredVaultsOpen] = useState(false)
  const [isTvlBreakdownOpen, setIsTvlBreakdownOpen] = useState(false)
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
        ? Object.entries(data.tvlByChain)
            .filter(([chain]) => chainFilter === 'all' || chain === chainFilter)
            .map(([chain, rawTvl]) => {
              const overlap = data.overlapByChain[chain] || 0
              return {
                chain,
                label: CHAIN_NAMES[Number(chain)] || CHAIN_SHORT[Number(chain)] || chain,
                tvl: rawTvl - overlap
              }
            })
            .filter((c) => c.tvl > 0)
            .sort((a, b) => b.tvl - a.tvl)
        : [],
    [data, chainFilter]
  )

  const categories = useMemo(
    () =>
      data
        ? [
            { key: 'v1', name: 'V1', tvl: data.v1Tvl, color: CAT_COLORS.v1 },
            { key: 'v2', name: 'V2', tvl: data.v2Tvl, color: CAT_COLORS.v2 },
            { key: 'v3', name: 'V3', tvl: data.v3Tvl, color: CAT_COLORS.v3 },
            { key: 'curation', name: 'Curation', tvl: data.curationTvl, color: CAT_COLORS.curation }
          ]
        : [],
    [data]
  )

  const activeCategories = useMemo(() => categories.filter((c) => c.tvl > 0), [categories])

  const retiredVaults = useMemo(() => data?.retiredVaults ?? [], [data])
  const retiredVaultCountIncluded = retiredVaults.length
  const tvlHistoryRemainingSeries =
    tvlHistoryBreakdown === 'chain' ? TVL_HISTORY_REMAINING_CHAIN_SERIES : TVL_HISTORY_REMAINING_VAULT_SERIES
  const tvlHistoryScaleFactor = useMemo(() => {
    if (!rawTvlHistory || rawTvlHistory.mode !== 'raw' || !data?.totalTvl) return 1
    const completeRows = filterPartialTerminalRows(rawTvlHistory.chart, rawTvlHistory.series.length)
    const latestTotal = getLatestRowTotal(completeRows, rawTvlHistory.series)
    return latestTotal > 0 ? data.totalTvl / latestTotal : 1
  }, [data?.totalTvl, rawTvlHistory])
  const tvlHistoryChart = useMemo(() => {
    if (!rawTvlHistory) return { rows: [], series: [] }
    const completeRows = filterPartialTerminalRows(rawTvlHistory.chart, rawTvlHistory.series.length)
    const scaledRows = scaleRows(completeRows, rawTvlHistory.series, tvlHistoryScaleFactor)
    const topTvlHistory = buildTopTvlHistoryChart(scaledRows, rawTvlHistory.series, tvlHistoryRemainingSeries)
    const rangedRows = filterRowsByRange(topTvlHistory.rows, tvlHistoryRange)
    return {
      rows: addZeroStartPoints(rangedRows, topTvlHistory.series),
      series: topTvlHistory.series
    }
  }, [rawTvlHistory, tvlHistoryRange, tvlHistoryRemainingSeries, tvlHistoryScaleFactor])
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
        tvlHistorySeries.map((series, index) => [series, tvlHistoryColors[index % tvlHistoryColors.length]])
      ),
    [tvlHistoryColors, tvlHistorySeries]
  )
  const hasTvlHistory = tvlHistoryRows.length > 0 && tvlHistorySeries.length > 0
  const tvlHistoryRangeLabel = rawTvlHistory
    ? `${formatFullDate(rawTvlHistory.range.from)} - ${formatFullDate(rawTvlHistory.range.to)}`
    : '-'
  const warningCount = rawTvlHistory ? getWarningCount(rawTvlHistory.meta) : 0
  const tvlHistoryBarSize = getHistoryBarSize(tvlHistoryRows.length)
  const tvlHistoryBreakdownLabel = tvlHistoryBreakdown === 'chain' ? 'chain' : 'vault'

  if (loading) return <SkeletonCards count={1} />
  if (error)
    return (
      <div className="error-retry">
        <div className="error-message">Error: {error}</div>
        <button className="page-btn" onClick={retry}>
          Retry
        </button>
      </div>
    )
  if (!data) return null

  const activeVaultCategoryTvl = data.v1Tvl + data.v2Tvl + data.v3Tvl + data.curationTvl || data.activeVaultTvl
  const maxChainTvl = chainData.length > 0 ? chainData[0].tvl : 1

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">TVL</div>
          <div className="value">{fmt(data.totalTvl)}</div>
          <div className="sub">
            {data.vaultCount.active} active vaults across {Object.keys(data.tvlByChain).length} chains
          </div>
        </div>
        <button type="button" className="page-btn" onClick={() => setIsTvlBreakdownOpen(true)}>
          See breakdown
        </button>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2>TVL History</h2>
            <div className="sub">
              Saved run grouped by {formatHistoryGroup(rawTvlHistory?.groupBy)}; top{' '}
              {Math.min(TVL_HISTORY_TOP_SERIES_COUNT, tvlHistorySeries.length)} by current TVL
            </div>
          </div>
          <div className="tvl-history-header-actions">
            {rawTvlHistory && (
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
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="tvl-history-controls" aria-label="TVL history controls">
          <Tabs
            value={tvlHistoryBreakdown}
            onValueChange={(value) => setTvlHistoryBreakdown(value as TvlHistoryBreakdown)}
          >
            <TabsList className="tvl-history-tabs" aria-label="TVL history breakdown">
              <TabsTrigger className="tvl-history-tab" value="vault">
                Vaults
              </TabsTrigger>
              <TabsTrigger className="tvl-history-tab" value="chain">
                Chains
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="tvl-history-control-group" aria-label="TVL history time range">
            {TVL_HISTORY_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={tvlHistoryRange === option.value ? 'active' : undefined}
                aria-pressed={tvlHistoryRange === option.value}
                onClick={() => setTvlHistoryRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="tvl-history-control-group icon-group" aria-label="TVL history chart type">
            <button
              type="button"
              className={tvlHistoryView === 'line' ? 'active' : undefined}
              aria-label={`Show ${tvlHistoryBreakdownLabel} TVL as lines`}
              aria-pressed={tvlHistoryView === 'line'}
              onClick={() => setTvlHistoryView('line')}
            >
              <LineChart size={15} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={tvlHistoryView === 'bar' ? 'active' : undefined}
              aria-label={`Show ${tvlHistoryBreakdownLabel} TVL as bars`}
              aria-pressed={tvlHistoryView === 'bar'}
              onClick={() => setTvlHistoryView('bar')}
            >
              <BarChart3 size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>

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
            No TVL history data for this saved run.
          </div>
        )}

        {!tvlHistoryLoading && !tvlHistoryError && hasTvlHistory && (
          <div
            className={`chart-container tvl-history-chart${isTvlHistoryInspecting ? ' is-inspecting' : ''}`}
            style={{ height: 320 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={tvlHistoryRows}
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
                  interval={Math.max(0, Math.floor(tvlHistoryRows.length / 8) - 1)}
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
                  content={<TvlHistoryTooltip canonicalTotalByTimestamp={tvlHistoryCanonicalTotalByTimestamp} />}
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
                        connectNulls
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
      </div>

      {/* ── TVL Composition Bar ── */}
      <div className="card">
        <h2>TVL Composition</h2>
        <div
          className="composition-bar"
          role="img"
          aria-label={`TVL composition: ${activeCategories.map((c) => `${c.name} ${fmt(c.tvl)}`).join(', ')}`}
        >
          {activeCategories.map((c) => (
            <div
              key={c.key}
              style={{
                width: `${(c.tvl / activeVaultCategoryTvl) * 100}%`,
                background: c.color,
                borderRadius: 2
              }}
              title={`${c.name}: ${fmt(c.tvl)}`}
            />
          ))}
        </div>
        <div className="composition-legend">
          {activeCategories.map((c) => (
            <span key={c.key}>
              <span className="legend-dot" style={{ background: c.color }} />
              {c.name} &mdash; {fmt(c.tvl)} ({((c.tvl / activeVaultCategoryTvl) * 100).toFixed(1)}%)
            </span>
          ))}
        </div>
      </div>

      {/* ── TVL by Chain ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>TVL by Chain</h2>
          <button
            className="btn-export"
            onClick={() =>
              exportCSV(
                'tvl-by-chain.csv',
                ['Chain', 'TVL (USD)'],
                chainData.map((c) => [CHAIN_NAMES[Number(c.chain)] || c.chain, c.tvl])
              )
            }
          >
            Export CSV
          </button>
        </div>
        <div style={{ marginTop: '0.25rem' }}>
          {chainData.map((c, i) => (
            <div className="stat-row" key={c.chain}>
              <span
                className="stat-label"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 100, flexShrink: 0 }}
              >
                <span className="legend-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {c.label}
              </span>
              <span style={{ flex: 1, padding: '0 1rem' }}>
                <div className="inline-bar">
                  <div className="inline-bar-track">
                    <div
                      className="inline-bar-fill"
                      style={{
                        width: `${(c.tvl / maxChainTvl) * 100}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length]
                      }}
                    />
                  </div>
                </div>
              </span>
              <span className="stat-value">{fmt(c.tvl)}</span>
            </div>
          ))}
          {chainData.length === 0 && (
            <div className="text-dim" style={{ textAlign: 'center', padding: '1rem' }}>
              No data for selected chain
            </div>
          )}
        </div>
      </div>

      <Dialog open={isTvlBreakdownOpen} onOpenChange={setIsTvlBreakdownOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>TVL Breakdown</DialogTitle>
            <DialogDescription>Included and excluded TVL used to calculate the headline number.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Included TVL
              </h3>
              <div className="rounded-md border border-border">
                <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span>TVL in Active Vaults</span>
                  <span className="font-medium tabular-nums">{fmt(data.activeVaultTvl)}</span>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                  onClick={() => {
                    setIsTvlBreakdownOpen(false)
                    setIsRetiredVaultsOpen(true)
                  }}
                >
                  <span>TVL in Retired Vaults</span>
                  <span className="font-medium tabular-nums">{fmt(data.retiredVaultTvl)}</span>
                </button>
                <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-sm">
                  <span>Allocator Vault Overlap</span>
                  <span className="font-medium tabular-nums">-{fmt(data.overlapExcluded)}</span>
                </div>
                <div className="mx-3 border-t border-border" />
                <div className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold">
                  <span>Adjusted TVL</span>
                  <span className="tabular-nums">{fmt(data.totalTvl)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Excluded TVL
              </h3>
              <div className="divide-y divide-border rounded-md border border-border">
                <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span>Vault Bridge TVL</span>
                  <span className="font-medium tabular-nums">{fmt(data.vaultBridgeExcluded)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRetiredVaultsOpen} onOpenChange={setIsRetiredVaultsOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Retired vaults included in Retired Vault TVL</DialogTitle>
            <DialogDescription>
              {fmt(data.retiredVaultTvl)} across {retiredVaultCountIncluded} retired vaults after excluding cross-chain
              migrated vaults.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1.6fr)_auto_auto] gap-3 border-b border-border px-0 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <span>Vault</span>
              <span>Type</span>
              <span className="text-right">TVL</span>
            </div>
            <div className="overflow-y-auto">
              {retiredVaults.map((vault) => (
                <div
                  key={`${vault.chainId}:${vault.address}`}
                  className="grid grid-cols-[minmax(0,1.6fr)_auto_auto] items-center gap-3 border-b border-border/70 px-0 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      to={powergloveVaultPath(vault.chainId, vault.address)}
                      className="block truncate font-medium text-foreground hover:text-[#0657f9]"
                    >
                      {vault.name ?? vault.address}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">
                      {CHAIN_NAMES[vault.chainId] ?? `Chain ${vault.chainId}`} · {vault.address}
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{vault.category}</div>
                  <div className="text-right font-medium tabular-nums">{fmt(vault.tvlUsd)}</div>
                </div>
              ))}
              {retiredVaults.length === 0 && (
                <div className="py-6 text-sm text-muted-foreground">No retired vaults found.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
