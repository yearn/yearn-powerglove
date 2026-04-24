import React from 'react'
import APYChart from '@/components/charts/APYChart'
import { FixedHeightChartContainer } from '@/components/charts/chart-container'
import TVLChart from '@/components/charts/TVLChart'
import { ChartErrorBoundary } from '@/components/utils/ErrorBoundary'
import type { ChainId } from '@/constants/chains'
import { useStrategiesData } from '@/hooks/useStrategiesData'
import { formatAllocationPercent } from '@/lib/formatters'
import type { aprApyChartData, tvlChartData } from '@/types/dataTypes'
import type { VaultExtended } from '@/types/vaultTypes'

interface VaultOverviewTabProps {
  vaultChainId: ChainId
  vaultDetails: VaultExtended
  description: string
  aprApyData: aprApyChartData | null
  tvlData: tvlChartData | null
  isChartsLoading?: boolean
  hasChartsError?: boolean
}

const overviewChartHeightClassName = 'h-44 sm:h-52'
const overviewChartTimeframe = '1y'
const overviewChartMargin = { top: 8, right: 8, left: 0, bottom: 8 }
const overviewChartYAxisWidth = 64

const OverviewChartCard = ({
  type,
  aprApyData,
  tvlData,
  isLoading
}: {
  type: 'apy' | 'tvl'
  aprApyData: aprApyChartData | null
  tvlData: tvlChartData | null
  isLoading?: boolean
}) => {
  const isApyChart = type === 'apy'
  const hasForegroundData = isApyChart ? Boolean(aprApyData?.length) : Boolean(tvlData?.length)

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[#111111]">{isApyChart ? '1-year APY' : '1-year TVL'}</h3>
          <p className="mt-1 text-xs text-[#808080]">
            {isApyChart ? 'TVL shown as ghosted context' : '30-day APY shown as ghosted context'}
          </p>
        </div>
        <span className="shrink-0 text-xs text-[#808080]">1y</span>
      </div>
      {isLoading ? (
        <div className={overviewChartHeightClassName}>
          <div className="h-full animate-pulse bg-[#f5f5f5]" />
        </div>
      ) : hasForegroundData ? (
        <FixedHeightChartContainer heightClassName={overviewChartHeightClassName}>
          <div className="relative h-full w-full">
            {isApyChart ? (
              <>
                {tvlData?.length ? (
                  <div className="pointer-events-none absolute inset-0 z-10 opacity-10">
                    <ChartErrorBoundary>
                      <TVLChart
                        chartData={tvlData}
                        timeframe={overviewChartTimeframe}
                        hideAxes={true}
                        hideTooltip={true}
                        chartMargin={overviewChartMargin}
                        yAxisWidth={overviewChartYAxisWidth}
                      />
                    </ChartErrorBoundary>
                  </div>
                ) : null}

                <div className="absolute inset-0 z-20">
                  <ChartErrorBoundary>
                    <APYChart
                      chartData={aprApyData ?? []}
                      timeframe={overviewChartTimeframe}
                      hideSeriesControls={true}
                      chartMargin={overviewChartMargin}
                      yAxisWidth={overviewChartYAxisWidth}
                      defaultVisibleSeries={{
                        derivedApy: false,
                        sevenDayApy: false,
                        thirtyDayApy: true,
                        ppsPeriodApy: false,
                        oracleApr: false,
                        oracleApy30dAvg: false
                      }}
                    />
                  </ChartErrorBoundary>
                </div>
              </>
            ) : (
              <>
                {aprApyData?.length ? (
                  <div className="pointer-events-none absolute inset-0 z-10 opacity-30">
                    <ChartErrorBoundary>
                      <APYChart
                        chartData={aprApyData}
                        timeframe={overviewChartTimeframe}
                        hideAxes={true}
                        hideTooltip={true}
                        chartMargin={overviewChartMargin}
                        yAxisWidth={overviewChartYAxisWidth}
                        defaultVisibleSeries={{
                          derivedApy: false,
                          sevenDayApy: false,
                          thirtyDayApy: true,
                          ppsPeriodApy: false,
                          oracleApr: false,
                          oracleApy30dAvg: false
                        }}
                      />
                    </ChartErrorBoundary>
                  </div>
                ) : null}

                <div className="absolute inset-0 z-20">
                  <ChartErrorBoundary>
                    <TVLChart
                      chartData={tvlData ?? []}
                      timeframe={overviewChartTimeframe}
                      chartMargin={overviewChartMargin}
                      yAxisWidth={overviewChartYAxisWidth}
                    />
                  </ChartErrorBoundary>
                </div>
              </>
            )}
          </div>
        </FixedHeightChartContainer>
      ) : (
        <div className={`${overviewChartHeightClassName} flex items-center justify-center text-sm text-[#808080]`}>
          No chart data
        </div>
      )}
    </div>
  )
}

export const VaultOverviewTab: React.FC<VaultOverviewTabProps> = React.memo(
  ({
    vaultChainId,
    vaultDetails,
    description,
    aprApyData,
    tvlData,
    isChartsLoading = false,
    hasChartsError = false
  }) => {
    const strategiesData = useStrategiesData(vaultChainId, vaultDetails)

    const allocatedStrategies = React.useMemo(() => {
      return strategiesData.strategies
        .filter((strategy) => strategy.allocationPercent > 0)
        .sort((a, b) => b.allocationPercent - a.allocationPercent)
    }, [strategiesData.strategies])

    const unallocatedStrategies = React.useMemo(() => {
      return strategiesData.strategies.filter((strategy) => strategy.allocationPercent <= 0)
    }, [strategiesData.strategies])

    const topAllocatedStrategies = allocatedStrategies.slice(0, 5)
    const allocatedPercent = allocatedStrategies.reduce((sum, strategy) => sum + strategy.allocationPercent, 0)
    const topStrategyAllocation = allocatedStrategies[0]?.allocationPercent ?? 0
    const idlePercent = Math.max(0, 100 - allocatedPercent)
    const hasChartIssue = hasChartsError && !isChartsLoading

    const concentrationLabel =
      topStrategyAllocation >= 75
        ? 'High concentration'
        : topStrategyAllocation >= 40
          ? 'Moderate concentration'
          : 'Distributed'
    const vaultStandard = [vaultDetails.v3 ? 'V3 vault' : 'Legacy vault', vaultDetails.erc4626 ? 'ERC-4626' : null]
      .filter(Boolean)
      .join(' | ')
    const protocols = vaultDetails.meta?.protocols?.length ? vaultDetails.meta.protocols.join(', ') : 'Not specified'
    const riskProfileRows = [
      {
        label: 'Strategy Concentration',
        value: `${concentrationLabel} | top ${formatAllocationPercent(topStrategyAllocation)}`
      },
      {
        label: 'Idle Allocation',
        value: `${formatAllocationPercent(idlePercent)} unallocated`
      },
      {
        label: 'Active Set',
        value: `${allocatedStrategies.length} active | ${unallocatedStrategies.length} unallocated`
      },
      {
        label: 'Vault Standard',
        value: vaultStandard
      },
      {
        label: 'Yearn Status',
        value: vaultDetails.yearn ? 'Yearn listed' : 'Unlisted'
      },
      {
        label: 'Protocols',
        value: protocols
      }
    ]

    return (
      <div className="border-x border-b border-border bg-white">
        <div className="grid gap-8 p-4 sm:p-6 lg:grid-cols-2 lg:gap-14 xl:gap-20">
          <div className="min-w-0">
            <section className="pb-6">
              <h2 className="text-lg font-semibold text-[#111111]">Overview</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#4f4f4f]">
                {description || 'No vault description is currently available.'}
              </p>
            </section>

            <section className="pt-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#111111]">Allocated Strategies</h3>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-right text-sm">
                  <div>
                    <dt className="text-xs text-[#808080]">Active</dt>
                    <dd className="font-medium text-[#111111]">{allocatedStrategies.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#808080]">Idle</dt>
                    <dd className="font-medium text-[#111111]">{unallocatedStrategies.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#808080]">Allocated</dt>
                    <dd className="font-medium text-[#111111]">{formatAllocationPercent(allocatedPercent)}</dd>
                  </div>
                </dl>
              </div>

              <div className="border-y border-[#e6e7eb]">
                {topAllocatedStrategies.length > 0 ? (
                  topAllocatedStrategies.map((strategy) => (
                    <div
                      key={strategy.id}
                      className="grid gap-2 border-b border-[#f0f0f0] py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_6rem] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[#111111]">{strategy.name}</div>
                      </div>
                      <div className="text-sm font-medium tabular-nums text-[#111111] sm:text-right">
                        {formatAllocationPercent(strategy.allocationPercent)}
                      </div>
                      <div className="text-sm tabular-nums text-[#4f4f4f] sm:text-right">
                        {strategy.allocationAmount}
                      </div>
                      <div className="text-sm tabular-nums text-[#4f4f4f] sm:text-right">
                        {strategy.estimatedAPY} APY
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-sm text-[#808080]">No allocated strategies are currently reported.</div>
                )}
              </div>
            </section>

            <section className="pt-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#111111]">Vault Risk Profile</h3>
                <p className="mt-1 text-sm text-[#808080]">Current allocation and metadata signals.</p>
              </div>

              <dl className="border-y border-[#e6e7eb]">
                {riskProfileRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid gap-1 border-b border-[#f0f0f0] py-3 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
                  >
                    <dt className="text-xs uppercase tracking-[0.1em] text-[#808080]">{row.label}</dt>
                    <dd className="min-w-0 break-words text-sm font-medium text-[#111111]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <aside className="space-y-4">
            {hasChartIssue ? (
              <div className="border border-[#e6e7eb] p-4 text-sm text-[#808080]">Chart data is unavailable.</div>
            ) : (
              <div className="space-y-4">
                <OverviewChartCard type="apy" aprApyData={aprApyData} tvlData={tvlData} isLoading={isChartsLoading} />
                <OverviewChartCard type="tvl" aprApyData={aprApyData} tvlData={tvlData} isLoading={isChartsLoading} />
              </div>
            )}
          </aside>
        </div>
      </div>
    )
  }
)

VaultOverviewTab.displayName = 'VaultOverviewTab'
