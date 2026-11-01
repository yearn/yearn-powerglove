import { format, parseISO } from 'date-fns'
import { TrendingUp } from 'lucide-react'
import { useContext, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import APYChart, { APYSeriesSelector, type APYVisibleSeries, buildApyVisibleSeries } from '@/components/charts/APYChart'
import ChartSkeleton from '@/components/charts/ChartSkeleton'
import ChartsLoader from '@/components/charts/ChartsLoader'
import { FixedHeightChartContainer } from '@/components/charts/chart-container'
import {
  type ChartDateRange,
  calculatePpsHistoricalApySeries,
  filterChartTimeframe
} from '@/components/charts/chart-utils'
import { CustomTimeframePicker } from '@/components/charts/custom-timeframe-picker'
import PPSChart from '@/components/charts/PPSChart'
import TVLChart from '@/components/charts/TVLChart'
import YvUsdDualLineChart from '@/components/charts/YvUsdDualLineChart'
import YvUsdTVLChart from '@/components/charts/YvUsdTVLChart'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsMobile } from '@/components/ui/use-mobile'
import { ChartErrorBoundary } from '@/components/utils/ErrorBoundary'
import { PerformanceControlsContext } from '@/components/vault-page/PerformanceControlsContext'
import type { aprApyChartData, ppsChartData, tvlChartData, yvUsdChartData } from '@/types/dataTypes'

type ChartData = {
  aprApyData: aprApyChartData | null
  tvlData: tvlChartData | null
  ppsData: ppsChartData | null
  migrationDate?: string
  isV3Vault?: boolean
  isYBold?: boolean
  isLoading?: boolean
  hasErrors?: boolean
  yvUsdChartData?: {
    unlockedAprApyData: aprApyChartData
    lockedAprApyData: aprApyChartData
    lockedPpsData: ppsChartData
    tvlData: yvUsdChartData
    ppsData: yvUsdChartData
  } | null
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
    mobileLabel: 'APY'
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
  { label: '180 Days', mobileLabel: '180D', value: '180d' },
  { label: '1 Year', mobileLabel: '1Y', value: '1y' },
  { label: 'All Time', mobileLabel: 'All', value: 'all' }
] as const

type Timeframe = (typeof timeframes)[number] | { value: 'custom'; label: string; mobileLabel: string }
type YvUsdSeriesScope = 'primary' | 'both' | 'comparison'

type ApySeriesAvailability = {
  hasEstimatedApy: boolean
  hasEstimatedApy30dAvg: boolean
  hasOracleApy: boolean
  hasYBoldEstimatedApy: boolean
}

export function buildDefaultApyVisibleSeries({
  isV3Vault,
  isYBold,
  hasEstimatedApy,
  hasEstimatedApy30dAvg,
  hasOracleApy,
  hasYBoldEstimatedApy
}: ApySeriesAvailability & { isV3Vault: boolean; isYBold: boolean }): APYVisibleSeries {
  if (!isV3Vault) {
    return buildApyVisibleSeries({
      derivedApy: false,
      sevenDayApy: isYBold,
      thirtyDayApy: true,
      ppsAllTimeApy: true,
      estimatedApy: false,
      estimatedApy30dAvg: true,
      yBoldEstimatedApy: true,
      oracleApy: isYBold,
      oracleApy30dAvg: true
    })
  }

  const useYBoldEstimate = hasYBoldEstimatedApy
  const useEstimate = !useYBoldEstimate && hasEstimatedApy
  const useAveragedEstimate = !useYBoldEstimate && !useEstimate && hasEstimatedApy30dAvg
  const useOracleFallback = !useYBoldEstimate && !useEstimate && !useAveragedEstimate && hasOracleApy

  return buildApyVisibleSeries({
    derivedApy: false,
    sevenDayApy: false,
    thirtyDayApy: true,
    ppsAllTimeApy: true,
    estimatedApy: useEstimate,
    estimatedApy30dAvg: useAveragedEstimate,
    yBoldEstimatedApy: useYBoldEstimate,
    oracleApy: useOracleFallback,
    oracleApy30dAvg: false
  })
}

const yvUsdScopes: Array<{ value: YvUsdSeriesScope; label: string }> = [
  { value: 'primary', label: 'Unlocked' },
  { value: 'both', label: 'Both' },
  { value: 'comparison', label: 'Locked' }
]

function YvUsdScopeControl({
  value,
  onChange
}: {
  value: YvUsdSeriesScope
  onChange: (value: YvUsdSeriesScope) => void
}) {
  return (
    <div className="flex items-center justify-center gap-1" aria-label="yvUSD vault series">
      <span className="mr-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Vault</span>
      {yvUsdScopes.map((scope) => (
        <button
          key={scope.value}
          type="button"
          aria-pressed={value === scope.value}
          onClick={() => onChange(scope.value)}
          className={`rounded-none px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
            value === scope.value ? 'bg-[#0657f9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {scope.label}
        </button>
      ))}
    </div>
  )
}

export function ChartsPanel(data: ChartData) {
  const isMobile = useIsMobile()
  const mobileTimeframeId = useId()
  const performanceControls = useContext(PerformanceControlsContext)
  const fitMobileDrawer = isMobile && Boolean(performanceControls?.closest('[role="dialog"]'))
  const [activeTab, setActiveTab] = useState<ChartTab>('historical-apy')
  const [expandedMobileChart, setExpandedMobileChart] = useState('historical-apy')
  const {
    migrationDate,
    aprApyData,
    tvlData,
    ppsData,
    isV3Vault = false,
    isYBold = false,
    yvUsdChartData,
    isLoading = false,
    hasErrors = false
  } = data
  const [timeframe, setTimeframe] = useState<Timeframe>(timeframes[timeframes.length - 1])
  const [customDateRange, setCustomDateRange] = useState<ChartDateRange | null>(null)
  const chartTimeframe = timeframe.value === 'custom' && customDateRange ? customDateRange : timeframe.value
  const applyCustomRange = (range: ChartDateRange) => {
    const label = `${format(parseISO(range.start), 'MMM d, yyyy')} – ${format(parseISO(range.end), 'MMM d, yyyy')}`
    setCustomDateRange(range)
    setTimeframe({ value: 'custom', label, mobileLabel: label })
    setIsOptionsOpen(false)
  }
  const [apyVisibleSeries, setApyVisibleSeries] = useState<APYVisibleSeries | null>(null)
  const [yvUsdSeriesScope, setYvUsdSeriesScope] = useState<YvUsdSeriesScope>('both')
  const [showCustomTimeframe, setShowCustomTimeframe] = useState(false)
  const [isOptionsOpen, setIsOptionsOpen] = useState(false)

  if (hasErrors) {
    return (
      <div className="bg-white">
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

  const activeAprApyData = yvUsdChartData?.unlockedAprApyData ?? aprApyData
  const filteredAprApyData = filterChartTimeframe(activeAprApyData, chartTimeframe)
  const hasYvUsdChartData = Boolean(yvUsdChartData)
  const historicalApySeries = calculatePpsHistoricalApySeries(ppsData)
  const lockedHistoricalApySeries = yvUsdChartData
    ? calculatePpsHistoricalApySeries(yvUsdChartData.lockedPpsData)
    : null
  const hasOracleApy = filteredAprApyData.some((point) => typeof point.oracleApy === 'number')
  const hasOracleApy30dAvg = filteredAprApyData.some((point) => typeof point.oracleApy30dAvg === 'number')
  const hasYBoldEstimatedApy = filteredAprApyData.some((point) => typeof point.yBoldEstimatedApy === 'number')
  const hasEstimatedApy =
    filteredAprApyData.some((point) => typeof point.estimatedApy === 'number') ||
    Boolean(yvUsdChartData?.lockedAprApyData.some((point) => typeof point.estimatedApy === 'number'))
  const hasEstimatedApy30dAvg =
    filteredAprApyData.some((point) => typeof point.estimatedApy30dAvg === 'number') ||
    Boolean(yvUsdChartData?.lockedAprApyData.some((point) => typeof point.estimatedApy30dAvg === 'number'))
  const defaultApyVisibleSeries = buildDefaultApyVisibleSeries({
    isV3Vault,
    isYBold,
    hasEstimatedApy,
    hasEstimatedApy30dAvg,
    hasOracleApy,
    hasYBoldEstimatedApy
  })
  const resolvedApyVisibleSeries = apyVisibleSeries ?? defaultApyVisibleSeries
  const chartInfo = {
    'historical-apy': {
      title: hasYvUsdChartData ? 'yvUSD Performance' : 'Vault Performance',
      description: `Historical return over ${timeframe.label}`,
      mobileDescription: `Historical return over ${timeframe.label}`
    },
    'historical-pps': {
      title: hasYvUsdChartData ? 'yvUSD Share Growth' : 'Vault Share Growth',
      description: hasYvUsdChartData
        ? `Unlocked and locked share values in yvUSD terms over ${timeframe.label}.`
        : `Price Per Share values over ${timeframe.label}.`,
      mobileDescription: hasYvUsdChartData
        ? `Track locked and unlocked share growth over ${timeframe.mobileLabel}.`
        : `Track share price growth over ${timeframe.mobileLabel}.`
    },
    'historical-tvl': {
      title: hasYvUsdChartData ? 'yvUSD Deposits' : 'Total Value Deposited',
      description: hasYvUsdChartData
        ? `Unlocked and locked deposits over ${timeframe.label}.`
        : `Value deposited in vault over ${timeframe.label}.`,
      mobileDescription: hasYvUsdChartData
        ? `Review locked and unlocked TVL over ${timeframe.mobileLabel}.`
        : `Review TVL changes over ${timeframe.mobileLabel}.`
    }
  } satisfies Record<ChartTab, { title: string; description: string; mobileDescription: string }>

  const activeChartInfo = chartInfo[activeTab]
  const showGhostedOverlay = !isMobile
  const chartHeightClassName = fitMobileDrawer
    ? 'h-full min-h-0'
    : isMobile
      ? 'h-[clamp(160px,calc(100dvh-22rem),260px)]'
      : 'h-[320px] lg:h-[400px]'
  const desktopAlignedChartBottom = 16
  const chartOverlayYAxisWidthByTab = {
    'historical-apy': 60,
    'historical-pps': 60,
    'historical-tvl': 68
  } satisfies Record<ChartTab, number>

  const chartBody = (() => {
    const activeData =
      activeTab === 'historical-apy'
        ? activeAprApyData
        : activeTab === 'historical-pps'
          ? (yvUsdChartData?.ppsData ?? ppsData)
          : (yvUsdChartData?.tvlData ?? tvlData)
    if (
      timeframe.value === 'custom' &&
      filterChartTimeframe<{ date: string }>(activeData, chartTimeframe).length === 0
    ) {
      return (
        <output className={`${chartHeightClassName} flex items-center justify-center text-sm text-gray-500`}>
          No chart data available for this date range.
        </output>
      )
    }
    switch (activeTab) {
      case 'historical-apy':
        if (yvUsdChartData) {
          return (
            <FixedHeightChartContainer heightClassName={chartHeightClassName}>
              <ChartErrorBoundary>
                <APYChart
                  chartData={yvUsdChartData.unlockedAprApyData}
                  comparisonChartData={yvUsdChartData.lockedAprApyData}
                  primaryLabel="Unlocked yvUSD"
                  comparisonLabel="Locked yvUSD"
                  timeframe={chartTimeframe}
                  visibleSeries={resolvedApyVisibleSeries}
                  onVisibleSeriesChange={setApyVisibleSeries}
                  hideSeriesControls={true}
                  seriesScope={yvUsdSeriesScope}
                  historicalApySeries={historicalApySeries}
                  lockedHistoricalApySeries={lockedHistoricalApySeries}
                />
              </ChartErrorBoundary>
            </FixedHeightChartContainer>
          )
        }

        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              <APYChart
                chartData={aprApyData}
                migrationDate={migrationDate}
                timeframe={chartTimeframe}
                visibleSeries={resolvedApyVisibleSeries}
                onVisibleSeriesChange={setApyVisibleSeries}
                hideSeriesControls={true}
                historicalApySeries={historicalApySeries}
              />
            </ChartErrorBoundary>
            {showGhostedOverlay && (
              <div className="pointer-events-none absolute inset-0 opacity-10">
                <ChartErrorBoundary>
                  <TVLChart
                    chartData={tvlData}
                    timeframe={chartTimeframe}
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
        if (yvUsdChartData) {
          return (
            <FixedHeightChartContainer heightClassName={chartHeightClassName}>
              <ChartErrorBoundary>
                <YvUsdDualLineChart chartData={yvUsdChartData.ppsData} timeframe={chartTimeframe} valueType="pps" />
              </ChartErrorBoundary>
            </FixedHeightChartContainer>
          )
        }

        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              <PPSChart chartData={ppsData} timeframe={chartTimeframe} migrationDate={migrationDate} />
            </ChartErrorBoundary>
            {showGhostedOverlay && (
              <div className="pointer-events-none absolute inset-0 opacity-30">
                <ChartErrorBoundary>
                  <APYChart
                    chartData={aprApyData}
                    timeframe={chartTimeframe}
                    hideAxes={true}
                    hideTooltip={true}
                    chartMargin={{ bottom: desktopAlignedChartBottom }}
                    yAxisWidth={chartOverlayYAxisWidthByTab[activeTab]}
                    defaultVisibleSeries={{
                      sevenDayApy: false,
                      thirtyDayApy: false,
                      derivedApy: true,
                      oracleApy: false,
                      oracleApy30dAvg: false
                    }}
                  />
                </ChartErrorBoundary>
              </div>
            )}
          </FixedHeightChartContainer>
        )
      case 'historical-tvl':
        if (yvUsdChartData) {
          return (
            <FixedHeightChartContainer heightClassName={chartHeightClassName}>
              <ChartErrorBoundary>
                <YvUsdTVLChart chartData={yvUsdChartData.tvlData} timeframe={chartTimeframe} />
              </ChartErrorBoundary>
            </FixedHeightChartContainer>
          )
        }

        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              <TVLChart chartData={tvlData} timeframe={chartTimeframe} migrationDate={migrationDate} />
            </ChartErrorBoundary>
            {showGhostedOverlay && (
              <div className="pointer-events-none absolute inset-0 opacity-30">
                <ChartErrorBoundary>
                  <APYChart
                    chartData={aprApyData}
                    timeframe={chartTimeframe}
                    hideAxes={true}
                    hideTooltip={true}
                    chartMargin={{ bottom: desktopAlignedChartBottom }}
                    yAxisWidth={chartOverlayYAxisWidthByTab[activeTab]}
                    defaultVisibleSeries={{
                      sevenDayApy: false,
                      thirtyDayApy: true,
                      derivedApy: false,
                      oracleApy: false,
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

  const desktopChartDescription = (
    <div className="space-y-1">
      <div className="text-sm font-medium">{activeChartInfo.title}</div>
      <div className="text-xs text-gray-500">{activeChartInfo.description}</div>
    </div>
  )

  const mobileChartControls = (
    <Drawer open={isOptionsOpen} onOpenChange={setIsOptionsOpen} shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="h-6 shrink-0 rounded-none px-2 py-0 text-xs">
          Options
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85dvh] bg-white">
        <DrawerHeader>
          <DrawerTitle>Chart options</DrawerTitle>
          <DrawerDescription>Choose the timeframe and data shown in the chart.</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2">
          {hasYvUsdChartData && (isMobile || activeTab === 'historical-apy') ? (
            <YvUsdScopeControl value={yvUsdSeriesScope} onChange={setYvUsdSeriesScope} />
          ) : null}
          <div className="space-y-2">
            <label htmlFor={mobileTimeframeId} className="text-sm font-medium">
              Timeframe
            </label>
            <select
              id={mobileTimeframeId}
              value={showCustomTimeframe ? 'custom' : timeframe.value}
              onChange={(event) => {
                const selected = timeframes.find((item) => item.value === event.target.value)
                setShowCustomTimeframe(event.target.value === 'custom')
                if (selected) setTimeframe(selected)
              }}
              className="h-10 w-full border border-border bg-white px-3 text-sm"
            >
              {timeframes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {showCustomTimeframe || timeframe.value === 'custom' ? (
              <CustomTimeframePicker
                value={customDateRange}
                active={timeframe.value === 'custom'}
                onApply={applyCustomRange}
                className="w-full border border-border px-3 py-2 text-sm"
              />
            ) : null}
          </div>
          {isMobile || activeTab === 'historical-apy' ? (
            <APYSeriesSelector
              inline
              visibleSeries={resolvedApyVisibleSeries}
              onVisibleSeriesChange={setApyVisibleSeries}
              historicalApySeries={historicalApySeries}
              lockedHistoricalApySeries={lockedHistoricalApySeries}
              hasOracleApy={hasOracleApy}
              hasOracleApy30dAvg={hasOracleApy30dAvg}
              hasYBoldEstimatedApy={hasYBoldEstimatedApy}
              hasEstimatedApy={hasEstimatedApy}
              hasEstimatedApy30dAvg={hasEstimatedApy30dAvg}
            />
          ) : null}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" className="rounded-none">
              Done
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )

  const desktopChartControls = (
    <div className="flex flex-wrap gap-2">
      {timeframes.map((tf) => (
        <button
          key={tf.value}
          aria-pressed={timeframe.value === tf.value}
          onClick={() => setTimeframe(tf)}
          className={`min-w-0 rounded-none px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${
            timeframe.value === tf.value ? 'bg-[#0657f9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          type="button"
        >
          {tf.label}
        </button>
      ))}
      <CustomTimeframePicker
        value={customDateRange}
        active={timeframe.value === 'custom'}
        onApply={applyCustomRange}
        className={`min-w-0 rounded-none px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${timeframe.value === 'custom' ? 'bg-[#0657f9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      />
    </div>
  )

  const desktopApySeriesControls = (
    <div className="flex justify-center">
      <APYSeriesSelector
        visibleSeries={resolvedApyVisibleSeries}
        onVisibleSeriesChange={setApyVisibleSeries}
        historicalApySeries={historicalApySeries}
        lockedHistoricalApySeries={lockedHistoricalApySeries}
        hasOracleApy={hasOracleApy}
        hasOracleApy30dAvg={hasOracleApy30dAvg}
        hasYBoldEstimatedApy={hasYBoldEstimatedApy}
        hasEstimatedApy={hasEstimatedApy}
        hasEstimatedApy30dAvg={hasEstimatedApy30dAvg}
        className="w-full justify-center"
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
      <div className={fitMobileDrawer ? 'flex h-full min-h-0 flex-col bg-white' : 'bg-white'}>
        {performanceControls ? (
          createPortal(mobileChartControls, performanceControls)
        ) : (
          <div className="flex justify-end px-4 py-3">{mobileChartControls}</div>
        )}
        <Accordion
          className={fitMobileDrawer ? 'flex min-h-0 flex-1 flex-col' : undefined}
          type="single"
          value={expandedMobileChart}
          onValueChange={(value) => {
            setExpandedMobileChart(value)
            if (value) setActiveTab(value as ChartTab)
          }}
        >
          {chartTabs.map((tab) => (
            <AccordionItem
              key={tab.value}
              value={tab.value}
              className={`border-t border-border [&:not(:last-child)]:border-b-0 ${fitMobileDrawer ? 'flex min-h-0 flex-col [&>h3]:shrink-0 data-[state=open]:flex-1 data-[state=closed]:shrink-0' : ''}`}
            >
              <AccordionTrigger className="pl-8 pr-4 py-3 text-sm text-left transition-none [&>svg]:transition-none hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9]">
                <span className="flex items-center gap-2">
                  <TrendingUp aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {tab.mobileLabel}
                </span>
              </AccordionTrigger>
              <AccordionContent
                animated={false}
                containerClassName={fitMobileDrawer ? 'min-h-0 flex-1' : undefined}
                className={fitMobileDrawer ? 'h-full pb-0' : 'pb-0'}
              >
                {expandedMobileChart === tab.value ? (
                  <div className={fitMobileDrawer ? 'h-full min-h-0 p-3' : 'p-4'}>{chartBody}</div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <Tabs
        value={activeTab}
        className="w-full"
        onValueChange={(value) => {
          setActiveTab(value as ChartTab)
        }}
      >
        <div className="border-b border-border">
          <div className="px-4 sm:px-6">
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
          {activeTab === 'historical-apy' && (
            <div className="space-y-3">
              {hasYvUsdChartData ? <YvUsdScopeControl value={yvUsdSeriesScope} onChange={setYvUsdSeriesScope} /> : null}
              {desktopApySeriesControls}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  )
}
