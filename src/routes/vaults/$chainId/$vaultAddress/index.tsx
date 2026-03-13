import { createFileRoute } from '@tanstack/react-router'
import React, { lazy, Suspense } from 'react'
import { MainInfoPanel } from '@/components/main-info-panel'

// Lazy load ChartsPanel for code splitting (reduces initial bundle size)
const ChartsPanel = lazy(() =>
  import('@/components/charts/charts-panel').then((m) => ({
    default: m.ChartsPanel
  }))
)

import type { Address } from 'viem'
import { StrategiesPanel } from '@/components/strategies-panel/index'
import { VaultPageBreadcrumb, VaultPageLayout } from '@/components/vault-page'
import type { ChainId } from '@/constants/chains'
import { useTokenAssetsContext } from '@/contexts/useTokenAssets'
import { useAprOracle } from '@/hooks/useAprOracle'
import { useChartData } from '@/hooks/useChartData'
import { useMainInfoPanelData } from '@/hooks/useMainInfoPanelData'
// Import our new data hooks and layout components
import { useVaultPageData } from '@/hooks/useVaultPageData'
import { formatPercent } from '@/lib/formatters'
import { isLegacyVaultType } from '@/utils/vaultDataUtils'
import { getVaultOverrideDisplayItems } from '@/utils/vaultOverrides'

function SingleVaultPage() {
  const { chainId, vaultAddress } = Route.useParams()
  const vaultChainId = Number(chainId) as ChainId
  const { assets: tokenAssets } = useTokenAssetsContext()

  const {
    vaultDetails,
    kongSnapshot,
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

  // Process chart data
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

  // Ensure we have vault details and main info panel data
  if (!vaultDetails || !mainInfoPanelProps) {
    return (
      <VaultPageLayout isLoading={true} hasErrors={false}>
        {null}
      </VaultPageLayout>
    )
  }

  return (
    <VaultPageLayout isLoading={isInitialLoading} hasErrors={hasErrors}>
      <VaultPageBreadcrumb vaultName={vaultDetails.name} />
      <div className="relative">
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
        <div className={`space-y-0 ${isBlacklisted ? 'relative z-10 pointer-events-none select-none' : ''}`}>
          <MainInfoPanel {...mainInfoPanelProps} />
          <Suspense fallback={null}>
            <ChartsPanel
              aprApyData={transformedAprApyData}
              tvlData={transformedTvlData}
              ppsData={transformedPpsData}
              isLoading={chartsLoading}
              hasErrors={chartsError}
            />
          </Suspense>
          <StrategiesPanel vaultChainId={vaultChainId} vaultDetails={vaultDetails} kongSnapshot={kongSnapshot} />
        </div>
      </div>
    </VaultPageLayout>
  )
}

export const Route = createFileRoute('/vaults/$chainId/$vaultAddress/')({
  component: SingleVaultPage
})
