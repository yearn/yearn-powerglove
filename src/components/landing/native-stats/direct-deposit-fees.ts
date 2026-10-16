import type { FeeStackChain, FeeStackEntry, FeeStackNode } from './types'

export interface DirectDepositFeeRow {
  vault: FeeStackNode['vault']
  root: FeeStackNode
  roots: FeeStackNode[]
  performanceFee: number | null
  managementFee: number | null
  feeRateBasis: 'stack' | 'vault' | 'product'
  adjustedTvlUsd?: number | null
}

export function directDepositFeeRows(chains: FeeStackChain[], entries?: FeeStackEntry[]): DirectDepositFeeRow[] {
  if (entries)
    return entries.filter((entry) => entry.roots.length > 0).map((entry) => ({ ...entry, root: entry.roots[0] }))
  const key = (node: FeeStackNode) => `${node.vault.chainId}:${node.vault.address.toLowerCase()}`
  const rows = new Map<string, DirectDepositFeeRow>(
    chains.map((chain) => [
      key(chain.root),
      {
        vault: chain.root.vault,
        root: chain.root,
        roots: [chain.root],
        feeRateBasis: 'stack',
        performanceFee: chain.effectivePerfFee,
        managementFee: chain.effectiveMgmtFee
      }
    ])
  )
  const visit = (node: FeeStackNode) => {
    if (!rows.has(key(node))) {
      const supported = !node.children.length && node.availability?.state === 'available'
      rows.set(key(node), {
        vault: node.vault,
        root: node,
        roots: [node],
        feeRateBasis: 'stack',
        performanceFee: supported ? node.perfFee : null,
        managementFee: supported ? node.mgmtFee : null
      })
    }
    node.children.forEach(visit)
  }
  chains.forEach((chain) => {
    visit(chain.root)
  })
  return [...rows.values()]
}

export interface FeeAnalysisTvlGraph {
  datasetId: string
  nodes: Array<{ chainId: number; address: string; externalTvlUsd: number | null }>
}

export function externalTvlByVault(graph: FeeAnalysisTvlGraph | null | undefined, datasetId: string | undefined) {
  const values = new Map<string, number>()
  if (!datasetId || graph?.datasetId !== datasetId) return values
  for (const node of graph.nodes) {
    if (typeof node.externalTvlUsd === 'number' && Number.isFinite(node.externalTvlUsd)) {
      values.set(`${node.chainId}:${node.address.toLowerCase()}`, node.externalTvlUsd)
    }
  }
  return values
}

export function feeStackLayers(root: FeeStackNode, depth = 0): Array<{ node: FeeStackNode; depth: number }> {
  return [{ node: root, depth }, ...root.children.flatMap((child) => feeStackLayers(child, depth + 1))]
}

export function directDepositTvl(row: DirectDepositFeeRow, externalTvl: Map<string, number>): number | null {
  return row.adjustedTvlUsd !== undefined
    ? row.adjustedTvlUsd
    : (externalTvl.get(`${row.vault.chainId}:${row.vault.address.toLowerCase()}`) ?? null)
}
