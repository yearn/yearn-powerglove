import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getAddress, isAddress } from 'viem'
import { type ChainId, isSupportedChainId } from '@/constants/chains'
import {
  getCanonicalVaultAddress,
  getYBoldEstimatedApy,
  getYieldDataAddress,
  getYvUsdSnapshotEstimatedApy,
  isYBoldAddress,
  isYvUsdAddress,
  YBOLD_CHAIN_ID,
  YBOLD_STAKING_ADDRESS,
  YVUSD_CHAIN_ID,
  YVUSD_DESCRIPTION,
  YVUSD_LOCKED_ADDRESS
} from '@/constants/featuredVaults'
import type { VaultOverrideConfig } from '@/constants/vaultOverrides'
import { useVaults } from '@/contexts/useVaults'
import { useRestTimeseries } from '@/hooks/useRestTimeseries'
import { fetchKongVaultSnapshotRaw } from '@/lib/kong-vault-client'
import { mapKongSnapshotToVaultExtended } from '@/lib/kong-vault-derivation'
import { fetchYvUsdAprs, getYvUsdApiStrategyApyByAddress, getYvUsdApiVault } from '@/lib/yvusd-apr-client'
import type { TimeseriesDataPoint } from '@/types/dataTypes'
import type { KongVaultSnapshot } from '@/types/kong'
import type { Vault, VaultExtended } from '@/types/vaultTypes'
import {
  applyVaultOverride,
  getVaultBlacklistReason,
  getVaultOverride,
  isVaultBlacklisted
} from '@/utils/vaultOverrides'

interface UseVaultPageDataProps {
  vaultAddress: string
  vaultChainId: ChainId
}

interface TimeseriesQueryResult {
  timeseries: TimeseriesDataPoint[]
}

interface UseVaultPageDataReturn {
  // Vault data
  vaultDetails: VaultExtended | null
  vaultLoading: boolean
  vaultError: Error | undefined
  vaultSnapshotTimestampUtc: string | null

  // Chart data (raw)
  apyWeeklyData: TimeseriesQueryResult | undefined
  apyMonthlyData: TimeseriesQueryResult | undefined
  aprOracleAprData: TimeseriesQueryResult | undefined
  tvlData: TimeseriesQueryResult | undefined
  ppsData: TimeseriesQueryResult | undefined

  // Chart loading states
  chartsLoading: boolean
  chartsError: boolean

  // Combined states
  isInitialLoading: boolean
  hasErrors: boolean
  isBlacklisted: boolean
  blacklistReason?: string
  overrideConfig?: VaultOverrideConfig
  canonicalVaultAddress: string
  yieldDataAddress: string
}

const toBaseVaultExtended = (vault: Vault | null): VaultExtended | null => {
  if (!vault) {
    return null
  }

  return {
    ...vault,
    forwardApyNet: vault.forwardApyNet ?? null,
    strategyForwardAprs: vault.strategyForwardAprs ?? {},
    strategyDetails: []
  }
}

const mergeYBoldDetails = (baseVault: VaultExtended, stakedVault: VaultExtended): VaultExtended => {
  const estimatedApy = getYBoldEstimatedApy(stakedVault)

  return {
    ...baseVault,
    name: 'yBOLD',
    symbol: 'yBOLD',
    apy: stakedVault.apy ?? baseVault.apy,
    fees: {
      ...baseVault.fees,
      performanceFee: stakedVault.fees?.performanceFee ?? baseVault.fees.performanceFee
    },
    performanceFee: stakedVault.performanceFee ?? baseVault.performanceFee,
    forwardApyNet: estimatedApy.value,
    estimatedApySource: estimatedApy.source,
    historicalWeeklyApy: stakedVault.historicalWeeklyApy ?? null,
    historicalMonthlyApy: stakedVault.historicalMonthlyApy ?? null,
    strategyForwardAprs: stakedVault.strategyForwardAprs ?? baseVault.strategyForwardAprs
  }
}

const normalizeYvUsdDetails = (vault: VaultExtended): VaultExtended => ({
  ...vault,
  name: 'yvUSD',
  symbol: 'yvUSD',
  meta: {
    ...vault.meta,
    description: YVUSD_DESCRIPTION,
    displayName: 'yvUSD',
    displaySymbol: 'yvUSD',
    protocols: vault.meta?.protocols ?? [],
    token: vault.meta?.token ?? {
      category: '',
      description: '',
      displayName: '',
      displaySymbol: '',
      icon: '',
      type: ''
    }
  }
})

const applyYvUsdAprData = (
  vault: VaultExtended,
  lockedVault: VaultExtended | null,
  aprData: Awaited<ReturnType<typeof fetchYvUsdAprs>> | undefined
): VaultExtended => {
  const yvUsdVault = getYvUsdApiVault(aprData, vault.address)
  const lockedYvUsdVault = getYvUsdApiVault(aprData, YVUSD_LOCKED_ADDRESS)
  const unlockedEstimatedApy = yvUsdVault?.apy ?? getYvUsdSnapshotEstimatedApy(vault)
  const lockedEstimatedApy = lockedYvUsdVault?.apy ?? getYvUsdSnapshotEstimatedApy(lockedVault)

  return {
    ...vault,
    forwardApyNet: unlockedEstimatedApy,
    estimatedApySource: unlockedEstimatedApy !== null ? 'est-yvusd' : null,
    pairedEstimatedApy: {
      locked: lockedEstimatedApy,
      unlocked: unlockedEstimatedApy
    },
    pairedThirtyDayApy: {
      locked: lockedVault?.historicalMonthlyApy ?? null,
      unlocked: vault.historicalMonthlyApy ?? null
    },
    pairedFees: {
      locked: lockedVault?.fees ?? null,
      unlocked: vault.fees
    },
    yvUsdStrategyApyByAddress: getYvUsdApiStrategyApyByAddress(yvUsdVault)
  }
}

const normalizeVaultAddress = (address: string): string => {
  try {
    return getAddress(address)
  } catch {
    return address.toLowerCase()
  }
}

/**
 * Coordinates data fetching for the vault page and manages loading states
 * Uses Kong REST for vault details and timeseries data
 */
export function useVaultPageData({ vaultAddress, vaultChainId }: UseVaultPageDataProps): UseVaultPageDataReturn {
  const hasValidRouteParams = isSupportedChainId(vaultChainId) && isAddress(vaultAddress)
  const canonicalVaultAddress = normalizeVaultAddress(getCanonicalVaultAddress(vaultChainId, vaultAddress))
  const yieldDataAddress = normalizeVaultAddress(getYieldDataAddress(vaultChainId, vaultAddress))
  const isYBold = isYBoldAddress(vaultChainId, vaultAddress)
  const isYvUsd = isYvUsdAddress(vaultChainId, vaultAddress)
  const isBlacklisted = isVaultBlacklisted(vaultChainId, canonicalVaultAddress)
  const blacklistReason = getVaultBlacklistReason(vaultChainId, canonicalVaultAddress)
  const overrideConfig = getVaultOverride(vaultChainId, canonicalVaultAddress)
  const canFetchVaultData = hasValidRouteParams && !isBlacklisted
  const { vaults } = useVaults()
  const normalizedAddress = canonicalVaultAddress.toLowerCase()

  const baseVault = useMemo(() => {
    const matchedVault =
      vaults.find((vault) => vault.chainId === vaultChainId && vault.address.toLowerCase() === normalizedAddress) ??
      null

    return toBaseVaultExtended(matchedVault)
  }, [vaults, vaultChainId, normalizedAddress])

  const {
    data: snapshotData,
    isLoading: vaultLoading,
    error: snapshotError
  } = useQuery<KongVaultSnapshot | null, Error>({
    queryKey: ['kong', 'vault', 'snapshot', vaultChainId, normalizedAddress],
    queryFn: () => fetchKongVaultSnapshotRaw(vaultChainId, canonicalVaultAddress),
    staleTime: 30 * 1000,
    enabled: canFetchVaultData
  })

  const { data: yBoldStakedSnapshot } = useQuery<KongVaultSnapshot | null, Error>({
    queryKey: ['kong', 'vault', 'snapshot', YBOLD_CHAIN_ID, YBOLD_STAKING_ADDRESS.toLowerCase()],
    queryFn: () => fetchKongVaultSnapshotRaw(YBOLD_CHAIN_ID, YBOLD_STAKING_ADDRESS),
    staleTime: 30 * 1000,
    enabled: canFetchVaultData && isYBold
  })

  const { data: yvUsdLockedSnapshot } = useQuery<KongVaultSnapshot | null, Error>({
    queryKey: ['kong', 'vault', 'snapshot', YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS.toLowerCase()],
    queryFn: () => fetchKongVaultSnapshotRaw(YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS),
    staleTime: 30 * 1000,
    enabled: canFetchVaultData && isYvUsd
  })

  const { data: yvUsdAprData } = useQuery({
    queryKey: ['yvusd', 'aprs'],
    queryFn: fetchYvUsdAprs,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: canFetchVaultData && isYvUsd
  })

  const vaultDetails = useMemo(() => {
    const mappedBaseVault = snapshotData
      ? mapKongSnapshotToVaultExtended(snapshotData, baseVault)
      : baseVault
        ? { ...baseVault }
        : null

    if (!mappedBaseVault) {
      return null
    }

    const lockedYvUsdVault = yvUsdLockedSnapshot ? mapKongSnapshotToVaultExtended(yvUsdLockedSnapshot, null) : null
    const normalizedBaseVault = isYvUsd
      ? applyYvUsdAprData(normalizeYvUsdDetails(mappedBaseVault), lockedYvUsdVault, yvUsdAprData)
      : mappedBaseVault

    if (!isYBold) {
      return applyVaultOverride(normalizedBaseVault)
    }

    if (!yBoldStakedSnapshot) {
      return applyVaultOverride({
        ...normalizedBaseVault,
        name: 'yBOLD',
        symbol: 'yBOLD',
        forwardApyNet: null,
        estimatedApySource: null
      })
    }

    return applyVaultOverride(
      mergeYBoldDetails(normalizedBaseVault, mapKongSnapshotToVaultExtended(yBoldStakedSnapshot, null))
    )
  }, [snapshotData, baseVault, isYBold, isYvUsd, yBoldStakedSnapshot, yvUsdLockedSnapshot, yvUsdAprData])

  const vaultSnapshotTimestampUtc = useMemo(() => {
    const snapshotBlockTime = snapshotData?.blockTime
    if (snapshotBlockTime === null || snapshotBlockTime === undefined) {
      return null
    }

    const numericBlockTime =
      typeof snapshotBlockTime === 'string' ? Number.parseInt(snapshotBlockTime, 10) : Number(snapshotBlockTime)

    if (!Number.isFinite(numericBlockTime) || numericBlockTime <= 0) {
      return null
    }

    return new Date(numericBlockTime * 1000).toISOString()
  }, [snapshotData?.blockTime])

  const isV3Vault = Boolean(
    vaultDetails?.v3 || snapshotData?.apiVersion?.startsWith('3') || snapshotData?.apiVersion?.startsWith('~3')
  )

  // Fetch weekly APY data from REST API
  const {
    data: apyWeeklyData,
    isLoading: apyWeeklyLoading,
    error: apyWeeklyError
  } = useRestTimeseries({
    segment: 'apy-historical',
    chainId: vaultChainId,
    address: yieldDataAddress,
    components: ['weeklyNet'],
    enabled: canFetchVaultData
  })

  // Fetch monthly APY data from REST API
  const {
    data: apyMonthlyData,
    isLoading: apyMonthlyLoading,
    error: apyMonthlyError
  } = useRestTimeseries({
    segment: 'apy-historical',
    chainId: vaultChainId,
    address: yieldDataAddress,
    components: ['monthlyNet'],
    enabled: canFetchVaultData
  })

  // Prefer Kong's published net Oracle rates. Gross APR remains available as a
  // fee-adjusted fallback for older dates without netApy or netApr components.
  const { data: aprOracleAprData } = useRestTimeseries({
    segment: 'apr-oracle',
    chainId: vaultChainId,
    address: yieldDataAddress,
    components: ['netApy', 'netApr', 'apr'],
    enabled: canFetchVaultData && isV3Vault
  })

  // Fetch TVL data from REST API
  const {
    data: tvlData,
    isLoading: tvlLoading,
    error: tvlError
  } = useRestTimeseries({
    segment: 'tvl',
    chainId: vaultChainId,
    address: canonicalVaultAddress,
    enabled: canFetchVaultData
  })

  // Fetch PPS data from REST API
  const {
    data: ppsData,
    isLoading: ppsLoading,
    error: ppsError
  } = useRestTimeseries({
    segment: 'pps',
    chainId: vaultChainId,
    address: yieldDataAddress,
    components: ['humanized'],
    enabled: canFetchVaultData
  })

  // Calculate combined loading states
  const chartsLoading = useMemo(() => {
    // The Oracle overlay is optional and does not block the base chart.
    return apyWeeklyLoading || apyMonthlyLoading || tvlLoading || ppsLoading
  }, [apyWeeklyLoading, apyMonthlyLoading, tvlLoading, ppsLoading])

  // Calculate combined error states
  const chartsError = useMemo(() => {
    // Oracle overlay failures do not hide the base chart.
    return !!apyWeeklyError || !!apyMonthlyError || !!tvlError || !!ppsError
  }, [apyWeeklyError, apyMonthlyError, tvlError, ppsError])

  // Initial loading only waits for vault data (charts can load separately)
  const isInitialLoading = canFetchVaultData && vaultLoading

  // Has errors if vault fails to load
  const hasErrors = canFetchVaultData && !!snapshotError

  return {
    // Vault data
    vaultDetails: isBlacklisted ? null : vaultDetails,
    vaultLoading,
    vaultError: snapshotError ?? undefined,
    vaultSnapshotTimestampUtc,

    // Chart data
    apyWeeklyData,
    apyMonthlyData,
    aprOracleAprData,
    tvlData,
    ppsData,

    // Chart loading states
    chartsLoading,
    chartsError,

    // Combined states
    isInitialLoading,
    hasErrors,
    isBlacklisted,
    blacklistReason,
    overrideConfig,
    canonicalVaultAddress,
    yieldDataAddress
  }
}
