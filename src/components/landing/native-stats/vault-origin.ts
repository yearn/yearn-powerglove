import type { SpotFlowEdge, SpotFlowNode } from './TvlFlowGraphTool'

export interface OriginVault {
  address: string
  chainId: number
  name: string | null
  category: string
  vaultType: number | null
  tvlUsd: number | null
  countedTvlUsd?: number | null
  isRetired: boolean
  strategies: {
    address: string
    debtUsd: number | null
    targetVaultAddress: string | null
    targetVaultChainId: number | null
  }[]
}
export interface OriginAudit {
  datasetId: string
  vaults: OriginVault[]
}
export interface OriginGraph {
  datasetId: string
  asOfTimestamp: number
  nodes: SpotFlowNode[]
  edges: SpotFlowEdge[]
  bridgeExclusions?: { sourceNodeId: string; tvlUsd?: number }[]
  diagnostics?: { status: string; mappingScope: string }
}
export interface OriginFlow {
  vaultIds: string[]
  via: string | null
  amount: number | null
}
export interface VaultOriginRow {
  id: string
  vault: OriginVault
  listed: number | null
  fromYearn: number | null
  nonYearn: number | null
  toYearn: number | null
  yearnShare: number | null
  incoming: OriginFlow[]
  outgoing: OriginFlow[]
}
export const originVaultId = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`
const isYearn = (category: string) => ['v1', 'v2', 'v3'].includes(category)

/** Attribute published physical flows; do not recalculate capped overlap accounting. */
export function buildVaultOriginRows(audit: OriginAudit, graph: OriginGraph): VaultOriginRow[] {
  if (audit.datasetId !== graph.datasetId) throw new Error('Vault breakdown publications do not match')
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const vaults = new Map(audit.vaults.map((vault) => [originVaultId(vault.chainId, vault.address), vault]))
  const incoming = new Map<string, OriginFlow[]>()
  const outgoing = new Map<string, OriginFlow[]>()
  const missingIncoming = new Set<string>()
  const missingOutgoing = new Set<string>()
  const observed = new Set<string>()
  const bridgeExclusions = new Set(graph.bridgeExclusions?.map((bridge) => bridge.sourceNodeId))
  const edgeKey = (parent: string, holder: string, child: string) => `${parent}:${holder.toLowerCase()}:${child}`
  const add = (map: Map<string, OriginFlow[]>, id: string, flow: OriginFlow) => {
    const list = map.get(id) ?? []
    list.push(flow)
    map.set(id, list)
  }
  const byTarget = new Map<string, SpotFlowEdge[]>()
  for (const edge of graph.edges) {
    const edges = byTarget.get(edge.targetNodeId) ?? []
    edges.push(edge)
    byTarget.set(edge.targetNodeId, edges)
  }
  for (const edge of graph.edges) {
    const child = nodes.get(edge.targetNodeId)
    const source = nodes.get(edge.sourceNodeId)
    if (!child || child.nodeType !== 'vault' || !isYearn(child.category) || !source) continue
    if (!Number.isFinite(edge.tvlUsd) || edge.tvlUsd <= 0) continue
    const parents =
      source.nodeType === 'vault'
        ? [source]
        : [...new Set((byTarget.get(source.id) ?? []).map((parent) => parent.sourceNodeId))].flatMap((id) =>
            nodes.get(id) ? [nodes.get(id)!] : []
          )
    // Curation products are a separate layer, not Yearn V1/V2/V3 depositors.
    const yearnParents = parents.filter((parent) => parent.nodeType === 'vault' && isYearn(parent.category))
    if (!yearnParents.length) continue
    const via = source.nodeType === 'strategy' ? source.address : null
    const shared = parents.length !== 1
    add(incoming, child.id, {
      vaultIds: yearnParents.map((parent) => parent.id),
      via,
      amount: parents.length === yearnParents.length ? edge.tvlUsd : null
    })
    if (parents.length !== yearnParents.length) missingIncoming.add(child.id)
    for (const parent of yearnParents) {
      add(outgoing, parent.id, { vaultIds: [child.id], via, amount: shared ? null : edge.tvlUsd })
      observed.add(edgeKey(parent.id, edge.holderAddress, child.id))
      if (shared) missingOutgoing.add(parent.id)
    }
  }
  // A detected relationship without a published priced flow is unavailable, not zero.
  for (const [id, vault] of vaults) {
    if (bridgeExclusions.has(id)) continue
    for (const strategy of vault.strategies) {
      if (!strategy.targetVaultAddress || strategy.targetVaultChainId === null) continue
      const childId = originVaultId(strategy.targetVaultChainId, strategy.targetVaultAddress)
      const child = vaults.get(childId)
      if (!isYearn(vault.category) || !child || !isYearn(child.category) || strategy.debtUsd === 0) continue
      if (!observed.has(edgeKey(id, strategy.address, childId))) {
        missingOutgoing.add(id)
        missingIncoming.add(childId)
        add(outgoing, id, { vaultIds: [childId], via: strategy.address, amount: null })
        add(incoming, childId, { vaultIds: [id], via: strategy.address, amount: null })
      }
    }
  }
  const total = (flows: OriginFlow[]) => flows.reduce((sum, flow) => sum + (flow.amount ?? 0), 0)
  return [...vaults]
    .filter(([, vault]) => isYearn(vault.category))
    .map(([id, vault]) => {
      const node = nodes.get(id)
      const listed = vault.tvlUsd
      const inflows = incoming.get(id) ?? []
      const outflows = outgoing.get(id) ?? []
      const fromYearn = node && !missingIncoming.has(id) ? total(inflows) : null
      const toYearn = node && !missingOutgoing.has(id) ? total(outflows) : null
      const remainder = listed !== null && fromYearn !== null ? listed - fromYearn : null
      return {
        id,
        vault,
        listed,
        fromYearn,
        toYearn,
        nonYearn: remainder !== null && remainder >= -0.01 ? Math.max(0, remainder) : null,
        yearnShare: listed !== null && fromYearn !== null && listed > 0 ? fromYearn / listed : null,
        incoming: inflows,
        outgoing: outflows
      }
    })
}
