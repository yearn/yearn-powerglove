import { useMemo, useState } from 'react'
import APYChart from '@/components/charts/APYChart'
import ChartSkeleton from '@/components/charts/ChartSkeleton'
import ChartsLoader from '@/components/charts/ChartsLoader'
import { FixedHeightChartContainer } from '@/components/charts/chart-container'
import PPSChart from '@/components/charts/PPSChart'
import TVLChart from '@/components/charts/TVLChart'
import { useIsMobile } from '@/components/ui/use-mobile'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartErrorBoundary } from '@/components/utils/ErrorBoundary'
import type { aprApyChartData, ppsChartData, tvlChartData } from '@/types/dataTypes'

type ChartData = {
  aprApyData: aprApyChartData | null
  tvlData: tvlChartData | null
  ppsData: ppsChartData | null
  isLoading?: boolean
  hasErrors?: boolean
}

type ChartTab = 'historical-apy' | 'historical-pps' | 'historical-tvl'

const chartTabs: Array<{
  value: ChartTab
  label: string
  mobileLabel: string
}> = [
  { value: 'historical-apy', label: 'Historical Performance', mobileLabel: 'Performance' },
  { value: 'historical-pps', label: 'Historical Share Growth', mobileLabel: 'Share Growth' },
  { value: 'historical-tvl', label: 'Historical TVL', mobileLabel: 'TVL' }
]

const timeframes = [
  { label: '30 Days', mobileLabel: '30D', value: '30d' },
  { label: '90 Days', mobileLabel: '90D', value: '90d' },
  { label: '1 Year', mobileLabel: '1Y', value: '1y' },
  { label: 'All Time', mobileLabel: 'All', value: 'all' }
] as const

export function ChartsPanel(data: ChartData) {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<ChartTab>('historical-apy')
  const { aprApyData, tvlData, ppsData, isLoading = false, hasErrors = false } = data
  const [timeframe, setTimeframe] = useState(timeframes[3])

  if (hasErrors) {
    return (
      <div className="border-x border-border bg-white">
        <div className="flex h-96 items-center justify-center">
          <div className="text-red-500">Error loading chart data</div>
        </div>
      </div>
    )
  }

  if (isLoading || !aprApyData || !tvlData || !ppsData) {
    return (
      <div className="relative">
        <ChartSkeleton />
        <ChartsLoader loadingState={isLoading ? 'loading charts' : 'preparing charts'} />
      </div>
    )
  }

  const chartInfo = {
    'historical-apy': {
      title: 'Vault Performance',
      description: `1-Day, 7-Day, and 30-Day APYs over ${timeframe.label}.`,
      mobileDescription: `Compare APY trends over ${timeframe.mobileLabel}.`
    },
    'historical-pps': {
      title: 'Vault Share Growth',
      description: `Price Per Share values over ${timeframe.label}.`,
      mobileDescription: `Track share price growth over ${timeframe.mobileLabel}.`
    },
    'historical-tvl': {
      title: 'Total Value Deposited',
      description: `Value deposited in vault over ${timeframe.label}.`,
      mobileDescription: `Review TVL changes over ${timeframe.mobileLabel}.`
    }
  } satisfies Record<ChartTab, { title: string; description: string; mobileDescription: string }>

  const activeChartInfo = chartInfo[activeTab]
  const showGhostedOverlay = !isMobile
  const chartHeightClassName = isMobile ? 'h-[260px]' : 'h-[320px] lg:h-[400px]'

  const chartBody = useMemo(() => {
    switch (activeTab) {
      case 'historical-apy':
        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              <APYChart chartData={aprApyData} timeframe={timeframe.value} />
            </ChartErrorBoundary>
            {showGhostedOverlay && (
              <div className="pointer-events-none absolute inset-0 opacity-10">
                <ChartErrorBoundary>
                  <TVLChart chartData={tvlData} timeframe={timeframe.value} hideAxes={true} hideTooltip={true} />
                </ChartErrorBoundary>
              </div>
            )}
          </FixedHeightChartContainer>
        )
      case 'historical-pps':
        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              <PPSChart chartData={ppsData} timeframe={timeframe.value} />
            </ChartErrorBoundary>
            {showGhostedOverlay && (
              <div className="pointer-events-none absolute inset-0 opacity-30">
                <ChartErrorBoundary>
                  <APYChart
                    chartData={aprApyData}
                    timeframe={timeframe.value}
                    hideAxes={true}
                    hideTooltip={true}
                    defaultVisibleSeries={{
                      sevenDayApy: false,
                      thirtyDayApy: false,
                      derivedApy: true,
                      oracleApr: false,
                      oracleApy30dAvg: false
                    }}
                  />
                </ChartErrorBoundary>
              </div>
            )}
          </FixedHeightChartContainer>
        )
      case 'historical-tvl':
        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              <TVLChart chartData={tvlData} timeframe={timeframe.value} />
            </ChartErrorBoundary>
            {showGhostedOverlay && (
              <div className="pointer-events-none absolute inset-0 opacity-30">
                <ChartErrorBoundary>
                  <APYChart
                    chartData={aprApyData}
                    timeframe={timeframe.value}
                    hideAxes={true}
                    hideTooltip={true}
                    defaultVisibleSeries={{
                      sevenDayApy: false,
                      thirtyDayApy: true,
                      derivedApy: false,
                      oracleApr: false,
                      oracleApy30dAvg: false
                    }}
                  />
                </ChartErrorBoundary>
              </div>
            )}
          </FixedHeightChartContainer>
        )
    }
  }, [activeTab, aprApyData, chartHeightClassName, ppsData, showGhostedOverlay, timeframe.value, tvlData])

  return (
    <div className="border-x border-border bg-white">
      <Tabs value={activeTab} className="w-full" onValueChange={(value) => setActiveTab(value as ChartTab)}>
        <div className="border-b border-border">
          <div className="px-4 pt-4 sm:px-6">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:w-fit sm:grid-cols-3 sm:gap-0">
              {chartTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-auto rounded-none border border-border px-4 py-3 text-left text-sm data-[state=active]:border-[#0657f9] data-[state=active]:bg-[#0657f9]/5 data-[state=active]:text-foreground data-[state=active]:shadow-none sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:text-center"
                >
                  {isMobile ? tab.mobileLabel : tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">{activeChartInfo.title}</div>
              <div className="text-xs text-gray-500">
                {isMobile ? activeChartInfo.mobileDescription : activeChartInfo.description}
              </div>
              {isMobile && (
                <div className="text-[11px] text-gray-400">Tap the series toggles below the chart to simplify the view.</div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
              {timeframes.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf)}
                  className={`min-w-0 rounded-md px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${
                    timeframe.value === tf.value
                      ? 'bg-[#0657f9] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  type="button"
                >
                  {isMobile ? tf.mobileLabel : tf.label}
                </button>
              ))}
            </div>
          </div>

          <TabsContent value="historical-apy" className="mt-0">
            {activeTab === 'historical-apy' ? chartBody : null}
          </TabsContent>

          <TabsContent value="historical-pps" className="mt-0">
            {activeTab === 'historical-pps' ? chartBody : null}
          </TabsContent>

          <TabsContent value="historical-tvl" className="mt-0">
            {activeTab === 'historical-tvl' ? chartBody : null}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
