import { describe, expect, it } from 'vitest'
import type { CanonicalFeeHistoryBucket, CanonicalVaultFee } from './canonical-fees'
import {
  allocatorKey,
  allocatorMovingAverageWindow,
  buildVaultFeeHistorySeries,
  fourWeekVaultMovingAverage,
  rankAllocators
} from './vault-fee-history'

const amounts = {
  protocolFeesUsd: null,
  managerFeesUsd: null,
  performanceFeesUsd: null,
  managementFeesUsd: null,
  strategistFeesUsd: null,
  totalRefundsUsd: null
}
const earnings = (netYieldUsd: string | null) => ({
  rawGrossGainsUsd: null,
  rawLossesUsd: null,
  rawNetYieldUsd: null,
  grossGainsUsd: null,
  lossesUsd: null,
  netYieldUsd
})
const bucket = (period: string, net: string | null, fees: string | null): CanonicalFeeHistoryBucket => ({
  ...amounts,
  period,
  totalFeesPaidUsd: fees,
  lifetimeEarnings: earnings(net)
})

describe('allocator comparison series', () => {
  it('averages exactly four trailing weekly values, retaining zeros, losses, and unknowns', () => {
    const points = [-8, -4, 0, 4, 20].map((amount, index) => ({
      period: `week-${index}`,
      earnings: { vault: amount },
      fees: { vault: index * 4 }
    }))
    const smoothed = fourWeekVaultMovingAverage(points)
    expect(smoothed.map((point) => point.earnings.vault)).toEqual([null, null, null, -2, 5])
    expect(smoothed.map((point) => point.fees.vault)).toEqual([null, null, null, 6, 10])
    const unknown = fourWeekVaultMovingAverage(
      [4, 8, null, 0, -4, 12, 16].map((amount, index) => ({
        period: `week-${index}`,
        earnings: { vault: amount },
        fees: { vault: 4 }
      }))
    )
    expect(unknown.map((point) => point.earnings.vault)).toEqual([null, null, null, null, null, null, 6])
    expect(unknown[3].fees.vault).toBe(4)
  })

  it('loads three earlier weeks and shows only full UTC weeks within the range and before now', () => {
    const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000
    const window = allocatorMovingAverageWindow(
      `since=${timestamp('2026-01-06')}&until=${timestamp('2026-01-28')}&interval=monthly&datasetId=pinned&chainId=1`,
      timestamp('2026-01-22')
    )
    const params = new URLSearchParams(window.query)
    expect(params.get('since')).toBe(String(timestamp('2025-12-22')))
    expect(params.get('until')).toBe(String(timestamp('2026-01-19')))
    expect(params.get('interval')).toBe('weekly')
    expect(params.get('datasetId')).toBe('pinned')
    expect(params.get('chainId')).toBe('1')
    expect(window.first).toBe(timestamp('2026-01-12'))
    expect(window.periods.map((point) => point.period)).toEqual([
      '2025-12-22',
      '2025-12-29',
      '2026-01-05',
      '2026-01-12'
    ])
    expect(
      allocatorMovingAverageWindow(
        `since=${timestamp('2026-01-06')}&until=${timestamp('2026-01-09')}`,
        timestamp('2026-01-22')
      ).periods
    ).toEqual([])
  })

  it('compares chain-qualified vaults, retains losses and unknown amounts, and zero-fills verified empty periods', () => {
    const periods = ['2026-01', '2026-02', '2026-03'].map((period) => ({ period }))
    const series = buildVaultFeeHistorySeries(
      [
        {
          key: '1:0xabc',
          history: {
            interval: 'monthly',
            buckets: [bucket('2026-02', '-10', '2'), bucket('2026-03', null, '3'), bucket('2026-04', '999', '999')]
          }
        },
        { key: '747474:0xabc', history: { interval: 'monthly', buckets: [bucket('2026-01', '20', '4')] } },
        { key: '1:failed' }
      ],
      periods
    )
    expect(series.periodic.map((point) => point.earnings['1:0xabc'])).toEqual([0, -10, null])
    expect(series.periodic.map((point) => point.earnings['747474:0xabc'])).toEqual([20, 0, 0])
    expect(series.periodic.map((point) => point.fees['1:failed'])).toEqual([null, null, null])
    expect(series.cumulative.map((point) => point.earnings['1:0xabc'])).toEqual([0, 0, -10, null])
    expect(series.cumulative.map((point) => point.fees['1:0xabc'])).toEqual([0, 0, 2, 5])
    expect(series.cumulative[0].period).toBe('2026-01-01')
    expect(series.cumulative[series.cumulative.length - 1]?.period).toBe('2026-04-01')
  })

  it('ranks only allocators and preserves chain-qualified identities', () => {
    const vault = (chainId: number, family: string, net: string | null, fees: string | null): CanonicalVaultFee => ({
      ...amounts,
      chainId,
      address: '0xABC',
      name: 'Vault',
      contractFamily: family,
      totalFeesPaidUsd: fees,
      lifetimeEarnings: earnings(net)
    })
    const rows = [
      vault(1, 'yearn-v3-allocator', '10', '50'),
      vault(747474, 'yearn-v3-allocator', '20', '25'),
      vault(1, 'yearn-v3-tokenized-strategy', '999', '999'),
      vault(10, 'yearn-v2-vault', '999', '999'),
      vault(137, 'yearn-v3-allocator', null, null)
    ]
    expect(rankAllocators(rows, 'fees').map(allocatorKey)).toEqual(['1:0xabc', '747474:0xabc', '137:0xabc'])
    expect(rankAllocators(rows, 'earnings').map(allocatorKey)).toEqual(['747474:0xabc', '1:0xabc', '137:0xabc'])
  })
})
