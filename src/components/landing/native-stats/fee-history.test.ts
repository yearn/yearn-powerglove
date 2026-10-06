import { describe, expect, it } from 'vitest'
import type { CanonicalFeeHistoryBucket, LifetimeEarnings } from './canonical-fees'
import {
  buildCumulativeFeeHistorySeries,
  buildFeeHistorySeries,
  canonicalDecimalToNumber,
  completedMonthlyBuckets,
  formatFeeHistoryTick,
  utcMonthStartTimestamp
} from './fee-history'

function lifetimeEarnings(grossGainsUsd: string, lossesUsd: string, netYieldUsd: string): LifetimeEarnings {
  return {
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
    lifetimeEarnings: lifetimeEarnings(grossGainsUsd, lossesUsd, netYieldUsd)
  }
}

describe('buildFeeHistorySeries', () => {
  it('accumulates published values without turning absent history into zero or nulling later totals', () => {
    const missing = { ...historyBucket('2026-01', '0', '0', '0', '0'), totalFeesPaidUsd: null }
    const known = historyBucket('2026-02', '10', '100', '0', '100')
    const laterMissing = { ...missing, period: '2026-03' }
    expect(buildFeeHistorySeries([missing, known, laterMissing]).map((row) => row.cumulativeFeesPaidUsd)).toEqual([
      null,
      10,
      10
    ])
  })

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
    expect(utcMonthStartTimestamp(timestamp, -12)).toBe(Date.parse('2025-08-01T00:00:00Z') / 1000)
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

describe('buildCumulativeFeeHistorySeries', () => {
  it('uses weekly timestamps and clips partial weeks to the selected year', () => {
    const since = Date.parse('2025-10-01T00:00:00Z') / 1000
    const until = Date.parse('2026-10-01T00:00:00Z') / 1000
    const weekly = buildFeeHistorySeries(
      [
        {
          ...historyBucket('2025-09-29', '10', '100', '20', '80'),
          startTimestamp: Date.parse('2025-09-29T00:00:00Z') / 1000,
          endTimestamp: Date.parse('2025-10-06T00:00:00Z') / 1000
        },
        {
          ...historyBucket('2026-09-28', '20', '200', '40', '160'),
          startTimestamp: Date.parse('2026-09-28T00:00:00Z') / 1000,
          endTimestamp: Date.parse('2026-10-05T00:00:00Z') / 1000
        }
      ],
      { since, until }
    )
    const cumulative = buildCumulativeFeeHistorySeries(weekly)
    expect(weekly[0].startTimestamp).toBe(since)
    expect(weekly[1].endTimestamp).toBe(until)
    expect(cumulative.map((point) => point.period)).toEqual(['2025-10-01', '2025-10-06', '2026-10-01'])
    expect(cumulative.map((point) => point.cumulativeFeesPaidUsd)).toEqual([0, 10, 30])
    expect(cumulative.map((point) => point.cumulativeNetYieldUsd)).toEqual([0, 80, 240])
  })

  it('labels weekly points with the day and keeps monthly tick labels unchanged', () => {
    expect(formatFeeHistoryTick('2025-10-06', 'weekly')).toBe('Oct 6')
    expect(formatFeeHistoryTick('2025-10-01', 'monthly')).toBe('2025-10')
  })

  it('spans all twelve completed months from an opening zero to the final total', () => {
    const buckets = Array.from({ length: 12 }, (_, month) =>
      historyBucket(`2025-${String(month + 1).padStart(2, '0')}`, '10', '100', '20', '80')
    )
    const monthly = buildFeeHistorySeries(buckets)
    const cumulative = buildCumulativeFeeHistorySeries(monthly)

    expect(cumulative).toHaveLength(13)
    expect(cumulative[0]).toEqual({
      period: '2025-01-01',
      grossGainsUsd: null,
      netYieldUsd: null,
      totalFeesPaidUsd: null,
      cumulativeGrossGainsUsd: 0,
      cumulativeNetYieldUsd: 0,
      cumulativeFeesPaidUsd: 0
    })
    expect(cumulative[1]).toMatchObject({ period: '2025-02-01', cumulativeNetYieldUsd: 80 })
    expect(cumulative[12]).toMatchObject({
      period: '2026-01-01',
      cumulativeGrossGainsUsd: 1200,
      cumulativeNetYieldUsd: 960,
      cumulativeFeesPaidUsd: 120
    })
    expect(monthly).toHaveLength(12)
    expect(monthly[0]).toMatchObject({ period: '2025-01', netYieldUsd: 80, totalFeesPaidUsd: 10 })
  })

  it('does not invent zero-valued evidence for missing history or unavailable fees', () => {
    expect(buildCumulativeFeeHistorySeries([])).toEqual([])
    const missing = { ...historyBucket('2026-01', '0', '100', '20', '80'), totalFeesPaidUsd: null }
    const cumulative = buildCumulativeFeeHistorySeries(buildFeeHistorySeries([missing]))
    expect(cumulative.map((point) => point.cumulativeFeesPaidUsd)).toEqual([null, null])
    expect(cumulative.map((point) => point.cumulativeNetYieldUsd)).toEqual([0, 80])
  })
})
