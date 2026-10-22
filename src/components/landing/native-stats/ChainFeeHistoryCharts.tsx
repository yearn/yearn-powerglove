import { useMemo, useState } from 'react'
import type { ChartTypeControl } from './ChartTypeToggle'
import type { FeeHistoryInterval } from './canonical-fees'
import type { ChainFeeMetric } from './chain-fee-history'
import { buildChainFeeHistorySeries } from './chain-fee-history'
import { FeeBreakdownChart } from './FeeBreakdownChart'
import { FeeMetricToggle } from './FeeMetricToggle'
import type { FeeHistoryPeriod } from './fee-history'
import { CHAIN_COLORS, CHAIN_NAMES, SkeletonChart } from './hooks'
import { useChainFeeHistories } from './useChainFeeHistories'

export type ChainFeeHistoryView = 'cumulative' | 'periodic'

export function ChainFeeHistoryCharts({
  query,
  chainIds,
  periods,
  view,
  interval,
  renderType,
  onRenderTypeChange
}: ChartTypeControl & {
  query: string
  chainIds: number[]
  periods: FeeHistoryPeriod[]
  view: ChainFeeHistoryView
  interval: FeeHistoryInterval
}) {
  const [metric, setMetric] = useState<ChainFeeMetric>('earnings')
  const { data, loading, error, retry } = useChainFeeHistories(query, chainIds)
  const chartSeries = chainIds.map((chainId) => ({
    key: String(chainId),
    label: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
    color: CHAIN_COLORS[chainId] ?? '#808080'
  }))
  const series = useMemo(() => buildChainFeeHistorySeries(data ?? [], periods), [data, periods])

  return (
    <section className="chain-fee-charts fee-chart-group" aria-label="Earnings and fees by chain" aria-busy={loading}>
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
        <FeeBreakdownChart
          renderType={renderType}
          onRenderTypeChange={onRenderTypeChange}
          title={`${metric === 'earnings' ? 'Earnings' : 'Fees'} by Chain`}
          subtitle={metric === 'earnings' ? 'Gross gains less losses' : 'Gross fees charged'}
          metric={metric}
          metricControl={<FeeMetricToggle value={metric} onValueChange={setMetric} label="Chain" />}
          data={series[view]}
          series={chartSeries}
          interval={interval}
        />
      )}
    </section>
  )
}
