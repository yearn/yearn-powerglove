import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import React, { lazy, Suspense } from 'react'
import type { Address } from 'viem'
import { getVaultAtAGlanceItems, MainInfoPanel } from '@/components/main-info-panel'
import { StrategiesPanel } from '@/components/strategies-panel/index'
import { KongDataTab } from '@/components/strategies-panel/KongDataTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VaultEventsTabs } from '@/components/vault-events'
import { VaultOverviewTab, VaultPageBreadcrumb, VaultPageLayout } from '@/components/vault-page'
import type { ChainId } from '@/constants/chains'
import { useTokenAssetsContext } from '@/contexts/useTokenAssets'
import { useAprOracle } from '@/hooks/useAprOracle'
import { useChartData } from '@/hooks/useChartData'
import { useMainInfoPanelData } from '@/hooks/useMainInfoPanelData'
import { useReallocationData } from '@/hooks/useReallocationData'
import { useVaultPageData } from '@/hooks/useVaultPageData'
import { formatPercent } from '@/lib/formatters'
import { isLegacyVaultType } from '@/utils/vaultDataUtils'
import { getVaultOverrideDisplayItems } from '@/utils/vaultOverrides'

const ChartsPanel = lazy(() =>
  import('@/components/charts/charts-panel').then((m) => ({
    default: m.ChartsPanel
  }))
)

type VaultPageTab = 'overview' | 'charts' | 'strategy-info' | 'vault-events' | 'vault-data'

const vaultPageTabs: Array<{ value: VaultPageTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'charts', label: 'Charts' },
  { value: 'strategy-info', label: 'Strategy Info' },
  { value: 'vault-events', label: 'Vault Events' },
  { value: 'vault-data', label: 'Vault Data' }
]

const vaultPageTabTriggerClassName =
  'rounded-none border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground data-[state=active]:border-[#0657f9] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none md:px-5'
const vaultPageTabContentClassName = 'mt-3 flex-1 bg-white'

function SingleVaultPage() {
  const { chainId, vaultAddress } = Route.useParams()
  const vaultChainId = Number(chainId) as ChainId
  const { assets: tokenAssets } = useTokenAssetsContext()
  const [activeVaultPageTab, setActiveVaultPageTab] = React.useState<VaultPageTab>('overview')

  const {
    vaultDetails,
    kongSnapshot,
    vaultSnapshotTimestampUtc,
    apyWeeklyData,
    apyMonthlyData,
    aprOracleAprData,
    tvlData,
    ppsData,
    isInitialLoading,
    hasErrors,
    chartsLoading,
    chartsError,
    overrideConfig,
    isBlacklisted,
    blacklistReason
  } = useVaultPageData({ vaultAddress, vaultChainId })

  const mainInfoPanelData = useMainInfoPanelData({
    vaultDetails,
    tokenAssets
  })

  const { transformedAprApyData, transformedTvlData, transformedPpsData } = useChartData({
    apyWeeklyData,
    apyMonthlyData,
    aprOracleAprData,
    tvlData,
    ppsData,
    isLoading: chartsLoading,
    hasErrors: chartsError
  })

  const { data: vaultAprOracle } = useAprOracle({
    address: vaultDetails?.address ? (vaultDetails.address as Address) : undefined,
    chainId: vaultDetails?.v3 ? vaultChainId : undefined,
    delta: 0n,
    enabled: Boolean(vaultDetails?.v3)
  })

  const latestDerivedApy = React.useMemo(() => {
    if (!transformedAprApyData) return null
    for (let i = transformedAprApyData.length - 1; i >= 0; i--) {
      const point = transformedAprApyData[i]
      if (point?.derivedApy !== null && point?.derivedApy !== undefined) {
        return point.derivedApy
      }
    }
    return null
  }, [transformedAprApyData])

  const legacyVault = vaultDetails ? isLegacyVaultType(vaultDetails) : false
  const yDaemonForwardApy = legacyVault ? null : (vaultDetails?.forwardApyNet ?? null)
  const oracleOneDayApy = vaultAprOracle?.current.formatted ?? null

  const yDaemonForwardApyPercent = React.useMemo(() => {
    if (yDaemonForwardApy === null || yDaemonForwardApy === undefined) {
      return null
    }
    return yDaemonForwardApy * 100
  }, [yDaemonForwardApy])

  const yDaemonForwardApyFormatted = React.useMemo(() => {
    if (yDaemonForwardApyPercent === null || yDaemonForwardApyPercent === undefined) {
      return null
    }
    return formatPercent(yDaemonForwardApyPercent)
  }, [yDaemonForwardApyPercent])

  const mainInfoPanelProps = React.useMemo(() => {
    if (!mainInfoPanelData) return null
    const derivedApyFormatted = formatPercent(latestDerivedApy)
    const thirtyDayFormatted = mainInfoPanelData.thirtyDayAPY

    const finalOneDayApy = legacyVault ? ' - ' : (yDaemonForwardApyFormatted ?? oracleOneDayApy ?? derivedApyFormatted)

    return {
      ...mainInfoPanelData,
      oneDayAPY: finalOneDayApy,
      thirtyDayAPY: thirtyDayFormatted
    }
  }, [mainInfoPanelData, latestDerivedApy, legacyVault, yDaemonForwardApyFormatted, oracleOneDayApy])

  const overrideItems = React.useMemo(() => getVaultOverrideDisplayItems(overrideConfig), [overrideConfig])
  const vaultAtAGlanceItems = React.useMemo(
    () => (mainInfoPanelProps ? getVaultAtAGlanceItems(mainInfoPanelProps) : []),
    [mainInfoPanelProps]
  )
  const showMobileVaultCta = Boolean(mainInfoPanelProps?.yearnVaultLink && activeVaultPageTab !== 'vault-events')

  const { data: reallocationData } = useReallocationData(
    vaultAddress,
    vaultChainId,
    vaultDetails,
    vaultSnapshotTimestampUtc
  )

  if (!vaultDetails || !mainInfoPanelProps) {
    return (
      <VaultPageLayout isLoading={true} hasErrors={false}>
        {null}
      </VaultPageLayout>
    )
  }

  return (
    <VaultPageLayout isLoading={isInitialLoading} hasErrors={hasErrors}>
      <div className={`relative flex flex-1 flex-col ${showMobileVaultCta ? 'pb-20 md:pb-0' : ''}`}>
        {isBlacklisted && <div className="absolute inset-0 z-20 rounded-lg bg-white/40 backdrop-blur-sm" />}
        {isBlacklisted && (
          <div className="relative z-30 flex items-start gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
            <span aria-hidden="true" className="text-xl leading-none">
              ⚠️
            </span>
            <div className="text-left">
              <p className="font-semibold">Vault Data Unavailable</p>
              <p className="text-sm text-amber-700">
                {blacklistReason || 'This vault has been hidden until its data can be reviewed.'}
              </p>
            </div>
          </div>
        )}
        {!isBlacklisted && overrideItems.length > 0 && (
          <div className="relative z-30 flex items-start gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
            <span aria-hidden="true" className="text-xl leading-none">
              ⚠️
            </span>
            <div className="text-left">
              <p className="font-semibold">Vault info override active</p>
              <p className="text-sm text-amber-700">Certain values have been manually overridden.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {overrideItems.map((item) => (
                  <li key={item.label}>
                    <span className="font-medium">{item.label}:</span> <span>{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div
          className={`flex flex-1 flex-col space-y-0 ${isBlacklisted ? 'relative z-10 pointer-events-none select-none' : ''}`}
        >
          <Tabs
            value={activeVaultPageTab}
            className="flex w-full flex-1 flex-col bg-transparent"
            onValueChange={(value) => setActiveVaultPageTab(value as VaultPageTab)}
          >
            <div className="bg-white md:sticky md:top-[54px] md:z-20">
              <VaultPageBreadcrumb vaultName={vaultDetails.name} />
              <MainInfoPanel
                {...mainInfoPanelProps}
                navigation={
                  <TabsList className="flex h-auto max-w-full flex-wrap justify-center overflow-visible bg-transparent p-0 md:justify-end">
                    {vaultPageTabs.map((tab) => (
                      <TabsTrigger key={tab.value} value={tab.value} className={vaultPageTabTriggerClassName}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                }
              />
            </div>

            <TabsContent value="overview" className={vaultPageTabContentClassName}>
              <VaultOverviewTab
                vaultChainId={vaultChainId}
                vaultDetails={vaultDetails}
                description={mainInfoPanelProps.description}
                aprApyData={transformedAprApyData}
                tvlData={transformedTvlData}
                isChartsLoading={chartsLoading}
                hasChartsError={chartsError}
                atAGlanceItems={vaultAtAGlanceItems}
              />
            </TabsContent>

            <TabsContent value="charts" className={vaultPageTabContentClassName}>
              <Suspense fallback={null}>
                <ChartsPanel
                  aprApyData={transformedAprApyData}
                  tvlData={transformedTvlData}
                  ppsData={transformedPpsData}
                  vaultAddress={vaultDetails.address}
                  vaultChainId={vaultChainId}
                  isLoading={chartsLoading}
                  hasErrors={chartsError}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="strategy-info" className={vaultPageTabContentClassName}>
              <StrategiesPanel
                vaultChainId={vaultChainId}
                vaultDetails={vaultDetails}
                kongSnapshot={kongSnapshot}
                reallocationData={reallocationData}
              />
            </TabsContent>

            <TabsContent value="vault-events" className={vaultPageTabContentClassName}>
              <VaultEventsTabs vaultChainId={vaultChainId} vaultDetails={vaultDetails} />
            </TabsContent>

            <TabsContent value="vault-data" className={vaultPageTabContentClassName}>
              <div className="border border-border bg-white">
                <KongDataTab snapshot={kongSnapshot} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        {showMobileVaultCta && mainInfoPanelProps.yearnVaultLink ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
            <a
              className="mx-auto flex h-11 max-w-[1400px] items-center justify-center rounded-none bg-[#0657f9] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0657f9]/90"
              href={mainInfoPanelProps.yearnVaultLink}
              target="_blank"
              rel="noreferrer"
            >
              Go to Vault
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </div>
        ) : null}
      </div>
    </VaultPageLayout>
  )
}

export const Route = createFileRoute('/vaults/$chainId/$vaultAddress/')({
  component: SingleVaultPage
})
