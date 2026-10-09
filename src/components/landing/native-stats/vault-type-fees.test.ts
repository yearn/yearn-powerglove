import { describe, expect, it } from 'vitest'
import type { KongVaultListItem } from '@/types/kong'
import type { CanonicalVaultFee } from './canonical-fees'
import { buildVaultTypeFeeSeries } from './vault-type-fees'

function vault(
  address: string,
  contractFamily: string,
  earnings: string | null,
  fees: string | null
): CanonicalVaultFee {
  return {
    address,
    chainId: 1,
    name: 'Factory in a name is not a classification',
    contractFamily,
    totalFeesPaidUsd: fees,
    protocolFeesUsd: null,
    managerFeesUsd: null,
    performanceFeesUsd: null,
    managementFeesUsd: null,
    strategistFeesUsd: null,
    totalRefundsUsd: null,
    lifetimeEarnings: {
      rawGrossGainsUsd: null,
      rawLossesUsd: null,
      rawNetYieldUsd: null,
      grossGainsUsd: null,
      lossesUsd: null,
      netYieldUsd: earnings
    }
  }
}

const catalog: KongVaultListItem[] = [
  { address: '0xA', chainId: 1, name: 'A', type: 'Automated Yearn Vault' },
  { address: '0xB', chainId: 1, name: 'Factory', type: 'Yearn Vault' },
  { address: '0xC', chainId: 1, name: 'C', type: 'Experimental Yearn Vault' }
]

describe('vault type fee breakdown', () => {
  it('combines V3 allocator earnings and strategy fees, and separates V2 using explicit metadata', () => {
    const result = buildVaultTypeFeeSeries(
      [
        [
          vault('0xa', 'yearn-v2-vault', '100', '10'),
          vault('0xb', 'yearn-v2-vault', '50', '5'),
          vault('0xc', 'yearn-v2-vault', '-20', '2'),
          vault('0xd', 'yearn-v3-allocator', '40', '4'),
          vault('0xe', 'yearn-v3-tokenized-strategy', null, '3')
        ]
      ],
      [{ period: '2026-01' }],
      catalog
    )
    expect(result.totals.map(({ key, earnings, fees }) => ({ key, earnings, fees }))).toEqual([
      { key: 'v3', earnings: 40, fees: 7 },
      { key: 'v2-factory', earnings: 100, fees: 10 },
      { key: 'v2-legacy', earnings: 30, fees: 7 }
    ])
    expect(result.series.some(({ key }) => key === 'v1')).toBe(false)
  })

  it('zero-fills empty periods and starts at the clipped boundary; bar totals match the final stack', () => {
    const periods = [
      {
        period: '2025-09-29',
        startTimestamp: Date.parse('2025-10-01') / 1000,
        endTimestamp: Date.parse('2025-10-06') / 1000
      },
      {
        period: '2025-10-06',
        startTimestamp: Date.parse('2025-10-06') / 1000,
        endTimestamp: Date.parse('2025-10-13') / 1000
      },
      {
        period: '2025-10-13',
        startTimestamp: Date.parse('2025-10-13') / 1000,
        endTimestamp: Date.parse('2025-10-20') / 1000
      }
    ]
    const result = buildVaultTypeFeeSeries(
      [[vault('0xa', 'yearn-v2-vault', '100', '10')], [], [vault('0xa', 'yearn-v2-vault', '-20', null)]],
      periods,
      catalog
    )
    expect(result.periodic.map((point) => point.earnings['v2-factory'])).toEqual([100, 0, -20])
    expect(result.cumulative.map((point) => point.earnings['v2-factory'])).toEqual([0, 100, 100, 80])
    expect(result.cumulative[0].period).toBe('2025-10-01')
    expect(result.cumulative[result.cumulative.length - 1]?.period).toBe('2025-10-20')
    expect(result.totals[0].earnings).toBe(result.cumulative[result.cumulative.length - 1]?.earnings['v2-factory'])
    expect(result.totals[0].fees).toBe(10)
  })

  it('keeps unmatched V2 and unknown families visible rather than dropping or misclassifying amounts', () => {
    const result = buildVaultTypeFeeSeries(
      [[vault('0xf', 'yearn-v2-vault', '50', '5'), vault('0xg', 'new-family', '20', '2')]],
      [{ period: '2026-01' }],
      catalog
    )
    expect(result.totals.map(({ key, earnings }) => ({ key, earnings }))).toEqual([
      { key: 'v2-unclassified', earnings: 50 },
      { key: 'other', earnings: 20 }
    ])
  })
})
