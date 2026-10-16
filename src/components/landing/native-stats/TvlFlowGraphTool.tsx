import { Menu } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { fetchKongVaultSnapshotRaw } from '@/lib/kong-vault-client'
import { deriveKongSnapshotStrategies } from '@/lib/kong-vault-derivation'
import { cn } from '@/lib/utils'
import { powergloveVaultPath, shortAddr, useFetch } from './hooks'
import './styles.css'

const NODE_WIDTH = 220
const NODE_HEIGHT = 72
const COLUMN_GAP = 260
const ROW_GAP = 116
const STAGGERED_ROW_GAP = NODE_HEIGHT + 24
const STAGGER_THRESHOLD = 4
const DENSE_BRANCH_PARENT_GAP = 56
const CANVAS_MIN_WIDTH = 1180
const CANVAS_MIN_HEIGHT = 680
const CANVAS_PADDING = 32
const DEFAULT_FIT_ROW_COUNT = 5
const DEFAULT_FIT_MIN_HEIGHT = NODE_HEIGHT + ROW_GAP * (DEFAULT_FIT_ROW_COUNT - 1) + CANVAS_PADDING * 2
const USE_FIXTURE_FALLBACK = false
const INSPECTOR_TOGGLE_CLASS =
  'inline-grid size-8 shrink-0 appearance-none place-items-center border-0 bg-transparent p-0 leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0657f9]'

export type TvlFlowVault = {
  address: string
  chainId: number
}

export type TvlFlowStrategyMetadata = {
  address: string
  chainId: number
  name: string
}

export function buildTvlFlowGraphUrl(chainId: number, category?: string): string {
  const params = new URLSearchParams({ chainId: String(chainId), includeRetired: 'true' })
  if (category) params.set('category', category)
  return `/api/tvl/graph?${params.toString()}`
}

export function fitTvlFlowBounds(
  measuredBounds: { x: number; y: number; width: number; height: number },
  viewportSize: { width: number; height: number }
) {
  const minimumHeight = Math.max(measuredBounds.height, DEFAULT_FIT_MIN_HEIGHT)
  const boundedGraph = {
    ...measuredBounds,
    y: measuredBounds.y - (minimumHeight - measuredBounds.height) / 2,
    height: minimumHeight
  }
  const viewportAspect = viewportSize.width / viewportSize.height
  const measuredAspect = boundedGraph.width / boundedGraph.height

  if (measuredAspect > viewportAspect) {
    const height = boundedGraph.width / viewportAspect
    return {
      ...boundedGraph,
      y: boundedGraph.y - (height - boundedGraph.height) / 2,
      height
    }
  }

  const width = boundedGraph.height * viewportAspect
  return {
    ...boundedGraph,
    x: boundedGraph.x - (width - boundedGraph.width) / 2,
    width
  }
}

function fmtFlowUsd(n: number): string {
  const format = (value: number) => value.toLocaleString(undefined, { maximumSignificantDigits: 3 })
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${format(n / 1e9)}B`
  if (abs >= 1e6) return `$${format(n / 1e6)}M`
  if (abs >= 1e3) return `$${format(n / 1e3)}K`
  if (abs >= 1) return `$${format(n)}`
  return '$0'
}

export interface SpotFlowNode {
  id: string
  name: string
  address: string
  chainId: number
  nodeType: 'vault' | 'strategy'
  category: string
  vaultType?: number | null
  apiVersion?: string | null
  rawTvlUsd: number
  upstreamOwnedTvlUsd?: number
  externalTvlUsd: number
  isRetired: boolean
}

export function enrichTvlFlowStrategyNodes(
  nodes: SpotFlowNode[],
  strategyMetadata: TvlFlowStrategyMetadata[]
): SpotFlowNode[] {
  const metadataByAddress = new Map(
    strategyMetadata.map((strategy) => [`${strategy.chainId}:${strategy.address.toLowerCase()}`, strategy])
  )

  return nodes.map((node) => {
    if (node.nodeType !== 'strategy') return node

    const metadata = metadataByAddress.get(`${node.chainId}:${node.address.toLowerCase()}`)
    const name = metadata?.name.trim()
    return name ? { ...node, name } : node
  })
}

export function findTvlFlowAllocatorVaults(
  nodes: SpotFlowNode[],
  edges: SpotFlowEdge[],
  rootVault?: TvlFlowVault
): TvlFlowVault[] {
  const rootNodeId = findTvlFlowVaultNodeId(nodes, rootVault)
  if (!rootNodeId) return []

  const outgoingByNode = new Map<string, SpotFlowEdge[]>()
  const incomingByNode = new Map<string, SpotFlowEdge[]>()
  for (const edge of edges) {
    const outgoing = outgoingByNode.get(edge.sourceNodeId) ?? []
    outgoing.push(edge)
    outgoingByNode.set(edge.sourceNodeId, outgoing)

    const incoming = incomingByNode.get(edge.targetNodeId) ?? []
    incoming.push(edge)
    incomingByNode.set(edge.targetNodeId, incoming)
  }

  const collectReachableNodeIds = (
    edgesByNode: Map<string, SpotFlowEdge[]>,
    nextNodeId: (edge: SpotFlowEdge) => string
  ) => {
    const reachableNodeIds = new Set([rootNodeId])
    const queue = [rootNodeId]
    while (queue.length > 0) {
      const nodeId = queue.shift()
      if (!nodeId) continue

      for (const edge of edgesByNode.get(nodeId) ?? []) {
        const adjacentNodeId = nextNodeId(edge)
        if (reachableNodeIds.has(adjacentNodeId)) continue
        reachableNodeIds.add(adjacentNodeId)
        queue.push(adjacentNodeId)
      }
    }

    return reachableNodeIds
  }

  const relatedNodeIds = new Set([
    ...collectReachableNodeIds(outgoingByNode, (edge) => edge.targetNodeId),
    ...collectReachableNodeIds(incomingByNode, (edge) => edge.sourceNodeId)
  ])

  return nodes
    .filter(
      (node) =>
        node.nodeType === 'vault' && relatedNodeIds.has(node.id) && (outgoingByNode.get(node.id)?.length ?? 0) > 0
    )
    .map((node) => ({ address: node.address, chainId: node.chainId }))
}

export async function fetchTvlFlowAllocatorStrategyMetadata(
  allocatorVaults: TvlFlowVault[]
): Promise<TvlFlowStrategyMetadata[]> {
  const snapshots = await Promise.all(
    allocatorVaults.map(async (allocator) => ({
      allocator,
      snapshot: await fetchKongVaultSnapshotRaw(allocator.chainId, allocator.address).catch(() => null)
    }))
  )

  return snapshots.flatMap(({ allocator, snapshot }) =>
    snapshot
      ? deriveKongSnapshotStrategies(snapshot)
          .filter((strategy) => strategy.name.trim() && !/^Strategy \d+$/.test(strategy.name.trim()))
          .map((strategy) => ({
            address: strategy.address,
            chainId: allocator.chainId,
            name: strategy.name
          }))
      : []
  )
}

export function findTvlFlowVaultNodeId(nodes: SpotFlowNode[], vault?: TvlFlowVault): string | null {
  if (!vault) return null
  const address = vault.address.toLowerCase()
  return (
    nodes.find(
      (node) => node.nodeType === 'vault' && node.chainId === vault.chainId && node.address.toLowerCase() === address
    )?.id ?? null
  )
}

export function staggerChildRowPositions(
  childCount: number,
  parentCenterX: number,
  firstRowY: number
): Array<{ x: number; y: number }> {
  if (childCount <= 0) return []
  if (childCount <= STAGGER_THRESHOLD) {
    const rowWidth = (childCount - 1) * COLUMN_GAP + NODE_WIDTH
    const startX = parentCenterX - rowWidth / 2
    return Array.from({ length: childCount }, (_, index) => ({
      x: startX + index * COLUMN_GAP,
      y: firstRowY
    }))
  }

  const firstRowCount = Math.ceil(childCount / 2)
  const secondRowCount = childCount - firstRowCount
  const equalRows = firstRowCount === secondRowCount
  const spaciousFirstRowY = firstRowY + DENSE_BRANCH_PARENT_GAP

  return Array.from({ length: childCount }, (_, index) => {
    const rowIndex = index < firstRowCount ? 0 : 1
    const indexInRow = rowIndex === 0 ? index : index - firstRowCount
    const rowCount = rowIndex === 0 ? firstRowCount : secondRowCount
    const rowWidth = (rowCount - 1) * COLUMN_GAP + NODE_WIDTH
    const staggerOffset = equalRows ? (rowIndex === 0 ? -COLUMN_GAP / 4 : COLUMN_GAP / 4) : 0

    return {
      x: parentCenterX - rowWidth / 2 + staggerOffset + indexInRow * COLUMN_GAP,
      y: spaciousFirstRowY + rowIndex * STAGGERED_ROW_GAP
    }
  })
}

export function graphEdgeGeometry(
  source: { x: number; y: number; depth: number },
  target: { x: number; y: number; depth: number }
): { path: string; labelX: number; labelY: number; routedAroundSiblingRow: boolean } {
  const sourceX = source.x + NODE_WIDTH / 2
  const sourceY = source.y + NODE_HEIGHT
  const targetX = target.x + NODE_WIDTH / 2
  const targetY = target.y
  const routedAroundSiblingRow = target.depth === source.depth + 1 && target.y - source.y > ROW_GAP

  if (routedAroundSiblingRow) {
    const routingY = sourceY + Math.min(24, Math.max(12, (targetY - sourceY) / 4))
    return {
      path: `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + 12}, ${targetX} ${routingY - 12}, ${targetX} ${routingY} L ${targetX} ${targetY}`,
      labelX: targetX,
      labelY: targetY - 8,
      routedAroundSiblingRow
    }
  }

  const curveOffset = Math.max(36, Math.abs(targetY - sourceY) / 2)
  return {
    path: `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + curveOffset}, ${targetX} ${targetY - curveOffset}, ${targetX} ${targetY}`,
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2 - 6,
    routedAroundSiblingRow
  }
}

export interface SpotFlowEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  holderAddress: string
  kind: string
  tvlUsd: number
  valueSource?: string
  deductedTvlUsd?: number
}

interface BridgeExclusion {
  sourceNodeId: string
  address: string
  name: string
  label: string
  chainId: number
  targetChainId: number
  tvlUsd: number
}

interface LayoutNode extends SpotFlowNode {
  incoming: number
  outgoing: number
  depth: number
  x: number
  y: number
}

interface TvlGraphResponse {
  snapshotAt?: number
  totalTvlUsd?: number
  totalRawTvlUsd?: number
  totalOverlapTvlUsd?: number
  nodes?: Array<Record<string, unknown>>
  edges?: Array<Record<string, unknown>>
  bridgeExclusions?: Array<Record<string, unknown>>
}

const MOCK_NODES: SpotFlowNode[] = [
  {
    id: 'usdc-1',
    name: 'USDC-1 yVault',
    address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
    chainId: 1,
    nodeType: 'vault',
    category: 'v3',
    rawTvlUsd: 27_885_742.320085265,
    externalTvlUsd: 27_885_742.320085265,
    isRetired: false
  },
  {
    id: 'usdc-2',
    name: 'USDC-2 yVault',
    address: '0xAe7d8Db82480E6d8e3873ecbF22cf17b3D8A7308',
    chainId: 1,
    nodeType: 'vault',
    category: 'v3',
    rawTvlUsd: 1_167_684.2699072566,
    externalTvlUsd: 1_167_684.2699072566,
    isRetired: false
  },
  {
    id: 'usdc-1-idle-usdc',
    name: 'USDC-1 Idle USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
    nodeType: 'strategy',
    category: 'strategy',
    rawTvlUsd: 4_842.017439,
    externalTvlUsd: 4_842.017439,
    isRetired: false
  },
  {
    id: 'usdc-2-idle-usdc',
    name: 'USDC-2 Idle USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
    nodeType: 'strategy',
    category: 'strategy',
    rawTvlUsd: 169_500.982231,
    externalTvlUsd: 169_500.982231,
    isRetired: false
  },
  {
    id: 'spark-usdc-lender',
    name: 'Spark USDC Lender',
    address: '0x25f893276544d86a82b1ce407182836F45cb6673',
    chainId: 1,
    nodeType: 'strategy',
    category: 'strategy',
    rawTvlUsd: 484_496.5870153263,
    externalTvlUsd: 484_496.5870153263,
    isRetired: false
  },
  {
    id: 'usdc-to-usds',
    name: 'USDC to USDS Depositor',
    address: '0x39c0aEc5738ED939876245224aFc7E09C8480a52',
    chainId: 1,
    nodeType: 'strategy',
    category: 'strategy',
    rawTvlUsd: 0,
    externalTvlUsd: 0,
    isRetired: false
  },
  {
    id: 'usdc-to-susds',
    name: 'USDC to sUSDS Lender',
    address: '0x7130570BCEfCedBe9d15B5b11A33006156460f8f',
    chainId: 1,
    nodeType: 'strategy',
    category: 'strategy',
    rawTvlUsd: 27_396_850.684327465,
    externalTvlUsd: 27_396_850.684327465,
    isRetired: false
  },
  {
    id: 'morpho-yearn-usdc',
    name: 'Morpho Yearn USDC Compounder',
    address: '0xf1784A1bF0cBDE0F868838Dd093E65215343c4C0',
    chainId: 1,
    nodeType: 'strategy',
    category: 'strategy',
    externalTvlUsd: 0,
    rawTvlUsd: 0,
    isRetired: false
  },
  {
    id: 'evk-eusdc-2',
    name: 'EVK Vault eUSDC-2 Compounder',
    address: '0xa08CEb657D9A8035A44A1b44b8d4C42eC31Dd4D4',
    chainId: 1,
    nodeType: 'strategy',
    category: 'strategy',
    rawTvlUsd: 0,
    externalTvlUsd: 0,
    isRetired: false
  },
  {
    id: 'morpho-yearn-og-usdc',
    name: 'Morpho Yearn OG USDC Compounder',
    address: '0x0e297dE4005883C757c9F09fdF7cF1363C20e626',
    chainId: 1,
    nodeType: 'strategy',
    category: 'strategy',
    rawTvlUsd: 324_822.46418023173,
    externalTvlUsd: 324_822.46418023173,
    isRetired: false
  }
]

const MOCK_EDGES: SpotFlowEdge[] = [
  {
    id: 'usdc-1-to-idle',
    sourceNodeId: 'usdc-1',
    targetNodeId: 'usdc-1-idle-usdc',
    holderAddress: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
    kind: 'auto',
    tvlUsd: 4_842.017439
  },
  {
    id: 'usdc-2-to-idle',
    sourceNodeId: 'usdc-2',
    targetNodeId: 'usdc-2-idle-usdc',
    holderAddress: '0xAe7d8Db82480E6d8e3873ecbF22cf17b3D8A7308',
    kind: 'auto',
    tvlUsd: 169_500.982231
  },
  {
    id: 'usdc-2-to-usdc-1',
    sourceNodeId: 'usdc-2',
    targetNodeId: 'usdc-1',
    holderAddress: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
    kind: 'auto',
    tvlUsd: 673_413.6818027367
  },
  {
    id: 'usdc-2-to-evk-eusdc-2',
    sourceNodeId: 'usdc-2',
    targetNodeId: 'evk-eusdc-2',
    holderAddress: '0xa08CEb657D9A8035A44A1b44b8d4C42eC31Dd4D4',
    kind: 'auto',
    tvlUsd: 0
  },
  {
    id: 'usdc-2-to-morpho-yearn-og-usdc',
    sourceNodeId: 'usdc-2',
    targetNodeId: 'morpho-yearn-og-usdc',
    holderAddress: '0x0e297dE4005883C757c9F09fdF7cF1363C20e626',
    kind: 'auto',
    tvlUsd: 324_822.46418023173
  },
  {
    id: 'usdc-1-to-spark-usdc-lender',
    sourceNodeId: 'usdc-1',
    targetNodeId: 'spark-usdc-lender',
    holderAddress: '0x25f893276544d86a82b1ce407182836F45cb6673',
    kind: 'auto',
    tvlUsd: 484_496.5870153263
  },
  {
    id: 'usdc-1-to-usdc-to-usds',
    sourceNodeId: 'usdc-1',
    targetNodeId: 'usdc-to-usds',
    holderAddress: '0x39c0aEc5738ED939876245224aFc7E09C8480a52',
    kind: 'auto',
    tvlUsd: 0
  },
  {
    id: 'usdc-1-to-usdc-to-susds',
    sourceNodeId: 'usdc-1',
    targetNodeId: 'usdc-to-susds',
    holderAddress: '0x7130570BCEfCedBe9d15B5b11A33006156460f8f',
    kind: 'auto',
    tvlUsd: 27_396_850.684327465
  },
  {
    id: 'usdc-1-to-morpho-yearn-usdc',
    sourceNodeId: 'usdc-1',
    targetNodeId: 'morpho-yearn-usdc',
    holderAddress: '0xf1784A1bF0cBDE0F868838Dd093E65215343c4C0',
    kind: 'auto',
    tvlUsd: 0
  }
]

function layoutGraph(nodes: SpotFlowNode[], edges: SpotFlowEdge[], focusedNodeId: string | null): LayoutNode[] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  const childrenByNode = new Map<string, string[]>()
  const parentsByNode = new Map<string, string[]>()

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) continue
    incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1)
    outgoing.set(edge.sourceNodeId, (outgoing.get(edge.sourceNodeId) ?? 0) + 1)
    childrenByNode.set(edge.sourceNodeId, [...(childrenByNode.get(edge.sourceNodeId) ?? []), edge.targetNodeId])
    parentsByNode.set(edge.targetNodeId, [...(parentsByNode.get(edge.targetNodeId) ?? []), edge.sourceNodeId])
  }

  const depthByNode = new Map<string, number>()

  if (focusedNodeId && nodeIds.has(focusedNodeId)) {
    depthByNode.set(focusedNodeId, 0)

    const walk = (direction: 'upstream' | 'downstream') => {
      const queue = [{ nodeId: focusedNodeId, distance: 0 }]
      const seen = new Set([focusedNodeId])

      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) break

        const nextNodes =
          direction === 'upstream' ? (parentsByNode.get(item.nodeId) ?? []) : (childrenByNode.get(item.nodeId) ?? [])
        for (const nextNodeId of nextNodes) {
          const nextDistance = item.distance + 1
          const nextDepth = direction === 'upstream' ? -nextDistance : nextDistance
          const existingDepth = depthByNode.get(nextNodeId)
          if (existingDepth === undefined || Math.abs(nextDepth) < Math.abs(existingDepth))
            depthByNode.set(nextNodeId, nextDepth)
          if (seen.has(nextNodeId)) continue
          seen.add(nextNodeId)
          queue.push({ nodeId: nextNodeId, distance: nextDistance })
        }
      }
    }

    walk('upstream')
    walk('downstream')
  } else {
    const roots = nodes.filter((node) => !incoming.has(node.id)).sort((a, b) => b.rawTvlUsd - a.rawTvlUsd)
    const queue = roots.map((node) => ({ nodeId: node.id, depth: 0 }))

    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) break
      const previousDepth = depthByNode.get(item.nodeId)
      if (previousDepth !== undefined && previousDepth >= item.depth) continue
      depthByNode.set(item.nodeId, item.depth)
      for (const child of childrenByNode.get(item.nodeId) ?? []) queue.push({ nodeId: child, depth: item.depth + 1 })
    }
  }

  const layoutNodes = nodes.map((node) => ({
    ...node,
    incoming: incoming.get(node.id) ?? 0,
    outgoing: outgoing.get(node.id) ?? 0,
    depth: depthByNode.get(node.id) ?? 0,
    x: 0,
    y: 0
  }))

  const connectedToFocus = new Set<string>()
  if (focusedNodeId) {
    connectedToFocus.add(focusedNodeId)
    for (const edge of edges) {
      if (edge.sourceNodeId === focusedNodeId) connectedToFocus.add(edge.targetNodeId)
      if (edge.targetNodeId === focusedNodeId) connectedToFocus.add(edge.sourceNodeId)
    }
  }

  const nodesByDepth = new Map<number, LayoutNode[]>()
  for (const node of layoutNodes) nodesByDepth.set(node.depth, [...(nodesByDepth.get(node.depth) ?? []), node])
  const minDepth = Math.min(0, ...layoutNodes.map((node) => node.depth))

  for (const [depth, depthNodes] of nodesByDepth.entries()) {
    depthNodes
      .sort((a, b) => {
        const aFocused = connectedToFocus.has(a.id) ? 1 : 0
        const bFocused = connectedToFocus.has(b.id) ? 1 : 0
        return bFocused - aFocused || b.rawTvlUsd - a.rawTvlUsd || a.name.localeCompare(b.name)
      })
      .forEach((node, index) => {
        node.x = 32 + index * COLUMN_GAP
        node.y = 32 + (depth - minDepth) * ROW_GAP
      })
  }

  return layoutNodes
}

function nodeRole(node: LayoutNode): string {
  if (node.incoming === 0 && node.outgoing > 0) return 'top'
  if (node.incoming > 0 && node.outgoing === 0) return 'bottom'
  if (node.incoming > 0 && node.outgoing > 0) return 'middle'
  return 'isolated'
}

interface VaultTag {
  label: string
  kind: 'role' | 'version' | 'retired'
  width: number
}

function vaultTags(node: LayoutNode): VaultTag[] {
  if (node.nodeType !== 'vault') return []

  const role =
    node.vaultType === 1
      ? { label: 'Allocator', width: 52 }
      : node.vaultType === 2
        ? { label: 'Strategy', width: 48 }
        : null

  return [
    ...(role ? [{ ...role, kind: 'role' as const }] : []),
    ...(node.apiVersion
      ? [{ label: node.apiVersion, kind: 'version' as const, width: Math.max(40, node.apiVersion.length * 6 + 12) }]
      : []),
    ...(node.isRetired ? [{ label: 'Retired', kind: 'retired' as const, width: 48 }] : [])
  ]
}

function edgeColor(kind: SpotFlowEdge['kind']): string {
  if (kind === 'registry') return '#0657f9'
  if (kind === 'auto') return '#1d4ed8'
  if (kind === 'strategy') return '#64748b'
  if (kind === 'bridge') return '#94a3b8'
  return '#0f172a'
}

export function edgeDeductionNote(edge: SpotFlowEdge): string {
  if (edge.deductedTvlUsd !== undefined) {
    return edge.deductedTvlUsd > 0 ? ` · ${fmtFlowUsd(edge.deductedTvlUsd)} deducted` : ''
  }
  return edge.kind === 'auto' || edge.kind === 'registry' ? ' · deducted' : ''
}

function edgeValueNote(edge: SpotFlowEdge): string {
  if (edge.valueSource === 'parent-tvl-capped-debt-estimate') return ' · estimated within parent TVL'
  return edge.valueSource === 'source-vault-tvl-estimate' ? ' · estimated from source vault TVL' : ''
}

function stringValue(record: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function numberValue(record: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return fallback
}

function booleanValue(record: Record<string, unknown>, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }
  return fallback
}

export function mapGraphResponse(data: TvlGraphResponse | null): {
  nodes: SpotFlowNode[]
  edges: SpotFlowEdge[]
  bridgeExclusions: BridgeExclusion[]
  totalRawTvlUsd: number
  totalTvlUsd: number
  totalOverlapTvlUsd: number
  snapshotAt: number | null
  isLive: boolean
} {
  const rawNodes = Array.isArray(data?.nodes) ? data.nodes : []
  const rawEdges = Array.isArray(data?.edges) ? data.edges : []
  const rawBridgeExclusions = Array.isArray(data?.bridgeExclusions) ? data.bridgeExclusions : []

  if (rawNodes.length === 0 && USE_FIXTURE_FALLBACK) {
    const totalRawTvlUsd = MOCK_NODES.filter((node) => node.nodeType === 'vault').reduce(
      (sum, node) => sum + node.rawTvlUsd,
      0
    )
    const totalTvlUsd = MOCK_NODES.filter((node) => node.nodeType === 'vault').reduce(
      (sum, node) => sum + node.externalTvlUsd,
      0
    )
    return {
      nodes: MOCK_NODES,
      edges: MOCK_EDGES,
      bridgeExclusions: [],
      totalRawTvlUsd,
      totalTvlUsd,
      totalOverlapTvlUsd: totalRawTvlUsd - totalTvlUsd,
      snapshotAt: null,
      isLive: false
    }
  }

  if (rawNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      bridgeExclusions: [],
      totalRawTvlUsd: 0,
      totalTvlUsd: 0,
      totalOverlapTvlUsd: 0,
      snapshotAt: null,
      isLive: false
    }
  }

  const nodes = rawNodes.map((node, index) => {
    const address = stringValue(node, ['address', 'vaultAddress'], `node-${index}`)
    const chainId = numberValue(node, ['chainId'], 1)
    const id = stringValue(node, ['id', 'nodeId', 'vaultId'], `${chainId}:${address.toLowerCase()}`)
    const nodeType: SpotFlowNode['nodeType'] =
      stringValue(node, ['nodeType'], 'vault') === 'strategy' ? 'strategy' : 'vault'

    return {
      id,
      name: stringValue(node, ['name', 'label'], address),
      address,
      chainId,
      nodeType,
      category: stringValue(node, ['category', 'vaultCategory'], 'vault'),
      vaultType: nodeType === 'vault' ? numberValue(node, ['vaultType'], 0) || null : null,
      apiVersion: nodeType === 'vault' ? stringValue(node, ['apiVersion'], '') || null : null,
      rawTvlUsd: numberValue(node, ['rawTvlUsd', 'tvlUsd']),
      upstreamOwnedTvlUsd: numberValue(node, ['upstreamOwnedTvlUsd', 'ownedTvlUsd'], 0),
      externalTvlUsd: numberValue(node, ['externalTvlUsd', 'adjustedTvlUsd', 'rawTvlUsd', 'tvlUsd']),
      isRetired: booleanValue(node, ['isRetired'], false)
    }
  })

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = rawEdges.flatMap((edge, index): SpotFlowEdge[] => {
    const sourceNodeId = stringValue(edge, ['sourceNodeId', 'sourceId', 'source', 'fromNodeId', 'from'])
    const targetNodeId = stringValue(edge, ['targetNodeId', 'targetId', 'target', 'toNodeId', 'to'])
    if (!sourceNodeId || !targetNodeId || !nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) return []

    return [
      {
        id: stringValue(edge, ['id', 'edgeId'], `${sourceNodeId}->${targetNodeId}:${index}`),
        sourceNodeId,
        targetNodeId,
        holderAddress: stringValue(edge, ['holderAddress', 'holder', 'strategyAddress'], ''),
        kind: stringValue(edge, ['kind', 'type', 'edgeType'], 'auto'),
        tvlUsd: numberValue(edge, ['tvlUsd', 'amountUsd', 'upstreamOwnedTvlUsd', 'value']),
        valueSource: stringValue(edge, ['valueSource'], '') || undefined,
        deductedTvlUsd:
          typeof edge.deductedTvlUsd === 'number' && Number.isFinite(edge.deductedTvlUsd)
            ? edge.deductedTvlUsd
            : undefined
      }
    ]
  })

  const bridgeExclusions = rawBridgeExclusions.map((exclusion, index) => ({
    sourceNodeId: stringValue(exclusion, ['sourceNodeId', 'nodeId'], `bridge-${index}`),
    address: stringValue(exclusion, ['address', 'vaultAddress'], ''),
    name: stringValue(exclusion, ['name'], stringValue(exclusion, ['label'], 'Bridge exclusion')),
    label: stringValue(exclusion, ['label'], 'Bridge exclusion'),
    chainId: numberValue(exclusion, ['chainId'], 1),
    targetChainId: numberValue(exclusion, ['targetChainId'], 0),
    tvlUsd: numberValue(exclusion, ['tvlUsd', 'amountUsd'])
  }))

  const vaultNodes = nodes.filter((node) => node.nodeType === 'vault')
  const computedRawTvl =
    vaultNodes.reduce((sum, node) => sum + node.rawTvlUsd, 0) +
    bridgeExclusions.reduce((sum, item) => sum + item.tvlUsd, 0)
  const computedTvl = vaultNodes.reduce((sum, node) => sum + node.externalTvlUsd, 0)

  return {
    nodes,
    edges,
    bridgeExclusions,
    totalRawTvlUsd: typeof data?.totalRawTvlUsd === 'number' ? data.totalRawTvlUsd : computedRawTvl,
    totalTvlUsd: typeof data?.totalTvlUsd === 'number' ? data.totalTvlUsd : computedTvl,
    totalOverlapTvlUsd:
      typeof data?.totalOverlapTvlUsd === 'number'
        ? data.totalOverlapTvlUsd
        : Math.max(0, computedRawTvl - computedTvl),
    snapshotAt: typeof data?.snapshotAt === 'number' ? data.snapshotAt : null,
    isLive: true
  }
}

function visibleGraphForFocus(
  nodes: LayoutNode[],
  edges: SpotFlowEdge[],
  focusedNodeId: string | null
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  if (!focusedNodeId)
    return { nodeIds: new Set(nodes.map((node) => node.id)), edgeIds: new Set(edges.map((edge) => edge.id)) }
  const nodeIds = new Set(nodes.map((node) => node.id))
  const visibleIds = new Set([focusedNodeId])
  const visibleEdgeIds = new Set<string>()
  const incomingByTarget = new Map<string, SpotFlowEdge[]>()
  const outgoingBySource = new Map<string, SpotFlowEdge[]>()

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) continue
    incomingByTarget.set(edge.targetNodeId, [...(incomingByTarget.get(edge.targetNodeId) ?? []), edge])
    outgoingBySource.set(edge.sourceNodeId, [...(outgoingBySource.get(edge.sourceNodeId) ?? []), edge])
  }

  const walk = (startNodeId: string, direction: 'incoming' | 'outgoing') => {
    const queue = [startNodeId]
    const seen = new Set([startNodeId])

    while (queue.length > 0) {
      const nodeId = queue.shift()
      if (!nodeId) continue

      const nextEdges =
        direction === 'incoming' ? (incomingByTarget.get(nodeId) ?? []) : (outgoingBySource.get(nodeId) ?? [])
      for (const edge of nextEdges) {
        const nextNodeId = direction === 'incoming' ? edge.sourceNodeId : edge.targetNodeId
        visibleIds.add(nextNodeId)
        visibleEdgeIds.add(edge.id)
        if (seen.has(nextNodeId)) continue
        seen.add(nextNodeId)
        queue.push(nextNodeId)
      }
    }
  }

  walk(focusedNodeId, 'incoming')
  walk(focusedNodeId, 'outgoing')

  return { nodeIds: visibleIds, edgeIds: visibleEdgeIds }
}

function centerVisibleTree(
  nodes: LayoutNode[],
  edges: SpotFlowEdge[],
  visibleGraph: { nodeIds: Set<string>; edgeIds: Set<string> },
  focusNodeId: string | null
): LayoutNode[] {
  const visibleNodeIds = visibleGraph.nodeIds
  const visibleNodes = nodes.filter((node) => visibleNodeIds.has(node.id))
  if (visibleNodes.length === 0) return nodes

  const minDepth = Math.min(...visibleNodes.map((node) => node.depth))
  const rowMap = new Map<number, LayoutNode[]>()
  for (const node of visibleNodes) rowMap.set(node.depth, [...(rowMap.get(node.depth) ?? []), node])

  const sortedRows = [...rowMap.entries()].sort(([a], [b]) => a - b)
  const rowWidths = sortedRows.map(([, rowNodes]) => (rowNodes.length - 1) * COLUMN_GAP + NODE_WIDTH)
  const canvasCenterX = Math.max(CANVAS_MIN_WIDTH / 2, Math.max(...rowWidths) / 2 + 32)
  const positioned = new Map<string, { x: number; y: number }>()
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const downstream = new Map<string, string[]>()
  const upstream = new Map<string, string[]>()

  for (const edge of edges) {
    if (
      !visibleGraph.edgeIds.has(edge.id) ||
      !visibleNodeIds.has(edge.sourceNodeId) ||
      !visibleNodeIds.has(edge.targetNodeId)
    )
      continue
    const source = nodeById.get(edge.sourceNodeId)
    const target = nodeById.get(edge.targetNodeId)
    if (!source || !target) continue
    if (target.depth > source.depth)
      downstream.set(edge.sourceNodeId, [...(downstream.get(edge.sourceNodeId) ?? []), edge.targetNodeId])
    if (source.depth < target.depth)
      upstream.set(edge.targetNodeId, [...(upstream.get(edge.targetNodeId) ?? []), edge.sourceNodeId])
  }

  const sortNodeIds = (nodeIds: string[]) =>
    [...new Set(nodeIds)].sort((a, b) => {
      const nodeA = nodeById.get(a)
      const nodeB = nodeById.get(b)
      return (nodeB?.rawTvlUsd ?? 0) - (nodeA?.rawTvlUsd ?? 0) || (nodeA?.name ?? a).localeCompare(nodeB?.name ?? b)
    })

  const layoutSide = (adjacency: Map<string, string[]>, allowedDepth: (depth: number) => boolean) => {
    if (!focusNodeId) return
    let nextLeafX = 0
    const assigned = new Map<string, number>()

    const assign = (nodeId: string, path = new Set<string>()): number => {
      if (assigned.has(nodeId)) return assigned.get(nodeId)!
      if (path.has(nodeId)) return nextLeafX++ * COLUMN_GAP

      const node = nodeById.get(nodeId)
      const nextNodeIds = sortNodeIds(adjacency.get(nodeId) ?? []).filter((nextNodeId) => {
        const nextNode = nodeById.get(nextNodeId)
        return nextNode && visibleNodeIds.has(nextNodeId) && allowedDepth(nextNode.depth)
      })

      let x: number
      if (nextNodeIds.length === 0) {
        x = nextLeafX++ * COLUMN_GAP
      } else {
        const nextPath = new Set(path).add(nodeId)
        const childXs = nextNodeIds.map((nextNodeId) => assign(nextNodeId, nextPath))
        x = (Math.min(...childXs) + Math.max(...childXs)) / 2
      }

      if (node) assigned.set(nodeId, x)
      return x
    }

    const focusX = assign(focusNodeId)
    const offsetX = canvasCenterX - focusX
    for (const [nodeId, x] of assigned.entries()) {
      const node = nodeById.get(nodeId)
      if (!node || !allowedDepth(node.depth)) continue
      positioned.set(nodeId, {
        x: x + offsetX,
        y: 32 + (node.depth - minDepth) * ROW_GAP
      })
    }
  }

  layoutSide(upstream, (depth) => depth <= 0)
  layoutSide(downstream, (depth) => depth >= 0)

  for (const [parentNodeId, childNodeIds] of downstream.entries()) {
    const visibleChildren = sortNodeIds(childNodeIds).filter(
      (childNodeId) => visibleNodeIds.has(childNodeId) && positioned.has(childNodeId)
    )
    const allChildrenAreLeaves = visibleChildren.every(
      (childNodeId) => (downstream.get(childNodeId) ?? []).filter((nodeId) => visibleNodeIds.has(nodeId)).length === 0
    )
    const parentPosition = positioned.get(parentNodeId)
    const firstChildPosition = visibleChildren[0] ? positioned.get(visibleChildren[0]) : null
    if (visibleChildren.length <= STAGGER_THRESHOLD || !allChildrenAreLeaves || !parentPosition || !firstChildPosition)
      continue

    const staggeredPositions = staggerChildRowPositions(
      visibleChildren.length,
      parentPosition.x + NODE_WIDTH / 2,
      firstChildPosition.y
    )
    visibleChildren.forEach((childNodeId, index) => {
      const position = staggeredPositions[index]
      if (position) positioned.set(childNodeId, position)
    })
  }

  for (const [depth, rowNodes] of sortedRows) {
    const unpositioned = rowNodes.filter((node) => !positioned.has(node.id))
    if (unpositioned.length === 0) continue
    const rowWidth = (unpositioned.length - 1) * COLUMN_GAP
    const startX = canvasCenterX - rowWidth / 2
    unpositioned
      .sort((a, b) => b.rawTvlUsd - a.rawTvlUsd || a.name.localeCompare(b.name))
      .forEach((node, index) => {
        positioned.set(node.id, {
          x: startX + index * COLUMN_GAP,
          y: 32 + (depth - minDepth) * ROW_GAP
        })
      })
  }

  return nodes.map((node) => ({
    ...node,
    ...(positioned.get(node.id) ?? {})
  }))
}

function GraphCanvas({
  nodes,
  edges,
  focusNodeId,
  selectedNodeId,
  borderless = false,
  isRefreshing = false,
  inspectorOpen = false,
  onOpenInspector,
  onRefresh,
  onSelectNode
}: {
  nodes: LayoutNode[]
  edges: SpotFlowEdge[]
  focusNodeId: string | null
  selectedNodeId: string | null
  borderless?: boolean
  isRefreshing?: boolean
  inspectorOpen?: boolean
  onOpenInspector?: () => void
  onRefresh?: () => void
  onSelectNode: (nodeId: string) => void
}) {
  const visibleGraph = visibleGraphForFocus(nodes, edges, focusNodeId)
  const positionedNodes = centerVisibleTree(nodes, edges, visibleGraph, focusNodeId)
  const positionedNodeById = new Map(positionedNodes.map((node) => [node.id, node]))
  const visibleNodes = positionedNodes.filter((node) => visibleGraph.nodeIds.has(node.id))
  const visibleEdges = edges.filter((edge) => visibleGraph.edgeIds.has(edge.id))
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const arrowMarkerId = useId()
  const previousFocusNodeId = useRef(focusNodeId)
  const [viewportSize, setViewportSize] = useState({ width: CANVAS_MIN_WIDTH, height: CANVAS_MIN_HEIGHT })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [cameraDrag, setCameraDrag] = useState<{
    pointerId: number
    startClientX: number
    startClientY: number
    startPanX: number
    startPanY: number
    unitsPerPixelX: number
    unitsPerPixelY: number
  } | null>(null)
  const fittedBounds = useMemo(() => {
    const minX = Math.min(...visibleNodes.map((node) => node.x))
    const minY = Math.min(...visibleNodes.map((node) => node.y))
    const maxX = Math.max(...visibleNodes.map((node) => node.x + NODE_WIDTH))
    const maxY = Math.max(...visibleNodes.map((node) => node.y + NODE_HEIGHT))
    const measuredBounds = {
      x: minX - CANVAS_PADDING,
      y: minY - CANVAS_PADDING,
      width: maxX - minX + CANVAS_PADDING * 2,
      height: maxY - minY + CANVAS_PADDING * 2
    }
    return fitTvlFlowBounds(measuredBounds, viewportSize)
  }, [viewportSize, visibleNodes])
  const viewBox = useMemo(() => {
    const width = fittedBounds.width / zoom
    const height = fittedBounds.height / zoom
    return {
      x: fittedBounds.x + (fittedBounds.width - width) / 2 + pan.x,
      y: fittedBounds.y + (fittedBounds.height - height) / 2 + pan.y,
      width,
      height
    }
  }, [fittedBounds, pan, zoom])

  useEffect(() => {
    if (previousFocusNodeId.current !== focusNodeId) {
      previousFocusNodeId.current = focusNodeId
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setViewportSize({ width: Math.max(1, rect.width), height: CANVAS_MIN_HEIGHT })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = svgRef.current
    if (!element) return

    const zoomWithWheel = (event: WheelEvent) => {
      const activeElement = document.activeElement
      if (!activeElement || !containerRef.current?.contains(activeElement)) return

      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const deltaScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
      const nextZoom = Math.min(3, Math.max(0.35, zoom * Math.exp(-event.deltaY * deltaScale * 0.0015)))
      if (nextZoom === zoom) return

      const pointerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const pointerY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      const worldX = viewBox.x + pointerX * viewBox.width
      const worldY = viewBox.y + pointerY * viewBox.height
      const nextWidth = fittedBounds.width / nextZoom
      const nextHeight = fittedBounds.height / nextZoom
      const nextBaseX = fittedBounds.x + (fittedBounds.width - nextWidth) / 2
      const nextBaseY = fittedBounds.y + (fittedBounds.height - nextHeight) / 2

      setPan({
        x: worldX - pointerX * nextWidth - nextBaseX,
        y: worldY - pointerY * nextHeight - nextBaseY
      })
      setZoom(nextZoom)
    }

    element.addEventListener('wheel', zoomWithWheel, { passive: false })
    return () => element.removeEventListener('wheel', zoomWithWheel)
  }, [fittedBounds, viewBox, zoom])

  const resetCamera = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Interactive TVL flow graph"
      tabIndex={-1}
      className={cn(
        'relative bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0657f9]',
        !borderless && 'border border-border'
      )}
    >
      <div
        className="absolute right-3 top-3 z-10 flex items-center gap-1 bg-white/95 p-1"
        role="toolbar"
        aria-label="Graph controls"
      >
        <button
          type="button"
          className="page-btn px-2 py-1 text-xs"
          aria-label="Zoom in"
          onClick={() => setZoom((value) => Math.min(3, value * 1.2))}
        >
          +
        </button>
        <button
          type="button"
          className="page-btn px-2 py-1 text-xs"
          aria-label="Zoom out"
          onClick={() => setZoom((value) => Math.max(0.35, value / 1.2))}
        >
          -
        </button>
        <button type="button" className="page-btn px-2 py-1 text-xs" onClick={resetCamera}>
          Fit
        </button>
        {onRefresh ? (
          <button type="button" className="page-btn px-2 py-1 text-xs" disabled={isRefreshing} onClick={onRefresh}>
            {isRefreshing ? 'Refreshing...' : 'Refresh API'}
          </button>
        ) : null}
        {onOpenInspector ? (
          <button
            type="button"
            className={INSPECTOR_TOGGLE_CLASS}
            aria-label="Open inspector"
            aria-controls="tvl-flow-inspector"
            aria-expanded={inspectorOpen}
            onClick={onOpenInspector}
          >
            <Menu aria-hidden="true" className="block size-4" />
          </button>
        ) : null}
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={CANVAS_MIN_HEIGHT}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="TVL flow graph"
        className={cn('select-none', cameraDrag ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          containerRef.current?.focus({ preventScroll: true })
          if (event.button !== 0 || (event.target as Element).closest('[data-flow-node]')) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          setCameraDrag({
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPanX: pan.x,
            startPanY: pan.y,
            unitsPerPixelX: viewBox.width / viewportSize.width,
            unitsPerPixelY: viewBox.height / viewportSize.height
          })
        }}
        onPointerMove={(event) => {
          if (!cameraDrag || cameraDrag.pointerId !== event.pointerId) return
          setPan({
            x: cameraDrag.startPanX - (event.clientX - cameraDrag.startClientX) * cameraDrag.unitsPerPixelX,
            y: cameraDrag.startPanY - (event.clientY - cameraDrag.startClientY) * cameraDrag.unitsPerPixelY
          })
        }}
        onPointerUp={(event) => {
          if (cameraDrag?.pointerId !== event.pointerId) return
          event.currentTarget.releasePointerCapture(event.pointerId)
          setCameraDrag(null)
        }}
        onPointerCancel={(event) => {
          if (cameraDrag?.pointerId === event.pointerId) setCameraDrag(null)
        }}
      >
        <defs>
          <marker
            id={arrowMarkerId}
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#64748b" />
          </marker>
        </defs>
        {visibleEdges.map((edge) => {
          const source = positionedNodeById.get(edge.sourceNodeId)
          const target = positionedNodeById.get(edge.targetNodeId)
          if (!source || !target) return null

          const geometry = graphEdgeGeometry(source, target)
          const stroke = edgeColor(edge.kind)
          const isFocused = selectedNodeId === edge.sourceNodeId || selectedNodeId === edge.targetNodeId
          const strokeDasharray = edge.kind === 'strategy' ? '5 5' : undefined
          const edgeTitle = `${source.name} -> ${target.name} · ${fmtFlowUsd(edge.tvlUsd)} · ${edge.kind}${edgeDeductionNote(edge)}${edgeValueNote(edge)}${edge.holderAddress ? ` · holder ${shortAddr(edge.holderAddress)}` : ''}`

          return (
            <g key={`${edge.id}-${edge.sourceNodeId}-${edge.targetNodeId}`} className="spot-flow-edge">
              <path d={geometry.path} fill="none" stroke="transparent" strokeLinecap="round" strokeWidth={12}>
                <title>{edgeTitle}</title>
              </path>
              <path
                d={geometry.path}
                fill="none"
                markerEnd={`url(#${arrowMarkerId})`}
                stroke={stroke}
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                strokeOpacity={isFocused ? 0.78 : 0.38}
                strokeWidth={2}
                pointerEvents="none"
              />
              <text
                className="spot-flow-edge-label"
                x={geometry.labelX}
                y={geometry.labelY}
                fill="#334155"
                fontSize={11}
                paintOrder="stroke"
                pointerEvents="none"
                stroke="#ffffff"
                strokeWidth={4}
                textAnchor="middle"
              >
                {fmtFlowUsd(edge.tvlUsd)}
              </text>
              <title>{edgeTitle}</title>
            </g>
          )
        })}
        {visibleNodes.map((node) => {
          const isRoot = focusNodeId === node.id
          const isSelected = selectedNodeId === node.id
          const tags = vaultTags(node)
          let nextTagX = 12
          const positionedTags = tags.map((tag) => {
            const positionedTag = { ...tag, x: nextTagX }
            nextTagX += tag.width + 4
            return positionedTag
          })
          const role = nodeRole(node)
          const fill = isRoot
            ? 'rgba(6, 87, 249, 0.12)'
            : isSelected
              ? '#f8fafc'
              : node.nodeType === 'strategy'
                ? '#f8fafc'
                : '#ffffff'
          const stroke = isRoot
            ? '#0657f9'
            : isSelected
              ? '#0f172a'
              : node.nodeType === 'strategy'
                ? '#64748b'
                : role === 'top'
                  ? '#0f172a'
                  : role === 'bottom'
                    ? '#94a3b8'
                    : '#cbd5e1'

          return (
            // biome-ignore lint/a11y/useSemanticElements: SVG groups cannot be replaced with HTML buttons.
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              data-flow-node="true"
              role="button"
              tabIndex={0}
              onClick={() => onSelectNode(node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectNode(node.id)
              }}
              style={{ cursor: 'pointer' }}
            >
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={6}
                fill={fill}
                stroke={stroke}
                strokeWidth={isRoot || isSelected ? 2 : 1}
              />
              <text x={12} y={18} fill="#0f172a" fontSize={12} fontWeight={600}>
                {node.name.length > 29 ? `${node.name.slice(0, 28)}...` : node.name}
              </text>
              {positionedTags.map((tag) => {
                const fill = tag.kind === 'role' ? '#eef4ff' : tag.kind === 'retired' ? '#f5f5f5' : '#ffffff'
                const stroke = tag.kind === 'role' ? '#94adf2' : '#cbd5e1'
                const color = tag.kind === 'role' ? '#1d4ed8' : '#4f4f4f'
                return (
                  <g key={`${node.id}-${tag.kind}`} transform={`translate(${tag.x}, 24)`}>
                    <rect width={tag.width} height={14} rx={3} fill={fill} stroke={stroke} />
                    <text x={tag.width / 2} y={10} fill={color} fontSize={8.5} fontWeight={600} textAnchor="middle">
                      {tag.label}
                    </text>
                  </g>
                )
              })}
              {node.nodeType === 'strategy' && (
                <text x={12} y={34} fill="#64748b" fontSize={9} fontWeight={600}>
                  Router / allocation contract
                </text>
              )}
              <text x={12} y={54} fill="#64748b" fontSize={11}>
                raw {fmtFlowUsd(node.rawTvlUsd)} · ext {fmtFlowUsd(node.externalTvlUsd)}
              </text>
              <text x={12} y={67} fill="#94a3b8" fontSize={10}>
                {isRoot ? 'root' : node.nodeType} · {role} · in {node.incoming} · out {node.outgoing}
              </text>
              <g transform={`translate(${NODE_WIDTH - 30}, 49)`}>
                <a
                  className="spot-flow-node-action"
                  href={powergloveVaultPath(node.chainId, node.address)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${node.name} Powerglove page`}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  style={{ cursor: 'pointer' }}
                >
                  <rect width={20} height={20} fill="transparent" />
                  <path
                    d="M8 6H6.5A2.5 2.5 0 0 0 4 8.5v5A2.5 2.5 0 0 0 6.5 16h5A2.5 2.5 0 0 0 14 13.5V12"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth={1.5}
                  />
                  <path
                    d="M11 5h5v5 M16 5l-7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                  />
                  <title>Open Powerglove page</title>
                </a>
              </g>
              <title>{`${node.name}${tags.length > 0 ? ` · ${tags.map((tag) => tag.label).join(' · ')}` : ''} · raw ${fmtFlowUsd(node.rawTvlUsd)} · external ${fmtFlowUsd(node.externalTvlUsd)}`}</title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function DetailPanel({
  nodes,
  edges,
  selectedNodeId,
  drawer = false,
  open = true,
  onClose,
  onSelectNode
}: {
  nodes: LayoutNode[]
  edges: SpotFlowEdge[]
  selectedNodeId: string | null
  drawer?: boolean
  open?: boolean
  onClose?: () => void
  onSelectNode: (nodeId: string) => void
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const selectedNode = selectedNodeId ? (nodeById.get(selectedNodeId) ?? null) : null

  if (!selectedNode) {
    return (
      <aside className="border border-border bg-white p-3">
        <h3 className="text-sm font-semibold">Vault Inspector</h3>
        <div className="mt-3 text-sm text-muted-foreground">Select a vault to inspect origin and allocation edges.</div>
      </aside>
    )
  }

  const incomingEdges = edges
    .filter((edge) => edge.targetNodeId === selectedNode.id)
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
  const outgoingEdges = edges
    .filter((edge) => edge.sourceNodeId === selectedNode.id)
    .sort((a, b) => b.tvlUsd - a.tvlUsd)

  return (
    <aside
      id={drawer ? 'tvl-flow-inspector' : undefined}
      aria-label="Vault inspector"
      aria-hidden={drawer ? !open : undefined}
      inert={drawer && !open ? true : undefined}
      className={cn(
        'bg-white p-3',
        drawer
          ? 'absolute inset-y-0 right-0 z-20 w-[min(360px,calc(100%-2rem))] overflow-y-auto shadow-md transition-transform duration-200 ease-out motion-reduce:transition-none'
          : 'border border-border',
        drawer && (open ? 'translate-x-0' : 'pointer-events-none translate-x-full')
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Vault Inspector</h3>
        {drawer && onClose ? (
          <button type="button" className={INSPECTOR_TOGGLE_CLASS} aria-label="Close inspector" onClick={onClose}>
            <Menu aria-hidden="true" className="block size-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-3 space-y-4 text-sm">
        <div>
          <div className="font-medium">{selectedNode.name}</div>
          <div className="text-xs text-muted-foreground">{shortAddr(selectedNode.address)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2">
            <div className="text-muted-foreground">Raw TVL</div>
            <div className="mt-1 font-semibold tabular-nums">{fmtFlowUsd(selectedNode.rawTvlUsd)}</div>
          </div>
          <div className="p-2">
            <div className="text-muted-foreground">External TVL</div>
            <div className="mt-1 font-semibold tabular-nums">{fmtFlowUsd(selectedNode.externalTvlUsd)}</div>
          </div>
          <div className="p-2">
            <div className="text-muted-foreground">Yearn-Owned</div>
            <div className="mt-1 font-semibold tabular-nums">{fmtFlowUsd(selectedNode.upstreamOwnedTvlUsd ?? 0)}</div>
          </div>
          <div className="p-2">
            <div className="text-muted-foreground">Role</div>
            <div className="mt-1 font-semibold">{nodeRole(selectedNode)}</div>
          </div>
        </div>
        <div>
          <div className="label mb-2">Origin Edges</div>
          <div className="space-y-1">
            {incomingEdges.map((edge) => {
              const source = nodeById.get(edge.sourceNodeId)
              return (
                <button
                  type="button"
                  key={edge.id}
                  className="block w-full px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0657f9]"
                  onClick={() => onSelectNode(edge.sourceNodeId)}
                >
                  <span className="block truncate">{source?.name ?? edge.sourceNodeId}</span>
                  <span className="text-muted-foreground">
                    {fmtFlowUsd(edge.tvlUsd)} · {edge.kind}
                    {edgeValueNote(edge)}
                    {edgeDeductionNote(edge)}
                  </span>
                </button>
              )
            })}
            {incomingEdges.length === 0 && (
              <div className="text-xs text-muted-foreground">No upstream Yearn-owned TVL.</div>
            )}
          </div>
        </div>
        <div>
          <div className="label mb-2">Allocation Edges</div>
          <div className="space-y-1">
            {outgoingEdges.map((edge) => {
              const target = nodeById.get(edge.targetNodeId)
              return (
                <button
                  type="button"
                  key={edge.id}
                  className="block w-full px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0657f9]"
                  onClick={() => onSelectNode(edge.targetNodeId)}
                >
                  <span className="block truncate">{target?.name ?? edge.targetNodeId}</span>
                  <span className="text-muted-foreground">
                    {fmtFlowUsd(edge.tvlUsd)} · {edge.kind}
                    {edgeValueNote(edge)}
                    {edgeDeductionNote(edge)}
                  </span>
                </button>
              )
            })}
            {outgoingEdges.length === 0 && (
              <div className="text-xs text-muted-foreground">No downstream allocation edges.</div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

type TvlFlowGraphToolProps = {
  embedded?: boolean
  strategyMetadata?: TvlFlowStrategyMetadata[]
  vault?: TvlFlowVault
}

export function TvlFlowGraphTool({ embedded = false, strategyMetadata = [], vault }: TvlFlowGraphToolProps = {}) {
  const baseApiUrl = useMemo(
    () => buildTvlFlowGraphUrl(vault?.chainId ?? 1, embedded ? undefined : 'v3'),
    [embedded, vault?.chainId]
  )
  const [refreshRequest, setRefreshRequest] = useState<number | null>(null)
  const apiUrl = refreshRequest ? `${baseApiUrl}&refresh=true&request=${refreshRequest}` : baseApiUrl
  const { data: graphData, loading, error, retry, fetchedAt } = useFetch<TvlGraphResponse>(apiUrl)
  const [rootVaultNodeId, setRootVaultNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const mappedGraph = useMemo(() => mapGraphResponse(graphData), [graphData])
  const allocatorVaults = useMemo(
    () => findTvlFlowAllocatorVaults(mappedGraph.nodes, mappedGraph.edges, vault),
    [mappedGraph.edges, mappedGraph.nodes, vault]
  )
  const allocatorVaultKey = allocatorVaults
    .map((allocator) => `${allocator.chainId}:${allocator.address.toLowerCase()}`)
    .sort()
    .join('|')
  const [allocatorMetadata, setAllocatorMetadata] = useState<{
    key: string
    strategies: TvlFlowStrategyMetadata[]
  }>({ key: '', strategies: [] })

  useEffect(() => {
    if (!allocatorVaultKey) return

    let cancelled = false
    fetchTvlFlowAllocatorStrategyMetadata(allocatorVaults)
      .then((strategies) => {
        if (!cancelled) setAllocatorMetadata({ key: allocatorVaultKey, strategies })
      })
      .catch(() => {
        if (!cancelled) setAllocatorMetadata({ key: allocatorVaultKey, strategies: [] })
      })

    return () => {
      cancelled = true
    }
  }, [allocatorVaultKey, allocatorVaults])

  const resolvedStrategyMetadata = useMemo(
    () => [...(allocatorMetadata.key === allocatorVaultKey ? allocatorMetadata.strategies : []), ...strategyMetadata],
    [allocatorMetadata, allocatorVaultKey, strategyMetadata]
  )
  const graph = useMemo(() => {
    return {
      ...mappedGraph,
      nodes: enrichTvlFlowStrategyNodes(mappedGraph.nodes, resolvedStrategyMetadata)
    }
  }, [mappedGraph, resolvedStrategyMetadata])
  const outgoingByNode = useMemo(() => {
    const counts = new Map<string, number>()
    for (const edge of graph.edges) counts.set(edge.sourceNodeId, (counts.get(edge.sourceNodeId) ?? 0) + 1)
    return counts
  }, [graph.edges])
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const edge of graph.edges) {
      ids.add(edge.sourceNodeId)
      ids.add(edge.targetNodeId)
    }
    return ids
  }, [graph.edges])
  const graphNodes = graph.nodes.filter((node) => connectedNodeIds.has(node.id))
  const graphEdges = graph.edges
  const rootVaultNodes = graph.nodes
    .filter((node) => node.nodeType === 'vault' && connectedNodeIds.has(node.id))
    .sort((a, b) => b.rawTvlUsd - a.rawTvlUsd || a.name.localeCompare(b.name))
  const requestedRootVaultNodeId = findTvlFlowVaultNodeId(
    graph.nodes.filter((node) => connectedNodeIds.has(node.id)),
    vault
  )
  const rootVaultExists = rootVaultNodeId ? rootVaultNodes.some((node) => node.id === rootVaultNodeId) : false
  const effectiveRootVaultNodeId = rootVaultExists
    ? rootVaultNodeId
    : (requestedRootVaultNodeId ?? (embedded ? null : (rootVaultNodes[0]?.id ?? null)))
  const selectedNodeExists = selectedNodeId ? graphNodes.some((node) => node.id === selectedNodeId) : false
  const effectiveSelectedNodeId = selectedNodeExists ? selectedNodeId : effectiveRootVaultNodeId
  const displayEdges = graphEdges
  const nodes = useMemo(
    () => layoutGraph(graphNodes, displayEdges, effectiveRootVaultNodeId),
    [displayEdges, effectiveRootVaultNodeId, graphNodes]
  )
  const branchGraph = visibleGraphForFocus(nodes, displayEdges, effectiveRootVaultNodeId)
  const branchNodes = nodes.filter((node) => branchGraph.nodeIds.has(node.id))
  const branchEdges = displayEdges.filter((edge) => branchGraph.edgeIds.has(edge.id))
  const edgeKindCounts = graphEdges.reduce(
    (counts, edge) => {
      counts[edge.kind] = (counts[edge.kind] ?? 0) + 1
      return counts
    },
    {} as Record<string, number>
  )
  const selectedRootVault = effectiveRootVaultNodeId
    ? graph.nodes.find((node) => node.id === effectiveRootVaultNodeId)
    : null
  const setRootVault = (nodeId: string) => {
    setRootVaultNodeId(nodeId)
    setSelectedNodeId(nodeId)
    if (embedded) setIsInspectorOpen(true)
  }
  const inspectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    if (embedded) setIsInspectorOpen(true)
  }
  const requestBackendRefresh = () => {
    setRefreshRequest(Date.now())
  }

  const vaultIdentity = vault ? `${vault.chainId}:${vault.address.toLowerCase()}` : null
  useEffect(() => {
    if (!vaultIdentity) return
    setRootVaultNodeId(null)
    setSelectedNodeId(null)
    setIsInspectorOpen(false)
  }, [vaultIdentity])

  useEffect(() => {
    if (!isInspectorOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsInspectorOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isInspectorOpen])

  return (
    <main className={cn(embedded ? 'w-full' : 'container flex-1 pb-0 pt-0')}>
      <section
        className={cn(
          'pg-stats rounded-none bg-white',
          embedded ? 'border-0 p-0' : 'border-x border-b border-border p-4'
        )}
      >
        {!embedded ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              className="filter-select min-w-72"
              value={effectiveRootVaultNodeId ?? ''}
              onChange={(event) => {
                if (event.target.value) setRootVault(event.target.value)
              }}
            >
              {rootVaultNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name} · {fmtFlowUsd(node.rawTvlUsd)} · {outgoingByNode.get(node.id) ?? 0} out
                </option>
              ))}
            </select>
            <button type="button" className="page-btn ml-auto px-3 py-2 text-sm" onClick={requestBackendRefresh}>
              Refresh API
            </button>
          </div>
        ) : null}

        {!embedded ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{selectedRootVault ? `${selectedRootVault.name} root` : 'No root vault selected'}</span>
            <span>{branchNodes.length} nodes</span>
            <span>{branchEdges.length} edges</span>
            <span>
              {Object.entries(edgeKindCounts)
                .map(([kind, count]) => `${kind} ${count}`)
                .join(', ') || 'no edges'}
            </span>
            {fetchedAt && <span>Fetched {new Date(fetchedAt).toLocaleTimeString()}</span>}
            {!graph.isLive && <span>No live graph data</span>}
          </div>
        ) : null}

        {loading && (
          <div className="mb-3 border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-muted-foreground">
            Loading live TVL graph...
          </div>
        )}

        {error && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-muted-foreground">
            <span>Live endpoint unavailable: {error}.</span>
            <button type="button" className="page-btn px-3 py-1.5 text-xs" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {embedded && vault && !loading && !error && !requestedRootVaultNodeId ? (
          <div className="border border-border bg-[var(--surface-2)] px-3 py-6 text-center text-sm text-muted-foreground">
            No connected TVL flow is available for this vault.
          </div>
        ) : branchNodes.length === 0 || branchEdges.length === 0 ? (
          <div className="border border-border bg-[var(--surface-2)] px-3 py-6 text-center text-sm text-muted-foreground">
            No graph edges available for the selected allocator.
          </div>
        ) : embedded ? (
          <div className="relative overflow-hidden">
            <GraphCanvas
              borderless
              isRefreshing={loading}
              inspectorOpen={isInspectorOpen}
              nodes={nodes}
              edges={displayEdges}
              focusNodeId={effectiveRootVaultNodeId}
              selectedNodeId={effectiveSelectedNodeId}
              onOpenInspector={() => setIsInspectorOpen(true)}
              onRefresh={requestBackendRefresh}
              onSelectNode={inspectNode}
            />
            <DetailPanel
              drawer
              open={isInspectorOpen}
              nodes={branchNodes}
              edges={branchEdges}
              selectedNodeId={effectiveSelectedNodeId}
              onClose={() => setIsInspectorOpen(false)}
              onSelectNode={inspectNode}
            />
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <GraphCanvas
              nodes={nodes}
              edges={displayEdges}
              focusNodeId={effectiveRootVaultNodeId}
              selectedNodeId={effectiveSelectedNodeId}
              onSelectNode={inspectNode}
            />
            <DetailPanel
              nodes={branchNodes}
              edges={branchEdges}
              selectedNodeId={effectiveSelectedNodeId}
              onSelectNode={inspectNode}
            />
          </div>
        )}
      </section>
    </main>
  )
}
