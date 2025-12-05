import { useQuery, ApolloError } from '@apollo/client'
import { GET_VAULT_DETAILS } from '@/graphql/queries/vaults'
import { VaultExtended } from '@/types/vaultTypes'
import { TimeseriesDataPoint } from '@/types/dataTypes'
import { useMemo } from 'react'
import { ChainId } from '@/constants/chains'
import { useYDaemonVault } from '@/hooks/useYDaemonVaults'
import { useRestTimeseries } from '@/hooks/useRestTimeseries'

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
  vaultError: ApolloError | undefined

  // Chart data (raw)
  apyWeeklyData: TimeseriesQueryResult | undefined
  apyMonthlyData: TimeseriesQueryResult | undefined
  tvlData: TimeseriesQueryResult | undefined
  ppsData: TimeseriesQueryResult | undefined

  // Chart loading states
  chartsLoading: boolean
  chartsError: boolean

  // Combined states
  isInitialLoading: boolean
  hasErrors: boolean
}

/**
 * Coordinates data fetching for the vault page and manages loading states
 * Uses GraphQL for vault details and REST API for timeseries data
 */
export function useVaultPageData({
  vaultAddress,
  vaultChainId,
}: UseVaultPageDataProps): UseVaultPageDataReturn {
  // Fetch vault details
  const {
    data: vaultData,
    loading: vaultLoading,
    error: vaultError,
  } = useQuery<{ vault: VaultExtended }>(GET_VAULT_DETAILS, {
    variables: { address: vaultAddress, chainId: vaultChainId },
  })
  const { data: yDaemonVault, isLoading: yDaemonLoading } = useYDaemonVault(
    vaultChainId,
    vaultAddress
  )

  // Fetch weekly APY data from REST API
  const {
    data: apyWeeklyData,
    isLoading: apyWeeklyLoading,
    error: apyWeeklyError,
  } = useRestTimeseries({
    segment: 'apy-historical',
    chainId: vaultChainId,
    address: vaultAddress,
    components: ['weeklyNet'],
  })

  // Fetch monthly APY data from REST API
  const {
    data: apyMonthlyData,
    isLoading: apyMonthlyLoading,
    error: apyMonthlyError,
  } = useRestTimeseries({
    segment: 'apy-historical',
    chainId: vaultChainId,
    address: vaultAddress,
    components: ['monthlyNet'],
  })

  // Fetch TVL data from REST API
  const {
    data: tvlData,
    isLoading: tvlLoading,
    error: tvlError,
  } = useRestTimeseries({
    segment: 'tvl',
    chainId: vaultChainId,
    address: vaultAddress,
  })

  // Fetch PPS data from REST API
  const {
    data: ppsData,
    isLoading: ppsLoading,
    error: ppsError,
  } = useRestTimeseries({
    segment: 'pps',
    chainId: vaultChainId,
    address: vaultAddress,
    components: ['humanized'],
  })

  // Extract vault details with null safety
  const vaultDetails = useMemo(() => {
    if (!vaultData?.vault) return null
    const base = vaultData.vault
    if (!yDaemonVault) {
      return {
        ...base,
        forwardApyNet: base.forwardApyNet ?? null,
        strategyForwardAprs: base.strategyForwardAprs ?? {},
      }
    }
    const strategyAprs: Record<string, number | null> = {}
    yDaemonVault.strategies?.forEach(strategy => {
      if (!strategy?.address) return
      strategyAprs[strategy.address.toLowerCase()] = strategy.netAPR ?? null
    })
    return {
      ...base,
      forwardApyNet:
        yDaemonVault.apr?.forwardAPR?.netAPR ?? base.forwardApyNet ?? null,
      strategyForwardAprs: strategyAprs,
      kind: base.kind,
    }
  }, [vaultData, yDaemonVault])

  // Calculate combined loading states
  const chartsLoading = useMemo(() => {
    return apyWeeklyLoading || apyMonthlyLoading || tvlLoading || ppsLoading
  }, [apyWeeklyLoading, apyMonthlyLoading, tvlLoading, ppsLoading])

  // Calculate combined error states
  const chartsError = useMemo(() => {
    return !!apyWeeklyError || !!apyMonthlyError || !!tvlError || !!ppsError
  }, [apyWeeklyError, apyMonthlyError, tvlError, ppsError])

  // Initial loading only waits for vault data (charts can load separately)
  const isInitialLoading = vaultLoading || yDaemonLoading

  // Has errors if vault fails to load
  const hasErrors = !!vaultError

  return {
    // Vault data
    vaultDetails,
    vaultLoading,
    vaultError,

    // Chart data
    apyWeeklyData: apyWeeklyData,
    apyMonthlyData: apyMonthlyData,
    tvlData,
    ppsData,

    // Chart loading states
    chartsLoading,
    chartsError,

    // Combined states
    isInitialLoading,
    hasErrors,
  }
}
