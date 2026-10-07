import { useMemo } from 'react'
import type { FeeHistoryInterval } from './canonical-fees'
import { buildChainFeeHistorySeries } from './chain-fee-history'
import { FeeBreakdownChart } from './FeeBreakdownChart'
import type { FeeHistoryPeriod } from './fee-history'
import { CHAIN_COLORS, CHAIN_NAMES, SkeletonChart } from './hooks'
import { useChainFeeHistories } from './useChainFeeHistories'

export type ChainFeeHistoryView = 'cumulative' | 'periodic'

export function ChainFeeHistoryCharts({
  query,
  chainIds,
  periods,
  view,
  interval
}: {
  query: string
  chainIds: number[]
  periods: FeeHistoryPeriod[]
  view: ChainFeeHistoryView
  interval: FeeHistoryInterval
}) {
  const { data, loading, error, retry } = useChainFeeHistories(query, chainIds)
  const chartSeries = chainIds.map((chainId) => ({
    key: String(chainId),
    label: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
    color: CHAIN_COLORS[chainId] ?? '#808080'
  }))
  const series = useMemo(() => buildChainFeeHistorySeries(data ?? [], periods), [data, periods])

  return (
    <section className="chain-fee-charts" aria-label="Earnings and fees by chain" aria-busy={loading}>
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
          <FeeBreakdownChart
            title="Earnings by Chain"
            subtitle="Gross gains less losses"
            metric="earnings"
            data={series[view]}
            series={chartSeries}
            interval={interval}
          />
          <FeeBreakdownChart
            title="Fees by Chain"
            subtitle="Gross fees charged"
            metric="fees"
            data={series[view]}
            series={chartSeries}
            interval={interval}
          />
        </>
      )}
    </section>
  )
}
