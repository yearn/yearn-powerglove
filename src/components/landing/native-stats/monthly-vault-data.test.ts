import { describe, expect, it } from 'vitest'
import type { CanonicalVaultFee } from './canonical-fees'
import { buildMonthlyVaultRows, completedFeeMonths, monthlyUsd } from './monthly-vault-data'

const vault = (chainId: number, fee: string | null): CanonicalVaultFee => ({
  chainId,
  address: '0xAbc',
  name: 'Example',
  contractFamily: 'yearn-v3-allocator',
  totalFeesPaidUsd: fee,
  protocolFeesUsd: null,
  managerFeesUsd: null,
  managementFeesUsd: null,
  performanceFeesUsd: null,
  strategistFeesUsd: null,
  totalRefundsUsd: null,
  lifetimeEarnings: {
    rawGrossGainsUsd: null,
    rawLossesUsd: null,
    rawNetYieldUsd: null,
    grossGainsUsd: null,
    lossesUsd: null,
    netYieldUsd: null
  }
})
describe('monthly vault fee matrix', () => {
  it('uses exactly the last 12 completed UTC months, including leap February', () => {
    const months = completedFeeMonths(Date.parse('2024-03-15T12:00:00Z') / 1000)
    expect(months).toHaveLength(12)
    expect(months[0].period).toBe('2023-03')
    expect(months[11].period).toBe('2024-02')
    expect((months[11].endTimestamp! - months[11].startTimestamp!) / 86400).toBe(29)
    expect(months.every((month, i) => i === 11 || month.endTimestamp === months[i + 1].startTimestamp)).toBe(true)
  })
  it('keeps chain-qualified identities, missing published months at zero, and untracked or unknown fees unavailable', () => {
    const rows = buildMonthlyVaultRows(
      [vault(1, '30'), vault(137, '100')],
      [[vault(1, '10'), vault(137, null)], [vault(1, '20')]],
      [{ chainId: 8453, address: '0xabc', name: 'Not indexed' }]
    )
    expect(rows[0].months).toEqual([10, 20])
    expect(rows[0].total).toBe(30)
    expect(rows[1].months).toEqual([null, 0])
    expect(rows[1].total).toBeNull()
    expect(rows[2].months).toEqual([null, null])
    expect(rows[2].total).toBeNull()
  })
  it('retains catalog-only zero-fee vaults and names without losing historic vaults', () => {
    const rows = buildMonthlyVaultRows(
      [vault(1, '0')],
      [[{ ...vault(137, '12'), address: '0xdef' }]],
      [{ chainId: 1, address: '0xabc', name: 'Current name' }]
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].total).toBe(0)
    expect(rows[1].total).toBe(12)
  })
  it('uses product fees, not earnings or distributions, and does not re-add grouped members', () => {
    const product = {
      ...vault(1, '62'),
      name: 'yBOLD',
      memberAddresses: ['0xAbc', '0xstaking'],
      stakerDistributionUsd: '624',
      lifetimeEarnings: { ...vault(1, '62').lifetimeEarnings, netYieldUsd: '624' }
    }
    const rows = buildMonthlyVaultRows(
      [product],
      [[product]],
      [
        { chainId: 1, address: '0xabc', name: 'Old vault name' },
        { chainId: 1, address: '0xstaking', name: 'ysyBOLD' },
        { chainId: 10, address: '0xstaking', name: 'Unrelated chain' }
      ]
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].vault.name).toBe('yBOLD')
    expect(rows[0].total).toBe(62)
    expect(rows[1].vault.chainId).toBe(10)
  })
  it('uses net earnings rather than fees and preserves losses and unavailable earnings', () => {
    const gain = { ...vault(1, '62'), lifetimeEarnings: { ...vault(1, '62').lifetimeEarnings, netYieldUsd: '624' } }
    const loss = { ...gain, lifetimeEarnings: { ...gain.lifetimeEarnings, netYieldUsd: '-100' } }
    const rows = buildMonthlyVaultRows([gain, vault(137, '0')], [[gain], [loss], []], [], 'earnings')
    expect(rows[0].months).toEqual([624, -100, 0])
    expect(rows[0].total).toBe(524)
    expect(rows[1].months).toEqual([null, null, null])
    expect(rows[1].total).toBeNull()
  })
  it('matches the main vault page classifications', () => {
    const rows = buildMonthlyVaultRows(
      [
        vault(1, '0'),
        { ...vault(2, '0'), contractFamily: 'yearn-v3-tokenized-strategy' },
        { ...vault(3, '0'), name: 'Curve Factory Vault', contractFamily: 'yearn-v2-vault' },
        { ...vault(4, '0'), contractFamily: 'yearn-v2-vault' }
      ],
      []
    )
    expect(rows.map((row) => row.vaultType)).toEqual(['Allocator', 'Strategy', 'Factory', 'Legacy'])
  })
  it('rounds currency to whole dollars while retaining unavailable amounts', () => {
    expect(monthlyUsd(null)).toBe('—')
    expect(monthlyUsd(0)).toBe('$0')
    expect(monthlyUsd(0.001)).toBe('$0')
    expect(monthlyUsd(1e-9)).toBe('$0')
    expect(monthlyUsd(1234.56)).toBe('$1,235')
  })
})
