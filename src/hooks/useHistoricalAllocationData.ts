// src/hooks/useHistoricalAllocationData.ts
//
// Fetches the "Historical Allocation" series for a vault from Kong's indexed
// `StrategyReported` events (exposed via the `vaultReports` GraphQL field) and
// reconstructs per-strategy allocation shares over time. See `kong-data.md`.

import { useQuery } from '@tanstack/react-query'
import type { ChainId } from '@/constants/chains'
import {
  buildHistoricalAllocationSeries,
  type HistoricalAllocationSeries,
  type VaultReportEvent
} from '@/lib/historical-allocation'
import { fetchStrategyDisplayNames, type NameInfo } from '@/lib/kong-strategy-names'

const KONG_GQL_URL = import.meta.env.VITE_PUBLIC_GRAPHQL_URL || 'https://kong.yearn.fi/api/gql'

const VAULT_REPORTS_QUERY = `query HistoricalAllocationVaultReports($chainId: Int, $address: String) {
  vaultReports(chainId: $chainId, address: $address) {
    strategy
    currentDebt
    currentDebtUsd
    apr { net }
    blockNumber
    blockTime
    logIndex
    transactionHash
    eventName
  }
}`

interface KongGraphqlResponse<T> {
  data?: T
  errors?: Array<{ message?: string }>
}

async function fetchVaultReports(chainId: number, address: string): Promise<VaultReportEvent[]> {
  const response = await fetch(KONG_GQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: VAULT_REPORTS_QUERY, variables: { chainId, address } })
  })

  if (!response.ok) {
    throw new Error(`Kong vaultReports request failed (${response.status})`)
  }

  const payload = (await response.json()) as KongGraphqlResponse<{ vaultReports?: VaultReportEvent[] }>
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message ?? 'Kong vaultReports returned errors')
  }

  return payload.data?.vaultReports ?? []
}

export function buildHistoricalAllocationQueryKey(chainId: number | undefined, address: string | undefined) {
  return ['historical-allocation', chainId ?? null, (address ?? '').toLowerCase()] as const
}

interface UseHistoricalAllocationDataResult {
  series: HistoricalAllocationSeries | null
  isLoading: boolean
  error: Error | null
}

export function useHistoricalAllocationData(
  chainId: ChainId | undefined,
  vaultAddress: string | undefined
): UseHistoricalAllocationDataResult {
  const { data, isLoading, error } = useQuery<HistoricalAllocationSeries | null, Error>({
    queryKey: buildHistoricalAllocationQueryKey(chainId, vaultAddress),
    queryFn: async () => {
      if (!chainId || !vaultAddress) return null

      const reports = await fetchVaultReports(chainId, vaultAddress)
      if (reports.length === 0) {
        return { points: [], strategies: [], reportCount: 0 }
      }

      const strategyAddresses = [
        ...new Set(reports.map((report) => report.strategy?.toLowerCase()).filter(Boolean) as string[])
      ]

      // Names are best-effort — never block the chart on a name lookup failure.
      const namesByAddress = strategyAddresses.length
        ? await fetchStrategyDisplayNames(chainId, strategyAddresses).catch(() => ({}) as Record<string, NameInfo>)
        : {}

      return buildHistoricalAllocationSeries(reports, namesByAddress)
    },
    enabled: Boolean(chainId && vaultAddress),
    staleTime: 15 * 60 * 1000,
    retry: 1
  })

  return {
    series: data ?? null,
    isLoading,
    error: error ?? null
  }
}
