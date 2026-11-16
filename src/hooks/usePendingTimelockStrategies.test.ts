import { describe, expect, it } from 'vitest'
import { parsePendingTimelockStrategies } from './usePendingTimelockStrategies'

const vault = `0x${'1'.repeat(40)}`
const item = {
  chainId: 1,
  vaultAddress: vault,
  strategyAddress: `0x${'2'.repeat(40)}`,
  timelockAddress: `0x${'3'.repeat(40)}`,
  operationId: `0x${'4'.repeat(64)}`,
  scheduleTxHash: `0x${'5'.repeat(64)}`,
  status: 'queued',
  queuedAt: 1700000000,
  eta: 1700604800,
  executorLabel: 'yChad',
  maxDebtRaw: '0'
}
const payload = { chainId: 1, vaultAddress: vault, items: [item] }

describe('pending timelock response', () => {
  it('accepts pending changes and preserves genuine zero debt', () => {
    expect(parsePendingTimelockStrategies(payload, 1, vault)).toEqual([item])
  })
  it('accepts an empty result', () => {
    expect(parsePendingTimelockStrategies({ ...payload, items: [] }, 1, vault)).toEqual([])
  })
  it('rejects mismatched vaults and chains', () => {
    expect(() => parsePendingTimelockStrategies(payload, 8453, vault)).toThrow()
    expect(() => parsePendingTimelockStrategies(payload, 1, item.strategyAddress)).toThrow()
  })
  it.each([
    { status: 'executed' },
    { eta: null },
    { maxDebtRaw: '-1' },
    { scheduleTxHash: 'invalid' },
    { chainId: 8453 }
  ])('rejects invalid rows %j', (change) => {
    expect(() => parsePendingTimelockStrategies({ ...payload, items: [{ ...item, ...change }] }, 1, vault)).toThrow()
  })
})
