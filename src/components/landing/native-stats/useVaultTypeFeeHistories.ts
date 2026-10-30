import { useQuery } from '@tanstack/react-query'
import { assertCanonicalFeeResponse } from '@/lib/fee-api-contract'
import { fetchKongVaultListRaw } from '@/lib/kong-vault-client'
import { type CanonicalVaultHistoryFee, isMoney } from './canonical-fees'
import { type FeeHistoryPeriod, feeHistoryBoundary } from './fee-history'
import { resolveStatsApiBase } from './hooks'

export async function fetchVaultTypeFeeHistories(
  base: string,
  query: string,
  periods: FeeHistoryPeriod[],
  signal: AbortSignal
): Promise<CanonicalVaultHistoryFee[][]> {
  if (!periods.length) return []
  const params = new URLSearchParams(query)
  const datasetId = params.get('datasetId')
  const interval = params.get('interval') ?? (periods[0].period.length === 10 ? 'weekly' : 'monthly')
  const ranges = periods.map((period) => ({
    period: period.period,
    startTimestamp: Date.parse(feeHistoryBoundary(period, 'start')) / 1000,
    endTimestamp: Date.parse(feeHistoryBoundary(period, 'end')) / 1000
  }))
  params.set('interval', interval)
  params.set('since', String(Math.min(...ranges.map((range) => range.startTimestamp))))
  params.set('until', String(Math.max(...ranges.map((range) => range.endTimestamp))))
  const response = await fetch(`${base}/api/fees/vaults/history?${params}`, { signal })
  if (!response.ok) throw new Error('Vault history request failed')
  const payload = await response.json()
  assertCanonicalFeeResponse(payload, params.get('scope') ?? 'contract')
  if (
    !Array.isArray(payload.buckets) ||
    payload.interval !== interval ||
    (datasetId && payload.datasetId !== datasetId) ||
    typeof payload.dataCutoffTimestamp !== 'number' ||
    !Number.isFinite(payload.dataCutoffTimestamp) ||
    payload.dataCutoffTimestamp <= 0 ||
    ranges.some((range) => range.startTimestamp >= payload.dataCutoffTimestamp)
  ) {
    throw new Error('Vault history does not match the selected dataset')
  }
  const histories = ranges.map((range) => {
    const buckets = payload.buckets.filter(
      (bucket: { period: string; startTimestamp: number; endTimestamp: number }) =>
        bucket != null &&
        bucket.period === range.period &&
        bucket.startTimestamp === range.startTimestamp &&
        bucket.endTimestamp === range.endTimestamp
    )
    const vaults: CanonicalVaultHistoryFee[] | undefined = buckets.length === 1 ? buckets[0].vaults : undefined
    if (
      !Array.isArray(vaults) ||
      !vaults.every(
        (vault) =>
          vault != null &&
          typeof vault.address === 'string' &&
          typeof vault.chainId === 'number' &&
          typeof vault.contractFamily === 'string' &&
          vault.lifetimeEarnings != null &&
          [vault.totalFeesPaidUsd, vault.lifetimeEarnings.netYieldUsd].every(
            (value) => isMoney(value) && (value === null || Number.isFinite(Number(value)))
          )
      )
    ) {
      throw new Error('Vault history does not match the selected dataset')
    }
    return vaults
  })
  return histories
}

export function useVaultTypeFeeHistories(query: string, periods: FeeHistoryPeriod[]) {
  const base = resolveStatsApiBase('fees') ?? ''
  const catalog = useQuery({
    queryKey: ['fee-vault-type-required-catalog'],
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
