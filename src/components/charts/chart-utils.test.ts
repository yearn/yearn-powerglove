import { describe, expect, it } from 'vitest'
import {
  calculatePpsHistoricalApySeries,
  filterChartTimeframe,
  getTimeframeLimit
} from '@/components/charts/chart-utils'

describe('getTimeframeLimit', () => {
  it('includes both endpoints for fixed-day chart windows', () => {
    expect(getTimeframeLimit('30d')).toBe(31)
    expect(getTimeframeLimit('90d')).toBe(91)
    expect(getTimeframeLimit('180d')).toBe(181)
    expect(getTimeframeLimit('1y')).toBe(366)
  })

  it('does not cap the all-time chart window', () => {
    expect(getTimeframeLimit('all')).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('calculatePpsHistoricalApySeries', () => {
  it('calculates each rolling PPS timeframe at every available chart date', () => {
    const data = Array.from({ length: 366 }, (_, day) => ({
      date: `day-${day}`,
      time: day * 86400,
      PPS: day === 365 ? 110 : 100
    }))

    const result = calculatePpsHistoricalApySeries(data)
    const latest = result[365]

    expect(result).toHaveLength(366)
    expect(latest.pps90DayApy).toBeCloseTo(((110 / 100) ** (365 / 90) - 1) * 100)
    expect(latest.pps180DayApy).toBeCloseTo(((110 / 100) ** (365 / 180) - 1) * 100)
    expect(latest.ppsOneYearApy).toBeCloseTo(10)
    expect(latest.ppsAllTimeApy).toBeCloseTo(10)
  })

  it('keeps incomplete rolling periods unavailable while building all-time history', () => {
    const data = [
      { date: 'first', time: 0, PPS: 100 },
      { date: 'latest', time: 29 * 86400, PPS: 102 }
    ]

    const result = calculatePpsHistoricalApySeries(data)
    const latest = result[1]

    expect(result[0].ppsAllTimeApy).toBeNull()
    expect(latest.pps90DayApy).toBeNull()
    expect(latest.pps180DayApy).toBeNull()
    expect(latest.ppsOneYearApy).toBeNull()
    expect(latest.ppsAllTimeApy).toBeCloseTo(((102 / 100) ** (365 / 29) - 1) * 100)
  })

  it('ignores invalid PPS points and sorts valid observations by timestamp', () => {
    const data = [
      { date: 'latest', time: 32 * 86400, PPS: 105 },
      { date: 'missing-time', time: undefined, PPS: 100 },
      { date: 'missing-pps', time: 86400, PPS: null },
      { date: 'first', time: 2 * 86400, PPS: 100 }
    ]

    const result = calculatePpsHistoricalApySeries(data)
    const expected = ((105 / 100) ** (365 / 30) - 1) * 100

    expect(result.map((point) => point.date)).toEqual(['first', 'latest'])
    expect(result[1].ppsAllTimeApy).toBeCloseTo(expected)
  })

  it('returns an unavailable starting point when only one valid observation exists', () => {
    expect(calculatePpsHistoricalApySeries([{ date: 'first', time: 0, PPS: 100 }])).toEqual([
      {
        date: 'first',
        pps90DayApy: null,
        pps180DayApy: null,
        ppsOneYearApy: null,
        ppsAllTimeApy: null
      }
    ])
  })
})

describe('filterChartTimeframe', () => {
  it('includes both calendar boundaries across ISO and formatted chart dates, even with gaps', () => {
    const data = ['Dec 31, 2024', 'Jan 1, 2025', '2025-01-14', 'Jan 31, 2025', 'Feb 1, 2025', 'Invalid date'].map(
      (date) => ({ date })
    )
    expect(filterChartTimeframe(data, { start: '2025-01-01', end: '2025-01-31' })).toEqual(data.slice(1, 4))
    expect(filterChartTimeframe(data, { start: '2025-01-14', end: '2025-01-14' })).toEqual([data[2]])
    expect(filterChartTimeframe(data, { start: '2020-01-01', end: '2020-12-31' })).toEqual([])
  })

  it('does not truncate a custom range longer than the preset windows or 1000 rows', () => {
    const data = Array.from({ length: 1500 }, (_, day) => ({
      date: new Date(Date.UTC(2020, 0, day + 1)).toISOString().slice(0, 10)
    }))
    expect(filterChartTimeframe(data, { start: data[0].date, end: data[1499].date })).toHaveLength(1500)
    expect(filterChartTimeframe(data, 'all')).toHaveLength(1500)
    expect(filterChartTimeframe(data, '30d')).toEqual(data.slice(-31))
  })
})
