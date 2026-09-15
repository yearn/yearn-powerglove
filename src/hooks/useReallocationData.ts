import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { CHAIN_ID_TO_NAME, type ChainId } from '@/constants/chains'
import type {
  AllocationHistoryIssue,
  ReallocationData,
  ReallocationExecution,
  ReallocationExpectedAprImpact,
  ReallocationFlowLedger,
  ReallocationLedgerFlow,
  ReallocationLedgerNode,
  ReallocationPanel,
  ReallocationState,
  ReallocationStateStrategy
} from '@/types/reallocationTypes'
import type { VaultExtended } from '@/types/vaultTypes'

const PAGE_SIZE = 25
const IDLE_STRATEGY_KEY = 'unallocated'

interface AllocationHistoryChartAllocation {
  strategyAddress: string
  currentDebt: string
}

interface AllocationHistoryChartState {
  blockNumber: number
  blockTimestamp: string | number
  totalAssets: string
  totalIdle: string
  allocations: AllocationHistoryChartAllocation[]
}

interface AllocationHistoryChartInterval {
  fromEntryId: string
  toEntryId: string | null
  endKind: 'allocation_entry' | 'safe_head'
  flows: ReallocationLedgerFlow[]
  reconciliation: {
    balanceStatus: 'reconciled' | 'unreconciled'
    attributionStatus: 'complete' | 'partial'
    unattributedAmount: string
  }
}

interface AllocationHistoryChartExpectedAprAvailable {
  status: 'available'
  source: 'doa'
  scope: 'proposal'
  policyId: string
  baselineAprBps: number
  proposedAprBps: number
  deltaAprBps: number
  publishedAt: string | number
  relationship: string
  applicationStatus: string
}

interface AllocationHistoryChartExpectedAprUnavailable {
  status: 'unavailable'
  reason: string
}

type AllocationHistoryChartExpectedApr =
  | AllocationHistoryChartExpectedAprAvailable
  | AllocationHistoryChartExpectedAprUnavailable

interface AllocationHistoryChartEntry {
  id: string
  kind: 'strategy_reallocation'
  after: AllocationHistoryChartState
  endBlock: number
  endTimestamp: string | number
  execution: ReallocationExecution
  expectedAprImpact: AllocationHistoryChartExpectedApr
  detailsHref: string
  interval: AllocationHistoryChartInterval | null
}

interface AllocationHistoryChartResponse {
  schemaVersion: number
  projection: 'chart'
  generatedAt: string | number
  vault: {
    chainId: number
    address: string
    name?: string | null
    label?: string | null
  }
  strategies: Record<string, string | null>
  boundaryStates: Record<string, AllocationHistoryChartState>
  entries: AllocationHistoryChartEntry[]
  currentSnapshot:
    | (AllocationHistoryChartState & {
        id: string
        kind: 'current_snapshot'
        blockTimestamp: string | number
        interval: AllocationHistoryChartInterval | null
      })
    | null
  pagination: {
    nextCursor: string | null
  }
}

function normalizeVaultAddress(value: string): string {
  return value.toLowerCase()
}

function isUnsignedIntegerString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value)
}

function isValidState(state: unknown): state is AllocationHistoryChartState {
  if (
    !isObjectRecord(state) ||
    !isBlockNumber(state.blockNumber) ||
    normalizeTimestamp(state.blockTimestamp) === null ||
    !Array.isArray(state.allocations) ||
    !isUnsignedIntegerString(state.totalAssets) ||
    !isUnsignedIntegerString(state.totalIdle)
  ) {
    return false
  }

  const strategyAddresses = new Set<string>()
  let accountedAssets = BigInt(state.totalIdle)
  for (const allocation of state.allocations) {
    if (!isObjectRecord(allocation) || typeof allocation.strategyAddress !== 'string') return false
    const strategyAddress = normalizeVaultAddress(allocation.strategyAddress)
    if (!/^0x[a-f0-9]{40}$/.test(strategyAddress) || strategyAddresses.has(strategyAddress)) {
      return false
    }
    if (!isUnsignedIntegerString(allocation.currentDebt)) {
      return false
    }
    strategyAddresses.add(strategyAddress)
    accountedAssets += BigInt(allocation.currentDebt)
  }

  return accountedAssets === BigInt(state.totalAssets)
}

function isBlockNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isValidExpectedApr(value: unknown): value is AllocationHistoryChartExpectedApr {
  if (!isObjectRecord(value)) return false
  if (value.status === 'unavailable') return typeof value.reason === 'string'
  return (
    value.status === 'available' &&
    value.source === 'doa' &&
    value.scope === 'proposal' &&
    typeof value.policyId === 'string' &&
    [value.baselineAprBps, value.proposedAprBps, value.deltaAprBps].every(
      (number) => typeof number === 'number' && Number.isFinite(number)
    ) &&
    normalizeTimestamp(value.publishedAt) !== null &&
    typeof value.relationship === 'string' &&
    typeof value.applicationStatus === 'string'
  )
}

function isValidExecution(value: unknown): value is ReallocationExecution {
  if (!isObjectRecord(value)) return false
  return (
    typeof value.automation === 'string' &&
    ['automatic', 'manual', 'mixed', 'unknown'].includes(value.automation) &&
    typeof value.mechanism === 'string' &&
    [
      'allocator_keeper',
      'direct_vault_role',
      'governance_safe',
      'governance',
      'role_manager',
      'mixed',
      'unknown'
    ].includes(value.mechanism) &&
    typeof value.targetStatus === 'string' &&
    ['matched', 'overridden', 'unavailable', 'not_applicable', 'mixed'].includes(value.targetStatus) &&
    (value.transactions === undefined ||
      (Array.isArray(value.transactions) &&
        value.transactions.every(
          (transaction) =>
            isObjectRecord(transaction) &&
            typeof transaction.transactionHash === 'string' &&
            /^0x[a-fA-F0-9]{64}$/.test(transaction.transactionHash) &&
            isBlockNumber(transaction.blockNumber)
        )))
  )
}

export function isValidAllocationHistoryEntry(entry: unknown): entry is AllocationHistoryChartEntry {
  return (
    isObjectRecord(entry) &&
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    entry.kind === 'strategy_reallocation' &&
    isBlockNumber(entry.endBlock) &&
    normalizeTimestamp(entry.endTimestamp) !== null &&
    isValidState(entry.after) &&
    isValidExecution(entry.execution) &&
    isValidExpectedApr(entry.expectedAprImpact) &&
    typeof entry.detailsHref === 'string' &&
    (entry.interval === null || isValidInterval(entry.interval))
  )
}

function isValidFlowNode(value: unknown): value is ReallocationLedgerNode {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false
  }

  if (value.type === 'idle' || value.type === 'external' || value.type === 'accounting') {
    return true
  }

  return (
    value.type === 'strategy' &&
    'address' in value &&
    typeof value.address === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(value.address)
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isValidStrategyDictionary(value: unknown): value is Record<string, string | null> {
  return (
    isObjectRecord(value) &&
    Object.entries(value).every(
      ([address, name]) =>
        /^0x[a-f0-9]{40}$/.test(normalizeVaultAddress(address)) && (name === null || typeof name === 'string')
    )
  )
}

function isValidBoundaryStates(value: unknown): value is Record<string, AllocationHistoryChartState> {
  return isObjectRecord(value) && Object.entries(value).every(([id, state]) => id.length > 0 && isValidState(state))
}

function isValidInterval(interval: unknown): interval is AllocationHistoryChartInterval {
  return (
    isObjectRecord(interval) &&
    typeof interval.fromEntryId === 'string' &&
    (typeof interval.toEntryId === 'string' || interval.toEntryId === null) &&
    (interval.endKind === 'allocation_entry' || interval.endKind === 'safe_head') &&
    Array.isArray(interval.flows) &&
    interval.flows.every(
      (flow) =>
        isObjectRecord(flow) &&
        isValidFlowNode(flow.source) &&
        isValidFlowNode(flow.target) &&
        isUnsignedIntegerString(flow.amount) &&
        typeof flow.attribution === 'string' &&
        ['observed_event', 'derived_from_debt_updates', 'residual_balance'].includes(flow.attribution)
    ) &&
    isObjectRecord(interval.reconciliation) &&
    interval.reconciliation.balanceStatus === 'reconciled' &&
    typeof interval.reconciliation.attributionStatus === 'string' &&
    ['complete', 'partial'].includes(interval.reconciliation.attributionStatus) &&
    isUnsignedIntegerString(interval.reconciliation.unattributedAmount)
  )
}

function balanceNodeKey(node: ReallocationLedgerNode): string | null {
  if (node.type === 'idle') {
    return IDLE_STRATEGY_KEY
  }
  return node.type === 'strategy' ? normalizeVaultAddress(node.address) : null
}

function stateBalances(state: AllocationHistoryChartState): Map<string, bigint> {
  return new Map([
    [IDLE_STRATEGY_KEY, BigInt(state.totalIdle)],
    ...state.allocations.map(
      (allocation) => [normalizeVaultAddress(allocation.strategyAddress), BigInt(allocation.currentDebt)] as const
    )
  ])
}

function ledgerBalances(
  startState: AllocationHistoryChartState,
  endState: AllocationHistoryChartState,
  flows: readonly ReallocationLedgerFlow[]
): boolean {
  const opening = stateBalances(startState)
  const closing = stateBalances(endState)
  const netFlow = new Map<string, bigint>()

  for (const flow of flows) {
    const amount = BigInt(flow.amount)
    const sourceKey = balanceNodeKey(flow.source)
    const targetKey = balanceNodeKey(flow.target)
    if (sourceKey) {
      netFlow.set(sourceKey, (netFlow.get(sourceKey) ?? 0n) - amount)
    }
    if (targetKey) {
      netFlow.set(targetKey, (netFlow.get(targetKey) ?? 0n) + amount)
    }
  }

  const keys = new Set([...opening.keys(), ...closing.keys(), ...netFlow.keys()])
  return [...keys].every((key) => (opening.get(key) ?? 0n) + (netFlow.get(key) ?? 0n) === (closing.get(key) ?? 0n))
}

function rawAmountAsPercent(amount: string, totalAssets: string): number {
  const rawAmount = BigInt(amount)
  const rawTotalAssets = BigInt(totalAssets)
  if (rawAmount <= 0n || rawTotalAssets <= 0n) {
    return 0
  }

  return Number((rawAmount * 100_000_000n) / rawTotalAssets) / 1_000_000
}

function composeFlowLedger(
  startEntryId: string,
  endEntryId: string | null,
  startState: AllocationHistoryChartState,
  endState: AllocationHistoryChartState,
  intervals: readonly AllocationHistoryChartInterval[]
): ReallocationFlowLedger | null {
  const firstInterval = intervals[0]
  const lastInterval = intervals[intervals.length - 1]
  if (
    !firstInterval ||
    !lastInterval ||
    firstInterval.fromEntryId !== startEntryId ||
    lastInterval.toEntryId !== endEntryId
  ) {
    return null
  }

  for (let index = 0; index < intervals.length; index += 1) {
    const interval = intervals[index]
    const nextInterval = intervals[index + 1]
    if (nextInterval && (interval.toEntryId === null || nextInterval.fromEntryId !== interval.toEntryId)) {
      return null
    }
  }

  const flows = intervals.flatMap((interval) => interval.flows)
  if (!ledgerBalances(startState, endState, flows)) {
    return null
  }

  return {
    intervalCount: intervals.length,
    flows,
    balanceStatus: 'reconciled',
    attributionStatus: intervals.some((interval) => interval.reconciliation.attributionStatus === 'partial')
      ? 'partial'
      : 'complete',
    unattributedAmount: intervals
      .reduce((sum, interval) => sum + BigInt(interval.reconciliation.unattributedAmount), 0n)
      .toString()
  }
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const parsedDate =
    typeof value === 'number' ? new Date(value * 1000) : new Date(value.replace(' UTC', 'Z').replace(' ', 'T'))

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString()
}

function getAllocationHistoryApiUrl(): string {
  return import.meta.env.VITE_PUBLIC_ALLOCATION_HISTORY_API_URL?.trim() ?? ''
}

export function buildReallocationQueryKey(vaultAddress: string, vaultChainId: ChainId | undefined) {
  return ['allocation-history', 'chart', vaultChainId ?? null, normalizeVaultAddress(vaultAddress)] as const
}

export function buildReallocationRequestUrl(
  apiUrl: string,
  vaultAddress: string,
  vaultChainId: ChainId,
  cursor?: string | null
): string {
  const normalizedApiUrl = apiUrl.replace(/\/$/, '')
  const params = new URLSearchParams({
    projection: 'chart',
    limit: String(PAGE_SIZE),
    direction: 'desc'
  })
  if (cursor) {
    params.set('cursor', cursor)
  }

  return `${normalizedApiUrl}/${vaultChainId}/${normalizeVaultAddress(vaultAddress)}?${params.toString()}`
}

function resolveDetailsHref(apiUrl: string, detailsHref: string): string {
  if (!detailsHref || detailsHref.startsWith('http://') || detailsHref.startsWith('https://')) {
    return detailsHref
  }

  try {
    const apiOrigin = new URL(apiUrl).origin
    return new URL(detailsHref, apiOrigin).toString()
  } catch {
    return detailsHref
  }
}

function buildStrategyOrder(...states: readonly AllocationHistoryChartState[]): string[] {
  const orderedAddresses = states.flatMap((state) =>
    state.allocations.map((allocation) => normalizeVaultAddress(allocation.strategyAddress))
  )

  return [...new Set(orderedAddresses)]
}

function buildState(
  entryId: string,
  side: 'before' | 'after',
  snapshot: AllocationHistoryChartState,
  timestampUtc: string | number,
  strategyOrder: readonly string[],
  strategyNames: ReadonlyMap<string, string | null>
): ReallocationState {
  const allocationByAddress = new Map(
    snapshot.allocations.map((allocation) => [normalizeVaultAddress(allocation.strategyAddress), allocation] as const)
  )
  const strategies: ReallocationStateStrategy[] = strategyOrder.flatMap((strategyKey) => {
    const allocation = allocationByAddress.get(strategyKey)
    if (!allocation) {
      return []
    }

    return [
      {
        strategyKey,
        strategyAddress: allocation.strategyAddress,
        name: strategyNames.get(strategyKey)?.trim() || allocation.strategyAddress,
        isUnallocated: false,
        allocationPct: rawAmountAsPercent(allocation.currentDebt, snapshot.totalAssets),
        allocationAmount: allocation.currentDebt,
        aprPct: null
      } satisfies ReallocationStateStrategy
    ]
  })

  if (BigInt(snapshot.totalIdle) > 0n) {
    strategies.push({
      strategyKey: IDLE_STRATEGY_KEY,
      strategyAddress: null,
      name: 'Idle',
      isUnallocated: true,
      allocationPct: rawAmountAsPercent(snapshot.totalIdle, snapshot.totalAssets),
      allocationAmount: snapshot.totalIdle,
      aprPct: null
    })
  }

  return {
    id: `${entryId}:${side}:${snapshot.blockNumber}`,
    timestampUtc: normalizeTimestamp(timestampUtc),
    tvl: null,
    tvlUnit: null,
    vaultAprPct: null,
    strategies
  }
}

function normalizeExpectedAprImpact(
  expectedAprImpact: AllocationHistoryChartExpectedApr
): ReallocationExpectedAprImpact {
  if (expectedAprImpact.status === 'unavailable') {
    return expectedAprImpact
  }

  return {
    status: 'available',
    source: expectedAprImpact.source,
    scope: expectedAprImpact.scope,
    policyId: expectedAprImpact.policyId,
    baselineAprPct: expectedAprImpact.baselineAprBps / 100,
    proposedAprPct: expectedAprImpact.proposedAprBps / 100,
    deltaAprPct: expectedAprImpact.deltaAprBps / 100,
    publishedAt: normalizeTimestamp(expectedAprImpact.publishedAt) ?? String(expectedAprImpact.publishedAt),
    relationship: expectedAprImpact.relationship,
    applicationStatus: expectedAprImpact.applicationStatus
  }
}

export function buildObservedReallocationPanels(
  entries: readonly AllocationHistoryChartEntry[],
  currentSnapshot: NonNullable<AllocationHistoryChartResponse['currentSnapshot']>,
  boundaryStates: ReadonlyMap<string, AllocationHistoryChartState>,
  strategyNames: ReadonlyMap<string, string | null>,
  apiUrl = ''
): { panels: ReallocationPanel[]; issues: AllocationHistoryIssue[] } {
  const issues: AllocationHistoryIssue[] = []
  const reject = (entryId: string, reason: string) => {
    issues.push({ entryId, reason })
  }
  const chronologicalEntries = [...entries].sort(
    (left, right) => left.endBlock - right.endBlock || left.id.localeCompare(right.id)
  )
  const entryById = new Map(chronologicalEntries.map((entry) => [entry.id, entry]))
  const strategyOrder = buildStrategyOrder(
    currentSnapshot,
    ...boundaryStates.values(),
    ...chronologicalEntries.map((entry) => entry.after)
  )

  const historicalPanels = chronologicalEntries.flatMap((entry) => {
    const interval = entry.interval
    if (!interval) return [] // The first observed allocation has no preceding interval.
    if (interval.endKind !== 'allocation_entry' || interval.toEntryId !== entry.id) {
      reject(entry.id, 'Invalid interval reference')
      return []
    }
    const previousState = entryById.get(interval.fromEntryId)?.after ?? boundaryStates.get(interval.fromEntryId)
    if (!previousState) {
      reject(entry.id, `Missing boundary state: ${interval.fromEntryId}`)
      return []
    }

    const flowLedger = composeFlowLedger(interval.fromEntryId, entry.id, previousState, entry.after, [interval])
    if (!flowLedger) {
      reject(entry.id, 'Interval flows do not reconcile with observed balances')
      return []
    }

    return [
      {
        id: `executed-interval:${interval.fromEntryId}->${entry.id}`,
        beforeState: buildState(
          interval.fromEntryId,
          'after',
          previousState,
          previousState.blockTimestamp,
          strategyOrder,
          strategyNames
        ),
        afterState: buildState(entry.id, 'after', entry.after, entry.endTimestamp, strategyOrder, strategyNames),
        beforeTimestampUtc: normalizeTimestamp(previousState.blockTimestamp),
        afterTimestampUtc: normalizeTimestamp(entry.endTimestamp),
        kind: 'executed' as const,
        flowKind: entry.kind,
        execution: entry.execution,
        expectedAprImpact: normalizeExpectedAprImpact(entry.expectedAprImpact),
        detailsHref: resolveDetailsHref(apiUrl, entry.detailsHref),
        flowLedger
      }
    ]
  })

  const tailInterval = currentSnapshot.interval
  if (!tailInterval) return { panels: historicalPanels, issues }
  if (tailInterval.endKind !== 'safe_head' || tailInterval.toEntryId !== null) {
    reject(currentSnapshot.id, 'Invalid current interval reference')
    return { panels: historicalPanels, issues }
  }
  const latestState = entryById.get(tailInterval.fromEntryId)?.after ?? boundaryStates.get(tailInterval.fromEntryId)
  if (!latestState) {
    reject(currentSnapshot.id, `Missing boundary state: ${tailInterval.fromEntryId}`)
    return { panels: historicalPanels, issues }
  }
  const tailLedger = composeFlowLedger(tailInterval.fromEntryId, null, latestState, currentSnapshot, [tailInterval])
  if (!tailLedger) {
    reject(currentSnapshot.id, 'Current interval flows do not reconcile with observed balances')
    return { panels: historicalPanels, issues }
  }

  return {
    issues,
    panels: [
      ...historicalPanels,
      {
        id: `current-interval:${tailInterval.fromEntryId}->${currentSnapshot.id}`,
        beforeState: buildState(
          tailInterval.fromEntryId,
          'after',
          latestState,
          latestState.blockTimestamp,
          strategyOrder,
          strategyNames
        ),
        afterState: buildState(
          currentSnapshot.id,
          'after',
          currentSnapshot,
          currentSnapshot.blockTimestamp,
          strategyOrder,
          strategyNames
        ),
        beforeTimestampUtc: normalizeTimestamp(latestState.blockTimestamp),
        afterTimestampUtc: normalizeTimestamp(currentSnapshot.blockTimestamp),
        kind: 'current',
        flowLedger: tailLedger
      }
    ]
  }
}

export function isValidChartResponse(
  response: unknown,
  requestedVaultAddress: string,
  requestedChainId: ChainId,
  requireCurrentSnapshot: boolean
): response is AllocationHistoryChartResponse {
  const hasValidEnvelope =
    isObjectRecord(response) &&
    response.projection === 'chart' &&
    response.schemaVersion === 2 &&
    isObjectRecord(response.vault) &&
    response.vault.chainId === requestedChainId &&
    typeof response.vault.address === 'string' &&
    [response.vault.name, response.vault.label].every((name) => name == null || typeof name === 'string') &&
    normalizeVaultAddress(response.vault.address) === normalizeVaultAddress(requestedVaultAddress) &&
    isValidStrategyDictionary(response.strategies) &&
    isValidBoundaryStates(response.boundaryStates) &&
    Array.isArray(response.entries) &&
    response.entries.every(isValidAllocationHistoryEntry) &&
    isObjectRecord(response.pagination) &&
    (response.pagination.nextCursor === null ||
      (typeof response.pagination.nextCursor === 'string' && response.pagination.nextCursor.length > 0))
  if (!hasValidEnvelope) {
    return false
  }

  if (response.currentSnapshot === null) {
    return !requireCurrentSnapshot
  }

  return (
    isObjectRecord(response.currentSnapshot) &&
    typeof response.currentSnapshot.id === 'string' &&
    response.currentSnapshot.kind === 'current_snapshot' &&
    isValidState(response.currentSnapshot) &&
    (response.currentSnapshot.interval === null || isValidInterval(response.currentSnapshot.interval))
  )
}

export function useReallocationData(
  vaultAddress: string,
  vaultChainId: ChainId | undefined,
  currentVaultDetails?: VaultExtended | null,
  _currentVaultSnapshotTimestampUtc?: string | null
): {
  data: ReallocationData | null
  issues: AllocationHistoryIssue[]
  error: string | null
  isLoading: boolean
  hasOlderEntries: boolean
  isLoadingOlderEntries: boolean
  loadOlderEntries: () => Promise<void>
} {
  const allocationHistoryApiUrl = getAllocationHistoryApiUrl()
  const enabled = Boolean(allocationHistoryApiUrl && vaultAddress && vaultChainId && currentVaultDetails?.address)

  const query = useInfiniteQuery({
    queryKey: buildReallocationQueryKey(vaultAddress, vaultChainId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!allocationHistoryApiUrl || !vaultChainId) {
        throw new Error('Allocation history API is not configured')
      }

      const response = await fetch(
        buildReallocationRequestUrl(allocationHistoryApiUrl, vaultAddress, vaultChainId, pageParam)
      )
      if (response.status === 404) {
        return null
      }
      if (!response.ok) {
        throw new Error(`Allocation history API returned ${response.status}`)
      }

      const payload: unknown = await response.json()
      if (!isValidChartResponse(payload, vaultAddress, vaultChainId, pageParam === null)) {
        throw new Error('Allocation history API returned an invalid chart response')
      }

      return payload
    },
    getNextPageParam: (lastPage) => lastPage?.pagination.nextCursor ?? undefined,
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: 1
  })

  const transformed = useMemo<{ data: ReallocationData | null; issues: AllocationHistoryIssue[] }>(() => {
    const pages = query.data?.pages.filter((page): page is AllocationHistoryChartResponse => page !== null)
    if (!pages?.length) {
      return { data: null, issues: [] }
    }

    const firstPage = pages[0]
    if (!firstPage?.currentSnapshot) {
      return { data: null, issues: [] }
    }

    const uniqueEntries = [...new Map(pages.flatMap((page) => page.entries).map((entry) => [entry.id, entry])).values()]

    if (uniqueEntries.length === 0) {
      return { data: null, issues: [] }
    }

    const strategyNames = new Map(
      pages.flatMap((page) =>
        Object.entries(page.strategies).map(([address, name]) => [normalizeVaultAddress(address), name] as const)
      )
    )
    const boundaryStates = new Map(pages.flatMap((page) => Object.entries(page.boundaryStates)))
    const { panels, issues } = buildObservedReallocationPanels(
      uniqueEntries,
      firstPage.currentSnapshot,
      boundaryStates,
      strategyNames,
      allocationHistoryApiUrl
    )
    if (panels.length === 0) {
      return { data: null, issues }
    }

    return {
      issues,
      data: {
        vault: normalizeVaultAddress(firstPage.vault.address),
        vaultLabel:
          firstPage.vault.name?.trim() ||
          firstPage.vault.label?.trim() ||
          currentVaultDetails?.name ||
          firstPage.vault.address,
        chainId: firstPage.vault.chainId,
        chainName: CHAIN_ID_TO_NAME[firstPage.vault.chainId as ChainId] ?? null,
        panels
      }
    }
  }, [allocationHistoryApiUrl, currentVaultDetails?.name, query.data?.pages])

  if (query.error) {
    console.warn(`[allocation-history] query error for vault ${vaultAddress}:`, query.error)
  }

  return {
    data: transformed.data,
    issues: transformed.issues,
    error: query.error ? query.error.message : null,
    isLoading: query.isLoading,
    hasOlderEntries: Boolean(query.hasNextPage),
    isLoadingOlderEntries: query.isFetchingNextPage,
    loadOlderEntries: async () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        await query.fetchNextPage()
      }
    }
  }
}
