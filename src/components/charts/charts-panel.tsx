import { useState } from 'react'
import APYChart, {
  APYSeriesSelector,
  type APYVisibleSeries,
  buildApyVisibleSeries,
  getAvailableApySeries
} from '@/components/charts/APYChart'
import ChartSkeleton from '@/components/charts/ChartSkeleton'
import ChartsLoader from '@/components/charts/ChartsLoader'
import { FixedHeightChartContainer } from '@/components/charts/chart-container'
import { calculatePpsPeriodApy, getTimeframeLimit } from '@/components/charts/chart-utils'
import PPSChart from '@/components/charts/PPSChart'
import TVLChart from '@/components/charts/TVLChart'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/components/ui/use-mobile'
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
  {
    value: 'historical-apy',
    label: 'Historical Performance',
    mobileLabel: 'Performance'
  },
  {
    value: 'historical-pps',
    label: 'Historical Share Growth',
    mobileLabel: 'Share Growth'
  },
  { value: 'historical-tvl', label: 'Historical TVL', mobileLabel: 'TVL' }
]

const timeframes = [
  { label: '30 Days', mobileLabel: '30D', value: '30d' },
  { label: '90 Days', mobileLabel: '90D', value: '90d' },
  { label: '1 Year', mobileLabel: '1Y', value: '1y' },
  { label: 'All Time', mobileLabel: 'All', value: 'all' }
] as const

type Timeframe = (typeof timeframes)[number]

export function ChartsPanel(data: ChartData) {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<ChartTab>('historical-apy')
  const { aprApyData, tvlData, ppsData, isLoading = false, hasErrors = false } = data
  const [timeframe, setTimeframe] = useState<Timeframe>(timeframes[3])
  const [apyVisibleSeries, setApyVisibleSeries] = useState<APYVisibleSeries>(() =>
    buildApyVisibleSeries({
      derivedApy: false,
      sevenDayApy: false,
      thirtyDayApy: true,
      ppsPeriodApy: true,
      oracleApr: false,
      oracleApy30dAvg: true
    })
  )
  const [isTimeframeDialogOpen, setIsTimeframeDialogOpen] = useState(false)
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false)

  if (hasErrors) {
    return (
      <div className="bg-white sm:border-x sm:border-border">
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

  const filteredAprApyData = aprApyData.slice(-getTimeframeLimit(timeframe.value))
  const ppsPeriodApy = calculatePpsPeriodApy(ppsData, timeframe.value)
  const hasPpsPeriodApy = typeof ppsPeriodApy === 'number'
  const hasOracleApr = filteredAprApyData.some((point) => typeof point.oracleApr === 'number')
  const hasOracleApy30dAvg = filteredAprApyData.some((point) => typeof point.oracleApy30dAvg === 'number')
  const availableApySeries = getAvailableApySeries({
    hasPpsPeriodApy,
    hasOracleApr,
    hasOracleApy30dAvg
  })
  const selectedApySeriesCount = availableApySeries.filter((seriesKey) => apyVisibleSeries[seriesKey]).length

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
  const desktopAlignedChartBottom = 16
  const chartOverlayYAxisWidthByTab = {
    'historical-apy': 60,
    'historical-pps': 60,
    'historical-tvl': 68
  } satisfies Record<ChartTab, number>

  const chartBody = (() => {
    switch (activeTab) {
      case 'historical-apy':
        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              <APYChart
                chartData={aprApyData}
                timeframe={timeframe.value}
                visibleSeries={apyVisibleSeries}
                onVisibleSeriesChange={setApyVisibleSeries}
                hideSeriesControls={true}
                ppsPeriodApy={ppsPeriodApy}
              />
            </ChartErrorBoundary>
            {showGhostedOverlay && (
              <div className="pointer-events-none absolute inset-0 opacity-10">
                <ChartErrorBoundary>
                  <TVLChart
                    chartData={tvlData}
                    timeframe={timeframe.value}
                    hideAxes={true}
                    hideTooltip={true}
                    chartMargin={{ bottom: desktopAlignedChartBottom }}
                    yAxisWidth={chartOverlayYAxisWidthByTab['historical-apy']}
                  />
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
                    chartMargin={{ bottom: desktopAlignedChartBottom }}
                    yAxisWidth={chartOverlayYAxisWidthByTab[activeTab]}
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
                    chartMargin={{ bottom: desktopAlignedChartBottom }}
                    yAxisWidth={chartOverlayYAxisWidthByTab[activeTab]}
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
      default:
        return null
    }
  })()

  const mobileChartDescription = (
    <div className="space-y-1">
      <div className="text-sm font-medium">{activeChartInfo.title}</div>
      <div className="text-xs text-gray-500">{activeChartInfo.mobileDescription}</div>
    </div>
  )

  const desktopChartDescription = (
    <div className="space-y-1">
      <div className="text-sm font-medium">{activeChartInfo.title}</div>
      <div className="text-xs text-gray-500">{activeChartInfo.description}</div>
    </div>
  )

  const mobileChartControls = (
    <div className="flex flex-col gap-4">
      <div className="grid w-full grid-cols-2 gap-2">
        <Dialog open={isTimeframeDialogOpen} onOpenChange={setIsTimeframeDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="flex h-auto flex-col items-start rounded-md border-border px-3 py-2 text-left"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Timeframe</span>
              <span className="text-sm text-foreground">{timeframe.mobileLabel}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] rounded-lg p-4 sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Timeframe</DialogTitle>
              <DialogDescription>Choose the time window for the active chart.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {timeframes.map((tf) => (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => {
                    setTimeframe(tf)
                    setIsTimeframeDialogOpen(false)
                  }}
                  className={`rounded-md border px-3 py-3 text-left text-sm font-medium transition-colors ${
                    timeframe.value === tf.value
                      ? 'border-[#0657f9] bg-[#0657f9]/5 text-[#0657f9]'
                      : 'border-border text-foreground hover:bg-gray-50'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDataDialogOpen} onOpenChange={setIsDataDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={activeTab !== 'historical-apy'}
              className="flex h-auto flex-col items-start rounded-md border-border px-3 py-2 text-left disabled:opacity-40"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Data</span>
              <span className="text-sm text-foreground">
                {activeTab === 'historical-apy' ? `${selectedApySeriesCount} series` : 'Unavailable'}
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] rounded-lg p-4 sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Data</DialogTitle>
              <DialogDescription>Choose which APY series are visible on the chart.</DialogDescription>
            </DialogHeader>
            <APYSeriesSelector
              visibleSeries={apyVisibleSeries}
              onVisibleSeriesChange={setApyVisibleSeries}
              hasPpsPeriodApy={hasPpsPeriodApy}
              hasOracleApr={hasOracleApr}
              hasOracleApy30dAvg={hasOracleApy30dAvg}
              className="grid gap-2 border-none bg-transparent p-0"
              itemClassName="min-w-0 rounded-md border border-border px-3 py-3"
              idPrefix="dialog-toggle"
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )

  const desktopChartControls = (
    <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
      {timeframes.map((tf) => (
        <button
          key={tf.value}
          onClick={() => setTimeframe(tf)}
          className={`min-w-0 rounded-md px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${
            timeframe.value === tf.value ? 'bg-[#0657f9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          type="button"
        >
          {tf.label}
        </button>
      ))}
    </div>
  )

  const desktopApySeriesControls = (
    <div className="flex justify-center">
      <APYSeriesSelector
        visibleSeries={apyVisibleSeries}
        onVisibleSeriesChange={setApyVisibleSeries}
        hasPpsPeriodApy={hasPpsPeriodApy}
        hasOracleApr={hasOracleApr}
        hasOracleApy30dAvg={hasOracleApy30dAvg}
        compact={true}
        className="w-full justify-center bg-transparent p-0 text-xs sm:text-sm"
        itemClassName="min-w-0 rounded-md px-3 py-2"
        idPrefix="desktop-chart-toggle"
      />
    </div>
  )

  const chartTabContent = (
    <>
      <TabsContent value="historical-apy" className="mt-0">
        {activeTab === 'historical-apy' ? chartBody : null}
      </TabsContent>
      <TabsContent value="historical-pps" className="mt-0">
        {activeTab === 'historical-pps' ? chartBody : null}
      </TabsContent>
      <TabsContent value="historical-tvl" className="mt-0">
        {activeTab === 'historical-tvl' ? chartBody : null}
      </TabsContent>
    </>
  )

  if (isMobile) {
    return (
      <div className="bg-white border-x border-border">
        <Tabs
          value={activeTab}
          className="w-full"
          onValueChange={(value) => {
            const nextTab = value as ChartTab
            setActiveTab(nextTab)
            if (nextTab !== 'historical-apy') {
              setIsDataDialogOpen(false)
            }
          }}
        >
          <div className="border-b border-border">
            <div className="px-4 pt-4 sm:px-6">
              <TabsList className="grid h-auto w-full grid-cols-3 gap-0 bg-transparent p-0">
                {chartTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex min-w-0 rounded-none border border-border px-2 py-3 text-center text-sm data-[state=active]:border-[#0657f9] data-[state=active]:bg-[#0657f9]/5 data-[state=active]:text-foreground data-[state=active]:shadow-none sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:px-4"
                  >
                    {tab.mobileLabel}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-6">
            <div className="border-b border-border pb-4">{mobileChartDescription}</div>
            {chartTabContent}
            {mobileChartControls}
          </div>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="bg-white border-x border-border">
      <Tabs
        value={activeTab}
        className="w-full"
        onValueChange={(value) => {
          const nextTab = value as ChartTab
          setActiveTab(nextTab)
          if (nextTab !== 'historical-apy') {
            setIsDataDialogOpen(false)
          }
        }}
      >
        <div className="border-b border-border">
          <div className="px-4 pt-4 sm:px-6">
            <TabsList className="grid h-auto w-fit grid-cols-3 gap-0 bg-transparent p-0">
              {chartTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent px-4 py-2 text-left text-sm data-[state=active]:border-[#0657f9] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="space-y-0 p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">{desktopChartDescription}</div>
            <div className="shrink-0">{desktopChartControls}</div>
          </div>
          {chartTabContent}
          {activeTab === 'historical-apy' && desktopApySeriesControls}
        </div>
      </Tabs>
    </div>
  )
}
