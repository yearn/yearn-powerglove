import type { DirectDepositFeeRow } from './direct-deposit-fees'
import { directDepositTvl, feeStackLayers, treasuryAdjustedTvl } from './direct-deposit-fees'
import { downstreamCapital } from './downstream-capital'
import { combineProductAllocations, internalProductEdges, isCombinedProduct } from './product-capital'
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
export function reportedDepositTvl(
  row: DirectDepositFeeRow,
  vaults: Map<string, OriginVault>,
  graph?: OriginGraph | null,
  datasetId?: string
) {
  const gross = sumKnown(distinctRoots(row).map((root) => vaults.get(rootId(root))?.tvlUsd))
  if (!isCombinedProduct(row)) return gross
  if (gross === null || !datasetId || graph?.datasetId !== datasetId) return null
  const internal = sumKnown(internalProductEdges(row, graph).map((edge) => edge.deductedTvlUsd))
  return internal !== null && internal <= gross + 0.01 ? Math.max(0, gross - internal) : null
}

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
  feeNodes: Map<string, FeeStackNode> = new Map(),
  treasuryByVault: ReadonlyMap<string, number | null> = new Map()
) {
  const roots = distinctRoots(row)
  const members = new Set(roots.map(rootId))
  const combinedProduct = isCombinedProduct(row)
  const reported = reportedDepositTvl(row, vaults, graph, datasetId)
  const adjustedByVault = new Map(
    [...vaults].flatMap(([id, vault]) =>
      typeof vault.countedTvlUsd === 'number' ? [[id, vault.countedTvlUsd] as const] : []
    )
  )
  const publishedAdjusted = directDepositTvl(row, adjustedByVault)
  const adjusted = treasuryAdjustedTvl(row, adjustedByVault, treasuryByVault)
  const rootAdjusted = roots.map((root) => vaults.get(rootId(root))?.countedTvlUsd)
  const treasuryExcluded = sumKnown(
    roots.map((root) => treasuryByVault.get(rootId(root)) ?? (treasuryByVault.has(rootId(root)) ? null : 0))
  )
  const includedRoots = roots.map((root, index) => {
    const excluded = treasuryByVault.get(rootId(root)) ?? (treasuryByVault.has(rootId(root)) ? null : 0)
    const published = rootAdjusted[index]
    return typeof published === 'number' && excluded !== null && excluded >= 0 && excluded <= published + 0.01
      ? Math.max(0, published - excluded)
      : null
  })
  const adjustedSum = sumKnown(rootAdjusted)
  // Keep the canonical product total; never invent an allocation between members.
  const consistent =
    publishedAdjusted !== null &&
    adjusted !== null &&
    includedRoots.every((value) => value !== null) &&
    adjustedSum !== null &&
    Math.abs(publishedAdjusted - adjustedSum) < 0.01 &&
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
  const memberRoots =
    consistent && matched
      ? downstreamCapital(
          roots.map((root, index) => ({ vault: root.vault, capitalUsd: includedRoots[index]! })),
          vaults,
          graph,
          new Map([
            ...roots.flatMap((root) => feeStackLayers(root).map(({ node }) => [rootId(node), node] as const)),
            ...feeNodes
          ])
        )
      : null
  const downstreamRoots =
    combinedProduct && memberRoots && adjusted !== null
      ? combineProductAllocations(row, memberRoots, adjusted)
      : memberRoots
  const excludedBridges = matched
    ? sumKnown(
        (graph.bridgeExclusions ?? [])
          .filter((bridge) => members.has(bridge.sourceNodeId))
          .map((bridge) => bridge.tvlUsd)
      )
    : null
  const difference =
    reported !== null && publishedAdjusted !== null && excludedBridges !== null
      ? reported - publishedAdjusted - excludedBridges
      : null
  const upstream = difference !== null && difference >= -0.01 ? Math.max(0, difference) : null
  const positions: UpstreamFeeCapital[] = []
  const internalEdges = matched ? new Set(internalProductEdges(row, graph).map((edge) => edge.id)) : new Set<string>()
  if (matched) {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
    for (const edge of graph.edges) {
      if (internalEdges.has(edge.id)) continue
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
    direct:
      adjusted !== null && reported !== null && upstream !== null && treasuryExcluded !== null
        ? reported - upstream - treasuryExcluded
        : null,
    treasuryExcluded,
    upstream,
    excludedBridges,
    positions,
    downstreamRoots,
    combinedProduct,
    unattributedUpstream: upstream !== null ? Math.max(0, upstream - knownPositions) : null
  }
}
