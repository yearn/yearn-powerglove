import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchStrategyDisplayNames } from '@/lib/kong-strategy-names'
import { fetchKongVaultSnapshotRaw } from '@/lib/kong-vault-client'
import { deriveKongSnapshotStrategies } from '@/lib/kong-vault-derivation'
import type { DownstreamCapitalNode } from './downstream-capital'
import type { FeeStackNode } from './types'
import { originVaultId } from './vault-origin'

type FlowVault = FeeStackNode['vault']
const id = (vault: FlowVault) => originVaultId(vault.chainId, vault.address)
const unnamed = (vault: FlowVault) =>
  !vault.name?.trim() ||
  vault.name.toLowerCase() === vault.address.toLowerCase() ||
  /^Strategy \d+$/i.test(vault.name.trim())

/** Current display metadata only; published capital, fee rates, and product names stay unchanged. */
export function useFeeFlowStrategyNames(roots: DownstreamCapitalNode[] | null) {
  const client = useQueryClient()
  const parents = new Map<string, FlowVault>()
  const addresses = new Map<string, FlowVault>()
  const visit = (node: DownstreamCapitalNode) => {
    const missing = node.children.filter(
      (child) => (child.kind === 'vault' || child.kind === 'strategy') && unnamed(child.vault)
    )
    for (const child of missing) addresses.set(id(child.vault), child.vault)
    if (missing.length && node.kind === 'vault') parents.set(id(node.vault), node.vault)
    node.children.forEach(visit)
  }
  roots?.forEach(visit)
  const sortedParents = [...parents].sort(([a], [b]) => a.localeCompare(b))
  const sortedAddresses = [...addresses].sort(([a], [b]) => a.localeCompare(b))
  const { data } = useQuery({
    queryKey: ['fee-flow-strategy-names', sortedParents.map(([key]) => key), sortedAddresses.map(([key]) => key)],
    enabled: addresses.size > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const names: Record<string, string> = {}
      const snapshots = await Promise.all(
        sortedParents.map(async ([, vault]) => ({
          chainId: vault.chainId,
          snapshot: await client
            .fetchQuery({
              queryKey: ['kong', 'vault', 'snapshot', vault.chainId, vault.address.toLowerCase()],
              queryFn: () => fetchKongVaultSnapshotRaw(vault.chainId, vault.address),
              staleTime: 5 * 60 * 1000,
              retry: false
            })
            .catch(() => null)
        }))
      )
      for (const { chainId, snapshot } of snapshots) {
        if (!snapshot) continue
        for (const strategy of deriveKongSnapshotStrategies(snapshot)) {
          const vault = { ...strategy, chainId }
          if (!unnamed(vault)) names[id(vault)] = strategy.name
        }
      }
      const missingByChain = new Map<number, string[]>()
      for (const [key, vault] of sortedAddresses) {
        if (names[key]) continue
        missingByChain.set(vault.chainId, [...(missingByChain.get(vault.chainId) ?? []), vault.address])
      }
      const fallbacks = await Promise.all(
        [...missingByChain].map(async ([chainId, strategyAddresses]) => ({
          chainId,
          names: await fetchStrategyDisplayNames(chainId, strategyAddresses).catch(() => ({}))
        }))
      )
      for (const fallback of fallbacks) {
        for (const [address, info] of Object.entries(fallback.names)) {
          if (!unnamed({ address, chainId: fallback.chainId, name: info.name })) {
            names[originVaultId(fallback.chainId, address)] = info.name
          }
        }
      }
      // Only replace placeholders that were requested, never canonical named vaults.
      return Object.fromEntries(sortedAddresses.filter(([key]) => names[key]).map(([key]) => [key, names[key]]))
    }
  })
  return data ?? {}
}
