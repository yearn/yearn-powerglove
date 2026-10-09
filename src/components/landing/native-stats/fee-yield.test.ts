import { describe, expect, it } from 'vitest'
import type { FeeHistoryPoint } from './fee-history'
import { buildTvlYieldSeries, type DailyFeeTvlHistory } from './fee-yield'

const day = 86400
const start = Date.parse('2024-02-27T00:00:00Z') / 1000
function point(offset: number, days: number, fees: number | null): FeeHistoryPoint {
  return {
    period: '2024-02',
    startTimestamp: start + offset * day,
    endTimestamp: start + (offset + days) * day,
    totalFeesPaidUsd: fees,
    grossGainsUsd: null,
    netYieldUsd: null,
    cumulativeGrossGainsUsd: null,
    cumulativeNetYieldUsd: null,
    cumulativeFeesPaidUsd: null
  }
}
function history(values: Array<number | null>): DailyFeeTvlHistory {
  return {
    datasetId: 'tvl',
    interval: 'daily',
    chart: values.map((Ethereum, index) => ({ timestamp: start + (index + 1) * day - 1, Ethereum }))
  }
}

describe('annualized fees and earnings per dollar of average TVL', () => {
  it.each([7, 28, 29, 30, 31, 365, 366])(
    'annualizes a %i-day period on a 365-day basis without compounding',
    (days) => {
      const period = { ...point(0, days, days), netYieldUsd: -days }
      const daily = history(Array.from({ length: days }, () => 1000))
      const fees = buildTvlYieldSeries([period], daily)[0]
      const earnings = buildTvlYieldSeries([period], daily, undefined, 'earnings')[0]
      expect(fees.annualizedYieldPct).toBeCloseTo(36.5)
      expect(fees.cumulativeAnnualizedYieldPct).toBeCloseTo(36.5)
      expect(earnings.annualizedYieldPct).toBeCloseTo(-36.5)
      expect(earnings.cumulativeAnnualizedYieldPct).toBeCloseTo(-36.5)
      expect(fees.cumulativeDays).toBe(days)
    }
  )

  it('normalizes net earnings independently of fees, retaining losses and missing earnings', () => {
    const periods = [
      { ...point(0, 2, 10), netYieldUsd: 30 },
      { ...point(2, 1, 20), netYieldUsd: -50 }
    ]
    const data = buildTvlYieldSeries(periods, history([100, 100, 400]), undefined, 'earnings')
    expect(data.map((p) => p.amountUsd)).toEqual([30, -50])
    expect(data.map((p) => p.annualizedYieldPct)).toEqual([5475, -4562.5])
    expect(data[1].cumulativeAmountUsd).toBe(-20)
    expect(data[1].cumulativeAnnualizedYieldPct).toBeCloseTo(-1216.666666666667)
    expect(
      buildTvlYieldSeries(
        [{ ...point(0, 3, 12), netYieldUsd: null }],
        history([100, 200, 300]),
        undefined,
        'earnings'
      )[0].annualizedYieldPct
    ).toBeNull()
    expect(
      buildTvlYieldSeries(
        [{ ...point(0, 3, null), netYieldUsd: 0 }],
        history([100, 200, 300]),
        undefined,
        'earnings'
      )[0].annualizedYieldPct
    ).toBe(0)
  })

  it('uses the mean of daily closes over the same UTC fee period, including leap days', () => {
    const result = buildTvlYieldSeries([point(0, 3, 12)], history([100, 200, 300]))[0]
    expect(result.averageTvlUsd).toBe(200)
    expect(result.annualizedYieldPct).toBe(730)
    expect(result.coveredDays).toBe(3)
    expect(result.expectedDays).toBe(3)
  })

  it('preserves unknown fees and missing or invalid TVL instead of returning zero or a partial average', () => {
    const missingDay = history([100, 200, 300])
    missingDay.chart.splice(1, 1)
    const result = buildTvlYieldSeries([point(0, 3, 12)], missingDay)[0]
    expect(result.coveredDays).toBe(2)
    expect(result.averageTvlUsd).toBeNull()
    expect(result.annualizedYieldPct).toBeNull()
    for (const invalid of [null, NaN, Infinity, -100])
      expect(buildTvlYieldSeries([point(0, 3, 12)], history([100, invalid, 300]))[0].annualizedYieldPct).toBeNull()
    expect(buildTvlYieldSeries([point(0, 3, null)], history([100, 200, 300]))[0].annualizedYieldPct).toBeNull()
    expect(buildTvlYieldSeries([point(0, 3, 0)], history([100, 200, 300]))[0].annualizedYieldPct).toBe(0)
    expect(buildTvlYieldSeries([point(0, 3, 12)], history([0, 0, 0]))[0].annualizedYieldPct).toBeNull()
  })

  it('counts one latest observation per day and applies the selected chain without assuming absent chains have zero TVL', () => {
    const data = history([100, 200, 300])
    data.chart.forEach((row) => {
      row.Polygon = 100
    })
    data.chart.unshift({ timestamp: start + 3600, Ethereum: 9999, Polygon: 9999 })
    expect(buildTvlYieldSeries([point(0, 3, 12)], data)[0].averageTvlUsd).toBe(300)
    expect(buildTvlYieldSeries([point(0, 3, 12)], data, 'Ethereum')[0].averageTvlUsd).toBe(200)
    expect(buildTvlYieldSeries([point(0, 3, 12)], data, 'Sonic')[0].annualizedYieldPct).toBeNull()
  })

  it('recalculates cumulative yield using a day-weighted denominator rather than adding period percentages', () => {
    const data = buildTvlYieldSeries([point(0, 2, 10), point(2, 1, 20)], history([100, 100, 400]))
    expect(data.map((p) => p.annualizedYieldPct)).toEqual([1825, 1825])
    expect(data[1].cumulativeAverageTvlUsd).toBe(200)
    expect(data[1].cumulativeAmountUsd).toBe(30)
    expect(data[1].cumulativeDays).toBe(3)
    expect(data[1].cumulativeAnnualizedYieldPct).toBe(1825)
    expect(
      buildTvlYieldSeries([point(0, 2, null), point(2, 1, 20)], history([100, 100, 400]))[1]
        .cumulativeAnnualizedYieldPct
    ).toBeNull()
  })
})
