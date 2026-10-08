import { useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { StatsChartType } from './ChartTypeToggle'
import type { FeeHistoryInterval } from './canonical-fees'
import type { ChainFeeHistoryPoint, ChainFeeMetric } from './chain-fee-history'
import { formatFeeHistoryTick } from './fee-history'
import { fmt } from './hooks'

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
  const values = payload.filter((item) => typeof item.value === 'number')
  return (
    <div className="chain-fee-tooltip">
      <strong>{label}</strong>
      {values.map((item) => (
        <div key={String(item.name)}>
          <span style={{ color: item.color }}>{item.name}</span>
          <span>{formatChainFeeAmount(item.value as number)}</span>
        </div>
      ))}
      <div className="chain-fee-tooltip-total">
        <span>Total (shown series)</span>
        <strong>{formatChainFeeAmount(values.reduce((total, item) => total + (item.value as number), 0))}</strong>
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
  renderType = 'bar'
}: {
  metric: ChainFeeMetric
  data: ChainFeeHistoryPoint[]
  series: FeeBreakdownSeries[]
  title: string
  subtitle: string
  interval: FeeHistoryInterval
  renderType?: StatsChartType
}) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set())
  const activeSeries = series.filter((item) => !hiddenSeries.has(item.key))

  return (
    <div className="card fee-chart-card">
      <div className="fee-chart-header">
        <div>
          <h2>{title}</h2>
          <span className="text-dim">{subtitle}</span>
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
      </div>
      {data.length === 0 ? (
        <p className="text-dim">No completed history in this range.</p>
      ) : (
        <div className="chart-container fee-history-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} stackOffset="none" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
                domain={[(minimum: number) => Math.min(0, minimum), (maximum: number) => Math.max(0, maximum)]}
                tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                tickFormatter={(value: number) => fmt(value, 1)}
                width={68}
              />
              <Tooltip content={<ChainFeeTooltip />} />
              {activeSeries.map((item) =>
                renderType === 'bar' ? (
                  <Bar
                    key={item.key}
                    dataKey={(point: ChainFeeHistoryPoint) => point[metric][item.key]}
                    name={item.label}
                    stackId="chains"
                    fill={item.color}
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                ) : (
                  <Area
                    key={item.key}
                    type="linear"
                    dataKey={(point: ChainFeeHistoryPoint) => point[metric][item.key]}
                    name={item.label}
                    stackId="chains"
                    stroke={item.color}
                    fill={item.color}
                    fillOpacity={0.35}
                    isAnimationActive={false}
                  />
                )
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
