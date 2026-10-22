import type { DirectDepositFeeRow } from './direct-deposit-fees'
import { directDepositTvl, feeStackLayers } from './direct-deposit-fees'
import { downstreamCapital } from './downstream-capital'
import type { FeeStackNode } from './types'
import type { OriginAudit, OriginGraph, OriginVault } from './vault-origin'
import { originVaultId } from './vault-origin'

export function feeCapitalVaults(audit: OriginAudit | null, datasetId: string | undefined) {
  return new Map(
    audit && datasetId && audit.datasetId === datasetId
      ? audit.vaults.map((vault) => [originVaultId(vault.chainId, vault.address), vault])
      : []
  )
}
const rootId = (root: FeeStackNode) => originVaultId(root.vault.chainId, root.vault.address)
const distinctRoots = (row: DirectDepositFeeRow) => [...new Map(row.roots.map((root) => [rootId(root), root])).values()]
const sumKnown = (values: (number | null | undefined)[]) =>
  values.every((value) => typeof value === 'number' && Number.isFinite(value))
    ? values.reduce<number>((sum, value) => sum + (value as number), 0)
    : null
export const reportedDepositTvl = (row: DirectDepositFeeRow, vaults: Map<string, OriginVault>) =>
  sumKnown(distinctRoots(row).map((root) => vaults.get(rootId(root))?.tvlUsd))

export interface UpstreamFeeCapital {
  sources: FeeStackNode['vault'][]
  via: string | null
  amount: number
}

export function effectiveFeeCapital(
  row: DirectDepositFeeRow,
  vaults: Map<string, OriginVault>,
  graph: OriginGraph | null,
  datasetId: string | undefined,
  feeNodes: Map<string, FeeStackNode> = new Map()
) {
  const roots = distinctRoots(row)
  const members = new Set(roots.map(rootId))
  const reported = reportedDepositTvl(row, vaults)
  const adjustedByVault = new Map(
    [...vaults].flatMap(([id, vault]) =>
      typeof vault.countedTvlUsd === 'number' ? [[id, vault.countedTvlUsd] as const] : []
    )
  )
  const adjusted = directDepositTvl(row, adjustedByVault)
  const rootAdjusted = roots.map((root) => vaults.get(rootId(root))?.countedTvlUsd)
  const adjustedSum = sumKnown(rootAdjusted)
  // Keep the canonical product total; never invent an allocation between members.
  const consistent =
    adjusted !== null &&
    adjustedSum !== null &&
    Math.abs(adjusted - adjustedSum) < 0.01 &&
    roots.every((root, index) => {
      const reportedRoot = vaults.get(rootId(root))?.tvlUsd
      const adjustedRoot = rootAdjusted[index]
      return (
        typeof reportedRoot === 'number' &&
        typeof adjustedRoot === 'number' &&
        adjustedRoot >= 0 &&
        adjustedRoot <= reportedRoot + 0.01 &&
        Math.abs(root.capitalUsd - reportedRoot) < 0.01
      )
    })
  const matched = !!datasetId && graph?.datasetId === datasetId
  const downstreamRoots =
    consistent && matched
      ? downstreamCapital(
          roots.map((root, index) => ({ vault: root.vault, capitalUsd: rootAdjusted[index]! })),
          vaults,
          graph,
          new Map([
            ...roots.flatMap((root) => feeStackLayers(root).map(({ node }) => [rootId(node), node] as const)),
            ...feeNodes
          ])
        )
      : null
  const excludedBridges = matched
    ? sumKnown(
        (graph.bridgeExclusions ?? [])
          .filter((bridge) => members.has(bridge.sourceNodeId))
          .map((bridge) => bridge.tvlUsd)
      )
    : null
  const difference =
    reported !== null && adjusted !== null && excludedBridges !== null ? reported - adjusted - excludedBridges : null
  const upstream = difference !== null && difference >= -0.01 ? Math.max(0, difference) : null
  const positions: UpstreamFeeCapital[] = []
  if (matched) {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
    for (const edge of graph.edges) {
      if (!members.has(edge.targetNodeId) || typeof edge.deductedTvlUsd !== 'number' || edge.deductedTvlUsd <= 0)
        continue
      const source = nodes.get(edge.sourceNodeId)
      const parents =
        source?.nodeType === 'strategy'
          ? graph.edges
              .filter((parent) => parent.targetNodeId === source.id)
              .flatMap((parent) => (nodes.get(parent.sourceNodeId) ? [nodes.get(parent.sourceNodeId)!] : []))
          : source
            ? [source]
            : []
      positions.push({
        sources: parents.map(({ address, chainId, name }) => ({ address, chainId, name })),
        via: source?.nodeType === 'strategy' ? source.address : null,
        amount: edge.deductedTvlUsd
      })
    }
  }
  const knownPositions = positions.reduce((sum, position) => sum + position.amount, 0)
  return {
    reported,
    adjusted,
    direct: reported !== null && upstream !== null ? reported - upstream : null,
    upstream,
    excludedBridges,
    positions,
    downstreamRoots,
    unattributedUpstream: upstream !== null ? Math.max(0, upstream - knownPositions) : null
  }
}
