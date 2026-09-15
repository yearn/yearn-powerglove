import { describe, expect, it } from 'vitest'
import { isValidAllocationHistoryEntry } from '@/hooks/useReallocationData'

function makeEntry() {
  const state = {
    blockNumber: 100,
    blockTimestamp: 1000,
    totalAssets: '1000000',
    totalIdle: '250000',
    allocations: [
      {
        strategyAddress: '0x1111111111111111111111111111111111111111',
        currentDebt: '750000'
      }
    ]
  }

  return {
    id: 'entry-1',
    kind: 'strategy_reallocation' as const,
    after: state,
    endBlock: 101,
    endTimestamp: '2026-08-01T00:01:00Z',
    execution: {
      automation: 'automatic' as const,
      mechanism: 'allocator_keeper' as const,
      targetStatus: 'matched' as const
    },
    expectedAprImpact: {
      status: 'unavailable' as const,
      reason: 'no_matched_doa_policy'
    },
    detailsHref: '/details/entry-1',
    interval: null
  }
}

describe('isValidAllocationHistoryEntry', () => {
  it('accepts a reconciled observed allocation entry', () => {
    expect(isValidAllocationHistoryEntry(makeEntry())).toBe(true)
  })

  it('rejects allocation states whose raw balances do not equal total assets', () => {
    const entry = makeEntry()
    entry.after = { ...entry.after, totalIdle: '0' }

    expect(isValidAllocationHistoryEntry(entry as never)).toBe(false)
  })

  it('rejects unsupported flow kinds', () => {
    const entry = { ...makeEntry(), kind: 'allocator_override' }

    expect(isValidAllocationHistoryEntry(entry as never)).toBe(false)
  })
})
