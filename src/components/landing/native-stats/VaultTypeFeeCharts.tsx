import { useMemo } from 'react'
import type { ChainFeeHistoryView } from './ChainFeeHistoryCharts'
import type { FeeChartTypeControls } from './ChartTypeToggle'
import type { FeeHistoryInterval } from './canonical-fees'
import { FeeBreakdownChart } from './FeeBreakdownChart'
import type { FeeHistoryPeriod } from './fee-history'
import { SkeletonChart } from './hooks'
import { useVaultTypeFeeHistories } from './useVaultTypeFeeHistories'
import { buildVaultTypeFeeSeries } from './vault-type-fees'

export function VaultTypeFeeCharts({
  query,
  periods,
  interval,
  view,
  chartTypes
}: {
  query: string
  periods: FeeHistoryPeriod[]
  interval: FeeHistoryInterval
  view: ChainFeeHistoryView
  chartTypes: FeeChartTypeControls
}) {
  const { catalog, histories, loading, error, retry } = useVaultTypeFeeHistories(query, periods)
  const data = useMemo(() => buildVaultTypeFeeSeries(histories, periods, catalog), [histories, periods, catalog])

  return (
    <section
      className="chain-fee-charts fee-chart-group"
      aria-label="Earnings and fees by vault type"
      aria-busy={loading}
    >
      {error ? (
        <div className="card">
          <p>Vault type breakdown could not be loaded.</p>
          <button type="button" className="page-btn" onClick={retry}>
            Retry vault type breakdown
          </button>
        </div>
      ) : loading ? (
        <SkeletonChart />
      ) : (
        <>
          <FeeBreakdownChart
            {...chartTypes.earnings}
            title="Earnings by Vault Type"
            subtitle="Gross gains less losses"
            metric="earnings"
            data={data[view]}
            series={data.series}
            interval={interval}
          />
          <FeeBreakdownChart
            {...chartTypes.fees}
            title="Fees by Vault Type"
            subtitle="Gross fees charged"
            metric="fees"
            data={data[view]}
            series={data.series}
            interval={interval}
          />
          <p className="text-dim">
            V3 combines allocators and tokenized strategies. V2 factory and legacy categories use Kong’s vault
            classifications.
            {!data.series.some((item) => item.key === 'v1') && ' No V1 history is available in this selection.'}
          </p>
        </>
      )}
    </section>
  )
}
