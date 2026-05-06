import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ChainId } from '@/constants/chains'
import type { VaultOverrideConfig } from '@/constants/vaultOverrides'
import { useVaults } from '@/contexts/useVaults'
import { useRestTimeseries } from '@/hooks/useRestTimeseries'
import { fetchKongVaultSnapshotRaw } from '@/lib/kong-vault-client'
import { mapKongSnapshotToVaultExtended } from '@/lib/kong-vault-derivation'
import { fetchVaultManagementEvents } from '@/lib/vault-events'
import { fetchVaultReports } from '@/lib/vault-reports-client'
import type { TimeseriesDataPoint, VaultReportHistoryEntry } from '@/types/dataTypes'
import type { VaultManagementEvent } from '@/types/vaultEventTypes'
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

interface ReportHistoryQueryResult {
  vaultReports: VaultReportHistoryEntry[]
}

interface UseVaultPageDataReturn {
  // Vault data
  vaultDetails: VaultExtended | null
  kongSnapshot: KongVaultSnapshot | null
  vaultLoading: boolean
  vaultError: Error | undefined
  vaultSnapshotTimestampUtc: string | null

  // Chart data (raw)
  apyWeeklyData: TimeseriesQueryResult | undefined
  apyMonthlyData: TimeseriesQueryResult | undefined
  aprOracleAprData: TimeseriesQueryResult | undefined
  tvlData: TimeseriesQueryResult | undefined
  underlyingTvlData: TimeseriesQueryResult | undefined
  ppsData: TimeseriesQueryResult | undefined
  reportHistoryData: ReportHistoryQueryResult | undefined
  reportHistoryLoading: boolean
  reportHistoryError: Error | null
  managementEventsData: VaultManagementEvent[] | undefined
  managementEventsLoading: boolean
  managementEventsError: Error | null

  // Chart loading states
  chartsLoading: boolean
  chartsError: boolean

  // Combined states
  isInitialLoading: boolean
  hasErrors: boolean
  isBlacklisted: boolean
  blacklistReason?: string
  overrideConfig?: VaultOverrideConfig
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

/**
 * Coordinates data fetching for the vault page and manages loading states
 * Uses Kong REST for vault details and timeseries data
 */
export function useVaultPageData({ vaultAddress, vaultChainId }: UseVaultPageDataProps): UseVaultPageDataReturn {
  const isBlacklisted = isVaultBlacklisted(vaultChainId, vaultAddress)
  const blacklistReason = getVaultBlacklistReason(vaultChainId, vaultAddress)
  const overrideConfig = getVaultOverride(vaultChainId, vaultAddress)
  const { vaults } = useVaults()
  const normalizedAddress = vaultAddress.toLowerCase()

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
    queryFn: () => fetchKongVaultSnapshotRaw(vaultChainId, vaultAddress),
    staleTime: 30 * 1000,
    enabled: Boolean(vaultAddress)
  })

  const vaultDetails = useMemo(() => {
    if (!snapshotData) {
      return baseVault ? applyVaultOverride(baseVault) : null
    }

    return applyVaultOverride(mapKongSnapshotToVaultExtended(snapshotData, baseVault))
  }, [snapshotData, baseVault])

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
    address: vaultAddress,
    components: ['weeklyNet']
  })

  // Fetch monthly APY data from REST API
  const {
    data: apyMonthlyData,
    isLoading: apyMonthlyLoading,
    error: apyMonthlyError
  } = useRestTimeseries({
    segment: 'apy-historical',
    chainId: vaultChainId,
    address: vaultAddress,
    components: ['monthlyNet']
  })

  // Fetch APR-oracle APR timeseries from REST API (v3 only)
  const { data: aprOracleAprData } = useRestTimeseries({
    segment: 'apr-oracle',
    chainId: vaultChainId,
    address: vaultAddress,
    components: ['apr'],
    enabled: isV3Vault
  })

  // Fetch TVL data from REST API
  const {
    data: tvlData,
    isLoading: tvlLoading,
    error: tvlError
  } = useRestTimeseries({
    segment: 'tvl',
    chainId: vaultChainId,
    address: vaultAddress
  })

  const {
    data: underlyingTvlData,
    isLoading: underlyingTvlLoading,
    error: underlyingTvlError
  } = useRestTimeseries({
    segment: 'tvl',
    chainId: vaultChainId,
    address: vaultAddress,
    components: ['totalAssets']
  })

  // Fetch PPS data from REST API
  const {
    data: ppsData,
    isLoading: ppsLoading,
    error: ppsError
  } = useRestTimeseries({
    segment: 'pps',
    chainId: vaultChainId,
    address: vaultAddress,
    components: ['humanized']
  })

  const {
    data: reportHistoryEntries,
    isLoading: reportHistoryLoading,
    error: reportHistoryError
  } = useQuery<VaultReportHistoryEntry[], Error>({
    queryKey: ['kong', 'vault', 'reports', vaultChainId, normalizedAddress],
    queryFn: () => fetchVaultReports(vaultChainId, vaultAddress),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(vaultAddress)
  })

  const {
    data: managementEventsData,
    isLoading: managementEventsLoading,
    error: managementEventsError
  } = useQuery<VaultManagementEvent[], Error>({
    queryKey: ['envio', 'vault', 'management-events', vaultChainId, normalizedAddress],
    queryFn: () => fetchVaultManagementEvents(vaultAddress, vaultChainId),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(vaultAddress)
  })

  const reportHistoryData = useMemo<ReportHistoryQueryResult | undefined>(() => {
    if (!reportHistoryEntries) {
      return undefined
    }

    return {
      vaultReports: reportHistoryEntries
    }
  }, [reportHistoryEntries])

  // Calculate combined loading states
  const chartsLoading = useMemo(() => {
    // `aprOracleApyLoading` is intentionally excluded since it's optional overlay data.
    return apyWeeklyLoading || apyMonthlyLoading || tvlLoading || underlyingTvlLoading || ppsLoading
  }, [apyWeeklyLoading, apyMonthlyLoading, tvlLoading, underlyingTvlLoading, ppsLoading])

  // Calculate combined error states
  const chartsError = useMemo(() => {
    // `aprOracleApyError` is intentionally excluded since it's optional overlay data.
    return !!apyWeeklyError || !!apyMonthlyError || !!tvlError || !!underlyingTvlError || !!ppsError
  }, [apyWeeklyError, apyMonthlyError, tvlError, underlyingTvlError, ppsError])

  // Initial loading only waits for vault data (charts can load separately)
  const isInitialLoading = vaultLoading

  // Has errors if vault fails to load
  const hasErrors = !!snapshotError

  return {
    // Vault data
    vaultDetails,
    kongSnapshot: snapshotData ?? null,
    vaultLoading,
    vaultError: snapshotError ?? undefined,
    vaultSnapshotTimestampUtc,

    // Chart data
    apyWeeklyData,
    apyMonthlyData,
    aprOracleAprData,
    tvlData,
    underlyingTvlData,
    ppsData,
    reportHistoryData,
    reportHistoryLoading,
    reportHistoryError: reportHistoryError ?? null,
    managementEventsData,
    managementEventsLoading,
    managementEventsError: managementEventsError ?? null,

    // Chart loading states
    chartsLoading,
    chartsError,

    // Combined states
    isInitialLoading,
    hasErrors,
    isBlacklisted,
    blacklistReason,
    overrideConfig
  }
}
