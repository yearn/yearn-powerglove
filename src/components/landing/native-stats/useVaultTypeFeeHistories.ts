import { useQuery } from '@tanstack/react-query'
import { fetchKongVaultListRaw } from '@/lib/kong-vault-client'
import type { CanonicalVaultFee } from './canonical-fees'
import { type FeeHistoryPeriod, feeHistoryBoundary } from './fee-history'
import { resolveStatsApiBase } from './hooks'

export async function fetchVaultTypeFeeHistories(
  base: string,
  query: string,
  periods: FeeHistoryPeriod[],
  signal: AbortSignal
): Promise<CanonicalVaultFee[][]> {
  const datasetId = new URLSearchParams(query).get('datasetId')
  const histories: CanonicalVaultFee[][] = new Array(periods.length)
  let next = 0
  // Bound the fan-out while the API exposes vault totals per requested range.
  await Promise.all(
    Array.from({ length: Math.min(6, periods.length) }, async () => {
      while (next < periods.length) {
        const index = next++
        const params = new URLSearchParams(query)
        params.delete('interval')
        params.set('since', String(Date.parse(feeHistoryBoundary(periods[index], 'start')) / 1000))
        params.set('until', String(Date.parse(feeHistoryBoundary(periods[index], 'end')) / 1000))
        const response = await fetch(`${base}/api/fees/vaults?${params}`, { signal })
        if (!response.ok) throw new Error('Vault history request failed')
        const payload = await response.json()
        if (
          !Array.isArray(payload.vaults) ||
          (datasetId && payload.datasetId !== datasetId) ||
          !payload.vaults.every(
            (vault: CanonicalVaultFee) =>
              typeof vault.address === 'string' &&
              typeof vault.chainId === 'number' &&
              typeof vault.contractFamily === 'string' &&
              vault.lifetimeEarnings != null
          )
        ) {
          throw new Error('Vault history does not match the selected dataset')
        }
        histories[index] = payload.vaults
      }
    })
  ).catch((error: unknown) => {
    next = periods.length
    throw error
  })
  return histories
}

export function useVaultTypeFeeHistories(query: string, periods: FeeHistoryPeriod[]) {
  const base = resolveStatsApiBase('fees') ?? ''
  const catalog = useQuery({
    queryKey: ['fee-vault-type-catalog'],
    queryFn: async () => {
      const vaults = await fetchKongVaultListRaw()
      if (!vaults.length) throw new Error('Vault catalog is unavailable')
      return vaults
    },
    staleTime: 15 * 60 * 1000,
    retry: false
  })
  const history = useQuery({
    queryKey: ['fee-vault-type-history', base, query, periods],
    queryFn: ({ signal }) => fetchVaultTypeFeeHistories(base, query, periods, signal),
    enabled: periods.length > 0,
    staleTime: Infinity,
    retry: false
  })
  return {
    catalog: catalog.data ?? [],
    histories: history.data ?? [],
    loading: catalog.isPending || (periods.length > 0 && history.isPending),
    error: catalog.isError || history.isError,
    retry: () => {
      if (catalog.isError) void catalog.refetch()
      if (history.isError) void history.refetch()
    }
  }
}
