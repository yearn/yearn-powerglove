import { type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts'
import type { ChartDateRange } from '@/components/charts/chart-utils'
import { Tooltip as HelpTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ChainFeeHistoryCharts, type ChainFeeHistoryView } from './ChainFeeHistoryCharts'
import { type ChartTypeControl, ChartTypeToggle, type StatsChartType } from './ChartTypeToggle'
import {
  type CanonicalFeeHistory,
  type CanonicalFeeSummary,
  type CanonicalVaultFee,
  type FeeHistoryInterval,
  isCanonicalFeeSummary
} from './canonical-fees'
import { EffectiveFeesTable } from './EffectiveFeesTable'
import { FeeTimeRangeSlider } from './FeeTimeRangeSlider'
import { FeeYieldChart } from './FeeYieldChart'
import {
  buildCumulativeFeeHistorySeries,
  buildFeeHistorySeries,
  canonicalDecimalToNumber,
  completedFeeHistoryBuckets,
  type FeeHistoryPoint,
  formatFeeHistoryTick
} from './fee-history'
import { defaultFeeTimeRange, resolveFeeTimeframe } from './fee-timeframe'
import { buildTvlYieldSeries } from './fee-yield'
import { CHAIN_NAMES, fmt, pctFmt, SkeletonCards, SkeletonChart, useFetch } from './hooks'
import { MonthlyVaultTables } from './MonthlyVaultTables'
import { StatsChartControls } from './StatsChartControls'
import { StatsContext } from './StatsContext'
import type { FeeStackSummary } from './types'
import { useFeeTvlHistory } from './useFeeTvlHistory'
import { VaultComparisonCharts } from './VaultComparisonCharts'
import { VaultTypeFeeCharts } from './VaultTypeFeeCharts'

type Trend = 'improving' | 'declining' | 'stable' | 'insufficient_data'
type PricingConfidence = 'high' | 'medium' | 'low'
type Quadrant = 'high_tvl_high_yield' | 'high_tvl_low_yield' | 'low_tvl_high_yield' | 'low_tvl_low_yield'

interface VaultProfitability {
  address: string
  chainId: number
  name: string | null
  category: string
  tvlUsd: number | null
  annualizedFeeRevenue: number | null
  feeYield: number | null
  feeCapture: number | null
  gainYield: number | null
  trend: Trend
  trendDelta: number | null
  pricingConfidence: PricingConfidence
  reportCount: number
  avgHarvestFrequencyDays: number | null
  performanceFee: number | null
  managementFee: number | null
  totalGainUsd: number | null
  totalFeeRevenue: number | null
  quadrant: Quadrant | null
  currentPeriodFeeYield: number | null
  previousPeriodFeeYield: number | null
}

interface ProfitabilitySummary {
  protocolFeeYield: number | null
  feeCaptureRate: number | null
  medianVaultFeeYield: number | null
  totalAnnualizedFees: number | null
  totalTvl: number | null
  vaultCount: number
  lastUpdated: string
  vaults: VaultProfitability[]
  byChain: Array<{
    chain: string
    chainId: number
    tvl: number
    fees: number
    feeYield: number | null
    vaultCount: number
  }>
  byCategory: Array<{ category: string; tvl: number; fees: number; feeYield: number | null; vaultCount: number }>
  quadrants: Record<Quadrant, VaultProfitability[]>
  dataQuality: {
    highConfidenceCount: number
    mediumConfidenceCount: number
    lowConfidenceCount: number
    reportsWithPricingSource: number
    totalReports: number
  }
}

const QUADRANT_LABELS: Record<Quadrant, { label: string; color: string; desc: string }> = {
  high_tvl_high_yield: { label: 'Cash Cows', color: '#16a34a', desc: 'Protect & maintain' },
  high_tvl_low_yield: { label: 'Optimize', color: '#a16207', desc: 'Improve yield or migrate' },
  low_tvl_high_yield: { label: 'Scale Up', color: '#0657f9', desc: 'Drive more TVL' },
  low_tvl_low_yield: { label: 'Review', color: '#808080', desc: 'Consider retirement' }
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null
  const v = payload[0].payload
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '0.7rem 0.85rem',
        fontSize: '0.78rem',
        lineHeight: 1.6,
        minWidth: 180
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)', fontSize: '0.82rem' }}>
        {v.name || v.address?.slice(0, 10)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: 'var(--text-2)' }}>TVL</span>
        <span style={{ color: 'var(--text)' }}>{fmt(v.tvlUsd)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: 'var(--text-2)' }}>Fee Yield</span>
        <span style={{ color: 'var(--accent)' }}>{pctFmt(v.feeYield)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: 'var(--text-2)' }}>Fees (ann.)</span>
        <span style={{ color: 'var(--green)' }}>{fmt(v.annualizedFeeRevenue)}</span>
      </div>
    </div>
  )
}

function timeframeButtonClass(active: boolean) {
  return `min-w-0 rounded-none px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${
    active ? 'bg-[#0657f9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`
}

function formatCanonicalUsd(value: string | null, decimals = 1): string {
  const parsed = canonicalDecimalToNumber(value)
  return parsed === null ? '—' : fmt(parsed, decimals)
}

type FeeHistorySeriesKey =
  | 'grossGainsUsd'
  | 'netYieldUsd'
  | 'totalFeesPaidUsd'
  | 'cumulativeGrossGainsUsd'
  | 'cumulativeNetYieldUsd'
  | 'cumulativeFeesPaidUsd'

interface FeeHistoryChartSeries {
  key: 'gains' | 'yield' | 'fees'
  dataKey: FeeHistorySeriesKey
  label: string
  color: string
  strokeDasharray?: string
}

function FeeMetricTitle({ title, description }: { title: string; description: string }) {
  return (
    <HelpTooltip>
      <TooltipTrigger asChild>
        <button type="button" className="label cursor-help text-left">
          {title}
        </button>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </HelpTooltip>
  )
}

function FeesLoadingStatus({ label }: { label: string }) {
  return (
    <output className="fees-loading-status" aria-live="polite" aria-atomic="true">
      <span className="fees-loading-spinner" aria-hidden="true" />
      {label}
    </output>
  )
}

export function FeeHistoryChart({
  title,
  data,
  periods,
  cumulative,
  series,
  description,
  interval,
  renderType,
  onRenderTypeChange
}: ChartTypeControl & {
  title: string
  data: FeeHistoryPoint[]
  periods: FeeHistoryPoint[]
  cumulative: boolean
  series: FeeHistoryChartSeries[]
  description: string
  interval: FeeHistoryInterval
}) {
  const { chainFilter } = useContext(StatsContext)
  const tvl = useFeeTvlHistory(periods)
  const [showTvl, setShowTvl] = useState(true)
  const chartData = useMemo(() => {
    const averages = tvl.data
      ? buildTvlYieldSeries(
          periods,
          tvl.data,
          chainFilter === 'all' ? undefined : (CHAIN_NAMES[Number(chainFilter)] ?? `Chain ${chainFilter}`)
        )
      : []
    return data.map((point, index) => ({
      ...point,
      averageTvlUsd: cumulative && index === 0 ? null : (averages[index - (cumulative ? 1 : 0)]?.averageTvlUsd ?? null)
    }))
  }, [data, periods, cumulative, chainFilter, tvl.data])
  const hasTvl = chartData.some((point) => point.averageTvlUsd !== null)
  const tvlColor = '#94a3b8'
  const [visibleSeries, setVisibleSeries] = useState<Set<FeeHistoryChartSeries['key']>>(
    () => new Set(series.map((item) => item.key))
  )
  const seriesLabels = new Map(series.map((item) => [item.dataKey, item.label]))
  const activeSeries = series.filter((item) => visibleSeries.has(item.key))

  const toggleSeries = (key: FeeHistoryChartSeries['key']) => {
    setVisibleSeries((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (data.length === 0) {
    return (
      <div className="card fee-chart-card">
        <div className="fee-chart-title-row">
          <h2>{title}</h2>
          <ChartTypeToggle value={renderType} onValueChange={onRenderTypeChange} label="earnings and fees" />
        </div>
        <p className="text-dim">No completed history in this range.</p>
      </div>
    )
  }

  return (
    <div className="card fee-chart-card">
      <div className="fee-chart-header">
        <div className="fee-chart-title-row">
          <h2>{title}</h2>
          <ChartTypeToggle value={renderType} onValueChange={onRenderTypeChange} label="earnings and fees" />
        </div>
        <fieldset className="fee-series-toggles">
          <legend className="sr-only">{title} data series</legend>
          {series.map((item) => {
            const isVisible = visibleSeries.has(item.key)
            return (
              <button
                type="button"
                key={item.key}
                className="fee-series-toggle"
                aria-pressed={isVisible}
                onClick={() => toggleSeries(item.key)}
              >
                <span
                  className="fee-series-swatch"
                  aria-hidden="true"
                  style={{ borderColor: item.color, backgroundColor: isVisible ? item.color : 'transparent' }}
                />
                {item.label}
              </button>
            )
          })}
          <button
            type="button"
            className="fee-series-toggle"
            aria-label="TVL"
            aria-pressed={showTvl}
            title="Average daily adjusted TVL for each period, on the right axis. TVL remains a balance in cumulative view."
            onClick={() => setShowTvl((value) => !value)}
          >
            <span
              className="fee-series-swatch"
              aria-hidden="true"
              style={{ borderColor: tvlColor, backgroundColor: showTvl ? tvlColor : 'transparent' }}
            />
            TVL{tvl.loading && <span className="sr-only"> loading</span>}
          </button>
        </fieldset>
      </div>
      <div className="chart-container fee-history-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              tickFormatter={(period: string) => formatFeeHistoryTick(period, interval)}
              tick={{ fill: 'var(--text-3)', fontSize: 11 }}
              interval={Math.max(0, Math.floor(data.length / 10) - 1)}
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: 'var(--text-3)', fontSize: 11 }}
              tickFormatter={(value: number) => fmt(value, 0)}
              width={68}
            />
            {showTvl && hasTvl && (
              <YAxis
                yAxisId="tvl"
                orientation="right"
                width={68}
                tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                tickFormatter={(value: number) => fmt(value, 0)}
                axisLine={false}
                tickLine={false}
                label={{ value: 'TVL', angle: 90, position: 'insideRight', fill: 'var(--text-3)', fontSize: 11 }}
              />
            )}
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}
              labelStyle={{ color: 'var(--text)' }}
              formatter={(value: number, name: string) => [
                fmt(value, 2),
                name === 'averageTvlUsd' ? 'Average TVL' : (seriesLabels.get(name as FeeHistorySeriesKey) ?? name)
              ]}
              cursor={{ stroke: 'rgba(6, 87, 249, 0.22)' }}
            />
            {showTvl &&
              hasTvl &&
              (renderType === 'line' ? (
                <Bar
                  className="fee-tvl-overlay"
                  dataKey="averageTvlUsd"
                  name="averageTvlUsd"
                  yAxisId="tvl"
                  fill={tvlColor}
                  fillOpacity={0.18}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  className="fee-tvl-overlay"
                  dataKey="averageTvlUsd"
                  name="averageTvlUsd"
                  yAxisId="tvl"
                  type="linear"
                  stroke={tvlColor}
                  strokeOpacity={0.4}
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            {activeSeries.map((item) =>
              renderType === 'bar' ? (
                <Bar
                  key={item.key}
                  dataKey={item.dataKey}
                  name={item.dataKey}
                  fill={item.color}
                  maxBarSize={24}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.dataKey}
                  stroke={item.color}
                  strokeDasharray={item.strokeDasharray}
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={false}
                  name={item.dataKey}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {showTvl && tvl.error && (
        <div className="error-retry">
          <span>TVL history could not be loaded.</span>
          <button type="button" className="page-btn" onClick={tvl.retry}>
            Retry TVL
          </button>
        </div>
      )}
      {showTvl && tvl.data && !hasTvl && <p className="text-dim">TVL is unavailable for these periods.</p>}
      <span className="sr-only">{description}</span>
    </div>
  )
}

const DEFAULT_FEE_CHART_TYPES = {
  overall: 'line',
  feeYield: 'bar',
  earningsYield: 'bar',
  allocatorEarnings: 'line',
  allocatorFees: 'line',
  chainEarnings: 'bar',
  chainFees: 'bar',
  vaultTypeEarnings: 'bar',
  vaultTypeFees: 'bar'
} as const

export function FeesPanel({ chainSelector }: { chainSelector: ReactNode }) {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext)
  const [selectedRange, setSelectedRange] = useState<ChartDateRange>(() =>
    defaultFeeTimeRange(Math.floor(Date.now() / 1000))
  )
  const [chartView, setChartView] = useState<ChainFeeHistoryView>('periodic')
  const [chartTypes, setChartTypes] =
    useState<Record<keyof typeof DEFAULT_FEE_CHART_TYPES, StatsChartType>>(DEFAULT_FEE_CHART_TYPES)
  const chartType = (key: keyof typeof DEFAULT_FEE_CHART_TYPES): ChartTypeControl => ({
    renderType: chartTypes[key],
    onRenderTypeChange: (value) => setChartTypes((types) => ({ ...types, [key]: value }))
  })
  const [selectedAllocatorKeys, setSelectedAllocatorKeys] = useState<string[] | null>(null)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)

  const nowTs = Math.floor(Date.now() / 1000)
  const { since: sinceTs, until: untilTs, interval: historyInterval } = resolveFeeTimeframe(selectedRange, nowTs)
  const completedUntilTs = Math.min(untilTs, nowTs)
  const feeFilters = new URLSearchParams()
  if (sinceTs != null) {
    feeFilters.set('since', String(sinceTs))
    feeFilters.set('until', String(untilTs))
  }
  if (chainFilter !== 'all') feeFilters.set('chainId', chainFilter)
  const feeFilterQuery = feeFilters.toString()
  const historyFilters = new URLSearchParams()
  if (sinceTs != null) historyFilters.set('since', String(sinceTs))
  historyFilters.set('until', String(untilTs))
  if (chainFilter !== 'all') historyFilters.set('chainId', chainFilter)
  historyFilters.set('interval', historyInterval)
  const profitabilityFilters = new URLSearchParams()
  if (chainFilter !== 'all') profitabilityFilters.set('chainId', chainFilter)

  const {
    data: summary,
    loading: l1,
    fetchedAt,
    error: summaryError,
    retry: retrySummary
  } = useFetch<CanonicalFeeSummary>(`/api/fees?${feeFilterQuery}`)
  const validSummary = summary !== null && isCanonicalFeeSummary(summary)
  const vaultFilters = new URLSearchParams(feeFilters)
  if (validSummary && summary.datasetId) {
    historyFilters.set('datasetId', summary.datasetId)
    vaultFilters.set('datasetId', summary.datasetId)
  }
  const {
    data: history,
    loading: l2,
    error: historyError,
    retry: retryHistory
  } = useFetch<CanonicalFeeHistory>(`/api/fees/history?${historyFilters}`, { enabled: validSummary })
  const {
    data: vaultData,
    loading: l3,
    error: vaultError,
    retry: retryVaults
  } = useFetch<{ count: number; vaults: CanonicalVaultFee[]; datasetId?: string }>(`/api/fees/vaults?${vaultFilters}`, {
    enabled: validSummary
  })
  const {
    data: productData,
    error: productError,
    retry: retryProducts
  } = useFetch<{
    vaults: CanonicalVaultFee[]
    datasetId: string
    aggregationScope: string
  }>(`/api/fees/vaults?${vaultFilters}&scope=product`, { enabled: validSummary })
  const {
    data: feeStack,
    loading: l4,
    error: feeStackError,
    retry: retryFeeStack
  } = useFetch<FeeStackSummary>('/api/fees/stack')
  const { data: profData, loading: l5 } = useFetch<ProfitabilitySummary>(`/api/profitability?${profitabilityFilters}`)
  const [quadrantFilter, setQuadrantFilter] = useState<Quadrant | 'all'>('all')
  useEffect(() => {
    if (fetchedAt) setLastFetchedAt(fetchedAt)
  }, [fetchedAt, setLastFetchedAt])

  const feeHistorySeries = useMemo(
    () =>
      buildFeeHistorySeries(completedFeeHistoryBuckets(history?.buckets ?? [], completedUntilTs), {
        since: sinceTs,
        until: untilTs
      }),
    [history, completedUntilTs, sinceTs, untilTs]
  )
  const cumulativeFeeHistorySeries = useMemo(
    () => buildCumulativeFeeHistorySeries(feeHistorySeries),
    [feeHistorySeries]
  )
  const historyChainIds = useMemo(
    () => [...new Set(vaultData?.vaults.map((vault) => vault.chainId) ?? [])].sort((a, b) => a - b),
    [vaultData]
  )

  const scatterData = useMemo(() => {
    if (!profData) return []
    const base = profData.vaults
      .filter(
        (v): v is VaultProfitability & { feeYield: number; tvlUsd: number; quadrant: Quadrant } =>
          v.feeYield != null &&
          v.tvlUsd != null &&
          v.quadrant != null &&
          v.feeYield >= 0 &&
          v.tvlUsd >= 1e4 &&
          v.tvlUsd <= 1e8
      )
      .filter((v) => chainFilter === 'all' || String(v.chainId) === chainFilter)
    const eligible = quadrantFilter !== 'all' ? base.filter((v) => v.quadrant === quadrantFilter) : base
    if (eligible.length < 4) return eligible.map((v) => ({ ...v, logTvl: Math.log10(v.tvlUsd) }))
    const yields = eligible.map((v) => v.feeYield).sort((a, b) => a - b)
    const q1 = yields[Math.floor(yields.length * 0.25)]
    const q3 = yields[Math.floor(yields.length * 0.75)]
    const iqr = q3 - q1
    const upper = q3 + 1.5 * iqr
    return eligible.filter((v) => v.feeYield <= upper).map((v) => ({ ...v, logTvl: Math.log10(v.tvlUsd) }))
  }, [profData, quadrantFilter, chainFilter])

  const trendLine = useMemo(() => {
    if (scatterData.length < 5) return null
    const n = scatterData.length
    const { sumX, sumY, sumXY, sumX2, sumY2 } = scatterData.reduce(
      (acc, p) => ({
        sumX: acc.sumX + p.logTvl,
        sumY: acc.sumY + p.feeYield,
        sumXY: acc.sumXY + p.logTvl * p.feeYield,
        sumX2: acc.sumX2 + p.logTvl * p.logTvl,
        sumY2: acc.sumY2 + p.feeYield * p.feeYield
      }),
      { sumX: 0, sumY: 0, sumXY: 0, sumX2: 0, sumY2: 0 }
    )
    const denom = n * sumX2 - sumX * sumX
    if (denom === 0) return null
    const slope = (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n
    const denomR = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
    const r2 = denomR === 0 ? 0 : ((n * sumXY - sumX * sumY) / denomR) ** 2
    if (r2 < 0.01) return null
    const xs = scatterData.map((p) => p.logTvl)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    return {
      points: [
        { logTvl: minX, feeYield: slope * minX + intercept },
        { logTvl: maxX, feeYield: slope * maxX + intercept }
      ],
      r2
    }
  }, [scatterData])

  // Only show skeletons on initial load, not when switching time ranges
  const hasData =
    validSummary &&
    history &&
    vaultData &&
    (!summary.datasetId || (history.datasetId === summary.datasetId && vaultData.datasetId === summary.datasetId))
  const isFetching = l1 || l2 || l3 || l4 || l5
  const isRefreshing = Boolean(hasData) && isFetching
  useEffect(() => {
    if (!isRefreshing) {
      setShowLoadingOverlay(false)
      return
    }

    const timeout = window.setTimeout(() => setShowLoadingOverlay(true), 180)
    return () => window.clearTimeout(timeout)
  }, [isRefreshing])

  const controls = (
    <StatsChartControls key="fees-controls">
      {chainSelector}
      <fieldset className="fees-chart-view flex flex-wrap gap-2" aria-label="Chart view">
        {(['periodic', 'cumulative'] as const).map((view) => (
          <button
            key={view}
            type="button"
            className={timeframeButtonClass(chartView === view)}
            aria-pressed={chartView === view}
            onClick={() => setChartView(view)}
          >
            {view === 'cumulative' ? 'Cumulative' : historyInterval === 'weekly' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
      </fieldset>
      <FeeTimeRangeSlider datasetId={summary?.datasetId} selected={selectedRange} onApply={setSelectedRange} />
    </StatsChartControls>
  )

  if (summaryError || historyError || vaultError || (summary && !validSummary))
    return (
      <div className="fees-panel">
        {controls}
        <div className="card">
          <h2>Fee data could not be loaded</h2>
          <p className="text-dim">Please try again.</p>
          <button
            className="page-btn"
            onClick={() => {
              retrySummary()
              retryHistory()
              retryVaults()
            }}
          >
            Retry fee data
          </button>
        </div>
      </div>
    )

  if (!hasData && (l1 || l2 || l3))
    return (
      <div className="fees-panel" aria-busy="true">
        {controls}
        <div className="fees-panel fees-panel-initial" aria-busy="true">
          <div className="fees-loading-overlay fees-loading-overlay-initial">
            <FeesLoadingStatus label="Loading fee data" />
          </div>
          <SkeletonCards count={4} />
          <SkeletonChart />
        </div>
      </div>
    )
  if (!hasData) return <div className="fees-panel">{controls}</div>

  return (
    <div className="fees-panel" aria-busy={isFetching}>
      {showLoadingOverlay && (
        <div className="fees-loading-overlay">
          <FeesLoadingStatus label="Updating fee data" />
        </div>
      )}

      {controls}

      {/* ---- Metric Cards ---- */}
      <TooltipProvider delayDuration={200}>
        <div className="metric-grid">
          <div className="metric">
            <FeeMetricTitle title="Gross Fees" description="Fees charged across the stack" />
            <div className="value">{formatCanonicalUsd(summary.totalFeesPaidUsd)}</div>
          </div>
          <div className="metric metric-green">
            <FeeMetricTitle title="Net Yield" description="Gross gains less losses" />
            <div className="value text-green">{formatCanonicalUsd(summary.netLifetimeEarningsUsd)}</div>
          </div>
          <div className="metric metric-blue">
            <FeeMetricTitle title="Gross Gains" description="Reported vault gains" />
            <div className="value text-blue">{formatCanonicalUsd(summary.grossGainsUsd)}</div>
          </div>
          <div className="metric metric-red">
            <FeeMetricTitle title="Losses" description="Reported vault losses" />
            <div className="value text-red">{formatCanonicalUsd(summary.lossesUsd)}</div>
          </div>
        </div>
      </TooltipProvider>

      {/* ---- Full-width fee history charts ---- */}
      <div className="row fee-chart-row">
        <FeeHistoryChart
          {...chartType('overall')}
          periods={feeHistorySeries}
          cumulative={chartView === 'cumulative'}
          title={
            chartView === 'cumulative'
              ? 'Cumulative Earnings & Fees'
              : historyInterval === 'weekly'
                ? 'Weekly Earnings & Fees'
                : 'Monthly Earnings & Fees'
          }
          data={chartView === 'cumulative' ? cumulativeFeeHistorySeries : feeHistorySeries}
          interval={historyInterval}
          series={[
            {
              key: 'gains',
              dataKey: chartView === 'cumulative' ? 'cumulativeGrossGainsUsd' : 'grossGainsUsd',
              label: 'Gross Gains',
              color: '#46a2ff'
            },
            {
              key: 'yield',
              dataKey: chartView === 'cumulative' ? 'cumulativeNetYieldUsd' : 'netYieldUsd',
              label: 'Net Yield',
              color: '#94adf2'
            },
            {
              key: 'fees',
              dataKey: chartView === 'cumulative' ? 'cumulativeFeesPaidUsd' : 'totalFeesPaidUsd',
              label: 'Gross Fees',
              color: '#16a34a',
              strokeDasharray: '6 3'
            }
          ]}
          description={`${chartTypes.overall === 'bar' ? 'Bar' : 'Line'} chart comparing ${chartView === 'cumulative' ? 'cumulative' : historyInterval} canonical gross gains, net yield, and gross fees over completed periods in the selected time range.`}
        />

        <section className="chain-fee-charts fee-chart-group" aria-label="Fees and earnings per dollar of TVL">
          <FeeYieldChart
            periods={feeHistorySeries}
            interval={historyInterval}
            view={chartView}
            {...chartType('feeYield')}
          />
          <FeeYieldChart
            metric="earnings"
            periods={feeHistorySeries}
            interval={historyInterval}
            view={chartView}
            {...chartType('earningsYield')}
          />
        </section>

        {productData?.datasetId === summary.datasetId && productData?.aggregationScope === 'product' ? (
          <VaultComparisonCharts
            selectedKeys={selectedAllocatorKeys}
            onSelectedKeysChange={setSelectedAllocatorKeys}
            query={historyFilters.toString()}
            rankedVaults={productData.vaults}
            periods={feeHistorySeries}
            view={chartView}
            interval={historyInterval}
            chartTypes={{ earnings: chartType('allocatorEarnings'), fees: chartType('allocatorFees') }}
          />
        ) : productError ? (
          <div className="error-retry">
            <p>Product fee data could not be loaded.</p>
            <button type="button" className="page-btn" onClick={retryProducts}>
              Retry product fees
            </button>
          </div>
        ) : (
          <SkeletonChart />
        )}

        <ChainFeeHistoryCharts
          chartTypes={{ earnings: chartType('chainEarnings'), fees: chartType('chainFees') }}
          query={historyFilters.toString()}
          chainIds={historyChainIds}
          periods={feeHistorySeries}
          view={chartView}
          interval={historyInterval}
        />

        <VaultTypeFeeCharts
          chartTypes={{ earnings: chartType('vaultTypeEarnings'), fees: chartType('vaultTypeFees') }}
          query={historyFilters.toString()}
          periods={feeHistorySeries}
          interval={historyInterval}
          view={chartView}
        />

        <MonthlyVaultTables chainSelector={chainSelector} />
      </div>

      {/* ---- Effective Fees ---- */}
      {feeStackError && (
        <div className="card">
          <h2>Effective Fees</h2>
          <div className="error-retry">
            <div className="error-message">Effective fees unavailable: {feeStackError}</div>
            <button className="page-btn" onClick={retryFeeStack}>
              Retry effective fees
            </button>
          </div>
        </div>
      )}
      {!feeStackError && feeStack && (
        <EffectiveFeesTable feeStack={feeStack} vaults={vaultData?.vaults ?? []} chainSelector={chainSelector} />
      )}
      {profData && (
        <div className="card fee-chart-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            TVL vs Fee Yield
            {trendLine && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 400 }}>
                R² = {trendLine.r2.toFixed(3)}
              </span>
            )}
          </h2>
          <fieldset className="quadrant-legend" aria-label="Quadrant filter">
            {Object.entries(QUADRANT_LABELS).map(([key, { label, color, desc }]) => {
              const count = profData.quadrants[key as Quadrant]?.length || 0
              const isActive = quadrantFilter === key
              return (
                <button
                  type="button"
                  key={key}
                  className="quadrant-tag"
                  aria-pressed={isActive}
                  style={{
                    borderColor: color,
                    color,
                    cursor: 'pointer',
                    opacity: quadrantFilter === 'all' || isActive ? 1 : 0.4,
                    background: isActive ? `${color}15` : undefined
                  }}
                  onClick={() => setQuadrantFilter(quadrantFilter === key ? 'all' : (key as Quadrant))}
                >
                  {label} ({count}) <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>{desc}</span>
                </button>
              )
            })}
          </fieldset>
          <div className="chart-container fee-history-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 20, right: 20, bottom: 24, top: 10 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="logTvl"
                  name="TVL"
                  domain={[4, 8]}
                  ticks={[4, 5, 6, 7, 8]}
                  tickFormatter={(v: number) => fmt(10 ** v, 0)}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  label={{
                    value: 'TVL (log scale)',
                    position: 'bottom',
                    fill: 'var(--text-3)',
                    fontSize: 11,
                    offset: 6
                  }}
                  stroke="var(--border)"
                  allowDataOverflow
                />
                <YAxis
                  type="number"
                  dataKey="feeYield"
                  name="Fee Yield"
                  tickFormatter={(v) => pctFmt(v)}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  label={{
                    value: 'Fee Yield (ann.)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--text-3)',
                    fontSize: 11
                  }}
                  stroke="var(--border)"
                />
                <ZAxis type="number" dataKey="annualizedFeeRevenue" range={[30, 500]} name="Fees" />
                <Tooltip content={<ScatterTooltip />} cursor={false} />
                <Scatter data={scatterData}>
                  {scatterData.map((v) => {
                    const qColor = QUADRANT_LABELS[v.quadrant]?.color || '#808080'
                    return (
                      <Cell
                        key={`${v.address}-${v.chainId}`}
                        fill={qColor}
                        fillOpacity={0.65}
                        stroke={qColor}
                        strokeWidth={1}
                      />
                    )
                  })}
                </Scatter>
                {trendLine && (
                  <Scatter
                    data={trendLine.points}
                    line={{ stroke: '#a16207', strokeWidth: 2, strokeDasharray: '6 3' }}
                    shape={() => <></>}
                    isAnimationActive={false}
                    legendType="none"
                  />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <span className="sr-only">Scatter plot showing TVL vs fee yield for {scatterData.length} vaults.</span>
        </div>
      )}
    </div>
  )
}
