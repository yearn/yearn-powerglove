import { describe, expect, it } from 'vitest'
import type { CanonicalFeeHistoryBucket } from './canonical-fees'
import { buildChainFeeHistorySeries } from './chain-fee-history'

function bucket(
  period: string,
  netYieldUsd: string | null,
  totalFeesPaidUsd: string | null
): CanonicalFeeHistoryBucket {
  return {
    period,
    totalFeesPaidUsd,
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
      netYieldUsd
    }
  }
}

describe('chain fee history', () => {
  it('aligns missing chain weeks and accumulates at their actual closing boundaries', () => {
    const result = buildChainFeeHistorySeries(
      [
        {
          chainId: 1,
          history: {
            interval: 'weekly',
            buckets: [bucket('2025-09-29', '100', '10'), bucket('2025-10-06', '50', '5')]
          }
        },
        { chainId: 10, history: { interval: 'weekly', buckets: [bucket('2025-10-06', '20', '2')] } }
      ],
      [
        {
          period: '2025-09-29',
          startTimestamp: Date.parse('2025-10-01T00:00:00Z') / 1000,
          endTimestamp: Date.parse('2025-10-06T00:00:00Z') / 1000
        },
        {
          period: '2025-10-06',
          startTimestamp: Date.parse('2025-10-06T00:00:00Z') / 1000,
          endTimestamp: Date.parse('2025-10-13T00:00:00Z') / 1000
        }
      ]
    )
    expect(result.periodic).toEqual([
      { period: '2025-09-29', earnings: { 1: 100, 10: 0 }, fees: { 1: 10, 10: 0 } },
      { period: '2025-10-06', earnings: { 1: 50, 10: 20 }, fees: { 1: 5, 10: 2 } }
    ])
    expect(result.cumulative).toEqual([
      { period: '2025-10-01', earnings: { 1: 0, 10: 0 }, fees: { 1: 0, 10: 0 } },
      { period: '2025-10-06', earnings: { 1: 100, 10: 0 }, fees: { 1: 10, 10: 0 } },
      { period: '2025-10-13', earnings: { 1: 150, 10: 20 }, fees: { 1: 15, 10: 2 } }
    ])
  })

  it('aligns chain months and stacks signed net earnings with an opening zero', () => {
    const result = buildChainFeeHistorySeries(
      [
        { chainId: 1, history: { interval: 'monthly', buckets: [bucket('2025-12', '100', '10')] } },
        {
          chainId: 10,
          history: { interval: 'monthly', buckets: [bucket('2025-12', '-20', '2'), bucket('2026-01', '40', '4')] }
        }
      ],
      ['2025-12', '2026-01'].map((period) => ({ period }))
    )
    expect(result.periodic).toEqual([
      { period: '2025-12', earnings: { 1: 100, 10: -20 }, fees: { 1: 10, 10: 2 } },
      { period: '2026-01', earnings: { 1: 0, 10: 40 }, fees: { 1: 0, 10: 4 } }
    ])
    expect(result.cumulative).toEqual([
      { period: '2025-12-01', earnings: { 1: 0, 10: 0 }, fees: { 1: 0, 10: 0 } },
      { period: '2026-01-01', earnings: { 1: 100, 10: -20 }, fees: { 1: 10, 10: 2 } },
      { period: '2026-02-01', earnings: { 1: 100, 10: 20 }, fees: { 1: 10, 10: 6 } }
    ])
  })

  it('zero-fills missing amounts and resumes accumulation when amounts return', () => {
    const result = buildChainFeeHistorySeries(
      [
        {
          chainId: 1,
          history: { interval: 'monthly', buckets: [bucket('2026-01', null, null), bucket('2026-02', '200', '20')] }
        }
      ],
      ['2026-01', '2026-02'].map((period) => ({ period }))
    )
    expect(result.periodic.map((point) => point.fees[1])).toEqual([0, 20])
    expect(result.cumulative.map((point) => point.fees[1])).toEqual([0, 0, 20])
    expect(result.periodic.map((point) => point.earnings[1])).toEqual([0, 200])
    expect(result.cumulative.map((point) => point.earnings[1])).toEqual([0, 0, 200])
  })

  it('zero-fills months outside a chain history and chains with no activity in the window', () => {
    const result = buildChainFeeHistorySeries(
      [
        { chainId: 10, history: { interval: 'monthly', buckets: [bucket('2026-02', '100', '10')] } },
        { chainId: 100, history: { interval: 'monthly', buckets: [] } }
      ],
      ['2026-01', '2026-02', '2026-03'].map((period) => ({ period }))
    )
    expect(result.periodic.map((point) => point.earnings)).toEqual([
      { 10: 0, 100: 0 },
      { 10: 100, 100: 0 },
      { 10: 0, 100: 0 }
    ])
    expect(result.cumulative.map((point) => point.fees)).toEqual([
      { 10: 0, 100: 0 },
      { 10: 0, 100: 0 },
      { 10: 10, 100: 0 },
      { 10: 10, 100: 0 }
    ])
  })

  it('does not manufacture an opening point for an empty window', () => {
    expect(buildChainFeeHistorySeries([], [])).toEqual({ periodic: [], cumulative: [] })
  })
})
