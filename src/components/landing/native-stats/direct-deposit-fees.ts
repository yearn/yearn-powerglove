import type { FeeStackChain, FeeStackNode } from './types'

export function directDepositFeeRows(chains: FeeStackChain[]) {
  const key = (node: FeeStackNode) => `${node.vault.chainId}:${node.vault.address.toLowerCase()}`
  const rows = new Map(
    chains.map((chain) => [
      key(chain.root),
      {
        vault: chain.root.vault,
        root: chain.root,
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
