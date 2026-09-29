import { decomposeReallocationLedger } from '@/lib/reallocation-ledger'
import type { StrategyAllocationChartDatum } from '@/types/dataTypes'
import type {
  ReallocationFlowLedger,
  ReallocationIdleBridge,
  ReallocationPanel,
  ReallocationState,
  ReallocationStateStrategy,
  ReallocationStrategy
} from '@/types/reallocationTypes'
import { buildBlueShadePalette } from './theme-blue-palette'

const TOTAL_BPS = 10000
const NORMALIZATION_TOLERANCE_BPS = 5
const FLOW_EPSILON = 1e-9
const DEFAULT_NODE_GAP_RATIO = 12 / 390
const UNALLOCATED_STRATEGY_KEY = 'unallocated'
const UNALLOCATED_COLOR = '#9ca3af'

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
})

export interface ReallocationNormalizedChangeStrategy {
  strategyKey: string
  strategyAddress: string | null
  name: string
  isUnallocated: boolean
  currentAllocationPct: number
  targetAllocationPct: number
  currentAprPct: number | null
  targetAprPct: number | null
}

export interface ReallocationNormalizedChange {
  sourceKey: string
  timestampUtc: string | null
  tvl: number | null
  tvlUnit: string | null
  currentVaultAprPct: number | null
  targetVaultAprPct: number | null
  strategies: ReallocationNormalizedChangeStrategy[]
}

export interface CurrentAllocationStrategyInput {
  strategyAddress: string
  name: string
  allocationPct: number
  aprPct: number | null
}

export interface CurrentAllocationInput {
  timestampUtc: string
  tvl: number | null
  tvlUnit: string | null
  vaultAprPct: number | null
  strategies: readonly CurrentAllocationStrategyInput[]
}

export interface SankeyNode {
  id: string
  displayName: string
  labelText: string
  value: number
  localY: number
  heightRatio: number
  side: 'before' | 'center' | 'after'
  inboundValue?: number
  outboundValue?: number
  centerRole?: 'bridge' | 'source' | 'sink'
}

export interface SankeyLink {
  source: string
  target: string
  value: number
  attributions?: string[]
}

export interface SankeyGraph {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isPositive(value: number): boolean {
  return value > FLOW_EPSILON
}

function roundFlowValue(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function percentToBps(percent: number): number {
  return Math.round(percent * 100)
}

function normalizeStrategyName(value: string): string {
  return value.trim().toLowerCase()
}

function wrapLabelText(value: string, maxLineLength = 18): string {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const state = words.reduce(
    (acc, word) => {
      if (word.length > maxLineLength) {
        return {
          lines: [
            ...acc.lines,
            ...(acc.currentLine ? [acc.currentLine] : []),
            ...word.match(new RegExp(`.{1,${maxLineLength}}`, 'g'))!
          ],
          currentLine: ''
        }
      }

      const nextLine = acc.currentLine ? `${acc.currentLine} ${word}` : word
      if (nextLine.length <= maxLineLength) {
        return {
          lines: acc.lines,
          currentLine: nextLine
        }
      }

      return {
        lines: [...acc.lines, ...(acc.currentLine ? [acc.currentLine] : [])],
        currentLine: word
      }
    },
    {
      lines: [] as string[],
      currentLine: ''
    }
  )

  return [...state.lines, ...(state.currentLine ? [state.currentLine] : [])].join('\n') || value
}

function getStateStrategyIdentity(strategy: ReallocationStateStrategy): string {
  return strategy.isUnallocated ? UNALLOCATED_STRATEGY_KEY : strategy.strategyKey
}

function buildSnapshotState(change: ReallocationNormalizedChange): ReallocationState {
  return {
    id: `snapshot:${change.sourceKey}`,
    timestampUtc: change.timestampUtc,
    tvl: change.tvl,
    tvlUnit: change.tvlUnit,
    vaultAprPct: change.currentVaultAprPct,
    strategies: change.strategies.map((strategy) => ({
      strategyKey: strategy.strategyKey,
      strategyAddress: strategy.strategyAddress,
      name: strategy.name,
      isUnallocated: strategy.isUnallocated,
      allocationPct: strategy.currentAllocationPct,
      aprPct: strategy.currentAprPct
    }))
  }
}

function buildProposalState(change: ReallocationNormalizedChange): ReallocationState {
  return {
    id: `proposal:${change.sourceKey}`,
    timestampUtc: change.timestampUtc,
    tvl: change.tvl,
    tvlUnit: change.tvlUnit,
    vaultAprPct: change.targetVaultAprPct,
    strategies: change.strategies.map((strategy) => ({
      strategyKey: strategy.strategyKey,
      strategyAddress: strategy.strategyAddress,
      name: strategy.name,
      isUnallocated: strategy.isUnallocated,
      allocationPct: strategy.targetAllocationPct,
      aprPct: strategy.targetAprPct
    }))
  }
}

function buildCurrentAllocationState(
  currentAllocation: CurrentAllocationInput,
  referenceState?: ReallocationState
): ReallocationState {
  const referenceStrategies = referenceState?.strategies ?? []
  const referenceByAddress = new Map(
    referenceStrategies.flatMap((strategy) => {
      if (!strategy.strategyAddress) {
        return []
      }

      return [[strategy.strategyAddress.toLowerCase(), strategy] as const]
    })
  )
  const referenceByName = referenceStrategies.reduce((state, strategy) => {
    const normalizedName = normalizeStrategyName(strategy.name)
    if (!normalizedName) {
      return state
    }

    const nextMatches = [...(state.get(normalizedName) ?? []), strategy]
    const nextState = new Map(state)
    nextState.set(normalizedName, nextMatches)
    return nextState
  }, new Map<string, ReallocationStateStrategy[]>())

  const resolvedStrategies = currentAllocation.strategies.reduce(
    (state, strategy, index) => {
      const normalizedAddress = strategy.strategyAddress.toLowerCase()
      if (state.seenAddresses.has(normalizedAddress)) {
        return state
      }

      const referenceMatchByAddress = referenceByAddress.get(normalizedAddress)
      const normalizedName = normalizeStrategyName(strategy.name)
      const referenceMatchByName =
        normalizedName && !referenceMatchByAddress
          ? (referenceByName.get(normalizedName) ?? []).find(
              (candidate) => !state.usedReferenceIds.has(candidate.strategyKey)
            )
          : undefined
      const referenceMatch = referenceMatchByAddress ?? referenceMatchByName
      const resolvedStrategyKey = referenceMatch?.strategyKey ?? normalizedAddress
      const fallbackName = strategy.name.trim() || `Strategy ${index + 1}`
      const resolvedName = referenceMatch?.name ?? fallbackName
      const nextSeenAddresses = new Set(state.seenAddresses)
      nextSeenAddresses.add(normalizedAddress)
      const nextUsedReferenceIds = referenceMatch
        ? new Set([...state.usedReferenceIds, referenceMatch.strategyKey])
        : state.usedReferenceIds

      return {
        seenAddresses: nextSeenAddresses,
        usedReferenceIds: nextUsedReferenceIds,
        strategies: [
          ...state.strategies,
          {
            strategyKey: resolvedStrategyKey,
            strategyAddress: strategy.strategyAddress,
            name: resolvedName,
            isUnallocated: false,
            allocationPct: strategy.allocationPct,
            aprPct: strategy.aprPct
          }
        ]
      }
    },
    {
      seenAddresses: new Set<string>(),
      usedReferenceIds: new Set<string>(),
      strategies: [] as ReallocationStateStrategy[]
    }
  ).strategies

  const totalAllocationBps = resolvedStrategies.reduce((sum, strategy) => sum + percentToBps(strategy.allocationPct), 0)
  const unallocatedBps = Math.max(0, TOTAL_BPS - totalAllocationBps)
  const strategiesWithUnallocated =
    unallocatedBps > NORMALIZATION_TOLERANCE_BPS
      ? [
          ...resolvedStrategies,
          {
            strategyKey: UNALLOCATED_STRATEGY_KEY,
            strategyAddress: null,
            name: 'Unallocated',
            isUnallocated: true,
            allocationPct: unallocatedBps / 100,
            aprPct: null
          }
        ]
      : resolvedStrategies

  return {
    id: `current:${currentAllocation.timestampUtc}`,
    timestampUtc: currentAllocation.timestampUtc,
    tvl: currentAllocation.tvl,
    tvlUnit: currentAllocation.tvlUnit,
    vaultAprPct: currentAllocation.vaultAprPct,
    strategies: strategiesWithUnallocated
  }
}

function alignStateStrategyOrder(
  previousState: ReallocationState | undefined,
  nextState: ReallocationState
): ReallocationState {
  if (!previousState) {
    return {
      ...nextState,
      strategies: [...nextState.strategies]
    }
  }

  const nextByStrategyKey = new Map(
    nextState.strategies.map((strategy) => [getStateStrategyIdentity(strategy), strategy] as const)
  )
  const carriedStrategyKeys = new Set<string>()

  const carriedStrategies = previousState.strategies.flatMap((strategy) => {
    const strategyKey = getStateStrategyIdentity(strategy)
    const nextStrategy = nextByStrategyKey.get(strategyKey)

    if (!nextStrategy || carriedStrategyKeys.has(strategyKey)) {
      return []
    }

    carriedStrategyKeys.add(strategyKey)
    return [nextStrategy]
  })

  const remainingStrategies = nextState.strategies.filter(
    (strategy) => !carriedStrategyKeys.has(getStateStrategyIdentity(strategy))
  )

  return {
    ...nextState,
    strategies: [...carriedStrategies, ...remainingStrategies]
  }
}

function buildStateAllocationMap(state: ReallocationState): Map<string, number> {
  return state.strategies.reduce((allocationByStrategyKey, strategy) => {
    const nextAllocationByStrategyKey = new Map(allocationByStrategyKey)
    nextAllocationByStrategyKey.set(getStateStrategyIdentity(strategy), percentToBps(strategy.allocationPct))
    return nextAllocationByStrategyKey
  }, new Map<string, number>())
}

function statesMatch(leftState: ReallocationState, rightState: ReallocationState): boolean {
  const leftAllocationByStrategyKey = buildStateAllocationMap(leftState)
  const rightAllocationByStrategyKey = buildStateAllocationMap(rightState)
  const allStrategyKeys = new Set([...leftAllocationByStrategyKey.keys(), ...rightAllocationByStrategyKey.keys()])

  return [...allStrategyKeys].every((strategyKey) => {
    const leftAllocation = leftAllocationByStrategyKey.get(strategyKey) ?? 0
    const rightAllocation = rightAllocationByStrategyKey.get(strategyKey) ?? 0
    return Math.abs(leftAllocation - rightAllocation) <= NORMALIZATION_TOLERANCE_BPS
  })
}

function panelHasAllocations(panel: ReallocationPanel): boolean {
  return [...panel.beforeState.strategies, ...panel.afterState.strategies].some((strategy) =>
    isPositive(strategy.allocationPct)
  )
}

function getChangeTimestampMs(change: ReallocationNormalizedChange): number {
  if (!change.timestampUtc) {
    return 0
  }

  return new Date(change.timestampUtc.replace(' UTC', 'Z').replace(' ', 'T')).getTime()
}

function buildChangeSignature(change: ReallocationNormalizedChange): string {
  const strategySignature = change.strategies
    .map((strategy) =>
      [
        strategy.strategyKey,
        strategy.currentAllocationPct.toFixed(4),
        strategy.targetAllocationPct.toFixed(4),
        strategy.currentAprPct?.toFixed(4) ?? 'null',
        strategy.targetAprPct?.toFixed(4) ?? 'null'
      ].join(':')
    )
    .join('|')

  return [
    strategySignature,
    change.currentVaultAprPct?.toFixed(4) ?? 'null',
    change.targetVaultAprPct?.toFixed(4) ?? 'null'
  ].join('|')
}

function dedupeHistory(changes: readonly ReallocationNormalizedChange[]): ReallocationNormalizedChange[] {
  const sortedChanges = [...changes].sort((left, right) => getChangeTimestampMs(right) - getChangeTimestampMs(left))

  return sortedChanges.reduce(
    (state, change) => {
      const dedupeKey = [change.timestampUtc ?? change.sourceKey, buildChangeSignature(change)].join('|')

      if (state.seen.has(dedupeKey)) {
        return state
      }

      const nextSeen = new Set(state.seen)
      nextSeen.add(dedupeKey)
      return {
        seen: nextSeen,
        records: [...state.records, change]
      }
    },
    {
      seen: new Set<string>(),
      records: [] as ReallocationNormalizedChange[]
    }
  ).records
}

function buildOrderedNodes(
  strategies: Array<{ strategyKey: string; name: string; allocationPct: number }>,
  side: 'before' | 'after',
  gapRatio = DEFAULT_NODE_GAP_RATIO
): SankeyNode[] {
  const totalValue = strategies.reduce((sum, strategy) => sum + strategy.allocationPct, 0)
  const totalGap = Math.max(0, strategies.length - 1) * gapRatio
  const scale = totalValue > 0 ? Math.max(0, 1 - totalGap) / totalValue : 0

  return strategies.reduce(
    (state, strategy) => {
      const heightRatio = strategy.allocationPct * scale
      const node: SankeyNode = {
        id: `${side}:${strategy.strategyKey}`,
        displayName: strategy.name,
        labelText: wrapLabelText(strategy.name),
        value: strategy.allocationPct,
        localY: state.offset,
        heightRatio,
        side
      }

      return {
        offset: state.offset + heightRatio + gapRatio,
        nodes: [...state.nodes, node]
      }
    },
    {
      offset: 0,
      nodes: [] as SankeyNode[]
    }
  ).nodes
}

function allocateRemainingFlows(
  outgoing: Array<{ source: string; remaining: number }>,
  incoming: Array<{ target: string; remaining: number }>,
  incomingIndex = 0
): SankeyLink[] {
  const source = outgoing[0]
  if (!source) {
    return []
  }

  if (!isPositive(source.remaining)) {
    return allocateRemainingFlows(outgoing.slice(1), incoming, incomingIndex)
  }

  const target = incoming[incomingIndex]
  if (!target) {
    return allocateRemainingFlows(outgoing.slice(1), incoming, incomingIndex)
  }

  if (!isPositive(target.remaining)) {
    return allocateRemainingFlows(outgoing, incoming, incomingIndex + 1)
  }

  const transfer = roundFlowValue(Math.min(source.remaining, target.remaining))
  const nextSourceRemaining = roundFlowValue(source.remaining - transfer)
  const nextIncoming = incoming.map((item, index) => {
    return index === incomingIndex ? { ...item, remaining: roundFlowValue(item.remaining - transfer) } : item
  })
  const nextOutgoing = isPositive(nextSourceRemaining)
    ? [{ ...source, remaining: nextSourceRemaining }, ...outgoing.slice(1)]
    : outgoing.slice(1)
  const nextIncomingIndex = isPositive(nextIncoming[incomingIndex]?.remaining ?? 0) ? incomingIndex : incomingIndex + 1

  return [
    ...(isPositive(transfer)
      ? [
          {
            source: source.source,
            target: target.target,
            value: transfer
          }
        ]
      : []),
    ...allocateRemainingFlows(nextOutgoing, nextIncoming, nextIncomingIndex)
  ]
}

function mergeSankeyLinks(links: readonly SankeyLink[]): SankeyLink[] {
  const mergedLinks = new Map<string, SankeyLink>()

  for (const link of links) {
    const key = `${link.source}->${link.target}`
    const existingLink = mergedLinks.get(key)
    const attributions = [...new Set([...(existingLink?.attributions ?? []), ...(link.attributions ?? [])])]
    mergedLinks.set(key, {
      source: link.source,
      target: link.target,
      value: roundFlowValue((existingLink?.value ?? 0) + link.value),
      ...(attributions.length > 0 ? { attributions } : {})
    })
  }

  return [...mergedLinks.values()]
}

function rawAmountAsPercent(amount: bigint, denominator: bigint): number {
  if (amount <= 0n || denominator <= 0n) {
    return 0
  }
  return Number((amount * 100_000_000n) / denominator) / 1_000_000
}

function buildLedgerSankeyGraph(
  beforeStrategies: readonly ReallocationStateStrategy[],
  afterStrategies: readonly ReallocationStateStrategy[],
  ledger: ReallocationFlowLedger
): SankeyGraph | null {
  const routes = decomposeReallocationLedger(beforeStrategies, afterStrategies, ledger)
  if (!routes) {
    return null
  }

  const openingTotal = beforeStrategies.reduce((sum, strategy) => sum + BigInt(strategy.allocationAmount ?? '0'), 0n)
  const closingTotal = afterStrategies.reduce((sum, strategy) => sum + BigInt(strategy.allocationAmount ?? '0'), 0n)
  const denominator = openingTotal > closingTotal ? openingTotal : closingTotal
  if (denominator <= 0n) {
    return null
  }

  const links = routes.flatMap((route): SankeyLink[] => {
    const value = roundFlowValue(rawAmountAsPercent(route.amount, denominator))
    if (!isPositive(value) || (route.source.type === 'boundary' && route.target.type === 'boundary')) {
      return []
    }

    const attributions = route.attributions
    const sourceId =
      route.source.type === 'balance' ? `before:${route.source.key}` : `center:${route.source.key}-source`
    const targetId = route.target.type === 'balance' ? `after:${route.target.key}` : `center:${route.target.key}-sink`
    return [{ source: sourceId, target: targetId, value, attributions }]
  })
  const mergedLinks = mergeSankeyLinks(links)
  const outboundByNode = new Map<string, number>()
  const inboundByNode = new Map<string, number>()
  for (const link of mergedLinks) {
    outboundByNode.set(link.source, roundFlowValue((outboundByNode.get(link.source) ?? 0) + link.value))
    inboundByNode.set(link.target, roundFlowValue((inboundByNode.get(link.target) ?? 0) + link.value))
  }

  const beforeNodes = buildOrderedNodes(
    beforeStrategies
      .filter((strategy) => isPositive(strategy.allocationPct))
      .map((strategy) => ({
        strategyKey: strategy.isUnallocated ? UNALLOCATED_STRATEGY_KEY : strategy.strategyKey,
        name: strategy.name,
        allocationPct: strategy.allocationPct
      })),
    'before'
  ).map((node) => ({ ...node, outboundValue: outboundByNode.get(node.id) ?? 0 }))
  const afterNodes = buildOrderedNodes(
    afterStrategies
      .filter((strategy) => isPositive(strategy.allocationPct))
      .map((strategy) => ({
        strategyKey: strategy.isUnallocated ? UNALLOCATED_STRATEGY_KEY : strategy.strategyKey,
        name: strategy.name,
        allocationPct: strategy.allocationPct
      })),
    'after'
  ).map((node) => ({ ...node, inboundValue: inboundByNode.get(node.id) ?? 0 }))

  const centerDefinitions = [
    { id: 'center:external-source', name: 'External inflow', role: 'source' as const },
    { id: 'center:accounting-source', name: 'Reported gain', role: 'source' as const },
    { id: 'center:external-sink', name: 'External outflow', role: 'sink' as const },
    { id: 'center:accounting-sink', name: 'Reported loss / adjustment', role: 'sink' as const },
    { id: `center:${UNALLOCATED_STRATEGY_KEY}`, name: 'Unallocated', role: 'bridge' as const }
  ]
    .map((definition) => {
      const inboundValue = inboundByNode.get(definition.id) ?? 0
      const outboundValue = outboundByNode.get(definition.id) ?? 0
      return { ...definition, inboundValue, outboundValue, value: Math.max(inboundValue, outboundValue) }
    })
    .filter(({ value }) => isPositive(value))
  const centerGap = 0.075
  const availableCenterHeight = Math.max(0, 1 - Math.max(0, centerDefinitions.length - 1) * centerGap)
  const totalCenterValue = centerDefinitions.reduce((sum, node) => sum + node.value, 0)
  const centerScale = Math.min(1 / 100, totalCenterValue > 0 ? availableCenterHeight / totalCenterValue : 0)
  const usedCenterHeight = totalCenterValue * centerScale + Math.max(0, centerDefinitions.length - 1) * centerGap
  let centerOffset = Math.max(0, 1 - usedCenterHeight)
  const centerNodes = centerDefinitions.map((definition): SankeyNode => {
    const heightRatio = definition.value * centerScale
    const node = {
      id: definition.id,
      displayName: definition.name,
      labelText: wrapLabelText(definition.name),
      value: definition.value,
      localY: centerOffset,
      heightRatio,
      side: 'center' as const,
      inboundValue: definition.inboundValue,
      outboundValue: definition.outboundValue,
      centerRole: definition.role
    }
    centerOffset += heightRatio + centerGap
    return node
  })

  return { nodes: [...beforeNodes, ...afterNodes, ...centerNodes], links: mergedLinks }
}

function compactNumber(value: number): string {
  const absValue = Math.abs(value)
  const formatter =
    absValue >= 10000
      ? new Intl.NumberFormat('en-US', {
          notation: 'compact',
          compactDisplay: 'short',
          minimumSignificantDigits: 3,
          maximumSignificantDigits: 3
        })
      : new Intl.NumberFormat('en-US', {
          minimumFractionDigits: absValue < 10 ? 2 : absValue < 100 ? 1 : 0,
          maximumFractionDigits: absValue < 10 ? 2 : absValue < 100 ? 2 : 0
        })

  return formatter.format(value)
}

function formatAmountForState(value: number | null, unit: string | null): string {
  if (value === null || !Number.isFinite(value)) {
    return ' - '
  }

  if (!unit || unit.toUpperCase() === 'USD') {
    return `$${compactNumber(value)}`
  }

  return `${compactNumber(value)} ${unit}`
}

export function formatReallocationTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return 'Timestamp unavailable'
  }

  const parsedDate = new Date(timestamp.replace(' UTC', 'Z').replace(' ', 'T'))
  if (Number.isNaN(parsedDate.getTime())) {
    return timestamp
  }

  return timestampFormatter.format(parsedDate)
}

export function getReallocationPanelLabels(panel: Pick<ReallocationPanel, 'kind'>): {
  beforeLabel: string
  afterLabel: string
  beforeAprLabel: string
  afterAprLabel: string
} {
  if (panel.kind === 'executed') {
    return {
      beforeLabel: 'Start state',
      afterLabel: 'End state',
      beforeAprLabel: 'Start APR',
      afterAprLabel: 'End APR'
    }
  }

  if (panel.kind === 'proposal' || panel.kind === 'historical') {
    return {
      beforeLabel: 'Current',
      afterLabel: 'Proposed',
      beforeAprLabel: 'APR at current debt',
      afterAprLabel: 'APR at target debt'
    }
  }

  if (panel.kind === 'current') {
    return {
      beforeLabel: 'Last Seen',
      afterLabel: 'Current',
      beforeAprLabel: 'Last Seen APR',
      afterAprLabel: 'Current APR'
    }
  }

  return {
    beforeLabel: 'Before',
    afterLabel: 'After',
    beforeAprLabel: 'Before APR',
    afterAprLabel: 'After APR'
  }
}

export function buildReallocationPanels(
  changes: readonly ReallocationNormalizedChange[],
  currentAllocation?: CurrentAllocationInput
): ReallocationPanel[] {
  const dedupedHistory = dedupeHistory(changes)
  const chronologicalHistory = dedupedHistory.slice().reverse()
  const historicalPanels = chronologicalHistory.reduce(
    (state, change) => {
      const beforeState = alignStateStrategyOrder(state.previousBeforeState, buildSnapshotState(change))
      const afterState = alignStateStrategyOrder(beforeState, buildProposalState(change))

      return {
        previousBeforeState: beforeState,
        panels: [
          ...state.panels,
          {
            id: `historical:${change.sourceKey}`,
            beforeState,
            afterState,
            beforeTimestampUtc: change.timestampUtc,
            afterTimestampUtc: change.timestampUtc,
            kind: 'historical' as const
          }
        ]
      }
    },
    {
      previousBeforeState: undefined as ReallocationState | undefined,
      panels: [] as ReallocationPanel[]
    }
  ).panels

  const latestSnapshotState = historicalPanels[historicalPanels.length - 1]?.beforeState
  const currentPanel =
    latestSnapshotState && currentAllocation
      ? (() => {
          const alignedCurrentState = alignStateStrategyOrder(
            latestSnapshotState,
            buildCurrentAllocationState(currentAllocation, latestSnapshotState)
          )

          return {
            id: `current:${latestSnapshotState.id}->${alignedCurrentState.id}`,
            beforeState: latestSnapshotState,
            afterState: alignedCurrentState,
            beforeTimestampUtc: latestSnapshotState.timestampUtc,
            afterTimestampUtc: currentAllocation.timestampUtc,
            kind: 'current' as const
          }
        })()
      : null

  const currentMatchesLatestSnapshot = currentPanel
    ? statesMatch(currentPanel.beforeState, currentPanel.afterState)
    : false
  const terminalPanels =
    currentPanel && !currentMatchesLatestSnapshot && panelHasAllocations(currentPanel) ? [currentPanel] : []

  return [...historicalPanels, ...terminalPanels]
}

export function buildColorByStrategyKey(panels: readonly ReallocationPanel[]): string[] {
  const orderedKeys: string[] = []
  const seenKeys = new Set<string>()

  for (const panel of panels) {
    for (const state of [panel.beforeState, panel.afterState]) {
      for (const strategy of state.strategies) {
        if (strategy.isUnallocated || seenKeys.has(strategy.strategyKey)) {
          continue
        }

        seenKeys.add(strategy.strategyKey)
        orderedKeys.push(strategy.strategyKey)
      }
    }
  }

  return orderedKeys
}

export function buildReallocationColorMap(
  panels: readonly ReallocationPanel[],
  isDark: boolean
): Record<string, string> {
  const orderedKeys = buildColorByStrategyKey(panels)
  const palette = buildBlueShadePalette(isDark)

  const colorByStrategyKey = orderedKeys.reduce(
    (map, strategyKey, index) => {
      map[strategyKey] = palette[index % palette.length] ?? UNALLOCATED_COLOR
      return map
    },
    {} as Record<string, string>
  )

  if (
    panels.some((panel) =>
      [...panel.beforeState.strategies, ...panel.afterState.strategies].some((strategy) => strategy.isUnallocated)
    )
  ) {
    colorByStrategyKey.unallocated = UNALLOCATED_COLOR
  }

  return colorByStrategyKey
}

export function buildComparisonStrategies(
  panel: ReallocationPanel,
  colorByStrategyKey: Record<string, string>
): ReallocationStrategy[] {
  const beforeByKey = new Map(panel.beforeState.strategies.map((strategy) => [strategy.strategyKey, strategy] as const))
  const afterByKey = new Map(panel.afterState.strategies.map((strategy) => [strategy.strategyKey, strategy] as const))
  const orderedKeys = [
    ...panel.afterState.strategies.map((strategy) => strategy.strategyKey),
    ...panel.beforeState.strategies
      .map((strategy) => strategy.strategyKey)
      .filter((strategyKey) => !afterByKey.has(strategyKey))
  ]

  return orderedKeys.map((strategyKey) => {
    const beforeStrategy = beforeByKey.get(strategyKey)
    const afterStrategy = afterByKey.get(strategyKey)
    const currentAprPct = beforeStrategy?.aprPct ?? null
    const targetAprPct = afterStrategy?.aprPct ?? null
    const color =
      colorByStrategyKey[strategyKey] ??
      (beforeStrategy?.isUnallocated || afterStrategy?.isUnallocated ? '#9ca3af' : '#9ca3af')

    return {
      strategyKey,
      strategyAddress: afterStrategy?.strategyAddress ?? beforeStrategy?.strategyAddress ?? null,
      name: afterStrategy?.name ?? beforeStrategy?.name ?? strategyKey,
      isUnallocated: afterStrategy?.isUnallocated ?? beforeStrategy?.isUnallocated ?? false,
      currentRatioPct: beforeStrategy?.allocationPct ?? 0,
      targetRatioPct: afterStrategy?.allocationPct ?? 0,
      allocationDeltaPct: (afterStrategy?.allocationPct ?? 0) - (beforeStrategy?.allocationPct ?? 0),
      currentAprPct,
      targetAprPct,
      aprDeltaPct: currentAprPct !== null && targetAprPct !== null ? targetAprPct - currentAprPct : null,
      color
    }
  })
}

export function buildStateAllocationChartData(
  state: ReallocationState,
  colorByStrategyKey: Record<string, string>
): StrategyAllocationChartDatum[] {
  return [...state.strategies]
    .filter((strategy) => strategy.allocationPct > 0)
    .sort((left, right) => right.allocationPct - left.allocationPct)
    .map((strategy) => ({
      id: strategy.strategyKey,
      name: strategy.name,
      value: strategy.allocationPct,
      amount: formatAmountForState(
        state.tvl !== null ? (state.tvl * strategy.allocationPct) / 100 : null,
        state.tvlUnit
      ),
      color: colorByStrategyKey[strategy.strategyKey] ?? '#9ca3af'
    }))
}

export function getAfterStateUnallocatedPct(panel: ReallocationPanel): number {
  const unallocatedStrategy = panel.afterState.strategies.find((strategy) => strategy.isUnallocated)
  return unallocatedStrategy?.allocationPct ?? 0
}

export function buildStateTransitionSankeyGraph(
  beforeStrategies: readonly ReallocationStateStrategy[],
  afterStrategies: readonly ReallocationStateStrategy[],
  idleBridge?: ReallocationIdleBridge,
  flowLedger?: ReallocationFlowLedger
): SankeyGraph {
  if (flowLedger) {
    const ledgerGraph = buildLedgerSankeyGraph(beforeStrategies, afterStrategies, flowLedger)
    if (ledgerGraph) {
      return ledgerGraph
    }
  }
  const indexedBeforeStrategies = beforeStrategies
    .filter((strategy) => isPositive(strategy.allocationPct))
    .map((strategy) => ({
      ...strategy,
      strategyKey: strategy.isUnallocated ? UNALLOCATED_STRATEGY_KEY : strategy.strategyKey
    }))
  const indexedAfterStrategies = afterStrategies
    .filter((strategy) => isPositive(strategy.allocationPct))
    .map((strategy) => ({
      ...strategy,
      strategyKey: strategy.isUnallocated ? UNALLOCATED_STRATEGY_KEY : strategy.strategyKey
    }))

  const deallocationByStrategyKey = new Map(
    idleBridge?.deallocations.map((flow) => [flow.strategyKey, flow.allocationPct]) ?? []
  )
  const deploymentByStrategyKey = new Map(
    idleBridge?.deployments.map((flow) => [flow.strategyKey, flow.allocationPct]) ?? []
  )
  const centerInbound = indexedBeforeStrategies
    .map((strategy) => ({
      source: `before:${strategy.strategyKey}`,
      strategyKey: strategy.strategyKey,
      value: roundFlowValue(Math.min(strategy.allocationPct, deallocationByStrategyKey.get(strategy.strategyKey) ?? 0))
    }))
    .filter(({ value }) => isPositive(value))
  const centerOutbound = indexedAfterStrategies
    .map((strategy) => ({
      target: `after:${strategy.strategyKey}`,
      strategyKey: strategy.strategyKey,
      value: roundFlowValue(Math.min(strategy.allocationPct, deploymentByStrategyKey.get(strategy.strategyKey) ?? 0))
    }))
    .filter(({ value }) => isPositive(value))
  const bridgedStrategyLinks = allocateRemainingFlows(
    centerInbound.map((flow) => ({ source: flow.source, remaining: flow.value })),
    centerOutbound.map((flow) => ({ target: flow.target, remaining: flow.value }))
  )
  const bridgedValueBySource = new Map<string, number>()
  const bridgedValueByTarget = new Map<string, number>()
  for (const link of bridgedStrategyLinks) {
    bridgedValueBySource.set(link.source, (bridgedValueBySource.get(link.source) ?? 0) + link.value)
    bridgedValueByTarget.set(link.target, (bridgedValueByTarget.get(link.target) ?? 0) + link.value)
  }
  const unmatchedCenterInbound = centerInbound
    .map((flow) => ({
      ...flow,
      value: roundFlowValue(flow.value - (bridgedValueBySource.get(flow.source) ?? 0))
    }))
    .filter(({ value }) => isPositive(value))
  const unmatchedCenterOutbound = centerOutbound
    .map((flow) => ({
      ...flow,
      value: roundFlowValue(flow.value - (bridgedValueByTarget.get(flow.target) ?? 0))
    }))
    .filter(({ value }) => isPositive(value))
  const centerInboundValue = roundFlowValue(unmatchedCenterInbound.reduce((sum, flow) => sum + flow.value, 0))
  const centerOutboundValue = roundFlowValue(unmatchedCenterOutbound.reduce((sum, flow) => sum + flow.value, 0))
  const centerValue = Math.max(centerInboundValue, centerOutboundValue)
  const centerHeightRatio = centerValue / 100

  const nodes = [
    ...buildOrderedNodes(
      indexedBeforeStrategies.map((strategy) => ({
        strategyKey: strategy.strategyKey,
        name: strategy.name,
        allocationPct: strategy.allocationPct
      })),
      'before'
    ),
    ...buildOrderedNodes(
      indexedAfterStrategies.map((strategy) => ({
        strategyKey: strategy.strategyKey,
        name: strategy.name,
        allocationPct: strategy.allocationPct
      })),
      'after'
    ),
    ...(isPositive(centerValue)
      ? [
          {
            id: `center:${UNALLOCATED_STRATEGY_KEY}`,
            displayName: 'Unallocated',
            labelText: 'Unallocated',
            value: centerValue,
            localY: Math.max(0, 1 - centerHeightRatio),
            heightRatio: centerHeightRatio,
            side: 'center' as const,
            inboundValue: centerInboundValue,
            outboundValue: centerOutboundValue
          }
        ]
      : [])
  ]

  const afterValueByStrategyKey = new Map(
    indexedAfterStrategies.map((strategy) => [strategy.strategyKey, strategy.allocationPct])
  )
  const beforeValueByStrategyKey = new Map(
    indexedBeforeStrategies.map((strategy) => [strategy.strategyKey, strategy.allocationPct])
  )

  const directLinks = indexedBeforeStrategies
    .map((strategy) => {
      const beforeResidual =
        strategy.allocationPct -
        (deallocationByStrategyKey.has(strategy.strategyKey)
          ? Math.min(strategy.allocationPct, deallocationByStrategyKey.get(strategy.strategyKey) ?? 0)
          : 0)
      const afterValue = afterValueByStrategyKey.get(strategy.strategyKey) ?? 0
      const afterResidual = afterValue - Math.min(afterValue, deploymentByStrategyKey.get(strategy.strategyKey) ?? 0)
      const overlap = Math.min(beforeResidual, afterResidual)
      return isPositive(overlap)
        ? {
            source: `before:${strategy.strategyKey}`,
            target: `after:${strategy.strategyKey}`,
            value: roundFlowValue(overlap)
          }
        : null
    })
    .filter(Boolean) as SankeyLink[]

  const outgoing = indexedBeforeStrategies
    .map((strategy) => {
      const centerFlow = Math.min(strategy.allocationPct, deallocationByStrategyKey.get(strategy.strategyKey) ?? 0)
      const beforeResidual = strategy.allocationPct - centerFlow
      const afterValue = afterValueByStrategyKey.get(strategy.strategyKey) ?? 0
      const afterResidual = afterValue - Math.min(afterValue, deploymentByStrategyKey.get(strategy.strategyKey) ?? 0)
      const overlap = Math.min(beforeResidual, afterResidual)
      return {
        source: `before:${strategy.strategyKey}`,
        remaining: roundFlowValue(beforeResidual - overlap)
      }
    })
    .filter(({ remaining }) => isPositive(remaining))

  const incoming = indexedAfterStrategies
    .map((strategy) => {
      const centerFlow = Math.min(strategy.allocationPct, deploymentByStrategyKey.get(strategy.strategyKey) ?? 0)
      const afterResidual = strategy.allocationPct - centerFlow
      const beforeValue = beforeValueByStrategyKey.get(strategy.strategyKey) ?? 0
      const beforeResidual =
        beforeValue - Math.min(beforeValue, deallocationByStrategyKey.get(strategy.strategyKey) ?? 0)
      const overlap = Math.min(afterResidual, beforeResidual)
      return {
        target: `after:${strategy.strategyKey}`,
        remaining: roundFlowValue(afterResidual - overlap)
      }
    })
    .filter(({ remaining }) => isPositive(remaining))

  return {
    nodes,
    links: mergeSankeyLinks([
      ...directLinks,
      ...allocateRemainingFlows(outgoing, incoming),
      ...bridgedStrategyLinks,
      ...unmatchedCenterInbound.map((flow) => ({
        source: flow.source,
        target: `center:${UNALLOCATED_STRATEGY_KEY}`,
        value: flow.value
      })),
      ...unmatchedCenterOutbound.map((flow) => ({
        source: `center:${UNALLOCATED_STRATEGY_KEY}`,
        target: flow.target,
        value: flow.value
      }))
    ])
  }
}

export function clampPanelIndex(index: number, panels: readonly ReallocationPanel[]): number {
  return clamp(index, 0, Math.max(panels.length - 1, 0))
}
