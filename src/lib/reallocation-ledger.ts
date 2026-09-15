import type {
  ReallocationFlowLedger,
  ReallocationLedgerAttribution,
  ReallocationLedgerFlow,
  ReallocationLedgerNode,
  ReallocationStateStrategy
} from '@/types/reallocationTypes'

const IDLE_KEY = 'unallocated'
const SUPER_SOURCE = 'super:source'
const SUPER_SINK = 'super:sink'

type RouteEndpoint = { type: 'balance'; key: string } | { type: 'boundary'; key: 'external' | 'accounting' }

export interface ReallocationLedgerRoute {
  source: RouteEndpoint
  target: RouteEndpoint
  amount: bigint
  viaIdle: boolean
  attributions: Array<ReallocationLedgerAttribution | 'boundary_balance'>
}

interface FlowEdge {
  to: string
  reverseIndex: number
  capacity: bigint
  flow: bigint
  original: boolean
  attribution?: ReallocationLedgerAttribution
}

function balanceKey(node: ReallocationLedgerNode): string | null {
  if (node.type === 'idle') {
    return IDLE_KEY
  }
  return node.type === 'strategy' ? node.address.toLowerCase() : null
}

function originNode(endpoint: RouteEndpoint): string {
  return endpoint.type === 'balance' ? `origin:balance:${endpoint.key}` : `origin:boundary:${endpoint.key}`
}

function coreNode(key: string): string {
  return `balance:${key}`
}

function endNode(endpoint: RouteEndpoint): string {
  return endpoint.type === 'balance' ? `end:balance:${endpoint.key}` : `end:boundary:${endpoint.key}`
}

function addEdge(
  graph: Map<string, FlowEdge[]>,
  from: string,
  to: string,
  capacity: bigint,
  attribution?: ReallocationLedgerAttribution
): void {
  if (capacity <= 0n) {
    return
  }

  const fromEdges = graph.get(from) ?? []
  const toEdges = graph.get(to) ?? []
  const forwardIndex = fromEdges.length
  const reverseIndex = toEdges.length
  fromEdges.push({ to, reverseIndex, capacity, flow: 0n, original: true, attribution })
  toEdges.push({ to: from, reverseIndex: forwardIndex, capacity: 0n, flow: 0n, original: false })
  graph.set(from, fromEdges)
  graph.set(to, toEdges)
}

function runMaxFlow(graph: Map<string, FlowEdge[]>): bigint {
  let totalFlow = 0n

  while (true) {
    const parent = new Map<string, { from: string; edgeIndex: number }>()
    const queue = [SUPER_SOURCE]
    parent.set(SUPER_SOURCE, { from: '', edgeIndex: -1 })

    for (let queueIndex = 0; queueIndex < queue.length && !parent.has(SUPER_SINK); queueIndex += 1) {
      const from = queue[queueIndex]
      for (const [edgeIndex, edge] of (graph.get(from) ?? []).entries()) {
        if (parent.has(edge.to) || edge.capacity - edge.flow <= 0n) {
          continue
        }
        parent.set(edge.to, { from, edgeIndex })
        queue.push(edge.to)
      }
    }

    if (!parent.has(SUPER_SINK)) {
      return totalFlow
    }

    let amount: bigint | null = null
    for (let node = SUPER_SINK; node !== SUPER_SOURCE; ) {
      const step = parent.get(node)
      if (!step) {
        return totalFlow
      }
      const edge = graph.get(step.from)?.[step.edgeIndex]
      if (!edge) {
        return totalFlow
      }
      const available = edge.capacity - edge.flow
      amount = amount === null || available < amount ? available : amount
      node = step.from
    }

    if (amount === null || amount <= 0n) {
      return totalFlow
    }

    for (let node = SUPER_SINK; node !== SUPER_SOURCE; ) {
      const step = parent.get(node)
      if (!step) {
        return totalFlow
      }
      const edge = graph.get(step.from)?.[step.edgeIndex]
      if (!edge) {
        return totalFlow
      }
      edge.flow += amount
      const reverse = graph.get(edge.to)?.[edge.reverseIndex]
      if (reverse) {
        reverse.flow -= amount
      }
      node = step.from
    }
    totalFlow += amount
  }
}

function openingBalances(strategies: readonly ReallocationStateStrategy[]): Map<string, bigint> {
  return new Map(
    strategies.map((strategy) => [
      strategy.isUnallocated ? IDLE_KEY : strategy.strategyKey,
      BigInt(strategy.allocationAmount ?? '0')
    ])
  )
}

function boundaryTotals(
  flows: readonly ReallocationLedgerFlow[],
  side: 'source' | 'target'
): Map<'external' | 'accounting', bigint> {
  const totals = new Map<'external' | 'accounting', bigint>()
  for (const flow of flows) {
    const node = flow[side]
    if (node.type !== 'external' && node.type !== 'accounting') {
      continue
    }
    totals.set(node.type, (totals.get(node.type) ?? 0n) + BigInt(flow.amount))
  }
  return totals
}

function routeEndpointFromOrigin(node: string): RouteEndpoint | null {
  if (node.startsWith('origin:balance:')) {
    return { type: 'balance', key: node.slice('origin:balance:'.length) }
  }
  if (node === 'origin:boundary:external' || node === 'origin:boundary:accounting') {
    return { type: 'boundary', key: node.endsWith('external') ? 'external' : 'accounting' }
  }
  return null
}

function routeEndpointFromEnd(node: string): RouteEndpoint | null {
  if (node.startsWith('end:balance:')) {
    return { type: 'balance', key: node.slice('end:balance:'.length) }
  }
  if (node === 'end:boundary:external' || node === 'end:boundary:accounting') {
    return { type: 'boundary', key: node.endsWith('external') ? 'external' : 'accounting' }
  }
  return null
}

function routeAttributions(edges: readonly FlowEdge[]): ReallocationLedgerRoute['attributions'] {
  const attributions = [...new Set(edges.flatMap((edge) => (edge.attribution ? [edge.attribution] : [])))]
  return attributions.length > 0 ? attributions : ['boundary_balance']
}

function findUsedPath(
  graph: ReadonlyMap<string, FlowEdge[]>,
  start: string,
  visited = new Set<string>()
): Array<{ from: string; edge: FlowEdge }> | null {
  if (routeEndpointFromEnd(start)) {
    return []
  }
  if (visited.has(start)) {
    return null
  }
  visited.add(start)

  for (const edge of graph.get(start) ?? []) {
    if (!edge.original || edge.flow <= 0n || edge.to === SUPER_SINK) {
      continue
    }
    const suffix = findUsedPath(graph, edge.to, new Set(visited))
    if (suffix) {
      return [{ from: start, edge }, ...suffix]
    }
  }
  return null
}

function decomposeUsedFlow(graph: Map<string, FlowEdge[]>, sources: readonly string[]): ReallocationLedgerRoute[] {
  const routes: ReallocationLedgerRoute[] = []

  for (const sourceNode of sources) {
    while (true) {
      const path = findUsedPath(graph, sourceNode)
      const source = routeEndpointFromOrigin(sourceNode)
      const lastEdge = path?.[path.length - 1]?.edge
      const target = lastEdge ? routeEndpointFromEnd(lastEdge.to) : null
      if (!path || path.length === 0 || !source || !target) {
        break
      }

      const amount = path.reduce((minimum, { edge }) => (edge.flow < minimum ? edge.flow : minimum), path[0]!.edge.flow)
      const edges = path.map(({ edge }) => edge)
      for (const edge of edges) {
        edge.flow -= amount
      }
      routes.push({
        source,
        target,
        amount,
        viaIdle: path.some(({ from, edge }) => from === coreNode(IDLE_KEY) || edge.to === coreNode(IDLE_KEY)),
        attributions: routeAttributions(edges)
      })
    }
  }

  return routes
}

export function decomposeReallocationLedger(
  beforeStrategies: readonly ReallocationStateStrategy[],
  afterStrategies: readonly ReallocationStateStrategy[],
  ledger: ReallocationFlowLedger
): ReallocationLedgerRoute[] | null {
  const opening = openingBalances(beforeStrategies)
  const closing = openingBalances(afterStrategies)
  const boundarySources = boundaryTotals(ledger.flows, 'source')
  const boundaryTargets = boundaryTotals(ledger.flows, 'target')
  const graph = new Map<string, FlowEdge[]>()
  const sourceNodes: string[] = []

  for (const [key, amount] of opening) {
    const endpoint = { type: 'balance', key } as const
    const origin = originNode(endpoint)
    sourceNodes.push(origin)
    addEdge(graph, SUPER_SOURCE, origin, amount)
    addEdge(graph, origin, coreNode(key), amount)
  }
  for (const [key, amount] of boundarySources) {
    const origin = originNode({ type: 'boundary', key })
    sourceNodes.push(origin)
    addEdge(graph, SUPER_SOURCE, origin, amount)
  }

  for (const [key, amount] of closing) {
    const end = endNode({ type: 'balance', key })
    addEdge(graph, coreNode(key), end, amount)
    addEdge(graph, end, SUPER_SINK, amount)
  }
  for (const [key, amount] of boundaryTargets) {
    const end = endNode({ type: 'boundary', key })
    addEdge(graph, end, SUPER_SINK, amount)
  }

  for (const flow of ledger.flows) {
    const amount = BigInt(flow.amount)
    const sourceKey = balanceKey(flow.source)
    const targetKey = balanceKey(flow.target)
    const source = sourceKey
      ? coreNode(sourceKey)
      : flow.source.type === 'external' || flow.source.type === 'accounting'
        ? originNode({ type: 'boundary', key: flow.source.type })
        : null
    const target = targetKey
      ? coreNode(targetKey)
      : flow.target.type === 'external' || flow.target.type === 'accounting'
        ? endNode({ type: 'boundary', key: flow.target.type })
        : null
    if (source && target) {
      addEdge(graph, source, target, amount, flow.attribution)
    }
  }

  const expectedFlow = [...opening.values(), ...boundarySources.values()].reduce((sum, amount) => sum + amount, 0n)
  if (runMaxFlow(graph) !== expectedFlow) {
    return null
  }

  return decomposeUsedFlow(graph, sourceNodes)
}
