import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { useContext, useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Tooltip as HelpTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChainFeeHistoryView } from './ChainFeeHistoryCharts'
import { type ChartTypeControl, ChartTypeToggle } from './ChartTypeToggle'
import type { FeeHistoryInterval } from './canonical-fees'
import { type FeeHistoryPoint, feeHistoryBoundary, formatFeeHistoryTick } from './fee-history'
import { buildTvlYieldSeries, type DailyFeeTvlHistory, type TvlYieldMetric, type TvlYieldPoint } from './fee-yield'
import { CHAIN_NAMES, fmt, resolveStatsApiBase, SkeletonChart, useFetch } from './hooks'
import { StatsContext } from './StatsContext'
import type { TvlSummary } from './types'

const percentage = (value: number) =>
  `${value !== 0 && Math.abs(value) < 0.0001 ? value.toPrecision(3) : new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value)}%`

function amount(value: number, minimumFractionDigits = 2): string {
  return value !== 0 && Math.abs(value) < 1e-8
    ? `$${value.toExponential(2)}`
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits,
        maximumFractionDigits: 8
      }).format(value)
}

function FeeYieldTooltip({
  active,
  payload,
  cumulative,
  metric
}: {
  active?: boolean
  payload?: Array<{ payload?: TvlYieldPoint }>
  cumulative: boolean
  metric: TvlYieldMetric
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const annualizedYieldPct = cumulative ? point.cumulativeAnnualizedYieldPct : point.annualizedYieldPct
  const numerator = cumulative ? point.cumulativeAmountUsd : point.amountUsd
  const tvl = cumulative ? point.cumulativeAverageTvlUsd : point.averageTvlUsd
  if (annualizedYieldPct === null || numerator === null || tvl === null) return null
  const earnings = metric === 'earnings'
  const perDollar = amount(annualizedYieldPct / 100, 4)
  return (
    <div className="chain-fee-tooltip">
      <strong>{point.period}</strong>
      <div>
        <span>Annualized {earnings ? 'earnings' : 'fee'} yield</span>
        <span>{percentage(annualizedYieldPct)}</span>
      </div>
      <div>
        <span>Annualized {earnings ? 'earnings' : 'fees'} per $1 TVL</span>
        <span>{perDollar}</span>
      </div>
      <div>
        <span>
          {earnings ? 'Net yield' : 'Gross fees'}
          {cumulative ? ' to date' : ''}
        </span>
        <span>{Math.abs(numerator) < 1 ? amount(numerator) : fmt(numerator, 2)}</span>
      </div>
      <div>
        <span>Average adjusted TVL</span>
        <span>{Math.abs(tvl) < 1 ? amount(tvl) : fmt(tvl, 2)}</span>
      </div>
      <div>
        <span>Days annualized</span>
        <span>{cumulative ? point.cumulativeDays : point.expectedDays}</span>
      </div>
      <div>
        <span>Daily closes in period</span>
        <span>
          {point.coveredDays} / {point.expectedDays}
        </span>
      </div>
    </div>
  )
}

export function FeeYieldChart({
  periods,
  interval,
  view,
  renderType,
  onRenderTypeChange,
  metric = 'fees'
}: ChartTypeControl & {
  periods: FeeHistoryPoint[]
  interval: FeeHistoryInterval
  view: ChainFeeHistoryView
  metric?: TvlYieldMetric
}) {
  const { chainFilter } = useContext(StatsContext)
  const summary = useFetch<TvlSummary>('/api/tvl')
  const base = resolveStatsApiBase('tvl') ?? ''
  const datasetId = summary.data?.datasetId
  const from = periods.length ? Date.parse(feeHistoryBoundary(periods[0], 'start')) / 1000 : 0
  const to = periods.length ? Date.parse(feeHistoryBoundary(periods[periods.length - 1], 'end')) / 1000 - 1 : 0
  const client = useQueryClient()
  // A loaded larger window serves shorter selections and every chain locally.
  const cached = client
    .getQueriesData<DailyFeeTvlHistory>({ queryKey: ['fee-yield-daily-tvl', base, datasetId] })
    .find(
      ([key, data]) =>
        data?.datasetId === datasetId &&
        typeof key[3] === 'number' &&
        key[3] <= from &&
        typeof key[4] === 'number' &&
        key[4] >= to
    )
  const scopeFrom = cached ? Number(cached[0][3]) : from
  const scopeTo = cached ? Number(cached[0][4]) : to
  const enabled = !!datasetId && periods.length > 0
  const history = useQuery({
    queryKey: ['fee-yield-daily-tvl', base, datasetId, scopeFrom, scopeTo],
    enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }): Promise<DailyFeeTvlHistory> => {
      const filters = new URLSearchParams({
        groupBy: 'chain',
        mode: 'external',
        interval: 'daily',
        format: 'chart',
        from: String(scopeFrom),
        to: String(scopeTo),
        datasetId: datasetId ?? ''
      })
      const response = await fetch(`${base}/api/tvl/history/runs/latest?${filters}`, { signal })
      if (!response.ok) throw new Error('Daily TVL could not be loaded')
      const data: DailyFeeTvlHistory = await response.json()
      if (data.datasetId !== datasetId || data.interval !== 'daily' || !Array.isArray(data.chart))
        throw new Error('Daily TVL does not match the selected publication')
      return data
    }
  })
  const data = useMemo(
    () =>
      history.data
        ? buildTvlYieldSeries(
            periods,
            history.data,
            chainFilter === 'all' ? undefined : (CHAIN_NAMES[Number(chainFilter)] ?? `Chain ${chainFilter}`),
            metric
          )
        : [],
    [history.data, periods, chainFilter, metric]
  )
  const loading = summary.loading || (enabled && history.isPending)
  const cumulative = view === 'cumulative'
  const key = cumulative ? 'cumulativeAnnualizedYieldPct' : 'annualizedYieldPct'
  const available = data.filter((point) => point[key] !== null).length
  const earnings = metric === 'earnings'
  const title = earnings ? 'Earnings' : 'Fees'
  const yieldLabel = earnings ? 'Annualized earnings yield' : 'Annualized fee yield'
  const color = earnings ? '#46a2ff' : '#16a34a'

  return (
    <section className="card fee-chart-card" aria-label={`${title} per dollar of TVL`} aria-busy={loading}>
      <div className="fee-chart-header">
        <div className="fee-chart-title-row">
          <h2>
            {cumulative ? 'Cumulative' : interval === 'weekly' ? 'Weekly' : 'Monthly'} {title} per $1 of TVL
            (Annualized)
          </h2>
          <ChartTypeToggle
            value={renderType}
            onValueChange={onRenderTypeChange}
            label={`${title.toLowerCase()} per dollar of TVL`}
          />
        </div>
        <TooltipProvider delayDuration={200}>
          <HelpTooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="tvl-history-icon-btn"
                aria-label={`How ${title.toLowerCase()} per dollar of TVL is calculated`}
              >
                <Info size={15} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {earnings ? 'Reported net yield (gross gains less losses)' : 'Gross fees charged'} divided by the average
              published daily, overlap-adjusted TVL for the same UTC period, multiplied by 365 divided by the number of
              days in that period. Cumulative mode annualizes the total to date using the day-weighted average TVL and
              total days to date. This uses simple annualization without compounding.
            </TooltipContent>
          </HelpTooltip>
        </TooltipProvider>
      </div>
      {loading ? (
        <SkeletonChart />
      ) : summary.error || history.isError ? (
        <div className="error-retry">
          <p>Historical TVL could not be loaded for this selection.</p>
          <button
            type="button"
            className="page-btn"
            onClick={() => {
              summary.retry()
              void history.refetch()
            }}
          >
            Retry {yieldLabel.toLowerCase()}
          </button>
        </div>
      ) : available === 0 ? (
        <p className="text-dim">
          {yieldLabel} is unavailable: this selection needs {earnings ? 'reported net yield' : 'recorded fees'}, daily
          TVL coverage, and a positive average TVL.
        </p>
      ) : (
        <>
          <div className="chart-container fee-history-chart" data-fee-yield-chart={view} data-tvl-yield-metric={metric}>
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
                  tickFormatter={percentage}
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  width={68}
                  domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
                />
                <Tooltip content={<FeeYieldTooltip cumulative={cumulative} metric={metric} />} />
                {renderType === 'bar' ? (
                  <Bar dataKey={key} name={yieldLabel} fill={color} maxBarSize={32} isAnimationActive={false} />
                ) : (
                  <Line
                    type="linear"
                    dataKey={key}
                    name={yieldLabel}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {available < data.length && (
            <p className="text-dim">
              {data.length - available} periods have unavailable {yieldLabel.toLowerCase()}. Gaps indicate missing{' '}
              {earnings ? 'net yield' : 'fees'}, missing daily TVL, or zero average TVL.
            </p>
          )}
        </>
      )}
    </section>
  )
}
