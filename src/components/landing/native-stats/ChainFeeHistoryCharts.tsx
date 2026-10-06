import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { FeeHistoryInterval } from './canonical-fees'
import { buildChainFeeHistorySeries, type ChainFeeHistoryPoint, type ChainFeeMetric } from './chain-fee-history'
import { type FeeHistoryPeriod, formatFeeHistoryTick } from './fee-history'
import { CHAIN_COLORS, CHAIN_NAMES, fmt, SkeletonChart } from './hooks'
import { useChainFeeHistories } from './useChainFeeHistories'

export type ChainFeeHistoryView = 'cumulative' | 'periodic'

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
        <span>Total (shown chains)</span>
        <strong>{formatChainFeeAmount(values.reduce((total, item) => total + (item.value as number), 0))}</strong>
      </div>
    </div>
  )
}

function ChainFeeChart({
  metric,
  data,
  chainIds,
  interval
}: {
  metric: ChainFeeMetric
  data: ChainFeeHistoryPoint[]
  chainIds: number[]
  interval: FeeHistoryInterval
}) {
  const [hiddenChains, setHiddenChains] = useState<Set<number>>(() => new Set())
  const title = metric === 'earnings' ? 'Earnings by Chain' : 'Fees by Chain'
  const activeChains = chainIds.filter((chainId) => !hiddenChains.has(chainId))

  return (
    <div className="card fee-chart-card">
      <div className="fee-chart-header">
        <div>
          <h2>{title}</h2>
          <span className="text-dim">{metric === 'earnings' ? 'Gross gains less losses' : 'Gross fees charged'}</span>
        </div>
        <fieldset className="fee-series-toggles">
          <legend className="sr-only">{title} data series</legend>
          {chainIds.map((chainId) => {
            const visible = !hiddenChains.has(chainId)
            const color = CHAIN_COLORS[chainId] ?? '#808080'
            return (
              <button
                type="button"
                key={chainId}
                className="fee-series-toggle"
                aria-pressed={visible}
                onClick={() =>
                  setHiddenChains((current) => {
                    const next = new Set(current)
                    if (next.has(chainId)) next.delete(chainId)
                    else next.add(chainId)
                    return next
                  })
                }
              >
                <span
                  className="fee-series-swatch"
                  aria-hidden="true"
                  style={{ borderColor: color, backgroundColor: visible ? color : 'transparent' }}
                />
                {CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}
              </button>
            )
          })}
        </fieldset>
      </div>
      {data.length === 0 ? (
        <p className="text-dim">No history in this range.</p>
      ) : (
        <div className="chart-container fee-history-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} stackOffset="none" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
              {activeChains.map((chainId) => (
                <Area
                  key={chainId}
                  type="linear"
                  dataKey={(point: ChainFeeHistoryPoint) => point[metric][chainId]}
                  name={CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}
                  stackId="chains"
                  stroke={CHAIN_COLORS[chainId] ?? '#808080'}
                  fill={CHAIN_COLORS[chainId] ?? '#808080'}
                  fillOpacity={0.35}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function ChainFeeHistoryCharts({
  query,
  chainIds,
  periods,
  view,
  onViewChange,
  interval
}: {
  query: string
  chainIds: number[]
  periods: FeeHistoryPeriod[]
  view: ChainFeeHistoryView
  onViewChange: (view: ChainFeeHistoryView) => void
  interval: FeeHistoryInterval
}) {
  const { data, loading, error, retry } = useChainFeeHistories(query, chainIds)
  const series = useMemo(() => buildChainFeeHistorySeries(data ?? [], periods), [data, periods])

  return (
    <section className="chain-fee-charts" aria-label="Earnings and fees by chain" aria-busy={loading}>
      <fieldset className="time-presets" aria-label="Chain chart view">
        {(['cumulative', 'periodic'] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            className={view === mode ? 'active' : ''}
            aria-pressed={view === mode}
            onClick={() => onViewChange(mode)}
          >
            {mode === 'cumulative' ? 'Cumulative' : interval === 'weekly' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
      </fieldset>
      {loading ? (
        <SkeletonChart />
      ) : error ? (
        <div className="card">
          <p>Chain breakdown could not be loaded.</p>
          <button type="button" className="page-btn" onClick={retry}>
            Retry chain breakdown
          </button>
        </div>
      ) : (
        <>
          <ChainFeeChart metric="earnings" data={series[view]} chainIds={chainIds} interval={interval} />
          <ChainFeeChart metric="fees" data={series[view]} chainIds={chainIds} interval={interval} />
        </>
      )}
    </section>
  )
}
