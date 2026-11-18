import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { isSupportedChainId } from '@/constants/chains'
import { type DepositBalances, findDepositSnapshotBlock, readDepositBalanceBatch } from '@/lib/direct-deposit-balances'
import { type DirectDepositFeeRow, directDepositTvl, externalTvlByVault } from './direct-deposit-fees'
import { directDepositSources, registeredDepositTargets, treasuryExclusions } from './direct-deposit-sources'
import type { DirectDepositSourceState } from './useDirectDepositSources'
import { type OriginGraph, type OriginVault, originVaultId } from './vault-origin'

export function useTableDepositSources(
  rows: DirectDepositFeeRow[],
  vaults: Map<string, OriginVault>,
  graph: OriginGraph | null,
  datasetId: string | undefined
) {
  const client = useQueryClient()
  const targets = useMemo(
    () =>
      [
        ...new Map(rows.flatMap((row) => registeredDepositTargets(row)).map((target) => [target.id, target])).values()
      ].sort((a, b) => a.id.localeCompare(b.id)),
    [rows]
  )
  const chains = [...new Set(targets.map((target) => target.chainId))].filter(isSupportedChainId)
  const timestamp = graph?.asOfTimestamp
  const enabled =
    !!datasetId &&
    graph?.datasetId === datasetId &&
    vaults.size > 0 &&
    typeof timestamp === 'number' &&
    Number.isSafeInteger(timestamp) &&
    timestamp > 0
  const state = useQueries({
    queries: chains.map((chainId) => {
      const chainTargets = targets
        .filter((target) => target.chainId === chainId)
        .map((target) => ({
          id: target.id,
          address: target.address as Address,
          holders: [
            ...new Set(target.groups.flatMap((group) => group.depositors.map((holder) => holder.address.toLowerCase())))
          ].sort() as Address[]
        }))
      return {
        queryKey: ['table-deposit-balances', datasetId, timestamp, chainId, chainTargets],
        enabled,
        staleTime: Infinity,
        retry: false,
        queryFn: async () => {
          if (!enabled || !timestamp) throw new Error('Deposit snapshot unavailable')
          const block = await client.fetchQuery({
            queryKey: ['direct-deposit-block', chainId, timestamp],
            queryFn: () => findDepositSnapshotBlock(chainId, timestamp),
            staleTime: Infinity,
            retry: false
          })
          return readDepositBalanceBatch(chainId, chainTargets, block)
        }
      }
    }),
    combine: (queries) => ({
      balances: queries.map((query) => query.data),
      fetching: queries.map((query) => query.isFetching)
    })
  })
  return useMemo(() => {
    const chains = [...new Set(targets.map((target) => target.chainId))].filter(isSupportedChainId)
    const balances = new Map<string, DepositBalances>(
      enabled ? state.balances.flatMap((balances) => [...(balances ?? [])]) : []
    )
    const published = externalTvlByVault(graph, datasetId)
    const sources = new Map<string, DirectDepositSourceState>()
    const exclusions = new Map<string, number | null>()
    for (const row of rows) {
      const rowTargets = registeredDepositTargets(row)
      const members = new Set(row.roots.map((root) => originVaultId(root.vault.chainId, root.vault.address)))
      const bridges = graph?.bridgeExclusions?.filter((bridge) => members.has(bridge.sourceNodeId)) ?? []
      const adjusted = directDepositTvl(row, published)
      const direct =
        adjusted !== null && bridges.every((bridge) => typeof bridge.tvlUsd === 'number')
          ? adjusted + bridges.reduce((sum, bridge) => sum + bridge.tvlUsd!, 0)
          : null
      const breakdown = directDepositSources(rowTargets, vaults, enabled ? graph : null, balances, direct)
      const rowChains = new Set(rowTargets.map((target) => target.chainId))
      const rowChainIds = chains.filter((chainId) => rowChains.has(chainId))
      const loading = enabled && chains.some((chainId, index) => rowChains.has(chainId) && state.fetching[index])
      sources.set(originVaultId(row.vault.chainId, row.vault.address), {
        ...breakdown,
        loading,
        unavailable: !loading && breakdown.groups.some((group) => group.amount === null),
        canRetry: enabled && rowChainIds.length > 0,
        retry: () => {
          for (const chainId of rowChainIds)
            void client.refetchQueries({ queryKey: ['table-deposit-balances', datasetId, timestamp, chainId] })
        }
      })
      for (const [id, value] of treasuryExclusions(row, breakdown.groups)) {
        exclusions.set(id, value)
      }
    }
    const loading = enabled && state.fetching.some(Boolean)
    return {
      sources,
      exclusions,
      loading,
      unavailable: enabled && !loading && [...exclusions.values()].some((amount) => amount === null),
      retry: () => {
        void client.refetchQueries({ queryKey: ['table-deposit-balances', datasetId, timestamp] })
      }
    }
  }, [state, targets, rows, vaults, graph, datasetId, timestamp, enabled, client])
}
