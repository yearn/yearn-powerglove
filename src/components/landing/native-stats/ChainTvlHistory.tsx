import { BarChart3, Info, LineChart } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { buildBlueShadePalette } from '@/lib/theme-blue-palette'
import { CAT_COLORS, fmt, useFetch } from './hooks'
import {
  ACTUAL_TOTAL_SERIES,
  addChartTotal,
  buildChainTvlHistoryUrl,
  buildTopSeriesChart,
  type ChainTvlHistoryBreakdown,
  getAvailableChartSeries,
  getPriceNeutralCoverageLabel,
  getStackRenderSeries,
  getTvlHistoryErrorMessage,
  getTvlHistoryRangeBounds,
  labelVersionHistoryChart,
  mergePriceNeutralTotal,
  PRICE_NEUTRAL_TOTAL_SERIES,
  TVL_HISTORY_RANGE_OPTIONS,
  type TvlHistoryRange
} from './tvl-history'
import type { ConstantPriceTvlHistory } from './types'

const REMAINING_VAULTS = 'All other vaults'
const REMAINING_VERSIONS = 'All other versions'

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

function ChainTvlTooltip({
  active,
  label,
  payload,
  showPriceNeutral
}: {
  active?: boolean
  label?: number | string
  payload?: Payload<ValueType, NameType>[]
  showPriceNeutral: boolean
}) {
  if (!active || !payload?.length) return null

  const values = payload
    .filter((item) => typeof item.value === 'number' && Number.isFinite(item.value))
    .map((item) => ({
      name: String(item.name ?? item.dataKey ?? ''),
      value: item.value as number,
      color: item.color
    }))
  const actual = values.find(({ name }) => name === ACTUAL_TOTAL_SERIES)
  const priceNeutral = showPriceNeutral ? values.find(({ name }) => name === PRICE_NEUTRAL_TOTAL_SERIES) : undefined
  const vaults = values
    .filter(({ name, value }) => name !== ACTUAL_TOTAL_SERIES && name !== PRICE_NEUTRAL_TOTAL_SERIES && value > 0)
    .reverse()

  return (
    <div className="chain-history-tooltip">
      <div className="chain-history-tooltip-date">{label ? formatFullDate(label) : 'TVL'}</div>
      <div className="chain-history-tooltip-totals">
        {actual && (
          <div>
            <span>Actual TVL</span>
            <strong>{fmt(actual.value)}</strong>
          </div>
        )}
        {priceNeutral && (
          <div>
            <span>Price-neutral TVL</span>
            <strong>{fmt(priceNeutral.value)}</strong>
          </div>
        )}
      </div>
      <div className="chain-history-tooltip-vaults">
        {vaults.map((item) => (
          <div key={item.name}>
            <span>
              <i className="legend-dot" style={{ background: item.color }} />
              {item.name}
            </span>
            <strong>{fmt(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChainTvlHistory({
  chainId,
  chainLabel,
  allTimeRange,
  datasetId
}: {
  chainId: number
  chainLabel: string
  allTimeRange: { from: number; to: number }
  datasetId?: string
}) {
  const isDark = useRootDarkMode()
  const [breakdown, setBreakdown] = useState<ChainTvlHistoryBreakdown>('vault')
  const [range, setRange] = useState<TvlHistoryRange>('all')
  const [view, setView] = useState<'line' | 'bar'>('line')
  const [showPriceNeutral, setShowPriceNeutral] = useState(true)
  const bounds = getTvlHistoryRangeBounds(range, allTimeRange.to, allTimeRange.from)
  const url = buildChainTvlHistoryUrl({ breakdown, chainId, ...bounds }) + (datasetId ? `&datasetId=${datasetId}` : '')
  const { data, loading, error, status, retry } = useFetch<ConstantPriceTvlHistory>(url)
  const colors = useMemo(() => buildBlueShadePalette(isDark), [isDark])
  const fillId = `chain-tvl-fill-${useId().replace(/:/g, '')}`

  const chart = useMemo(() => {
    if (!data) return { rows: [], series: [], stackSeries: [], colors: {} as Record<string, string> }
    const actualSeries = getAvailableChartSeries(data.actualChart)
    const remainingSeries = breakdown === 'vault' ? REMAINING_VAULTS : REMAINING_VERSIONS
    const actual =
      breakdown === 'vault'
        ? buildTopSeriesChart(data.actualChart, actualSeries, remainingSeries)
        : labelVersionHistoryChart(data.actualChart, actualSeries)
    const actualRows = addChartTotal(actual.rows, actual.series, ACTUAL_TOTAL_SERIES)
    const priceNeutralSeries = getAvailableChartSeries(data.constantPriceChart)
    const rows =
      view === 'line' && showPriceNeutral
        ? mergePriceNeutralTotal(actualRows, data.constantPriceChart, priceNeutralSeries)
        : actualRows

    return {
      rows,
      series: actual.series,
      stackSeries: getStackRenderSeries(actual.series, remainingSeries),
      colors: Object.fromEntries(
        actual.series.map((series, index) => [
          series,
          breakdown === 'category'
            ? (CAT_COLORS[series.toLowerCase()] ?? colors[index % colors.length])
            : colors[index % colors.length]
        ])
      )
    }
  }, [breakdown, colors, data, showPriceNeutral, view])

  const priceNeutralVisible = view === 'line' && showPriceNeutral
  const coverage = data ? getPriceNeutralCoverageLabel(data.meta) : null

  return (
    <section className="chain-history-drilldown" aria-labelledby={`chain-history-${chainId}`}>
      <div className="chain-history-heading">
        <div>
          <h3 id={`chain-history-${chainId}`}>{chainLabel} TVL History</h3>
          <p>
            {breakdown === 'vault'
              ? `Vaults on ${chainLabel}; top ${Math.min(10, chart.series.length)} by latest actual TVL`
              : `Vault versions on ${chainLabel}`}
          </p>
        </div>
        {data && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="tvl-history-icon-btn" aria-label={`${chainLabel} history details`}>
                <Info size={15} strokeWidth={1.8} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="tvl-history-info-popover">
              <div className="label">Chain history</div>
              <div className="mt-2 grid gap-2 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Chain ID</span>
                  <span className="font-medium tabular-nums">{chainId}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Run</span>
                  <span className="font-medium tabular-nums">#{data.runId}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Reference window</span>
                  <span className="font-medium tabular-nums">{data.meta.referenceWindowPoints} valid prices</span>
                </div>
                {coverage && <div className="text-muted-foreground">{coverage}</div>}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {view === 'line' && (
        <div className="tvl-history-series-switch" aria-label={`${chainLabel} TVL history series`}>
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
            Price-neutral TVL
          </button>
        </div>
      )}

      <div className="chain-history-controls">
        <Tabs value={breakdown} onValueChange={(value) => setBreakdown(value as ChainTvlHistoryBreakdown)}>
          <TabsList className="tvl-history-tabs" aria-label={`${chainLabel} TVL history breakdown`}>
            <TabsTrigger className="tvl-history-tab" value="vault">
              Vaults
            </TabsTrigger>
            <TabsTrigger className="tvl-history-tab" value="category">
              Version
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="tvl-history-control-group" aria-label={`${chainLabel} history time range`}>
          {TVL_HISTORY_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={range === option.value ? 'active' : undefined}
              aria-pressed={range === option.value}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="tvl-history-control-group icon-group" aria-label={`${chainLabel} history chart type`}>
          <button
            type="button"
            className={view === 'line' ? 'active' : undefined}
            aria-label={`Show ${chainLabel} TVL as lines`}
            aria-pressed={view === 'line'}
            onClick={() => setView('line')}
          >
            <LineChart size={15} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className={view === 'bar' ? 'active' : undefined}
            aria-label={`Show ${chainLabel} TVL as bars`}
            aria-pressed={view === 'bar'}
            onClick={() => setView('bar')}
          >
            <BarChart3 size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {loading && <div className="chain-history-state">Loading {chainLabel} history...</div>}
      {error && (
        <div className="chain-history-state error-retry">
          <span>{getTvlHistoryErrorMessage({ isConstantPrice: true, status, error })}</span>
          <button type="button" className="page-btn" onClick={retry}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && chart.rows.length === 0 && (
        <div className="chain-history-state">
          No {chainLabel} {breakdown === 'vault' ? 'vault' : 'version'} history for this timeframe.
        </div>
      )}

      {!loading && !error && chart.rows.length > 0 && (
        <div
          className="chain-history-chart"
          data-chain-history={chainLabel}
          data-price-neutral-overlay={priceNeutralVisible}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart.rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.16} />
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
                interval={Math.max(0, Math.floor(chart.rows.length / 7) - 1)}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(value: number) => fmt(value, 0)}
                tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<ChainTvlTooltip showPriceNeutral={priceNeutralVisible} />} />
              {view === 'line' && (
                <>
                  <Area
                    type="monotone"
                    dataKey={ACTUAL_TOTAL_SERIES}
                    stroke="none"
                    fill={`url(#${fillId})`}
                    isAnimationActive={false}
                    connectNulls
                  />
                  {chart.stackSeries.map((series) => (
                    <Area
                      key={series}
                      type="monotone"
                      dataKey={series}
                      stackId="chain-vaults"
                      stroke={chart.colors[series]}
                      fill={chart.colors[series]}
                      fillOpacity={0.14}
                      strokeOpacity={0.5}
                      strokeWidth={1.1}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey={ACTUAL_TOTAL_SERIES}
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 1.5, stroke: 'var(--surface)', fill: 'var(--accent)' }}
                    isAnimationActive={false}
                    connectNulls
                  />
                  {priceNeutralVisible && (
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
                      isAnimationActive={false}
                      connectNulls
                    />
                  )}
                </>
              )}
              {view === 'bar' &&
                chart.stackSeries.map((series, index) => (
                  <Bar
                    key={series}
                    dataKey={series}
                    stackId="chain-vaults"
                    fill={chart.colors[series]}
                    fillOpacity={series === REMAINING_VAULTS || series === REMAINING_VERSIONS ? 0.28 : 0.78}
                    stroke="transparent"
                    maxBarSize={22}
                    radius={index === chart.stackSeries.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
