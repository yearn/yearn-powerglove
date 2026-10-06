import { describe, expect, it } from 'vitest'
import type { CanonicalFeeHistoryBucket, LifetimeEarnings } from './canonical-fees'
import {
  buildFeeHistorySeries,
  canonicalDecimalToNumber,
  completedMonthlyBuckets,
  utcMonthStartTimestamp
} from './fee-history'

function lifetimeEarnings(grossGainsUsd: string, lossesUsd: string, netYieldUsd: string): LifetimeEarnings {
  return {
    methodologyVersion: 'yearn-data-eod-1',
    definition: 'incident-adjusted-net-strategy-pnl',
    scope: 'yearn-data-comparable',
    priceBasis: 'canonical-utc-eod',
    includedContractFamilies: ['yearn-v2-vault', 'yearn-v3-allocator'],
    excludedFeeEventCount: 0,
    reportCount: 1,
    pricedReportCount: 1,
    unpricedReportCount: 0,
    incidentAdjustedReportCount: 0,
    rawGrossGainsUsd: grossGainsUsd,
    rawLossesUsd: lossesUsd,
    rawNetYieldUsd: netYieldUsd,
    grossGainsUsd,
    lossesUsd,
    netYieldUsd
  }
}

function historyBucket(
  period: string,
  totalFeesPaidUsd: string,
  grossGainsUsd: string,
  lossesUsd: string,
  netYieldUsd: string
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
    lifetimeEarnings: lifetimeEarnings(grossGainsUsd, lossesUsd, netYieldUsd),
    tokenizedStrategyYield: {
      methodologyVersion: 'tokenized-strategy-reported-pnl-1',
      definition: 'v3-tokenized-strategy-reported-pnl',
      scope: 'v3-tokenized-strategies',
      priceBasis: 'canonical-utc-eod',
      includedContractFamilies: ['yearn-v3-tokenized-strategy'],
      reportCount: 0,
      pricedReportCount: 0,
      unpricedReportCount: 0,
      grossGainsUsd: '0',
      lossesUsd: '0',
      netYieldUsd: '0'
    },
    canonicalEventCount: 1,
    zeroFeeReportCount: 0,
    unpricedEventCount: 0
  }
}

describe('buildFeeHistorySeries', () => {
  it('converts canonical decimal strings only when building chart data', () => {
    const buckets = [
      historyBucket('2026-01', '10.5', '100.25', '20', '80.25'),
      historyBucket('2026-02', '30.75', '250.5', '50', '200.5')
    ]

    expect(buildFeeHistorySeries(buckets)).toEqual([
      {
        period: '2026-01',
        grossGainsUsd: 100.25,
        netYieldUsd: 80.25,
        totalFeesPaidUsd: 10.5,
        cumulativeGrossGainsUsd: 100.25,
        cumulativeNetYieldUsd: 80.25,
        cumulativeFeesPaidUsd: 10.5
      },
      {
        period: '2026-02',
        grossGainsUsd: 250.5,
        netYieldUsd: 200.5,
        totalFeesPaidUsd: 30.75,
        cumulativeGrossGainsUsd: 350.75,
        cumulativeNetYieldUsd: 280.75,
        cumulativeFeesPaidUsd: 41.25
      }
    ])
  })

  it('preserves unavailable and invalid decimal values as null', () => {
    expect(canonicalDecimalToNumber(null)).toBeNull()
    expect(canonicalDecimalToNumber('not-a-number')).toBeNull()
    expect(canonicalDecimalToNumber('0')).toBe(0)
  })

  it('aligns timestamps to the start of their UTC month', () => {
    const timestamp = Date.parse('2026-08-04T16:00:00Z') / 1000
    expect(utcMonthStartTimestamp(timestamp)).toBe(Date.parse('2026-08-01T00:00:00Z') / 1000)
  })

  it('keeps only completed calendar-month buckets', () => {
    const buckets = [
      historyBucket('2026-06', '10', '100', '20', '80'),
      historyBucket('2026-07', '20', '200', '40', '160'),
      historyBucket('2026-08', '30', '300', '60', '240')
    ]
    const currentMonthStart = Date.parse('2026-08-01T00:00:00Z') / 1000

    expect(completedMonthlyBuckets(buckets, currentMonthStart).map((bucket) => bucket.period)).toEqual([
      '2026-06',
      '2026-07'
    ])
  })
})
