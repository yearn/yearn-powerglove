import { describe, expect, it } from 'vitest'
import { calculatePpsHistoricalApySeries, getTimeframeLimit } from '@/components/charts/chart-utils'

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
