import type { StrategyAllocationChartDatum } from '@/types/dataTypes'
import type {
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
  hour: 'numeric',
  minute: '2-digit',
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
  side: 'before' | 'after'
}

export interface SankeyLink {
  source: string
  target: string
  value: number
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

function alignChronologicalStateStrategies(states: readonly ReallocationState[]): ReallocationState[] {
  return states.reduce((orderedStates, state) => {
    orderedStates.push(alignStateStrategyOrder(orderedStates[orderedStates.length - 1], state))
    return orderedStates
  }, [] as ReallocationState[])
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

  return `${timestampFormatter.format(parsedDate)} UTC`
}

export function getReallocationPanelLabels(panel: Pick<ReallocationPanel, 'kind'>): {
  beforeLabel: string
  afterLabel: string
} {
  if (panel.kind === 'proposal') {
    return {
      beforeLabel: 'Current',
      afterLabel: 'Proposed'
    }
  }

  if (panel.kind === 'current') {
    return {
      beforeLabel: 'Last Seen',
      afterLabel: 'Current'
    }
  }

  return {
    beforeLabel: 'Before',
    afterLabel: 'After'
  }
}

export function buildReallocationPanels(
  changes: readonly ReallocationNormalizedChange[],
  currentAllocation?: CurrentAllocationInput
): ReallocationPanel[] {
  const dedupedHistory = dedupeHistory(changes)
  const chronologicalHistory = dedupedHistory.slice().reverse()
  const chronologicalSnapshotStates = alignChronologicalStateStrategies(chronologicalHistory.map(buildSnapshotState))

  const historicalPanels = chronologicalSnapshotStates.slice(1).map((afterState, index) => {
    const beforeState = chronologicalSnapshotStates[index]

    return {
      id: `historical:${beforeState.id}->${afterState.id}`,
      beforeState,
      afterState,
      beforeTimestampUtc: beforeState.timestampUtc,
      afterTimestampUtc: afterState.timestampUtc,
      kind: 'historical' as const
    }
  })

  const latestChange = dedupedHistory[0]
  const latestSnapshotState = chronologicalSnapshotStates[chronologicalSnapshotStates.length - 1]
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
  const proposalPanel = latestChange
    ? latestSnapshotState
      ? [
          {
            id: `proposal:${latestChange.sourceKey}`,
            beforeState: latestSnapshotState,
            afterState: alignStateStrategyOrder(latestSnapshotState, buildProposalState(latestChange)),
            beforeTimestampUtc: latestSnapshotState.timestampUtc,
            afterTimestampUtc: latestChange.timestampUtc,
            kind: 'proposal' as const
          }
        ]
      : []
    : []

  const currentMatchesLatestSnapshot = currentPanel
    ? statesMatch(currentPanel.beforeState, currentPanel.afterState)
    : false
  const adjustedHistoricalPanels =
    currentMatchesLatestSnapshot && historicalPanels.length > 0 && currentAllocation
      ? historicalPanels.map((panel, index) => {
          if (index !== historicalPanels.length - 1) {
            return panel
          }

          return {
            ...panel,
            afterState: {
              ...panel.afterState,
              timestampUtc: currentAllocation.timestampUtc,
              tvl: currentAllocation.tvl,
              tvlUnit: currentAllocation.tvlUnit,
              vaultAprPct: currentAllocation.vaultAprPct
            },
            afterTimestampUtc: currentAllocation.timestampUtc
          }
        })
      : historicalPanels
  const terminalPanels = currentPanel
    ? currentMatchesLatestSnapshot
      ? historicalPanels.length > 0
        ? []
        : [currentPanel]
      : [currentPanel]
    : proposalPanel

  return [...adjustedHistoricalPanels, ...terminalPanels].filter(panelHasAllocations)
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
  afterStrategies: readonly ReallocationStateStrategy[]
): SankeyGraph {
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
    )
  ]

  const afterValueByStrategyKey = new Map(
    indexedAfterStrategies.map((strategy) => [strategy.strategyKey, strategy.allocationPct])
  )
  const beforeValueByStrategyKey = new Map(
    indexedBeforeStrategies.map((strategy) => [strategy.strategyKey, strategy.allocationPct])
  )

  const directLinks = indexedBeforeStrategies
    .map((strategy) => {
      const overlap = Math.min(strategy.allocationPct, afterValueByStrategyKey.get(strategy.strategyKey) ?? 0)
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
      const overlap = Math.min(strategy.allocationPct, afterValueByStrategyKey.get(strategy.strategyKey) ?? 0)
      return {
        source: `before:${strategy.strategyKey}`,
        remaining: roundFlowValue(strategy.allocationPct - overlap)
      }
    })
    .filter(({ remaining }) => isPositive(remaining))

  const incoming = indexedAfterStrategies
    .map((strategy) => {
      const overlap = Math.min(strategy.allocationPct, beforeValueByStrategyKey.get(strategy.strategyKey) ?? 0)
      return {
        target: `after:${strategy.strategyKey}`,
        remaining: roundFlowValue(strategy.allocationPct - overlap)
      }
    })
    .filter(({ remaining }) => isPositive(remaining))

  return {
    nodes,
    links: [...directLinks, ...allocateRemainingFlows(outgoing, incoming)]
  }
}

export function clampPanelIndex(index: number, panels: readonly ReallocationPanel[]): number {
  return clamp(index, 0, Math.max(panels.length - 1, 0))
}
