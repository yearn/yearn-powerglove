import { ChevronRight } from 'lucide-react'
import { Fragment, useContext, useEffect, useId, useMemo, useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/components/ui/use-mobile'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { buildBlueShadePalette } from '@/lib/theme-blue-palette'
import { ChainDistributionChart } from './ChainDistributionChart'
import { ChainTvlHistory } from './ChainTvlHistory'
import { ChartTypeToggle, type StatsChartType } from './ChartTypeToggle'
import { formatTvlHistoryTick } from './fee-history'
import { CAT_COLORS, CHAIN_NAMES, CHAIN_SHORT, fmt, useFetch } from './hooks'
import { MobileYAxisTick, StatsTooltipContent, useMobileChartTooltip } from './StatsChartInteractions'
import { StatsChartOptions, StatsTableColumnSelector } from './StatsChartOptions'
import { StatsContext, StatsTimeRangeContext } from './StatsContext'
import { StatsPlotSkeleton, StatsTvlSkeleton } from './StatsLoadingSkeletons'
import {
  buildConstantPriceTvlUrl,
  buildTopSeriesChart,
  buildTvlHistoryUrl,
  DAY_SECONDS,
  getAvailableChartSeries,
  getStackRenderSeries,
  getTvlHistoryErrorMessage,
  labelVersionHistoryChart,
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
import { VaultHeadlineStats } from './VaultHeadlineStats'

const TVL_HISTORY_REMAINING_CHAIN_SERIES = 'All other chains'
const TVL_HISTORY_REMAINING_VERSION_SERIES = 'All other versions'
const TVL_HISTORY_TOTAL_SERIES = 'Total TVL'

function formatFullDate(timestamp: number | string): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
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

function getCanonicalTotalByTimestamp(run: TvlHistoryRun | null): Record<number, number> {
  if (!run) return {}

  const currentSnapshot = run.meta.currentSnapshot
  if (!currentSnapshot || typeof currentSnapshot !== 'object') return {}

  const snapshotRecord = currentSnapshot as Record<string, unknown>
  const timestamp = getNumberRecordValue(snapshotRecord, 'timestamp')
  const adjustedTotal =
    getNumberRecordValue(snapshotRecord, 'adjustedTotalTvlUsd') ?? getNumberRecordValue(run.meta, 'adjustedTotalTvlUsd')

  return timestamp && adjustedTotal !== null ? { [timestamp]: adjustedTotal } : {}
}

export function TvlHistoryTooltip({
  active,
  label,
  payload,
  canonicalTotalByTimestamp,
  remainingSeries,
  comparisonSeries,
  priceAdjusted = false
}: {
  active?: boolean
  label?: number | string
  payload?: Payload<ValueType, NameType>[]
  canonicalTotalByTimestamp: Record<number, number>
  remainingSeries: string
  comparisonSeries?: string
  priceAdjusted?: boolean
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
            <span className="text-muted-foreground">{priceAdjusted ? 'Price-adjusted TVL' : 'Actual TVL'}</span>
            <span className="font-semibold tabular-nums text-foreground" data-testid="tvl-history-tooltip-total">
              {fmt(total)}
            </span>
          </div>
        )}
        {comparisonPayload && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">
              {comparisonSeries === PRICE_NEUTRAL_TOTAL_SERIES ? 'Price-adjusted TVL' : comparisonSeries}
            </span>
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

export function TvlOverview() {
  const mobile = useIsMobile()
  const tooltip = useMobileChartTooltip(mobile)
  const [chainColumn, setChainColumn] = useState('tvl')
  const { range: selectedRange } = useContext(StatsTimeRangeContext)
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
  const [showPriceNeutral, setShowPriceNeutral] = useState(false)
  const [tvlHistoryView, setTvlHistoryView] = useState<StatsChartType>('bar')
  const [selectedHistoryChain, setSelectedHistoryChain] = useState<string | null>(null)
  const [historyEndAnchor] = useState(() => Math.floor(Date.now() / 1000))
  const tvlHistoryMode = 'external'
  const tvlHistoryInterval = 'weekly'
  const selectedBounds = selectedRange
    ? {
        from: Date.parse(`${selectedRange.start}T00:00:00Z`) / 1000,
        to: Date.parse(`${selectedRange.end}T00:00:00Z`) / 1000 + DAY_SECONDS - 1
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
  constantPriceFilters.set('groupBy', tvlHistoryBreakdown)
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
    enabled: Boolean(rawTvlHistory) && showPriceNeutral
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
  const tvlHistoryChart = useMemo(() => {
    if (!rawTvlHistory || (showPriceNeutral && !constantPriceHistory)) return { rows: [], series: [] }
    const sourceRows = showPriceNeutral
      ? selectConstantPriceChart(constantPriceHistory!, 'constant-price')
      : rawTvlHistory.chart
    const sourceSeries = showPriceNeutral ? getAvailableChartSeries(sourceRows) : rawTvlHistory.series
    const topTvlHistory = buildTopSeriesChart(sourceRows, sourceSeries, tvlHistoryRemainingSeries)
    const labeledHistory =
      tvlHistoryBreakdown === 'category'
        ? labelVersionHistoryChart(topTvlHistory.rows, topTvlHistory.series)
        : topTvlHistory
    const rangedRows = labeledHistory.rows.filter(
      (row) => row.timestamp >= selectedBounds.from && row.timestamp <= selectedBounds.to
    )
    return {
      rows: rangedRows,
      series: labeledHistory.series
    }
  }, [
    rawTvlHistory,
    constantPriceHistory,
    showPriceNeutral,
    tvlHistoryBreakdown,
    selectedBounds.from,
    selectedBounds.to,
    tvlHistoryRemainingSeries
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
    () => (showPriceNeutral ? {} : getCanonicalTotalByTimestamp(rawTvlHistory)),
    [rawTvlHistory, showPriceNeutral]
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
  const displayedHistoryRows = tvlHistoryRows
  const historyLoading = tvlHistoryLoading || (showPriceNeutral && constantPriceLoading)
  const historyError = tvlHistoryError || (showPriceNeutral && constantPriceError)
  const hasTvlHistory = displayedHistoryRows.length > 0 && tvlHistorySeries.length > 0

  const tvlHistoryBarSize = getHistoryBarSize(displayedHistoryRows.length)

  if (loading)
    return (
      <>
        <VaultHeadlineStats data={null} loading />
        <StatsTvlSkeleton chainCount={chainFilter === 'all' ? 9 : 1} />
      </>
    )
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

  const totalChainTvl = chainData.reduce((total, { tvl }) => total + Math.max(0, tvl), 0)
  const chainPercentage = (tvl: number) => (totalChainTvl > 0 ? (tvl / totalChainTvl) * 100 : 0)

  return (
    <>
      <VaultHeadlineStats data={data} />

      <div className="card stats-chart-tvl">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="fee-chart-title-row">
              <h2>TVL History</h2>
              <StatsChartOptions title="TVL History">
                <ChartTypeToggle value={tvlHistoryView} onValueChange={setTvlHistoryView} label="TVL" />
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
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={showPriceNeutral}
                      onChange={(event) => setShowPriceNeutral(event.target.checked)}
                    />
                    price adjusted
                  </label>
                </div>
              </StatsChartOptions>
            </div>
          </div>
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

        {historyLoading && (
          <div aria-label="Loading TVL history" aria-busy="true">
            <StatsPlotSkeleton tvl />
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

        {!historyLoading && !historyError && !hasTvlHistory && (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            No TVL history data for this selected timeframe.
          </div>
        )}

        {!historyLoading && !historyError && hasTvlHistory && (
          <div
            className={`chart-container tvl-history-chart${isTvlHistoryInspecting ? ' is-inspecting' : ''}`}
            data-price-adjusted={showPriceNeutral}
            style={{ height: 'var(--stats-tvl-plot-height, 320px)' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                {...tooltip.chartEvents}
                data={displayedHistoryRows}
                margin={{ top: mobile ? 18 : 8, right: mobile ? 8 : 12, bottom: 0, left: mobile ? 8 : 0 }}
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
                  tickFormatter={formatTvlHistoryTick}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  angle={mobile ? -90 : -45}
                  textAnchor="end"
                  height={mobile ? 70 : 50}
                  interval={Math.max(0, Math.floor(displayedHistoryRows.length / 8) - 1)}
                  minTickGap={16}
                />

                <Tooltip
                  {...tooltip.tooltipProps}
                  content={
                    <StatsTooltipContent
                      mobile={mobile}
                      onClose={tooltip.dismiss}
                      renderContent={(props) => (
                        <TvlHistoryTooltip
                          {...props}
                          canonicalTotalByTimestamp={tvlHistoryCanonicalTotalByTimestamp}
                          remainingSeries={tvlHistoryRemainingSeries}
                          priceAdjusted={showPriceNeutral}
                        />
                      )}
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

                <YAxis
                  mirror={mobile}
                  tickMargin={mobile ? 8 : 5}
                  tickFormatter={(value: number) => fmt(value, 0)}
                  tick={
                    mobile ? (
                      <MobileYAxisTick formatter={(value) => fmt(value, 0)} />
                    ) : (
                      { fill: 'var(--text-3)', fontSize: 11 }
                    )
                  }
                  axisLine={false}
                  tickLine={false}
                  width={mobile ? 1 : 60}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {showPriceNeutral && constantPriceError && (
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
      <div className="card chain-distribution-card">
        <h2>TVL by Chain</h2>
        <div className={`chain-distribution-layout${selectedHistoryChain ? ' is-expanded' : ''}`}>
          <ChainDistributionChart chains={chainData} colors={tvlHistoryColors} total={totalChainTvl} />
          <div className="chain-distribution-table">
            <StatsTableColumnSelector
              label="Chain data column"
              value={chainColumn}
              onChange={setChainColumn}
              columns={[
                { value: 'tvl', label: 'TVL' },
                { value: 'percentage', label: '% of TVL' }
              ]}
            />
            <div className="chain-distribution-head">
              <span>Chain</span>
              <span hidden={mobile && chainColumn !== 'tvl'}>TVL</span>
              <span hidden={mobile && chainColumn !== 'percentage'}>% of TVL</span>
            </div>
            {chainData.map((c, i) => {
              const isExpanded = selectedHistoryChain === c.chain
              return (
                <Fragment key={c.chain}>
                  <button
                    type="button"
                    className={`stat-row chain-stat-row chain-distribution-row${isExpanded ? ' is-selected' : ''}`}
                    aria-expanded={isExpanded}
                    aria-controls={c.chainId ? `chain-history-${c.chainId}` : undefined}
                    disabled={c.chainId === null}
                    onClick={() => setSelectedHistoryChain((current) => toggleSelectedChain(current, c.chain))}
                  >
                    <span className="stat-label chain-stat-label">
                      <ChevronRight className="chain-stat-chevron" size={15} strokeWidth={1.8} aria-hidden="true" />
                      <span
                        className="legend-dot"
                        style={{ background: tvlHistoryColors[i % tvlHistoryColors.length] }}
                      />
                      {c.label}
                    </span>
                    <span className="stat-value" hidden={mobile && chainColumn !== 'tvl'}>
                      {fmt(c.tvl)}
                    </span>
                    <span className="chain-distribution-percentage" hidden={mobile && chainColumn !== 'percentage'}>
                      {chainPercentage(c.tvl).toFixed(2)}%
                    </span>
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
          {selectedHistoryChain ? (
            <div className="chain-distribution-bar" aria-label="TVL distribution by chain">
              {chainData
                .filter((chain) => chain.tvl > 0)
                .map((chain) => (
                  <button
                    type="button"
                    key={chain.chain}
                    className="chain-distribution-segment"
                    style={{
                      flexGrow: chain.tvl,
                      background: tvlHistoryColors[chainData.indexOf(chain) % tvlHistoryColors.length]
                    }}
                    title={`${chain.label} · ${fmt(chain.tvl)} · ${chainPercentage(chain.tvl).toFixed(2)}%`}
                    aria-label={`${chain.label}: ${fmt(chain.tvl)}, ${chainPercentage(chain.tvl).toFixed(2)}% of TVL`}
                    onClick={() => {
                      if (chain.chainId !== null)
                        setSelectedHistoryChain((current) => toggleSelectedChain(current, chain.chain))
                    }}
                  />
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
