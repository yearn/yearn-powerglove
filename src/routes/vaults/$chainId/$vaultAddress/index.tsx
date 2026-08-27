import { createFileRoute } from '@tanstack/react-router'
import React, { lazy, Suspense } from 'react'
import { isAddress } from 'viem'
import { MainInfoPanel } from '@/components/main-info-panel'

// Lazy load ChartsPanel for code splitting (reduces initial bundle size)
const ChartsPanel = lazy(() =>
  import('@/components/charts/charts-panel').then((m) => ({
    default: m.ChartsPanel
  }))
)

import { StrategiesPanel } from '@/components/strategies-panel/index'
import { VaultPageBreadcrumb, VaultPageLayout } from '@/components/vault-page'
import { type ChainId, isSupportedChainId } from '@/constants/chains'
import { isYBoldAddress, isYvUsdAddress } from '@/constants/featuredVaults'
import { useTokenAssetsContext } from '@/contexts/useTokenAssets'
import { useChartData } from '@/hooks/useChartData'
import { useMainInfoPanelData } from '@/hooks/useMainInfoPanelData'
import { useReallocationData } from '@/hooks/useReallocationData'
// Import our new data hooks and layout components
import { useVaultPageData } from '@/hooks/useVaultPageData'
import { useYvUsdChartData } from '@/hooks/useYvUsdChartData'
import { buildPairedApyDisplay, buildSingleApyDisplay } from '@/lib/apy-display'
import { isLegacyVaultType } from '@/utils/vaultDataUtils'
import { getVaultOverrideDisplayItems } from '@/utils/vaultOverrides'

function InvalidVaultParamsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Invalid vault route</h1>
        <p className="mt-2 text-sm text-slate-600">
          The vault address or chain identifier in this URL is not valid. Please check the link and try again.
        </p>
      </div>
    </main>
  )
}

export function isValidVaultRouteParams(chainId: string, vaultAddress: string): boolean {
  return isSupportedChainId(Number(chainId)) && isAddress(vaultAddress)
}

type SingleVaultPageContentProps = {
  vaultChainId: ChainId
  vaultAddress: string
  vaultDetails: ReturnType<typeof useVaultPageData>['vaultDetails']
  vaultSnapshotTimestampUtc: string | null
  isInitialLoading: boolean
  hasErrors: boolean
  chartsLoading: boolean
  chartsError: boolean
  overrideConfig: ReturnType<typeof useVaultPageData>['overrideConfig']
  isBlacklisted: boolean
  blacklistReason?: string
  transformedAprApyData: ReturnType<typeof useChartData>['transformedAprApyData']
  transformedTvlData: ReturnType<typeof useChartData>['transformedTvlData']
  transformedPpsData: ReturnType<typeof useChartData>['transformedPpsData']
  yvUsdChartData?: ReturnType<typeof useYvUsdChartData>['yvUsdChartData']
  isYBold?: boolean
  isYvUsd?: boolean
  mainInfoPanelProps: ReturnType<typeof useMainInfoPanelData>
  reallocationData: ReturnType<typeof useReallocationData>['data']
}

export function SingleVaultPageContent({
  vaultChainId,
  vaultDetails,
  isInitialLoading,
  hasErrors,
  chartsLoading,
  chartsError,
  overrideConfig,
  isBlacklisted,
  blacklistReason,
  transformedAprApyData,
  transformedTvlData,
  transformedPpsData,
  yvUsdChartData,
  isYBold = false,
  isYvUsd = false,
  mainInfoPanelProps,
  reallocationData
}: SingleVaultPageContentProps) {
  const overrideItems = React.useMemo(() => getVaultOverrideDisplayItems(overrideConfig), [overrideConfig])

  if (isBlacklisted) {
    return (
      <VaultPageLayout isLoading={isInitialLoading} hasErrors={hasErrors}>
        <div className="relative">
          <div className="absolute inset-0 z-20 rounded-lg bg-white/40 backdrop-blur-sm" />
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
        </div>
      </VaultPageLayout>
    )
  }

  if (!vaultDetails || !mainInfoPanelProps) {
    return (
      <VaultPageLayout isLoading={true} hasErrors={false}>
        {null}
      </VaultPageLayout>
    )
  }

  const isFactoryVault = vaultDetails.name?.toLowerCase().includes('factory') ?? false
  const isV3Vault =
    !isFactoryVault &&
    Boolean(vaultDetails.v3 || vaultDetails.apiVersion?.startsWith('3') || vaultDetails.apiVersion?.startsWith('~3'))

  return (
    <VaultPageLayout isLoading={isInitialLoading} hasErrors={hasErrors}>
      <VaultPageBreadcrumb vaultName={isYvUsd ? 'yvUSD' : vaultDetails.name} />
      {overrideItems.length > 0 && (
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
      <div className="space-y-0">
        <MainInfoPanel {...mainInfoPanelProps} />
        <Suspense fallback={null}>
          <ChartsPanel
            aprApyData={transformedAprApyData}
            tvlData={transformedTvlData}
            ppsData={transformedPpsData}
            yvUsdChartData={yvUsdChartData}
            isV3Vault={isV3Vault}
            isYBold={isYBold}
            isLoading={chartsLoading}
            hasErrors={chartsError}
          />
        </Suspense>
        <StrategiesPanel
          vaultChainId={vaultChainId}
          vaultDetails={vaultDetails}
          aboutDescription={mainInfoPanelProps.description}
          aboutLink={mainInfoPanelProps.yearnVaultLink}
          reallocationData={reallocationData}
        />
      </div>
    </VaultPageLayout>
  )
}

function ValidVaultPage({ chainId, vaultAddress }: { chainId: string; vaultAddress: string }) {
  const vaultChainId = Number(chainId) as ChainId
  const { assets: tokenAssets } = useTokenAssetsContext()

  const {
    vaultDetails,
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

  // Transform main info panel data
  const mainInfoPanelData = useMainInfoPanelData({
    vaultDetails,
    tokenAssets
  })

  const isYBold = isYBoldAddress(vaultChainId, vaultAddress)

  // Process chart data
  const { transformedAprApyData, transformedTvlData, transformedPpsData } = useChartData({
    apyWeeklyData,
    apyMonthlyData,
    aprOracleAprData,
    tvlData,
    ppsData,
    includeYBoldEstimatedApy: isYBold,
    managementFeeBps: vaultDetails?.fees.managementFee ?? 0,
    performanceFeeBps: vaultDetails?.fees.performanceFee ?? 0,
    isLoading: chartsLoading,
    hasErrors: chartsError
  })

  const isYvUsd = isYvUsdAddress(vaultChainId, vaultAddress)
  const {
    yvUsdChartData,
    isLoading: yvUsdChartsLoading,
    hasErrors: yvUsdChartsError
  } = useYvUsdChartData({
    enabled: isYvUsd,
    unlockedAprApyData: transformedAprApyData,
    unlockedTvlData: transformedTvlData,
    unlockedPpsData: transformedPpsData,
    lockedFees: vaultDetails?.pairedFees?.locked ?? null
  })

  const legacyVault = vaultDetails ? isLegacyVaultType(vaultDetails) : false

  const mainInfoPanelProps = React.useMemo(() => {
    if (!mainInfoPanelData) return null
    const pairedEstimatedApy = vaultDetails?.pairedEstimatedApy
    const pairedThirtyDayApy = vaultDetails?.pairedThirtyDayApy

    if (isYvUsd && pairedEstimatedApy && pairedThirtyDayApy) {
      return {
        ...mainInfoPanelData,
        oneDayAPY: buildPairedApyDisplay(pairedEstimatedApy),
        thirtyDayAPY: buildPairedApyDisplay(pairedThirtyDayApy)
      }
    }

    return {
      ...mainInfoPanelData,
      oneDayAPY: buildSingleApyDisplay(legacyVault ? null : vaultDetails?.forwardApyNet)
    }
  }, [
    mainInfoPanelData,
    legacyVault,
    isYvUsd,
    vaultDetails?.forwardApyNet,
    vaultDetails?.pairedEstimatedApy,
    vaultDetails?.pairedThirtyDayApy
  ])

  const { data: reallocationData } = useReallocationData(
    vaultAddress,
    vaultChainId,
    vaultDetails,
    vaultSnapshotTimestampUtc
  )

  return (
    <SingleVaultPageContent
      vaultChainId={vaultChainId}
      vaultAddress={vaultAddress}
      vaultDetails={vaultDetails}
      vaultSnapshotTimestampUtc={vaultSnapshotTimestampUtc}
      isInitialLoading={isInitialLoading}
      hasErrors={hasErrors}
      chartsLoading={chartsLoading || yvUsdChartsLoading}
      chartsError={chartsError || yvUsdChartsError}
      overrideConfig={overrideConfig}
      isBlacklisted={isBlacklisted}
      blacklistReason={blacklistReason}
      transformedAprApyData={transformedAprApyData}
      transformedTvlData={transformedTvlData}
      transformedPpsData={transformedPpsData}
      yvUsdChartData={yvUsdChartData}
      isYBold={isYBold}
      isYvUsd={isYvUsd}
      mainInfoPanelProps={mainInfoPanelProps}
      reallocationData={reallocationData}
    />
  )
}

function SingleVaultPage() {
  const { chainId, vaultAddress } = Route.useParams()

  if (!isValidVaultRouteParams(chainId, vaultAddress)) {
    return <InvalidVaultParamsPage />
  }

  return <ValidVaultPage chainId={chainId} vaultAddress={vaultAddress} />
}

export const Route = createFileRoute('/vaults/$chainId/$vaultAddress/')({
  component: SingleVaultPage
})
