import type { DirectDepositFeeRow } from './direct-deposit-fees'
import type { DownstreamCapitalNode } from './downstream-capital'
import type { FeeStackNode } from './types'
import { type OriginGraph, originVaultId } from './vault-origin'

const vaultId = (vault: FeeStackNode['vault']) => originVaultId(vault.chainId, vault.address)
export const isCombinedProduct = (row: DirectDepositFeeRow) =>
  row.feeRateBasis === 'product' && new Set(row.roots.map((root) => vaultId(root.vault))).size > 1

/** Consolidate only the member identities supplied by the canonical product entry. */
export function internalProductEdges(row: DirectDepositFeeRow, graph: OriginGraph) {
  if (!isCombinedProduct(row)) return []
  const members = new Set(row.roots.map((root) => vaultId(root.vault)))
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  return graph.edges.filter((edge) => {
    if (!members.has(edge.targetNodeId)) return false
    if (members.has(edge.sourceNodeId)) return true
    if (nodes.get(edge.sourceNodeId)?.nodeType !== 'strategy') return false
    const parents = graph.edges.filter((parent) => parent.targetNodeId === edge.sourceNodeId)
    return parents.length > 0 && parents.every((parent) => members.has(parent.sourceNodeId))
  })
}

function mergeAllocations(nodes: DownstreamCapitalNode[]): DownstreamCapitalNode[] {
  const groups = new Map<string, DownstreamCapitalNode[]>()
  for (const node of nodes) {
    const key =
      node.kind === 'vault' || node.kind === 'strategy'
        ? `${node.kind}:${vaultId(node.vault)}`
        : `${node.kind}:${node.vault.name}`
    groups.set(key, [...(groups.get(key) ?? []), node])
  }
  return [...groups.values()].map((group) => ({
    ...group[0],
    capitalUsd: group.every((node) => node.capitalUsd !== null)
      ? group.reduce((total, node) => total + node.capitalUsd!, 0)
      : null,
    perfFee: group.every((node) => node.perfFee === group[0].perfFee) ? group[0].perfFee : null,
    mgmtFee: group.every((node) => node.mgmtFee === group[0].mgmtFee) ? group[0].mgmtFee : null,
    note: [...new Set(group.flatMap((node) => (node.note ? [node.note] : [])))].join(' ') || undefined,
    children: mergeAllocations(group.flatMap((node) => node.children))
  }))
}

/** Merge member allocations, following internal transfers without repeating member wrappers. */
export function combineProductAllocations(
  row: DirectDepositFeeRow,
  roots: DownstreamCapitalNode[],
  adjusted: number
): DownstreamCapitalNode[] {
  const members = new Set(row.roots.map((root) => vaultId(root.vault)))
  const outsideMembers = (node: DownstreamCapitalNode): DownstreamCapitalNode[] => {
    if ((node.kind !== 'vault' && node.kind !== 'strategy') || !members.has(vaultId(node.vault))) {
      return [{ ...node, children: node.children.flatMap(outsideMembers) }]
    }
    if (node.children.length) return node.children.flatMap(outsideMembers)
    if (node.capitalUsd === 0) return []
    return [
      {
        ...node,
        vault: { ...node.vault, name: 'Unresolved product allocation' },
        kind: 'unresolved',
        perfFee: null,
        mgmtFee: null,
        note: 'Member allocation detail is unavailable.'
      }
    ]
  }
  const primary = roots.find((root) => vaultId(root.vault) === vaultId(row.vault))
  if (!primary) return roots
  return [{ ...primary, capitalUsd: adjusted, children: mergeAllocations(roots.flatMap(outsideMembers)) }]
}
