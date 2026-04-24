import { sortEventsChronologically } from '@/lib/vault-events'
import type { VaultManagementEvent, VaultManagementEventType, VaultUserEvent } from '@/types/vaultEventTypes'

export interface VaultManagementReason {
  label: string
  description: string
}

export interface VaultManagementTimelineEventItem {
  kind: 'event'
  id: string
  event: VaultManagementEvent
  reason?: VaultManagementReason
}

export interface VaultManagementTimelineReallocationItem {
  kind: 'reallocation'
  id: string
  transactionHash: string
  chainId: number
  blockNumber: string
  blockTimestamp: string
  increases: VaultManagementEvent[]
  decreases: VaultManagementEvent[]
  reason?: VaultManagementReason
}

export interface VaultManagementTimelineSequenceItem {
  kind: 'sequence'
  id: string
  title: string
  blockNumber: string
  blockTimestamp: string
  direction: 'increase' | 'decrease'
  items: VaultManagementTimelineEventItem[]
  reason: VaultManagementReason
}

export type VaultManagementTimelineItem =
  | VaultManagementTimelineEventItem
  | VaultManagementTimelineReallocationItem
  | VaultManagementTimelineSequenceItem

const KNOWN_MANAGEMENT_ACTORS: Record<string, { label: string; description: string }> = {
  '0x604e586f17ce106b64185a7a0d2c1da5bace711e': {
    label: 'Keeper Action',
    description:
      'This debt update was submitted by yHaaSRelayer, an internal keeper/relayer that likely applies DOA-driven allocation recommendations.'
  }
}

function getTransactionKey(transactionHash?: string): string | null {
  return transactionHash ? transactionHash.toLowerCase() : null
}

function getKnownManagementActor(address?: string): { label: string; description: string } | null {
  if (!address) {
    return null
  }

  return KNOWN_MANAGEMENT_ACTORS[address.toLowerCase()] ?? null
}

function toBigInt(value: string | undefined): bigint | null {
  if (!value) {
    return null
  }

  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function getDebtDelta(event: VaultManagementEvent): bigint | null {
  if (event.type !== 'debtUpdated') {
    return null
  }

  const currentDebt = toBigInt(event.currentDebt)
  const newDebt = toBigInt(event.newDebt)
  if (currentDebt === null || newDebt === null) {
    return null
  }

  return newDebt - currentDebt
}

function buildManagementEventsByTransaction(events: VaultManagementEvent[]): Map<string, VaultManagementEvent[]> {
  const eventsByTransaction = new Map<string, VaultManagementEvent[]>()

  for (const event of events) {
    const transactionKey = getTransactionKey(event.transactionHash)
    if (!transactionKey) {
      continue
    }

    const existingEvents = eventsByTransaction.get(transactionKey) ?? []
    existingEvents.push(event)
    eventsByTransaction.set(transactionKey, existingEvents)
  }

  for (const [transactionKey, transactionEvents] of eventsByTransaction) {
    eventsByTransaction.set(transactionKey, sortEventsChronologically(transactionEvents))
  }

  return eventsByTransaction
}

function buildUserEventsByTransaction(events: VaultUserEvent[]): Map<string, VaultUserEvent[]> {
  const eventsByTransaction = new Map<string, VaultUserEvent[]>()

  for (const event of events) {
    const transactionKey = getTransactionKey(event.transactionHash)
    if (!transactionKey) {
      continue
    }

    const existingEvents = eventsByTransaction.get(transactionKey) ?? []
    existingEvents.push(event)
    eventsByTransaction.set(transactionKey, existingEvents)
  }

  return eventsByTransaction
}

function buildFilteredDebtEventsByTransaction(events: VaultManagementEvent[]): Map<string, VaultManagementEvent[]> {
  const debtEventsByTransaction = new Map<string, VaultManagementEvent[]>()

  for (const event of events) {
    if (event.type !== 'debtUpdated') {
      continue
    }

    const transactionKey = getTransactionKey(event.transactionHash)
    if (!transactionKey) {
      continue
    }

    const existingEvents = debtEventsByTransaction.get(transactionKey) ?? []
    existingEvents.push(event)
    debtEventsByTransaction.set(transactionKey, existingEvents)
  }

  for (const [transactionKey, transactionEvents] of debtEventsByTransaction) {
    debtEventsByTransaction.set(transactionKey, sortEventsChronologically(transactionEvents))
  }

  return debtEventsByTransaction
}

function buildDebtReallocationTransactions(
  filteredDebtEventsByTransaction: Map<string, VaultManagementEvent[]>
): Set<string> {
  const transactionKeys = new Set<string>()

  for (const [transactionKey, debtEvents] of filteredDebtEventsByTransaction) {
    let hasIncrease = false
    let hasDecrease = false

    for (const event of debtEvents) {
      const delta = getDebtDelta(event)
      if (delta === null) {
        continue
      }

      if (delta > 0n) {
        hasIncrease = true
      } else if (delta < 0n) {
        hasDecrease = true
      }
    }

    if (hasIncrease && hasDecrease) {
      transactionKeys.add(transactionKey)
    }
  }

  return transactionKeys
}

function deriveDebtUpdateReason(
  event: VaultManagementEvent,
  sameTransactionManagementEvents: VaultManagementEvent[],
  sameTransactionUserEvents: VaultUserEvent[]
): VaultManagementReason {
  const delta = getDebtDelta(event) ?? 0n
  const relatedManagementEvents = sameTransactionManagementEvents.filter((candidate) => candidate.id !== event.id)

  if (sameTransactionUserEvents.some((userEvent) => userEvent.type === 'withdraw')) {
    return {
      label: 'Withdrawal',
      description:
        'The same transaction contains a vault withdrawal, so this debt change likely pulled capital back from the strategy to fund that exit.'
    }
  }

  if (delta > 0n && sameTransactionUserEvents.some((userEvent) => userEvent.type === 'deposit')) {
    return {
      label: 'Deposit Allocation',
      description:
        'The same transaction contains a vault deposit, so this debt increase likely allocated freshly deposited assets into the strategy.'
    }
  }

  if (
    relatedManagementEvents.some(
      (candidate) => candidate.type === 'debtUpdated' && (getDebtDelta(candidate) ?? 0n) !== 0n
    )
  ) {
    return {
      label: 'Reallocation',
      description:
        'The same transaction also changed debt on another strategy, so this looks like part of a broader capital reallocation across the vault.'
    }
  }

  if (relatedManagementEvents.some((candidate) => candidate.type === 'strategyReported')) {
    return {
      label: 'Strategy Report',
      description:
        'The same transaction includes a strategy report, so this debt update likely happened as part of report-driven vault accounting or rebalancing.'
    }
  }

  if (relatedManagementEvents.some((candidate) => candidate.type === 'updatedMaxDebtForStrategy')) {
    return {
      label: 'Max Debt Cap Update',
      description:
        'The same transaction updated a max debt cap, so this debt update likely reflects a cap change being applied to the live allocation.'
    }
  }

  if (relatedManagementEvents.some((candidate) => candidate.type === 'strategyChanged')) {
    return {
      label: 'Strategy Status Change',
      description:
        'The same transaction also changed strategy status, so this debt update likely happened alongside a strategy add, revoke, or migration step.'
    }
  }

  if (relatedManagementEvents.some((candidate) => candidate.type === 'debtPurchased')) {
    return {
      label: 'Debt Purchase',
      description:
        'The same transaction includes a debt purchase event, so this debt update likely reflects debt being bought out rather than a normal allocation rebalance.'
    }
  }

  if (relatedManagementEvents.some((candidate) => candidate.type === 'shutdown')) {
    return {
      label: 'Shutdown',
      description:
        'The same transaction includes a shutdown event, so this debt update likely happened as part of unwinding strategy positions after shutdown.'
    }
  }

  const knownActor = getKnownManagementActor(event.transactionFrom)
  if (knownActor) {
    return knownActor
  }

  return {
    label: 'Direct Debt Update',
    description:
      'No same-transaction withdrawal, deposit, or paired debt movement was found in the indexed events, so this appears to be a standalone debt adjustment.'
  }
}

function getSequenceGroupingKey(item: VaultManagementTimelineItem): 'withdrawal' | 'deposit' | null {
  if (item.kind !== 'event' || item.event.type !== 'debtUpdated' || !item.reason) {
    return null
  }

  const delta = getDebtDelta(item.event)
  if (delta === null) {
    return null
  }

  if (item.reason.label === 'Withdrawal' && delta < 0n) {
    return 'withdrawal'
  }

  if (item.reason.label === 'Deposit Allocation' && delta > 0n) {
    return 'deposit'
  }

  return null
}

function groupSequentialDebtTimelineItems(items: VaultManagementTimelineItem[]): VaultManagementTimelineItem[] {
  const groupedItems: VaultManagementTimelineItem[] = []

  for (let index = 0; index < items.length; ) {
    const currentItem = items[index]
    const groupingKey = getSequenceGroupingKey(currentItem)

    if (!groupingKey) {
      groupedItems.push(currentItem)
      index += 1
      continue
    }

    if (currentItem.kind !== 'event') {
      groupedItems.push(currentItem)
      index += 1
      continue
    }

    const groupedSequence: VaultManagementTimelineEventItem[] = [currentItem]
    let nextIndex = index + 1

    while (nextIndex < items.length && getSequenceGroupingKey(items[nextIndex]) === groupingKey) {
      const candidateItem = items[nextIndex]
      if (candidateItem.kind === 'event') {
        groupedSequence.push(candidateItem)
      }
      nextIndex += 1
    }

    if (groupedSequence.length >= 2) {
      groupedItems.push({
        kind: 'sequence',
        id: `sequence-${groupingKey}-${groupedSequence[0].id}-${groupedSequence[groupedSequence.length - 1].id}`,
        title: groupingKey === 'withdrawal' ? 'Withdrawal Debt Changes' : 'Deposit Debt Changes',
        blockNumber: groupedSequence[0].event.blockNumber,
        blockTimestamp: groupedSequence[0].event.blockTimestamp,
        direction: groupingKey === 'withdrawal' ? 'decrease' : 'increase',
        items: groupedSequence,
        reason: groupedSequence[0].reason ?? {
          label: groupingKey === 'withdrawal' ? 'Withdrawal' : 'Deposit Allocation',
          description:
            groupingKey === 'withdrawal'
              ? 'These consecutive debt decreases were grouped because they look like withdrawal-driven capital pulls.'
              : 'These consecutive debt increases were grouped because they look like deposit-driven allocations.'
        }
      })
    } else {
      groupedItems.push(currentItem)
    }

    index = nextIndex
  }

  return groupedItems
}

function deriveDebtReallocationReason(
  sameTransactionManagementEvents: VaultManagementEvent[],
  sameTransactionUserEvents: VaultUserEvent[]
): VaultManagementReason {
  if (sameTransactionUserEvents.some((event) => event.type === 'withdraw')) {
    return {
      label: 'Withdrawal Reallocation',
      description:
        'The same transaction contains a vault withdrawal, and the vault also moved debt between strategies. This suggests the withdrawal was handled alongside a broader rebalance.'
    }
  }

  if (sameTransactionUserEvents.some((event) => event.type === 'deposit')) {
    return {
      label: 'Deposit Reallocation',
      description:
        'The same transaction contains a vault deposit and multiple debt changes, so the vault appears to have redistributed new capital across strategies.'
    }
  }

  if (sameTransactionManagementEvents.some((event) => event.type === 'strategyReported')) {
    return {
      label: 'Report Reallocation',
      description:
        'The same transaction includes a strategy report, and the vault moved debt between strategies as part of that report-driven rebalance.'
    }
  }

  if (sameTransactionManagementEvents.some((event) => event.type === 'strategyChanged')) {
    return {
      label: 'Strategy Migration',
      description:
        'The same transaction changed strategy status and moved debt across strategies, which is consistent with a migration or replacement of allocations.'
    }
  }

  return {
    label: 'Reallocation',
    description:
      'The vault moved debt out of one strategy and into another in the same transaction. This is a direct strategy-level reallocation of capital.'
  }
}

export function buildVaultManagementTimelineItems(
  managementEvents: VaultManagementEvent[],
  userEvents: VaultUserEvent[],
  eventType: 'all' | VaultManagementEventType
): VaultManagementTimelineItem[] {
  const filteredManagementEvents =
    eventType === 'all' ? managementEvents : managementEvents.filter((event) => event.type === eventType)

  const allManagementEventsByTransaction = buildManagementEventsByTransaction(managementEvents)
  const userEventsByTransaction = buildUserEventsByTransaction(userEvents)
  const filteredDebtEventsByTransaction = buildFilteredDebtEventsByTransaction(filteredManagementEvents)
  const debtReallocationTransactions = buildDebtReallocationTransactions(filteredDebtEventsByTransaction)

  const timelineItems: VaultManagementTimelineItem[] = []
  const seenDebtReallocationTransactions = new Set<string>()

  for (const event of filteredManagementEvents) {
    const transactionKey = getTransactionKey(event.transactionHash)

    if (event.type === 'debtUpdated' && transactionKey && debtReallocationTransactions.has(transactionKey)) {
      if (seenDebtReallocationTransactions.has(transactionKey)) {
        continue
      }

      seenDebtReallocationTransactions.add(transactionKey)

      const debtEvents = filteredDebtEventsByTransaction.get(transactionKey) ?? []
      const increases = debtEvents.filter((candidate) => (getDebtDelta(candidate) ?? 0n) > 0n)
      const decreases = debtEvents.filter((candidate) => (getDebtDelta(candidate) ?? 0n) < 0n)
      const sameTransactionManagementEvents = allManagementEventsByTransaction.get(transactionKey) ?? [event]
      const sameTransactionUserEvents = userEventsByTransaction.get(transactionKey) ?? []

      timelineItems.push({
        kind: 'reallocation',
        id: `reallocation-${transactionKey}`,
        transactionHash: event.transactionHash,
        chainId: event.chainId,
        blockNumber: event.blockNumber,
        blockTimestamp: event.blockTimestamp,
        increases,
        decreases,
        reason: deriveDebtReallocationReason(sameTransactionManagementEvents, sameTransactionUserEvents)
      })
      continue
    }

    const sameTransactionManagementEvents = transactionKey
      ? (allManagementEventsByTransaction.get(transactionKey) ?? [event])
      : [event]
    const sameTransactionUserEvents = transactionKey ? (userEventsByTransaction.get(transactionKey) ?? []) : []

    timelineItems.push({
      kind: 'event',
      id: event.id,
      event,
      reason:
        event.type === 'debtUpdated'
          ? deriveDebtUpdateReason(event, sameTransactionManagementEvents, sameTransactionUserEvents)
          : undefined
    })
  }

  return groupSequentialDebtTimelineItems(timelineItems)
}
