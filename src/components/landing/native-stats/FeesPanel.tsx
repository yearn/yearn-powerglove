import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import { Fragment, type ReactNode, useContext, useEffect, useId, useMemo, useState } from 'react'
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
import { ChartTypeToggle, type StatsChartType } from './ChartTypeToggle'
import {
  type CanonicalFeeHistory,
  type CanonicalFeeSummary,
  type CanonicalVaultFee,
  type FeeHistoryInterval,
  isCanonicalFeeSummary
} from './canonical-fees'
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
import {
  bpsPct,
  CHAIN_COLORS,
  CHAIN_SHORT,
  fmt,
  pctFmt,
  SkeletonCards,
  SkeletonChart,
  useFetch,
  usePagination,
  useSort
} from './hooks'
import { StatsContext } from './StatsContext'
import type { FeeStackChain, FeeStackNode, FeeStackSummary } from './types'
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
  tvlUsd: number
  annualizedFeeRevenue: number
  feeYield: number
  feeCapture: number
  gainYield: number
  trend: Trend
  trendDelta: number
  pricingConfidence: PricingConfidence
  reportCount: number
  avgHarvestFrequencyDays: number
  performanceFee: number
  managementFee: number
  totalGainUsd: number
  totalFeeRevenue: number
  quadrant: Quadrant
  currentPeriodFeeYield: number
  previousPeriodFeeYield: number
}

interface ProfitabilitySummary {
  protocolFeeYield: number
  feeCaptureRate: number
  medianVaultFeeYield: number
  totalAnnualizedFees: number
  totalTvl: number
  vaultCount: number
  lastUpdated: string
  vaults: VaultProfitability[]
  byChain: Array<{ chain: string; chainId: number; tvl: number; fees: number; feeYield: number; vaultCount: number }>
  byCategory: Array<{ category: string; tvl: number; fees: number; feeYield: number; vaultCount: number }>
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

function trendIcon(t: string | undefined) {
  if (t === 'improving') return <span style={{ color: 'var(--green)' }}>&#x25B2;</span>
  if (t === 'declining') return <span style={{ color: 'var(--red)' }}>&#x25BC;</span>
  if (t === 'stable') return <span style={{ color: 'var(--text-3)' }}>&#x25CF;</span>
  return <span style={{ color: 'var(--text-3)' }}>-</span>
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

/** Flatten tree to rows, filtering out dust (<$100) children */
function flattenTree(
  node: FeeStackNode,
  depth: number,
  isLast: boolean
): Array<{ node: FeeStackNode; depth: number; isLast: boolean }> {
  const rows: Array<{ node: FeeStackNode; depth: number; isLast: boolean }> = [{ node, depth, isLast }]
  const visibleChildren = depth === 0 ? node.children : node.children.filter((c) => c.capitalUsd >= 100)
  visibleChildren.forEach((child, i) => {
    rows.push(...flattenTree(child, depth + 1, i === visibleChildren.length - 1))
  })
  return rows
}

function timeframeButtonClass(active: boolean) {
  return `min-w-0 rounded-none px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${
    active ? 'bg-[#0657f9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`
}

function vaultFeeKey(vault: { address: string; chainId: number }): string {
  return `${vault.address.toLowerCase()}-${vault.chainId}`
}

function actualVaultFeesUsd(
  vault: { address: string; chainId: number },
  vaultFeeMap: Map<string, CanonicalVaultFee>
): string | null {
  const fee = vaultFeeMap.get(vaultFeeKey(vault))
  return fee?.totalFeesPaidUsd ?? null
}

function formatCanonicalUsd(value: string | null, decimals = 1): string {
  const parsed = canonicalDecimalToNumber(value)
  return parsed === null ? '—' : fmt(parsed, decimals)
}

function ActualFeeCell({ value }: { value: string | null }) {
  if (value === null) return <span className="text-dim">—</span>
  return <span className="text-green">{formatCanonicalUsd(value)}</span>
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

function FeeHistoryChart({
  title,
  data,
  series,
  description,
  interval,
  renderType
}: {
  title: string
  data: FeeHistoryPoint[]
  series: FeeHistoryChartSeries[]
  description: string
  interval: FeeHistoryInterval
  renderType: StatsChartType
}) {
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
        <h2>{title}</h2>
        <p className="text-dim">No completed history in this range.</p>
      </div>
    )
  }

  return (
    <div className="card fee-chart-card">
      <div className="fee-chart-header">
        <h2>{title}</h2>
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
        </fieldset>
      </div>
      <div className="chart-container fee-history-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}
              labelStyle={{ color: 'var(--text)' }}
              formatter={(value: number, name: string) => [
                fmt(value, 2),
                seriesLabels.get(name as FeeHistorySeriesKey) ?? name
              ]}
              cursor={{ stroke: 'rgba(6, 87, 249, 0.22)' }}
            />
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
      <span className="sr-only">{description}</span>
    </div>
  )
}

export function FeesPanel({ chainSelector }: { chainSelector: ReactNode }) {
  const { chainFilter, density, setLastFetchedAt } = useContext(StatsContext)
  const [selectedRange, setSelectedRange] = useState<ChartDateRange>(() =>
    defaultFeeTimeRange(Math.floor(Date.now() / 1000))
  )
  const [chartView, setChartView] = useState<ChainFeeHistoryView>('periodic')
  const [renderType, setRenderType] = useState<StatsChartType>('bar')
  const [selectedAllocatorKeys, setSelectedAllocatorKeys] = useState<string[] | null>(null)
  const [controlsExpanded, setControlsExpanded] = useState(true)
  const controlsId = useId()
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
    data: feeStack,
    loading: l4,
    error: feeStackError,
    retry: retryFeeStack
  } = useFetch<FeeStackSummary>('/api/fees/stack')
  const { data: profData, loading: l5 } = useFetch<ProfitabilitySummary>(`/api/profitability?${profitabilityFilters}`)
  const stackSort = useSort('feeCaptured')
  const { sorted: sortStacks } = stackSort
  const [expandedStack, setExpandedStack] = useState<number | null>(null)
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

  // Build a lookup map for vault fees from the time-filtered vaultData
  const vaultFeeMap = useMemo(() => {
    if (!vaultData) return new Map<string, CanonicalVaultFee>()
    return new Map(vaultData.vaults.map((v) => [`${v.address.toLowerCase()}-${v.chainId}`, v]))
  }, [vaultData])

  // Build a lookup map for profitability trend data
  const profTrendMap = useMemo(() => {
    if (!profData) return new Map<string, string>()
    return new Map(profData.vaults.map((v) => [`${v.address.toLowerCase()}-${v.chainId}`, v.trend]))
  }, [profData])

  const sortedStacks = useMemo(() => {
    if (!feeStack) return []
    type ChainWithFee = FeeStackChain & { actualFeesUsd: string | null; trend: string | undefined }
    const withFees: ChainWithFee[] = feeStack.chains
      .filter((c) => chainFilter === 'all' || String(c.root.vault.chainId) === chainFilter)
      .map((c) => {
        const key = vaultFeeKey(c.root.vault)
        return {
          ...c,
          actualFeesUsd: actualVaultFeesUsd(c.root.vault, vaultFeeMap),
          trend: profTrendMap.get(key)
        }
      })
    return sortStacks(withFees, {
      name: (c) => c.root.vault.name || '',
      perfFee: (c) => c.root.perfFee,
      feeCaptured: (c) => canonicalDecimalToNumber(c.actualFeesUsd) ?? -1,
      effective: (c) => c.effectivePerfFee
    })
  }, [feeStack, vaultFeeMap, profTrendMap, sortStacks, chainFilter])

  const stackPagination = usePagination(sortedStacks.length, 30)
  const pagedStacks = sortedStacks.slice(stackPagination.start, stackPagination.end)

  const scatterData = useMemo(() => {
    if (!profData) return []
    const base = profData.vaults
      .filter((v) => v.feeYield > 0 && v.tvlUsd >= 1e4 && v.tvlUsd <= 1e8)
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
    <div key="fees-controls" className={`fees-toolbar${controlsExpanded ? '' : ' fees-toolbar-collapsed'}`}>
      {!controlsExpanded && <span className="fees-controls-label text-dim">Chart controls</span>}
      <div id={controlsId} className="fees-toolbar-controls" hidden={!controlsExpanded}>
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
        <ChartTypeToggle value={renderType} onValueChange={setRenderType} label="fee and earnings charts" />
        <FeeTimeRangeSlider datasetId={summary?.datasetId} selected={selectedRange} onApply={setSelectedRange} />
      </div>
      <button
        type="button"
        className="fees-toolbar-collapse"
        aria-expanded={controlsExpanded}
        aria-controls={controlsId}
        aria-label={controlsExpanded ? 'Collapse chart controls' : 'Expand chart controls'}
        onClick={() => setControlsExpanded((expanded) => !expanded)}
      >
        {controlsExpanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
    </div>
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
          renderType={renderType}
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
          description={`${renderType === 'bar' ? 'Bar' : 'Line'} chart comparing ${chartView === 'cumulative' ? 'cumulative' : historyInterval} canonical gross gains, net yield, and gross fees over completed periods in the selected time range.`}
        />

        <FeeYieldChart periods={feeHistorySeries} interval={historyInterval} view={chartView} renderType={renderType} />
        <FeeYieldChart
          metric="earnings"
          periods={feeHistorySeries}
          interval={historyInterval}
          view={chartView}
          renderType={renderType}
        />

        <VaultComparisonCharts
          selectedKeys={selectedAllocatorKeys}
          onSelectedKeysChange={setSelectedAllocatorKeys}
          query={historyFilters.toString()}
          rankedVaults={vaultData?.vaults ?? []}
          periods={feeHistorySeries}
          view={chartView}
          interval={historyInterval}
          renderType={renderType}
        />

        <ChainFeeHistoryCharts
          renderType={renderType}
          query={historyFilters.toString()}
          chainIds={historyChainIds}
          periods={feeHistorySeries}
          view={chartView}
          interval={historyInterval}
        />

        <VaultTypeFeeCharts
          renderType={renderType}
          query={historyFilters.toString()}
          periods={feeHistorySeries}
          interval={historyInterval}
          view={chartView}
        />

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

      {/* ---- Fee Analysis ---- */}
      {feeStackError && (
        <div className="card">
          <h2>Fee Analysis</h2>
          <div className="error-retry">
            <div className="error-message">Fee analysis unavailable: {feeStackError}</div>
            <button className="page-btn" onClick={retryFeeStack}>
              Retry fee analysis
            </button>
          </div>
        </div>
      )}
      {!feeStackError &&
        feeStack &&
        feeStack.chains.length > 0 &&
        (() => {
          return (
            <div className="card">
              <h2>Fee Analysis</h2>
              <div className="metric-grid" style={{ marginBottom: '1rem' }}>
                <div className="metric">
                  <div className="label">Max Depth</div>
                  <div className="value">{feeStack.maxDepth}</div>
                </div>
                <div className="metric">
                  <div className="label">Max Effective Perf Fee</div>
                  <div className="value text-yellow">{bpsPct(feeStack.maxEffectivePerfFee)}</div>
                </div>
                <div className="metric">
                  <div className="label">Avg Effective Perf Fee</div>
                  <div className="value">{bpsPct(feeStack.avgEffectivePerfFee)}</div>
                </div>
                <div className="metric">
                  <div className="label">Vaults with Stacking</div>
                  <div className="value">{sortedStacks.length}</div>
                </div>
              </div>
              <div className="table-scroll" style={{ maxHeight: 600, overflowY: 'auto' }}>
                <table className={density === 'compact' ? 'density-compact' : ''}>
                  <thead>
                    <tr>
                      <th {...stackSort.th('name', 'Vault')} />
                      <th {...stackSort.th('perfFee', 'Perf Fee', 'text-right')} />
                      <th {...stackSort.th('feeCaptured', 'Gross Fees', 'text-right')} />
                      <th {...stackSort.th('effective', 'Effective Perf Fee', 'text-right')} />
                      <th style={{ textAlign: 'center', width: 60 }}>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedStacks.map((chain, idx) => {
                      const realIdx = stackPagination.start + idx
                      const isOpen = expandedStack === realIdx
                      const rows = flattenTree(chain.root, 0, true)
                      return (
                        <Fragment key={`stack-${realIdx}`}>
                          <tr onClick={() => setExpandedStack(isOpen ? null : realIdx)} style={{ cursor: 'pointer' }}>
                            <td>
                              <span className="audit-toggle" style={{ marginRight: 6 }}>
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
                                )}
                              </span>
                              <span style={{ fontWeight: 600 }}>
                                {chain.root.vault.name?.slice(0, 30) || chain.root.vault.address.slice(0, 10)}
                              </span>
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  background: `${CHAIN_COLORS[chain.root.vault.chainId] || '#5e6673'}20`,
                                  color: CHAIN_COLORS[chain.root.vault.chainId] || '#5e6673',
                                  letterSpacing: '0.03em'
                                }}
                              >
                                {CHAIN_SHORT[chain.root.vault.chainId] || chain.root.vault.chainId}
                              </span>
                            </td>
                            <td className="text-right">{bpsPct(chain.root.perfFee)}</td>
                            <td className="text-right">
                              <ActualFeeCell value={chain.actualFeesUsd} />
                            </td>
                            <td className="text-right">
                              <span className="text-yellow" style={{ fontWeight: 600 }}>
                                {bpsPct(chain.effectivePerfFee)}
                              </span>
                              <span className="text-dim" style={{ fontSize: '0.7rem', marginLeft: 4 }}>
                                depth {chain.maxDepth}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>{trendIcon(chain.trend)}</td>
                          </tr>
                          {isOpen &&
                            rows.map(({ node, depth, isLast }) => {
                              const paddingLeft = 1.0 + depth * 1.6
                              const isRoot = depth === 0
                              const isLeafStrategy = node.children.length === 0 && node.perfFee === 0 && !isRoot
                              const rowOpacity = isLeafStrategy ? 0.55 : 1
                              const nodeActualFees = actualVaultFeesUsd(node.vault, vaultFeeMap)
                              return (
                                <tr
                                  key={`${node.vault.chainId}-${node.vault.address}-${depth}`}
                                  style={{
                                    background: depth > 0 ? 'var(--surface-2)' : 'var(--surface)',
                                    opacity: rowOpacity
                                  }}
                                >
                                  <td style={{ paddingLeft: `${paddingLeft}rem` }}>
                                    <span className="text-dim" style={{ marginRight: 6, fontSize: '0.75rem' }}>
                                      {isRoot ? '\u25CB' : isLast ? '\u2514\u2500' : '\u251C\u2500'}
                                    </span>
                                    {!isRoot && (
                                      <span
                                        style={{
                                          color: 'var(--accent)',
                                          fontSize: '0.65rem',
                                          marginRight: 4,
                                          opacity: 0.6
                                        }}
                                      >
                                        {'\u2192'}
                                      </span>
                                    )}
                                    <span style={{ color: isRoot ? 'var(--text)' : 'var(--text-2)' }}>
                                      {node.vault.name?.slice(0, 28) || node.vault.address.slice(0, 10)}
                                    </span>
                                    {!isRoot && node.vault.chainId !== chain.root.vault.chainId && (
                                      <span
                                        style={{
                                          marginLeft: 4,
                                          fontSize: '0.55rem',
                                          fontWeight: 600,
                                          padding: '1px 4px',
                                          borderRadius: 3,
                                          background: `${CHAIN_COLORS[node.vault.chainId] || '#5e6673'}20`,
                                          color: CHAIN_COLORS[node.vault.chainId] || '#5e6673'
                                        }}
                                      >
                                        {CHAIN_SHORT[node.vault.chainId] || node.vault.chainId}
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className="text-right"
                                    style={{ color: node.perfFee > 0 ? 'var(--text)' : 'var(--text-3)' }}
                                  >
                                    {bpsPct(node.perfFee)}
                                  </td>
                                  <td className="text-right">
                                    <ActualFeeCell value={nodeActualFees} />
                                  </td>
                                  <td className="text-right">
                                    {isRoot ? (
                                      <span className="text-dim" style={{ fontSize: '0.7rem' }}>
                                        root
                                      </span>
                                    ) : isLeafStrategy ? (
                                      <span className="text-dim" style={{ fontSize: '0.65rem' }}>
                                        strategy
                                      </span>
                                    ) : (
                                      <span className="text-dim" style={{ fontSize: '0.7rem' }}>
                                        +{bpsPct(node.perfFee)}
                                      </span>
                                    )}
                                  </td>
                                  <td />
                                </tr>
                              )
                            })}
                          {isOpen && (
                            <tr style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                              <td style={{ paddingLeft: '1rem' }}>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: 'var(--text-3)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                  }}
                                >
                                  Effective total
                                </span>
                              </td>
                              <td className="text-right">
                                <span className="text-dim">—</span>
                              </td>
                              <td className="text-right">
                                <span className="text-dim">—</span>
                              </td>
                              <td className="text-right">
                                <span className="text-yellow" style={{ fontWeight: 600 }}>
                                  {bpsPct(chain.effectivePerfFee)}
                                </span>
                                <span className="text-dim" style={{ fontSize: '0.7rem' }}>
                                  weighted
                                </span>
                              </td>
                              <td />
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {stackPagination.Pagination && <stackPagination.Pagination />}
            </div>
          )
        })()}
    </div>
  )
}
