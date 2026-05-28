import { type PointerEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { powergloveVaultPath, shortAddr, useFetch } from './hooks'
import './styles.css'

const NODE_WIDTH = 220
const NODE_HEIGHT = 54
const COLUMN_GAP = 260
const ROW_GAP = 116
const CANVAS_MIN_WIDTH = 1180
const CANVAS_MIN_HEIGHT = 680
const CANVAS_PADDING = 32
const TVL_FLOW_GRAPH_BASE_URL = '/api/tvl/graph?chainId=1&category=v3&includeRetired=true'

function fmtFlowUsd(n: number): string {
  const format = (value: number) => value.toLocaleString(undefined, { maximumSignificantDigits: 3 })
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${format(n / 1e9)}B`
  if (abs >= 1e6) return `$${format(n / 1e6)}M`
  if (abs >= 1e3) return `$${format(n / 1e3)}K`
  if (abs >= 1) return `$${format(n)}`
  return '$0'
}

interface SpotFlowNode {
  id: string
  name: string
  address: string
  chainId: number
  nodeType: 'vault' | 'strategy'
  category: string
  rawTvlUsd: number
  upstreamOwnedTvlUsd?: number
  externalTvlUsd: number
  isRetired: boolean
}

interface SpotFlowEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  holderAddress: string
  kind: string
  tvlUsd: number
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

function edgeColor(kind: SpotFlowEdge['kind']): string {
  if (kind === 'registry') return '#0657f9'
  if (kind === 'auto') return '#1d4ed8'
  if (kind === 'strategy') return '#64748b'
  if (kind === 'bridge') return '#94a3b8'
  return '#0f172a'
}

function isDeductibleEdge(edge: SpotFlowEdge): boolean {
  return edge.kind === 'auto' || edge.kind === 'registry'
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

function mapGraphResponse(data: TvlGraphResponse | null): {
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

  if (rawNodes.length === 0) {
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
        tvlUsd: numberValue(edge, ['tvlUsd', 'amountUsd', 'upstreamOwnedTvlUsd', 'value'])
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
  onSelectNode,
  onSetRootNode,
  onMoveNode
}: {
  nodes: LayoutNode[]
  edges: SpotFlowEdge[]
  focusNodeId: string | null
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
  onSetRootNode: (nodeId: string) => void
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void
}) {
  const visibleGraph = visibleGraphForFocus(nodes, edges, focusNodeId)
  const positionedNodes = centerVisibleTree(nodes, edges, visibleGraph, focusNodeId)
  const positionedNodeById = new Map(positionedNodes.map((node) => [node.id, node]))
  const visibleNodes = positionedNodes.filter((node) => visibleGraph.nodeIds.has(node.id))
  const visibleEdges = edges.filter((edge) => visibleGraph.edgeIds.has(edge.id))
  const containerRef = useRef<HTMLDivElement | null>(null)
  const arrowMarkerId = useId()
  const previousFocusNodeId = useRef(focusNodeId)
  const [viewportSize, setViewportSize] = useState({ width: CANVAS_MIN_WIDTH, height: CANVAS_MIN_HEIGHT })
  const [zoom, setZoom] = useState(1)
  const [dragState, setDragState] = useState<{
    nodeId: string
    pointerId: number
    offsetX: number
    offsetY: number
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
    const viewportAspect = viewportSize.width / viewportSize.height
    const measuredAspect = measuredBounds.width / measuredBounds.height

    if (measuredAspect > viewportAspect) {
      const height = measuredBounds.width / viewportAspect
      return {
        ...measuredBounds,
        y: measuredBounds.y - (height - measuredBounds.height) / 2,
        height
      }
    }

    const width = measuredBounds.height * viewportAspect
    return {
      ...measuredBounds,
      x: measuredBounds.x - (width - measuredBounds.width) / 2,
      width
    }
  }, [viewportSize, visibleNodes])
  const viewBox = useMemo(() => {
    const width = fittedBounds.width / zoom
    const height = fittedBounds.height / zoom
    return {
      x: fittedBounds.x + (fittedBounds.width - width) / 2,
      y: fittedBounds.y + (fittedBounds.height - height) / 2,
      width,
      height
    }
  }, [fittedBounds, zoom])

  useEffect(() => {
    if (previousFocusNodeId.current !== focusNodeId) {
      previousFocusNodeId.current = focusNodeId
      setZoom(1)
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

  const getSvgPoint = (event: PointerEvent<SVGElement>): { x: number; y: number } => {
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return { x: event.clientX, y: event.clientY }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const transform = svg.getScreenCTM()
    if (!transform) return { x: event.clientX, y: event.clientY }
    const svgPoint = point.matrixTransform(transform.inverse())
    return { x: svgPoint.x, y: svgPoint.y }
  }

  return (
    <div ref={containerRef} className="relative border border-border bg-white">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 border border-border bg-white/90 p-1">
        <button
          type="button"
          className="page-btn px-2 py-1 text-xs"
          onClick={() => setZoom((value) => Math.min(3, value * 1.2))}
        >
          +
        </button>
        <button
          type="button"
          className="page-btn px-2 py-1 text-xs"
          onClick={() => setZoom((value) => Math.max(0.35, value / 1.2))}
        >
          -
        </button>
        <button type="button" className="page-btn px-2 py-1 text-xs" onClick={() => setZoom(1)}>
          Fit
        </button>
      </div>
      <svg
        width="100%"
        height={CANVAS_MIN_HEIGHT}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="TVL flow graph"
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

          const sourceX = source.x + NODE_WIDTH / 2
          const sourceY = source.y + NODE_HEIGHT
          const targetX = target.x + NODE_WIDTH / 2
          const targetY = target.y
          const curveOffset = Math.max(36, Math.abs(targetY - sourceY) / 2)
          const stroke = edgeColor(edge.kind)
          const isFocused = selectedNodeId === edge.sourceNodeId || selectedNodeId === edge.targetNodeId
          const strokeDasharray = edge.kind === 'strategy' ? '5 5' : undefined
          const midX = (sourceX + targetX) / 2
          const midY = (sourceY + targetY) / 2
          const edgeTitle = `${source.name} -> ${target.name} · ${fmtFlowUsd(edge.tvlUsd)} · ${edge.kind}${isDeductibleEdge(edge) ? ' deducted' : ' allocation'}${edge.holderAddress ? ` · holder ${shortAddr(edge.holderAddress)}` : ''}`

          return (
            <g key={`${edge.id}-${edge.sourceNodeId}-${edge.targetNodeId}`} className="spot-flow-edge">
              <path
                d={`M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + curveOffset}, ${targetX} ${targetY - curveOffset}, ${targetX} ${targetY}`}
                fill="none"
                stroke="transparent"
                strokeLinecap="round"
                strokeWidth={12}
              >
                <title>{edgeTitle}</title>
              </path>
              <path
                d={`M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + curveOffset}, ${targetX} ${targetY - curveOffset}, ${targetX} ${targetY}`}
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
                x={midX}
                y={midY - 6}
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
              role="button"
              tabIndex={0}
              onClick={() => onSelectNode(node.id)}
              onPointerDown={(event) => {
                const point = getSvgPoint(event)
                event.currentTarget.setPointerCapture(event.pointerId)
                setDragState({
                  nodeId: node.id,
                  pointerId: event.pointerId,
                  offsetX: point.x - node.x,
                  offsetY: point.y - node.y
                })
                onSelectNode(node.id)
              }}
              onPointerMove={(event) => {
                if (!dragState || dragState.nodeId !== node.id || dragState.pointerId !== event.pointerId) return
                const point = getSvgPoint(event)
                onMoveNode(node.id, {
                  x: Math.max(0, point.x - dragState.offsetX),
                  y: Math.max(0, point.y - dragState.offsetY)
                })
              }}
              onPointerUp={(event) => {
                if (dragState?.pointerId === event.pointerId) {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                  setDragState(null)
                }
              }}
              onPointerCancel={(event) => {
                if (dragState?.pointerId === event.pointerId) setDragState(null)
              }}
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
              <text x={12} y={35} fill="#64748b" fontSize={11}>
                raw {fmtFlowUsd(node.rawTvlUsd)} · ext {fmtFlowUsd(node.externalTvlUsd)}
              </text>
              <text x={12} y={48} fill="#94a3b8" fontSize={10}>
                {isRoot ? 'root' : node.nodeType} · {role} · in {node.incoming} · out {node.outgoing}
              </text>
              {node.nodeType === 'vault' && !isRoot && (
                // biome-ignore lint/a11y/useSemanticElements: SVG groups cannot be replaced with HTML buttons.
                <g
                  className="spot-flow-node-action"
                  role="button"
                  tabIndex={0}
                  aria-label={`Center graph on ${node.name}`}
                  transform={`translate(${NODE_WIDTH - 30}, 8)`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSetRootNode(node.id)
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.stopPropagation()
                      onSetRootNode(node.id)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect width={20} height={20} fill="transparent" />
                  <circle cx={10} cy={10} r={5} fill="none" stroke="currentColor" strokeWidth={1.5} />
                  <path
                    d="M10 3.5V6.5 M10 13.5V16.5 M3.5 10H6.5 M13.5 10H16.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth={1.5}
                  />
                  <title>Center graph on this vault</title>
                </g>
              )}
              {node.nodeType === 'vault' && (
                <g transform={`translate(${NODE_WIDTH - 30}, 31)`}>
                  <a
                    className="spot-flow-node-action"
                    href={powergloveVaultPath(node.chainId, node.address)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${node.name} vault page`}
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
                    <title>Open vault page</title>
                  </a>
                </g>
              )}
              <title>{`${node.name} · raw ${fmtFlowUsd(node.rawTvlUsd)} · external ${fmtFlowUsd(node.externalTvlUsd)}`}</title>
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
  onSelectNode
}: {
  nodes: LayoutNode[]
  edges: SpotFlowEdge[]
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const selectedNode = selectedNodeId ? (nodeById.get(selectedNodeId) ?? null) : null

  if (!selectedNode) {
    return (
      <aside className="border border-border bg-white p-3">
        <h3 className="text-sm font-semibold">Inspector</h3>
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
    <aside className="border border-border bg-white p-3">
      <h3 className="text-sm font-semibold">Inspector</h3>
      <div className="mt-3 space-y-4 text-sm">
        <div>
          <div className="font-medium">{selectedNode.name}</div>
          <div className="text-xs text-muted-foreground">{shortAddr(selectedNode.address)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="border border-border p-2">
            <div className="text-muted-foreground">Raw TVL</div>
            <div className="mt-1 font-semibold tabular-nums">{fmtFlowUsd(selectedNode.rawTvlUsd)}</div>
          </div>
          <div className="border border-border p-2">
            <div className="text-muted-foreground">External TVL</div>
            <div className="mt-1 font-semibold tabular-nums">{fmtFlowUsd(selectedNode.externalTvlUsd)}</div>
          </div>
          <div className="border border-border p-2">
            <div className="text-muted-foreground">Yearn-Owned</div>
            <div className="mt-1 font-semibold tabular-nums">{fmtFlowUsd(selectedNode.upstreamOwnedTvlUsd ?? 0)}</div>
          </div>
          <div className="border border-border p-2">
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
                  className="block w-full border border-border px-2 py-1.5 text-left text-xs"
                  onClick={() => onSelectNode(edge.sourceNodeId)}
                >
                  <span className="block truncate">{source?.name ?? edge.sourceNodeId}</span>
                  <span className="text-muted-foreground">
                    {fmtFlowUsd(edge.tvlUsd)} · {edge.kind}
                    {isDeductibleEdge(edge) ? ' · deducted' : ''}
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
                  className="block w-full border border-border px-2 py-1.5 text-left text-xs"
                  onClick={() => onSelectNode(edge.targetNodeId)}
                >
                  <span className="block truncate">{target?.name ?? edge.targetNodeId}</span>
                  <span className="text-muted-foreground">
                    {fmtFlowUsd(edge.tvlUsd)} · {edge.kind}
                    {isDeductibleEdge(edge) ? ' · deducted' : ''}
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

export function TvlFlowGraphTool() {
  const [apiUrl, setApiUrl] = useState(TVL_FLOW_GRAPH_BASE_URL)
  const { data: graphData, loading, error, retry, fetchedAt } = useFetch<TvlGraphResponse>(apiUrl)
  const [rootVaultNodeId, setRootVaultNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({})
  const graph = useMemo(() => mapGraphResponse(graphData), [graphData])
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
  const rootVaultExists = rootVaultNodeId ? rootVaultNodes.some((node) => node.id === rootVaultNodeId) : false
  const effectiveRootVaultNodeId = rootVaultExists ? rootVaultNodeId : (rootVaultNodes[0]?.id ?? null)
  const selectedNodeExists = selectedNodeId ? graphNodes.some((node) => node.id === selectedNodeId) : false
  const effectiveSelectedNodeId = selectedNodeExists ? selectedNodeId : effectiveRootVaultNodeId
  const displayEdges = graphEdges
  const nodes = useMemo(
    () =>
      layoutGraph(graphNodes, displayEdges, effectiveRootVaultNodeId).map((node) => ({
        ...node,
        ...(manualPositions[node.id] ?? {})
      })),
    [displayEdges, effectiveRootVaultNodeId, graphNodes, manualPositions]
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
    setManualPositions({})
  }
  const requestBackendRefresh = () => {
    setManualPositions({})
    setApiUrl(`${TVL_FLOW_GRAPH_BASE_URL}&refresh=true&request=${Date.now()}`)
  }

  return (
    <main className="flex-1 container pt-0 pb-0">
      <section className="pg-stats rounded-none border-x border-b border-border bg-white p-4">
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
          {Object.keys(manualPositions).length > 0 && (
            <button type="button" className="page-btn px-3 py-2 text-sm" onClick={() => setManualPositions({})}>
              Reset layout
            </button>
          )}
          <button type="button" className="page-btn ml-auto px-3 py-2 text-sm" onClick={requestBackendRefresh}>
            Refresh API
          </button>
        </div>

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
          {!graph.isLive && <span>Fixture fallback</span>}
        </div>

        {loading && (
          <div className="mb-3 border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-muted-foreground">
            Loading live TVL graph...
          </div>
        )}

        {error && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-[var(--surface-2)] px-3 py-2 text-sm text-muted-foreground">
            <span>Live endpoint unavailable: {error}. Using fixture fallback.</span>
            <button type="button" className="page-btn px-3 py-1.5 text-xs" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {branchNodes.length === 0 || branchEdges.length === 0 ? (
          <div className="border border-border bg-[var(--surface-2)] px-3 py-6 text-center text-sm text-muted-foreground">
            No graph edges available for the selected allocator.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <GraphCanvas
              nodes={nodes}
              edges={displayEdges}
              focusNodeId={effectiveRootVaultNodeId}
              selectedNodeId={effectiveSelectedNodeId}
              onMoveNode={(nodeId, position) => setManualPositions((current) => ({ ...current, [nodeId]: position }))}
              onSelectNode={setSelectedNodeId}
              onSetRootNode={setRootVault}
            />
            <DetailPanel
              nodes={branchNodes}
              edges={branchEdges}
              selectedNodeId={effectiveSelectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        )}
      </section>
    </main>
  )
}
