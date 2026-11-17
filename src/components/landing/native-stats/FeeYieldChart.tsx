import { useContext, useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile } from '@/components/ui/use-mobile'
import { type ChartTypeControl, ChartTypeToggle } from './ChartTypeToggle'
import type { FeeHistoryInterval } from './canonical-fees'
import { FeeMetricToggle } from './FeeMetricToggle'
import { type FeeHistoryPoint, formatFeeHistoryTick } from './fee-history'
import { buildTvlYieldSeries, type TvlYieldMetric, type TvlYieldPoint } from './fee-yield'
import { CHAIN_NAMES, fmt } from './hooks'
import { MobileYAxisTick, StatsTooltipContent, useMobileChartTooltip } from './StatsChartInteractions'
import { StatsChartOptions } from './StatsChartOptions'
import { StatsContext } from './StatsContext'
import { StatsPlotSkeleton } from './StatsLoadingSkeletons'
import { useFeeTvlHistory } from './useFeeTvlHistory'

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
  metric
}: {
  active?: boolean
  payload?: Array<{ payload?: TvlYieldPoint }>
  metric: TvlYieldMetric
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const annualizedYieldPct = point.annualizedYieldPct
  const numerator = point.amountUsd
  const tvl = point.averageTvlUsd
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
        <span>{earnings ? 'Net yield' : 'Gross fees'}</span>
        <span>{Math.abs(numerator) < 1 ? amount(numerator) : fmt(numerator, 2)}</span>
      </div>
      <div>
        <span>Average adjusted TVL</span>
        <span>{Math.abs(tvl) < 1 ? amount(tvl) : fmt(tvl, 2)}</span>
      </div>
      <div>
        <span>Days annualized</span>
        <span>{point.expectedDays}</span>
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
  renderType,
  onRenderTypeChange
}: ChartTypeControl & {
  periods: FeeHistoryPoint[]
  interval: FeeHistoryInterval
}) {
  const mobile = useIsMobile()
  const tooltip = useMobileChartTooltip(mobile)
  const [metric, setMetric] = useState<TvlYieldMetric>('fees')
  const { chainFilter } = useContext(StatsContext)
  const history = useFeeTvlHistory(periods)
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
  const loading = history.loading
  const key = 'annualizedYieldPct'
  const hasYield = data.some((point) => point[key] !== null)
  const earnings = metric === 'earnings'
  const title = earnings ? 'Earnings' : 'Fees'
  const yieldLabel = earnings ? 'Annualized earnings yield' : 'Annualized fee yield'
  const color = earnings ? '#46a2ff' : '#16a34a'

  return (
    <section
      className="card fee-chart-card stats-chart-yield"
      aria-label={`${title} per dollar of TVL`}
      aria-busy={loading}
    >
      <div className="fee-chart-header">
        <div className="fee-chart-title-row">
          <h2>
            {interval === 'weekly' ? 'Weekly' : 'Monthly'} {title} per $1 of TVL (Annualized)
          </h2>
          <StatsChartOptions title={`${title} per $1 of TVL`}>
            <FeeMetricToggle value={metric} onValueChange={setMetric} label="TVL yield" />
            <ChartTypeToggle
              value={renderType}
              onValueChange={onRenderTypeChange}
              label={`${title.toLowerCase()} per dollar of TVL`}
            />
          </StatsChartOptions>
        </div>
      </div>
      {loading ? (
        <StatsPlotSkeleton />
      ) : history.error ? (
        <div className="error-retry">
          <p>Historical TVL could not be loaded for this selection.</p>
          <button type="button" className="page-btn" onClick={history.retry}>
            Retry {yieldLabel.toLowerCase()}
          </button>
        </div>
      ) : !hasYield ? (
        <p className="text-dim">
          {yieldLabel} is unavailable: this selection needs {earnings ? 'reported net yield' : 'recorded fees'}, daily
          TVL coverage, and a positive average TVL.
        </p>
      ) : (
        <div
          className="chart-container fee-history-chart"
          data-fee-yield-chart="periodic"
          data-tvl-yield-metric={metric}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              {...tooltip.chartEvents}
              data={data}
              margin={{ top: mobile ? 18 : 8, right: mobile ? 8 : 12, bottom: 0, left: mobile ? 8 : 0 }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                tickFormatter={(period: string) => formatFeeHistoryTick(period, interval)}
                tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                interval={Math.max(0, Math.floor(data.length / 10) - 1)}
                angle={mobile ? -90 : -35}
                textAnchor="end"
                height={mobile ? 70 : 50}
              />

              <Tooltip
                {...tooltip.tooltipProps}
                content={
                  <StatsTooltipContent
                    mobile={mobile}
                    onClose={tooltip.dismiss}
                    renderContent={(props) => <FeeYieldTooltip {...props} metric={metric} />}
                  />
                }
              />
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

              <YAxis
                mirror={mobile}
                tickMargin={mobile ? 8 : 5}
                tickFormatter={percentage}
                tick={mobile ? <MobileYAxisTick formatter={percentage} /> : { fill: 'var(--text-3)', fontSize: 11 }}
                width={mobile ? 1 : 68}
                domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
