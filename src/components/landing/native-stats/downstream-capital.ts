import type { FeeStackNode } from './types'
import { type OriginGraph, type OriginVault, originVaultId } from './vault-origin'

export interface DownstreamCapitalNode {
  vault: FeeStackNode['vault']
  capitalUsd: number | null
  perfFee: number | null
  mgmtFee: number | null
  kind: 'vault' | 'strategy' | 'idle' | 'unresolved' | 'adjustment'
  note?: string
  children: DownstreamCapitalNode[]
}

/** Use the complete capital graph, independently of fee-stack membership. */
export function downstreamCapital(
  roots: { vault: FeeStackNode['vault']; capitalUsd: number }[],
  vaults: Map<string, OriginVault>,
  graph: OriginGraph,
  fees: Map<string, FeeStackNode>
): DownstreamCapitalNode[] {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, OriginGraph['edges']>()
  for (const edge of graph.edges) {
    if (!Number.isFinite(edge.tvlUsd) || edge.tvlUsd <= 0 || edge.sourceNodeId === edge.targetNodeId) continue
    const list = outgoing.get(edge.sourceNodeId) ?? []
    list.push(edge)
    outgoing.set(edge.sourceNodeId, list)
  }
  const extra = (
    parent: DownstreamCapitalNode,
    kind: 'idle' | 'unresolved' | 'adjustment',
    name: string,
    capitalUsd: number,
    note: string
  ): DownstreamCapitalNode => ({
    vault: { ...parent.vault, name },
    capitalUsd,
    perfFee: null,
    mgmtFee: null,
    kind,
    note,
    children: []
  })
  const build = (
    vault: FeeStackNode['vault'],
    capitalUsd: number | null,
    visited: Set<string>,
    root = false
  ): DownstreamCapitalNode => {
    const id = originVaultId(vault.chainId, vault.address)
    const audit = vaults.get(id)
    const graphNode = nodes.get(id)
    const fee = fees.get(id)
    const node: DownstreamCapitalNode = {
      vault: { ...vault, name: audit?.name || fee?.vault.name || graphNode?.name || vault.name },
      capitalUsd,
      perfFee: fee?.perfFee ?? null,
      mgmtFee: fee?.mgmtFee ?? null,
      kind: graphNode?.nodeType === 'strategy' || (!audit && !fee) ? 'strategy' : 'vault',
      children: []
    }
    if (capitalUsd === null || capitalUsd === 0) return node
    if (visited.has(id) || visited.size >= 10) {
      node.note = 'Further allocation detail stops here to avoid circular or excessively deep paths.'
      return node
    }
    const gross = audit?.tvlUsd ?? graphNode?.rawTvlUsd
    if (typeof gross !== 'number' || !Number.isFinite(gross) || gross <= 0) {
      node.note = 'Allocation detail unavailable.'
      return node
    }
    const ratio = capitalUsd / gross
    const path = new Set([...visited, id])
    const edges = outgoing.get(id) ?? []
    for (const edge of edges) {
      const child = nodes.get(edge.targetNodeId)
      if (!child) continue
      const branch = build(child, edge.tvlUsd * ratio, path)
      if ('valueSource' in edge && edge.valueSource === 'parent-tvl-capped-debt-estimate') {
        branch.note = 'Published allocation estimate capped to the vault’s assets; recorded debt is higher.'
      }
      node.children.push(branch)
    }
    // Router positions may repeat one strategy's debt for several destinations.
    const strategies = new Map<string, OriginVault['strategies']>()
    for (const strategy of audit?.strategies ?? []) {
      const address = strategy.address.toLowerCase()
      strategies.set(address, [...(strategies.get(address) ?? []), strategy])
    }
    const strategyDebts = new Map(
      [...strategies].map(([address, positions]) => {
        const debt = positions[0].debtUsd
        const value =
          typeof debt === 'number' && Number.isFinite(debt) && debt >= 0 && positions.every((p) => p.debtUsd === debt)
            ? debt
            : null
        return [address, value] as const
      })
    )
    const holders = new Set(edges.map((edge) => edge.holderAddress.toLowerCase()))
    for (const [address, debt] of strategyDebts) {
      if (holders.has(address) || debt === 0) continue
      const branch = build({ address, chainId: vault.chainId, name: null }, debt === null ? null : debt * ratio, path)
      branch.kind = 'strategy'
      if (debt === null) branch.note = 'Strategy debt unavailable or conflicting in the published snapshot.'
      node.children.push(branch)
    }
    const allocated = node.children.reduce((total, child) => total + (child.capitalUsd ?? 0), 0)
    const remainder = capitalUsd - allocated
    if (remainder < -0.01) {
      node.children.push(
        extra(
          node,
          'adjustment',
          'Debt / asset adjustment',
          remainder,
          'Published allocations exceed reported assets by this amount.'
        )
      )
    } else if (remainder > 0.00000001 && (root || node.children.length > 0 || strategies.size > 0)) {
      const debts = [...strategyDebts.values()]
      const debtTotal = debts.every((debt) => debt !== null)
        ? debts.reduce<number>((sum, debt) => sum + debt!, 0)
        : null
      const idle =
        debtTotal !== null &&
        strategies.size > 0 &&
        debtTotal <= gross + 0.01 &&
        Math.abs((gross - debtTotal) * ratio - remainder) < 0.01
      node.children.push(
        extra(
          node,
          idle ? 'idle' : 'unresolved',
          idle ? 'Idle funds' : 'Other / unresolved assets',
          remainder,
          idle
            ? 'Derived from reported total assets less published strategy debt, apportioned to adjusted TVL.'
            : 'Remaining capital without a reconciled strategy allocation. Not assumed to be idle.'
        )
      )
    }
    return node
  }
  return roots.map((root) => build(root.vault, root.capitalUsd, new Set(), true))
}
