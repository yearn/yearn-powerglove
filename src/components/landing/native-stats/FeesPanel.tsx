import { type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Tooltip as HelpTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ChainFeeHistoryCharts, type ChainFeeHistoryView } from './ChainFeeHistoryCharts'
import { type ChartTypeControl, ChartTypeToggle, type StatsChartType } from './ChartTypeToggle'
import { ChartViewToggle } from './ChartViewToggle'
import {
  type CanonicalFeeHistory,
  type CanonicalFeeSummary,
  type CanonicalVaultFee,
  type FeeHistoryInterval,
  isCanonicalFeeSummary
} from './canonical-fees'
import { EffectiveFeesTable } from './EffectiveFeesTable'
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
import { CHAIN_NAMES, fmt, SkeletonCards, SkeletonChart, useFetch } from './hooks'
import { MonthlyVaultTables } from './MonthlyVaultTables'
import { StatsContext, StatsTimeRangeContext } from './StatsContext'
import type { FeeStackSummary } from './types'
import { useFeeTvlHistory } from './useFeeTvlHistory'
import { VaultComparisonCharts } from './VaultComparisonCharts'
import { VaultTypeFeeCharts } from './VaultTypeFeeCharts'

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
  viewControl,
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
  viewControl?: ReactNode
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
          {viewControl}
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
          {viewControl}
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
              formatter={(value, name) => [
                fmt(typeof value === 'number' ? value : null, 2),
                name === 'averageTvlUsd'
                  ? 'Average TVL'
                  : (seriesLabels.get(name as FeeHistorySeriesKey) ?? String(name ?? ''))
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
  allocator: 'line',
  chain: 'bar',
  vaultType: 'bar'
} as const

export function FeesPanel() {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext)
  const { range } = useContext(StatsTimeRangeContext)
  const selectedRange = range ?? defaultFeeTimeRange(Math.floor(Date.now() / 1000))
  const [chartViews, setChartViews] = useState<
    Record<Exclude<keyof typeof DEFAULT_FEE_CHART_TYPES, 'feeYield'>, ChainFeeHistoryView>
  >({
    overall: 'periodic',
    allocator: 'periodic',
    chain: 'periodic',
    vaultType: 'periodic'
  })
  const chartView = (key: keyof typeof chartViews) => ({
    view: chartViews[key],
    onViewChange: (view: ChainFeeHistoryView) => setChartViews((views) => ({ ...views, [key]: view }))
  })
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

  const {
    data: summary,
    loading: l1,
    fetchedAt,
    error: summaryError,
    retry: retrySummary
  } = useFetch<CanonicalFeeSummary>(`/api/fees?${feeFilterQuery}`)
  const validSummary = summary !== null && isCanonicalFeeSummary(summary)
  const allTimeFilters = new URLSearchParams()
  if (chainFilter !== 'all') allTimeFilters.set('chainId', chainFilter)
  if (summary?.datasetId) allTimeFilters.set('datasetId', summary.datasetId)
  const allTime = useFetch<CanonicalFeeSummary>(`/api/fees?${allTimeFilters}`, {
    enabled: validSummary && !!summary.datasetId
  })
  const allTimeSummary =
    allTime.data && isCanonicalFeeSummary(allTime.data) && allTime.data.datasetId === summary?.datasetId
      ? allTime.data
      : null
  const rangeLabel = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    })
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

  // Only show skeletons on initial load, not when switching time ranges
  const hasData =
    validSummary &&
    history &&
    vaultData &&
    (!summary.datasetId || (history.datasetId === summary.datasetId && vaultData.datasetId === summary.datasetId))
  const isFetching = l1 || l2 || l3 || l4
  const isRefreshing = Boolean(hasData) && isFetching
  useEffect(() => {
    if (!isRefreshing) {
      setShowLoadingOverlay(false)
      return
    }

    const timeout = window.setTimeout(() => setShowLoadingOverlay(true), 180)
    return () => window.clearTimeout(timeout)
  }, [isRefreshing])

  if (summaryError || historyError || vaultError || (summary && !validSummary))
    return (
      <div className="fees-panel">
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
        <div className="fees-panel fees-panel-initial" aria-busy="true">
          <div className="fees-loading-overlay fees-loading-overlay-initial">
            <FeesLoadingStatus label="Loading fee data" />
          </div>
          <SkeletonCards count={4} />
          <SkeletonChart />
        </div>
      </div>
    )
  if (!hasData) return <div className="fees-panel" />

  return (
    <div className="fees-panel" aria-busy={isFetching}>
      {showLoadingOverlay && (
        <div className="fees-loading-overlay">
          <FeesLoadingStatus label="Updating fee data" />
        </div>
      )}

      {/* ---- Effective Fees ---- */}
      {feeStackError && (
        <div className="card">
          <h2>Adjusted TVL and Fees by Vault</h2>
          <div className="error-retry">
            <div className="error-message">Effective fees unavailable: {feeStackError}</div>
            <button className="page-btn" onClick={retryFeeStack}>
              Retry effective fees
            </button>
          </div>
        </div>
      )}
      {!feeStackError && feeStack && (
        <EffectiveFeesTable feeStack={feeStack} vaults={vaultData?.vaults ?? []} chainSelector={null} />
      )}

      <section className="earnings-fees-section" aria-label="Earnings and Fees">
        <TooltipProvider delayDuration={200}>
          <div className="fee-summary-grid">
            {(
              [
                {
                  title: 'Gross Fees',
                  field: 'totalFeesPaidUsd',
                  description: 'Fees charged across the stack'
                },
                {
                  title: 'Net Yield',
                  field: 'netLifetimeEarningsUsd',
                  description: 'Gross gains less losses'
                },
                {
                  title: 'Gross Gains',
                  field: 'grossGainsUsd',
                  description: 'Reported vault gains'
                },
                { title: 'Losses', field: 'lossesUsd', description: 'Reported vault losses' }
              ] as const
            ).map((metric) => (
              <section className="fee-summary-stat" key={metric.field} aria-label={metric.title}>
                <FeeMetricTitle title={metric.title} description={metric.description} />
                <dl className="fee-summary-values">
                  <div>
                    <dt>All time</dt>
                    <dd>
                      {allTime.loading && !allTimeSummary
                        ? '…'
                        : formatCanonicalUsd(allTimeSummary?.[metric.field] ?? null)}
                    </dd>
                  </div>
                  <div>
                    <dt>Since {rangeLabel(selectedRange.start)}</dt>
                    <dd>{formatCanonicalUsd(summary[metric.field])}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        </TooltipProvider>
        {!allTime.loading && !allTimeSummary && (
          <div className="error-retry">
            <span>All-time totals are unavailable.</span>
            <button type="button" className="page-btn" onClick={allTime.retry}>
              Retry all-time totals
            </button>
          </div>
        )}

        {/* ---- Full-width fee history charts ---- */}
        <div className="row fee-chart-row">
          <FeeHistoryChart
            {...chartType('overall')}
            viewControl={
              <ChartViewToggle {...chartView('overall')} interval={historyInterval} label="Earnings and fees" />
            }
            periods={feeHistorySeries}
            cumulative={chartViews.overall === 'cumulative'}
            title={
              chartViews.overall === 'cumulative'
                ? 'Cumulative Earnings & Fees'
                : historyInterval === 'weekly'
                  ? 'Weekly Earnings & Fees'
                  : 'Monthly Earnings & Fees'
            }
            data={chartViews.overall === 'cumulative' ? cumulativeFeeHistorySeries : feeHistorySeries}
            interval={historyInterval}
            series={[
              {
                key: 'gains',
                dataKey: chartViews.overall === 'cumulative' ? 'cumulativeGrossGainsUsd' : 'grossGainsUsd',
                label: 'Gross Gains',
                color: '#46a2ff'
              },
              {
                key: 'yield',
                dataKey: chartViews.overall === 'cumulative' ? 'cumulativeNetYieldUsd' : 'netYieldUsd',
                label: 'Net Yield',
                color: '#94adf2'
              },
              {
                key: 'fees',
                dataKey: chartViews.overall === 'cumulative' ? 'cumulativeFeesPaidUsd' : 'totalFeesPaidUsd',
                label: 'Gross Fees',
                color: '#16a34a',
                strokeDasharray: '6 3'
              }
            ]}
            description={`${chartTypes.overall === 'bar' ? 'Bar' : 'Line'} chart comparing ${chartViews.overall === 'cumulative' ? 'cumulative' : historyInterval} canonical gross gains, net yield, and gross fees over completed periods in the selected time range.`}
          />

          <section className="chain-fee-charts fee-chart-group" aria-label="Fees and earnings per dollar of TVL">
            <FeeYieldChart periods={feeHistorySeries} interval={historyInterval} {...chartType('feeYield')} />
          </section>

          <ChainFeeHistoryCharts
            {...chartType('chain')}
            query={historyFilters.toString()}
            chainIds={historyChainIds}
            periods={feeHistorySeries}
            {...chartView('chain')}
            interval={historyInterval}
          />

          <VaultTypeFeeCharts
            {...chartType('vaultType')}
            query={historyFilters.toString()}
            periods={feeHistorySeries}
            interval={historyInterval}
            {...chartView('vaultType')}
          />

          {productData?.datasetId === summary.datasetId && productData?.aggregationScope === 'product' ? (
            <VaultComparisonCharts
              selectedKeys={selectedAllocatorKeys}
              onSelectedKeysChange={setSelectedAllocatorKeys}
              query={historyFilters.toString()}
              rankedVaults={productData.vaults}
              periods={feeHistorySeries}
              {...chartView('allocator')}
              interval={historyInterval}
              {...chartType('allocator')}
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

          <MonthlyVaultTables chainSelector={null} datasetId={summary.datasetId} onRetryDataset={retrySummary} />
        </div>
      </section>
    </div>
  )
}
