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
import EnvioProfitChart from '@/components/charts/EnvioProfitChart'
import LifetimeEarningsChart from '@/components/charts/LifetimeEarningsChart'
import PPSChart from '@/components/charts/PPSChart'
import TVLChart from '@/components/charts/TVLChart'
import UnderlyingTvlChart from '@/components/charts/UnderlyingTvlChart'
import YvUsdDualLineChart from '@/components/charts/YvUsdDualLineChart'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { useIsMobile } from '@/components/ui/use-mobile'
import { ChartErrorBoundary } from '@/components/utils/ErrorBoundary'
import type {
  aprApyChartData,
  ppsChartData,
  tvlChartData,
  vaultEarningsChartData,
  vaultEventProfitChartData,
  yvUsdChartData
} from '@/types/dataTypes'

type ChartData = {
  aprApyData: aprApyChartData | null
  tvlData: tvlChartData | null
  underlyingTvlData: tvlChartData | null
  ppsData: ppsChartData | null
  vaultEarningsData: vaultEarningsChartData | null
  vaultEventProfitData: vaultEventProfitChartData | null
  assetSymbol?: string
  reportHistoryLoading?: boolean
  reportHistoryError?: boolean
  managementEventsLoading?: boolean
  managementEventsError?: boolean
  isLoading?: boolean
  hasErrors?: boolean
  chartHeaderStickyTop?: number
  yvUsdChartData?: {
    aprApyData: yvUsdChartData
    lockedAprApyData: aprApyChartData
    tvlData: yvUsdChartData
    ppsData: yvUsdChartData
  } | null
}

type ChartTab = 'historical-apy' | 'historical-pps' | 'historical-tvl' | 'lifetime-earnings' | 'envio-profit'

const chartSections: Array<{
  value: ChartTab
  label: string
}> = [
  {
    value: 'historical-apy',
    label: 'Historical Performance'
  },
  {
    value: 'historical-pps',
    label: 'Historical Share Growth'
  },
  { value: 'historical-tvl', label: 'Historical TVL' },
  { value: 'lifetime-earnings', label: 'Reported Profit / Fees' },
  { value: 'envio-profit', label: 'Vault Event Profit / Fees' }
]

const timeframes = [
  { label: '30 Days', mobileLabel: '30D', value: '30d' },
  { label: '90 Days', mobileLabel: '90D', value: '90d' },
  { label: '1 Year', mobileLabel: '1Y', value: '1y' },
  { label: 'All Time', mobileLabel: 'All', value: 'all' }
] as const

type Timeframe = (typeof timeframes)[number]
type TvlView = 'total' | 'underlying'

const tvlViewOptions = [
  { label: 'Deposited value', mobileLabel: 'Value', value: 'total' },
  { label: 'Underlying TVL', mobileLabel: 'Underlying', value: 'underlying' }
] as const

export function ChartsPanel(data: ChartData) {
  const isMobile = useIsMobile()
  const {
    aprApyData,
    tvlData,
    underlyingTvlData,
    ppsData,
    vaultEarningsData,
    vaultEventProfitData,
    assetSymbol,
    reportHistoryLoading = false,
    reportHistoryError = false,
    managementEventsLoading = false,
    managementEventsError = false,
    isLoading = false,
    hasErrors = false,
    chartHeaderStickyTop = 54,
    yvUsdChartData
  } = data
  const [timeframe, setTimeframe] = useState<Timeframe>(timeframes[3])
  const [tvlView, setTvlView] = useState<TvlView>('total')
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
      <div className="border-x border-t border-border bg-white">
        <div className="flex h-96 items-center justify-center">
          <div className="text-red-500">Error loading chart data</div>
        </div>
      </div>
    )
  }

  if (isLoading || !aprApyData || !tvlData || !underlyingTvlData || !ppsData) {
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
  const hasVaultProfitSeries = (vaultEarningsData ?? []).some((point) => typeof point.cumulativeGainUsd === 'number')
  const hasVaultFeesSeries = (vaultEarningsData ?? []).some((point) => typeof point.cumulativeFeesUsd === 'number')
  const hasEnvioProfitSeries = (vaultEventProfitData ?? []).some((point) => typeof point.cumulativeProfit === 'number')
  const hasEnvioFeesSeries = (vaultEventProfitData ?? []).some((point) => typeof point.cumulativeFees === 'number')

  const lifetimeChartTitle = hasVaultProfitSeries
    ? 'Cumulative Vault Profits'
    : hasVaultFeesSeries
      ? 'Cumulative Protocol Fees'
      : 'Report History'
  const lifetimeChartDescription = hasVaultProfitSeries
    ? 'Cumulative profit reported back to this vault from StrategyReported history, with cumulative protocol fees overlaid when available.'
    : hasVaultFeesSeries
      ? 'Kong report history does not expose profit USD for this vault, so this chart currently shows cumulative protocol fees only.'
      : 'No gain or fee USD values are currently available in Kong report history for this vault.'
  const lifetimeChartMobileDescription = hasVaultProfitSeries
    ? 'Review cumulative vault profit from report history.'
    : hasVaultFeesSeries
      ? 'Review cumulative protocol fees from report history.'
      : 'No report-history USD values available yet.'

  const envioChartTitle = hasEnvioProfitSeries
    ? 'Cumulative Vault Profit'
    : hasEnvioFeesSeries
      ? 'Cumulative Fees'
      : 'Vault Event Profit / Fees'
  const envioChartDescription = hasEnvioProfitSeries
    ? `Cumulative gain minus loss from Envio StrategyReported events in ${assetSymbol || 'underlying asset'} units, with cumulative fees overlaid when available.`
    : hasEnvioFeesSeries
      ? `Envio StrategyReported events expose cumulative fees for this vault in ${assetSymbol || 'underlying asset'} units, but no profit series was derived.`
      : 'No StrategyReported profit or fee events are available yet from Envio for this vault.'
  const envioChartMobileDescription = hasEnvioProfitSeries
    ? `Review cumulative event-level profit in ${assetSymbol || 'asset'} units.`
    : hasEnvioFeesSeries
      ? `Review cumulative event-level fees in ${assetSymbol || 'asset'} units.`
      : 'No Envio strategy report events available yet.'

  const hasYvUsdChartData = Boolean(yvUsdChartData)

  const chartInfo = {
    'historical-apy': {
      title: hasYvUsdChartData ? 'yvUSD Performance' : 'Vault Performance',
      description: hasYvUsdChartData
        ? `Unlocked and locked APY over ${timeframe.label}.`
        : `1-Day, 7-Day, and 30-Day APYs over ${timeframe.label}.`,
      mobileDescription: hasYvUsdChartData
        ? `Compare locked and unlocked APY over ${timeframe.mobileLabel}.`
        : `Compare APY trends over ${timeframe.mobileLabel}.`
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
      title:
        tvlView === 'underlying' ? 'Underlying TVL' : hasYvUsdChartData ? 'yvUSD Deposits' : 'Total Value Deposited',
      description:
        tvlView === 'underlying'
          ? `Underlying asset balance deposited in vault over ${timeframe.label}.`
          : hasYvUsdChartData
            ? `Unlocked and locked deposits over ${timeframe.label}.`
            : `Value deposited in vault over ${timeframe.label}.`,
      mobileDescription:
        tvlView === 'underlying'
          ? `Review underlying TVL over ${timeframe.mobileLabel}.`
          : hasYvUsdChartData
            ? `Review locked and unlocked TVL over ${timeframe.mobileLabel}.`
            : `Review TVL changes over ${timeframe.mobileLabel}.`
    },
    'lifetime-earnings': {
      title: lifetimeChartTitle,
      description: lifetimeChartDescription,
      mobileDescription: lifetimeChartMobileDescription
    },
    'envio-profit': {
      title: envioChartTitle,
      description: envioChartDescription,
      mobileDescription: envioChartMobileDescription
    }
  } satisfies Record<ChartTab, { title: string; description: string; mobileDescription: string }>

  const showGhostedOverlay = !isMobile
  const chartHeightClassName = isMobile ? 'h-[260px]' : 'h-[320px] lg:h-[400px]'
  const desktopAlignedChartBottom = 16
  const chartOverlayYAxisWidthByTab = {
    'historical-apy': 60,
    'historical-pps': 60,
    'historical-tvl': 68,
    'lifetime-earnings': 72,
    'envio-profit': 72
  } satisfies Record<ChartTab, number>

  const renderChartBody = (chartType: ChartTab) => {
    switch (chartType) {
      case 'historical-apy':
        if (yvUsdChartData) {
          return (
            <FixedHeightChartContainer heightClassName={chartHeightClassName}>
              <ChartErrorBoundary>
                <APYChart
                  chartData={aprApyData}
                  comparisonChartData={yvUsdChartData.lockedAprApyData}
                  comparisonLabel="Locked yvUSD"
                  timeframe={timeframe.value}
                  visibleSeries={apyVisibleSeries}
                  onVisibleSeriesChange={setApyVisibleSeries}
                  hideSeriesControls={true}
                  ppsPeriodApy={ppsPeriodApy}
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
        if (yvUsdChartData) {
          return (
            <FixedHeightChartContainer heightClassName={chartHeightClassName}>
              <ChartErrorBoundary>
                <YvUsdDualLineChart chartData={yvUsdChartData.ppsData} timeframe={timeframe.value} valueType="pps" />
              </ChartErrorBoundary>
            </FixedHeightChartContainer>
          )
        }

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
                    yAxisWidth={chartOverlayYAxisWidthByTab[chartType]}
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
        if (tvlView === 'underlying') {
          return (
            <FixedHeightChartContainer heightClassName={chartHeightClassName}>
              <ChartErrorBoundary>
                <UnderlyingTvlChart
                  chartData={underlyingTvlData}
                  timeframe={timeframe.value}
                  assetSymbol={assetSymbol}
                />
              </ChartErrorBoundary>
            </FixedHeightChartContainer>
          )
        }

        if (yvUsdChartData) {
          return (
            <FixedHeightChartContainer heightClassName={chartHeightClassName}>
              <ChartErrorBoundary>
                <YvUsdDualLineChart chartData={yvUsdChartData.tvlData} timeframe={timeframe.value} valueType="tvl" />
              </ChartErrorBoundary>
            </FixedHeightChartContainer>
          )
        }

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
                    yAxisWidth={chartOverlayYAxisWidthByTab[chartType]}
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
      case 'lifetime-earnings':
        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              {reportHistoryError ? (
                <div className="flex h-full items-center justify-center text-sm text-red-500">
                  Unable to load report history.
                </div>
              ) : reportHistoryLoading && !vaultEarningsData ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading report history…
                </div>
              ) : (
                <LifetimeEarningsChart chartData={vaultEarningsData ?? []} timeframe={timeframe.value} />
              )}
            </ChartErrorBoundary>
            {showGhostedOverlay && (
              <div className="pointer-events-none absolute inset-0 opacity-10">
                <ChartErrorBoundary>
                  <PPSChart
                    chartData={ppsData}
                    timeframe={timeframe.value}
                    hideAxes={true}
                    hideTooltip={true}
                    chartMargin={{ bottom: desktopAlignedChartBottom }}
                    yAxisWidth={chartOverlayYAxisWidthByTab[chartType]}
                  />
                </ChartErrorBoundary>
              </div>
            )}
          </FixedHeightChartContainer>
        )
      case 'envio-profit':
        return (
          <FixedHeightChartContainer heightClassName={chartHeightClassName}>
            <ChartErrorBoundary>
              {managementEventsError ? (
                <div className="flex h-full items-center justify-center text-sm text-red-500">
                  Unable to load Envio strategy report events.
                </div>
              ) : managementEventsLoading && !vaultEventProfitData ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading Envio strategy report events…
                </div>
              ) : (
                <EnvioProfitChart
                  chartData={vaultEventProfitData ?? []}
                  timeframe={timeframe.value}
                  assetSymbol={assetSymbol}
                />
              )}
            </ChartErrorBoundary>
          </FixedHeightChartContainer>
        )
      default:
        return null
    }
  }

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
              <DialogDescription>Choose the time window for all charts.</DialogDescription>
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
              className="flex h-auto flex-col items-start rounded-md border-border px-3 py-2 text-left"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">Data</span>
              <span className="text-sm text-foreground">{selectedApySeriesCount} series</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] rounded-lg p-4 sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Data</DialogTitle>
              <DialogDescription>Choose which APY series are visible on the performance chart.</DialogDescription>
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

  const tvlViewControls = (
    <div className="inline-grid grid-cols-2 rounded-md border border-border bg-white p-0.5">
      {tvlViewOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTvlView(option.value)}
          className={`min-w-0 rounded-[4px] px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
            tvlView === option.value
              ? 'bg-[#0657f9] text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-[#111111]'
          }`}
        >
          {isMobile ? option.mobileLabel : option.label}
        </button>
      ))}
    </div>
  )

  const chartControls = isMobile ? mobileChartControls : desktopChartControls

  const renderChartSection = (chartType: ChartTab) => {
    const info = chartInfo[chartType]
    const description = isMobile ? info.mobileDescription : info.description

    return (
      <section key={chartType} className="border-b border-border last:border-b-0">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-[#111111]">{info.title}</h3>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
            {chartType === 'historical-tvl' ? <div className="shrink-0">{tvlViewControls}</div> : null}
          </div>
          {renderChartBody(chartType)}
          {chartType === 'historical-apy' && !isMobile ? desktopApySeriesControls : null}
        </div>
      </section>
    )
  }

  return (
    <div className="border-x border-t border-border bg-white">
      <div
        className="sticky z-10 border-b border-border bg-white px-4 py-2 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-6"
        style={{ top: chartHeaderStickyTop }}
      >
        <div>
          <h2 className="text-base font-semibold text-[#111111]">Charts</h2>
          <p className="mt-1 text-xs text-gray-500">
            Historical performance, share growth, TVL, Kong report history, and Envio event profit/fee history.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:shrink-0">{chartControls}</div>
      </div>
      {chartSections.map((section) => renderChartSection(section.value))}
    </div>
  )
}
