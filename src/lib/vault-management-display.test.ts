import { describe, expect, it } from 'vitest'
import { buildVaultManagementTimelineItems } from '@/lib/vault-management-display'
import type { VaultManagementEvent, VaultUserEvent } from '@/types/vaultEventTypes'

function makeDebtUpdatedEvent(overrides: Partial<VaultManagementEvent>): VaultManagementEvent {
  return {
    id: overrides.id ?? 'debt-event',
    type: 'debtUpdated',
    chainId: overrides.chainId ?? 1,
    blockNumber: overrides.blockNumber ?? '100',
    blockTimestamp: overrides.blockTimestamp ?? '1000',
    transactionHash: overrides.transactionHash ?? '0xtx',
    transactionFrom: overrides.transactionFrom,
    logIndex: overrides.logIndex ?? '1',
    strategy: overrides.strategy ?? '0x1111111111111111111111111111111111111111',
    currentDebt: overrides.currentDebt ?? '1000',
    newDebt: overrides.newDebt ?? '500'
  }
}

function makeWithdrawEvent(overrides: Partial<VaultUserEvent>): VaultUserEvent {
  return {
    id: overrides.id ?? 'withdraw-event',
    type: 'withdraw',
    chainId: overrides.chainId ?? 1,
    blockNumber: overrides.blockNumber ?? '100',
    blockTimestamp: overrides.blockTimestamp ?? '1000',
    transactionHash: overrides.transactionHash ?? '0xtx',
    vaultAddress: overrides.vaultAddress ?? '0xvault',
    assets: overrides.assets ?? '500',
    shares: overrides.shares ?? '450'
  }
}

describe('buildVaultManagementTimelineItems', () => {
  it('assigns a withdrawal reason to same-transaction debt decreases', () => {
    const managementEvents = [
      makeDebtUpdatedEvent({
        id: 'debt-1',
        transactionHash: '0xwithdrawtx',
        currentDebt: '1000000',
        newDebt: '750000'
      })
    ]

    const userEvents = [
      makeWithdrawEvent({
        id: 'withdraw-1',
        transactionHash: '0xwithdrawtx',
        assets: '250000'
      })
    ]

    const timelineItems = buildVaultManagementTimelineItems(managementEvents, userEvents, 'all')

    expect(timelineItems).toHaveLength(1)
    expect(timelineItems[0]?.kind).toBe('event')
    if (timelineItems[0]?.kind !== 'event') {
      throw new Error('Expected an event item')
    }

    expect(timelineItems[0].reason?.label).toBe('Withdrawal')
  })

  it('groups mixed-direction debt updates into a reallocation item', () => {
    const managementEvents = [
      makeDebtUpdatedEvent({
        id: 'increase-1',
        transactionHash: '0xreallocationtx',
        logIndex: '20',
        strategy: '0x2222222222222222222222222222222222222222',
        currentDebt: '500',
        newDebt: '1500'
      }),
      makeDebtUpdatedEvent({
        id: 'decrease-1',
        transactionHash: '0xreallocationtx',
        logIndex: '10',
        strategy: '0x3333333333333333333333333333333333333333',
        currentDebt: '1800',
        newDebt: '800'
      })
    ]

    const timelineItems = buildVaultManagementTimelineItems(managementEvents, [], 'all')

    expect(timelineItems).toHaveLength(1)
    expect(timelineItems[0]?.kind).toBe('reallocation')
    if (timelineItems[0]?.kind !== 'reallocation') {
      throw new Error('Expected a reallocation item')
    }

    expect(timelineItems[0].increases).toHaveLength(1)
    expect(timelineItems[0].decreases).toHaveLength(1)
    expect(timelineItems[0].reason?.label).toBe('Reallocation')
  })

  it('groups consecutive withdrawal debt decreases into a sequence item', () => {
    const managementEvents = [
      makeDebtUpdatedEvent({
        id: 'withdrawal-decrease-1',
        transactionHash: '0xwithdraw-1',
        blockTimestamp: '3000',
        currentDebt: '2000',
        newDebt: '1500'
      }),
      makeDebtUpdatedEvent({
        id: 'withdrawal-decrease-2',
        transactionHash: '0xwithdraw-2',
        blockTimestamp: '2000',
        currentDebt: '1500',
        newDebt: '1000'
      })
    ]

    const userEvents = [
      makeWithdrawEvent({
        id: 'withdraw-1',
        transactionHash: '0xwithdraw-1',
        blockTimestamp: '3000'
      }),
      makeWithdrawEvent({
        id: 'withdraw-2',
        transactionHash: '0xwithdraw-2',
        blockTimestamp: '2000'
      })
    ]

    const timelineItems = buildVaultManagementTimelineItems(managementEvents, userEvents, 'all')

    expect(timelineItems).toHaveLength(1)
    expect(timelineItems[0]?.kind).toBe('sequence')
    if (timelineItems[0]?.kind !== 'sequence') {
      throw new Error('Expected a sequence item')
    }

    expect(timelineItems[0].reason.label).toBe('Withdrawal')
    expect(timelineItems[0].items).toHaveLength(2)
  })

  it('classifies known keeper-called debt updates', () => {
    const managementEvents = [
      makeDebtUpdatedEvent({
        id: 'keeper-debt-1',
        transactionHash: '0xkeeper-1',
        transactionFrom: '0x604e586F17cE106B64185A7a0d2c1Da5bAce711E',
        currentDebt: '1000',
        newDebt: '1200'
      })
    ]

    const timelineItems = buildVaultManagementTimelineItems(managementEvents, [], 'all')

    expect(timelineItems).toHaveLength(1)
    expect(timelineItems[0]?.kind).toBe('event')
    if (timelineItems[0]?.kind !== 'event') {
      throw new Error('Expected an event item')
    }

    expect(timelineItems[0].reason?.label).toBe('Keeper Action')
  })
})
