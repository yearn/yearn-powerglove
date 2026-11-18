import { type ReactNode, useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { useIsMobile } from '@/components/ui/use-mobile'
import { type ChartTypeControl, ChartTypeToggle } from './ChartTypeToggle'
import type { FeeHistoryInterval } from './canonical-fees'
import type { ChainFeeMetric } from './chain-fee-history'
import { formatFeeHistoryTick } from './fee-history'
import { fmt } from './hooks'
import { MobileYAxisTick, StatsTooltipContent, useMobileChartTooltip } from './StatsChartInteractions'
import { StatsChartOptions } from './StatsChartOptions'
import type { VaultComparisonPoint } from './vault-fee-history'

export interface FeeBreakdownSeries {
  key: string
  label: string
  color: string
}

function formatChainFeeAmount(value: number): string {
  return value !== 0 && Math.abs(value) < 1
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
      }).format(value)
    : fmt(value, 2)
}

function ChainFeeTooltip({
  active,
  label,
  payload
}: {
  active?: boolean
  label?: string
  payload?: Payload<ValueType, NameType>[]
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce<number | null>(
    (sum, item) => (sum === null || typeof item.value !== 'number' ? null : sum + item.value),
    0
  )
  return (
    <div className="chain-fee-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={String(item.name)}>
          <span style={{ color: item.color }}>{item.name}</span>
          <span>{typeof item.value === 'number' ? formatChainFeeAmount(item.value) : 'Unavailable'}</span>
        </div>
      ))}
      <div className="chain-fee-tooltip-total">
        <span>Total (shown series)</span>
        <strong>{total === null ? 'Unavailable' : formatChainFeeAmount(total)}</strong>
      </div>
    </div>
  )
}

export function FeeBreakdownChart({
  metric,
  data,
  series,
  title,
  subtitle,
  interval,
  renderType,
  onRenderTypeChange,
  metricControl,
  viewControl,
  controls,
  notice,
  placeholder,
  stacked = true
}: ChartTypeControl & {
  metric: ChainFeeMetric
  data: VaultComparisonPoint[]
  series: FeeBreakdownSeries[]
  title: string
  subtitle?: string
  interval: FeeHistoryInterval
  metricControl?: ReactNode
  viewControl?: ReactNode
  controls?: ReactNode
  notice?: ReactNode
  placeholder?: ReactNode
  stacked?: boolean
}) {
  const mobile = useIsMobile()
  const tooltip = useMobileChartTooltip(mobile)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set())
  const activeSeries = series.filter((item) => !hiddenSeries.has(item.key))

  return (
    <div
      className={`card fee-chart-card ${controls ? 'stats-chart-comparison' : title.includes('Chain') ? 'stats-chart-chain' : 'stats-chart-type'}`}
    >
      <div className="fee-chart-header">
        {mobile && <h2>{title}</h2>}
        <StatsChartOptions title={title}>
          <div className={controls ? 'fee-chart-controls-row' : undefined}>
            <div className="fee-chart-title-row">
              {!mobile && <h2>{title}</h2>}
              {metricControl}
              {viewControl}
              <ChartTypeToggle value={renderType} onValueChange={onRenderTypeChange} label={title.toLowerCase()} />
            </div>
            {subtitle && <span className="text-dim">{subtitle}</span>}
            {controls}
          </div>
          <fieldset className="fee-series-toggles">
            <legend className="sr-only">{title} data series</legend>
            {series.map((item) => {
              const visible = !hiddenSeries.has(item.key)
              const color = item.color
              return (
                <button
                  type="button"
                  key={item.key}
                  className="fee-series-toggle"
                  aria-pressed={visible}
                  onClick={() =>
                    setHiddenSeries((current) => {
                      const next = new Set(current)
                      if (next.has(item.key)) next.delete(item.key)
                      else next.add(item.key)
                      return next
                    })
                  }
                >
                  <span
                    className="fee-series-swatch"
                    aria-hidden="true"
                    style={{ borderColor: color, backgroundColor: visible ? color : 'transparent' }}
                  />
                  {item.label}
                </button>
              )
            })}
          </fieldset>
        </StatsChartOptions>
      </div>
      {notice}
      {placeholder ??
        (data.length === 0 ? (
          <p className="text-dim">No completed history in this range.</p>
        ) : (
          <div className="chart-container fee-history-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                {...tooltip.chartEvents}
                data={data}
                stackOffset="none"
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
                  filterNull={false}
                  content={
                    <StatsTooltipContent
                      mobile={mobile}
                      onClose={tooltip.dismiss}
                      renderContent={(props) => <ChainFeeTooltip {...props} />}
                    />
                  }
                />
                {activeSeries.map((item) =>
                  renderType === 'bar' ? (
                    <Bar
                      key={item.key}
                      dataKey={(point: VaultComparisonPoint) => point[metric][item.key]}
                      name={item.label}
                      stackId={stacked ? 'chains' : undefined}
                      fill={item.color}
                      maxBarSize={32}
                      isAnimationActive={false}
                    />
                  ) : stacked ? (
                    <Area
                      key={item.key}
                      type="linear"
                      dataKey={(point: VaultComparisonPoint) => point[metric][item.key]}
                      name={item.label}
                      stackId="chains"
                      stroke={item.color}
                      fill={item.color}
                      fillOpacity={0.35}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Line
                      key={item.key}
                      type="linear"
                      dataKey={(point: VaultComparisonPoint) => point[metric][item.key]}
                      name={item.label}
                      stroke={item.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  )
                )}

                <YAxis
                  mirror={mobile}
                  tickMargin={mobile ? 8 : 5}
                  domain={[(minimum: number) => Math.min(0, minimum), (maximum: number) => Math.max(0, maximum)]}
                  tick={
                    mobile ? (
                      <MobileYAxisTick formatter={(value) => fmt(value, 1)} />
                    ) : (
                      { fill: 'var(--text-3)', fontSize: 11 }
                    )
                  }
                  tickFormatter={(value: number) => fmt(value, 1)}
                  width={mobile ? 1 : 68}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ))}
    </div>
  )
}
