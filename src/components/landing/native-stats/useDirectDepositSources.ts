import { useQueries, useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { isSupportedChainId } from '@/constants/chains'
import { findDepositSnapshotBlock, readDepositBalances } from '@/lib/direct-deposit-balances'
import type { DirectDepositFeeRow } from './direct-deposit-fees'
import { directDepositSources, registeredDepositTargets } from './direct-deposit-sources'
import type { OriginGraph, OriginVault } from './vault-origin'

export function useDirectDepositSources(
  row: DirectDepositFeeRow,
  vaults: Map<string, OriginVault>,
  graph: OriginGraph | null,
  datasetId: string | undefined,
  direct: number | null,
  active = true
) {
  const client = useQueryClient()
  const targets = registeredDepositTargets(row)
  const observedTimestamp = graph?.asOfTimestamp
  const timestamp =
    typeof observedTimestamp === 'number' && Number.isSafeInteger(observedTimestamp) && observedTimestamp > 0
      ? observedTimestamp
      : undefined
  const enabled = active && !!datasetId && graph?.datasetId === datasetId && timestamp !== undefined && direct !== null
  const queries = useQueries({
    queries: targets.map((target) => {
      const holders = [
        ...new Set(
          target.groups.flatMap((group) =>
            group.depositors.map((depositor) => depositor.address.toLowerCase() as Address)
          )
        )
      ].sort()
      return {
        queryKey: ['direct-deposit-balances', datasetId, timestamp, target.id, holders],
        enabled: enabled && isSupportedChainId(target.chainId),
        staleTime: Infinity,
        retry: false,
        queryFn: async () => {
          if (!isSupportedChainId(target.chainId) || !enabled || !timestamp)
            throw new Error('Deposit snapshot unavailable')
          const chainId = target.chainId
          const block = await client.fetchQuery({
            queryKey: ['direct-deposit-block', chainId, timestamp],
            queryFn: () => findDepositSnapshotBlock(chainId, timestamp),
            staleTime: Infinity,
            retry: false
          })
          return readDepositBalances(chainId, target.address as Address, holders, block)
        }
      }
    })
  })
  const balances = new Map(
    targets.flatMap((target, index) =>
      enabled && queries[index].data ? [[target.id, queries[index].data!] as const] : []
    )
  )
  const breakdown = directDepositSources(targets, vaults, enabled ? graph : null, balances, direct)
  const loading = enabled && queries.some((query) => query.isFetching)
  return {
    ...breakdown,
    loading,
    unavailable: !loading && breakdown.groups.some((group) => group.amount === null),
    canRetry: enabled && targets.some((target) => isSupportedChainId(target.chainId)),
    retry: () => {
      for (const query of queries) if (enabled) void query.refetch()
    }
  }
}

export type DirectDepositSourceState = ReturnType<typeof useDirectDepositSources>
