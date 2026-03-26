import { describe, expect, it } from 'vitest'
import { calculatePpsPeriodApy } from '@/components/charts/chart-utils'

describe('calculatePpsPeriodApy', () => {
  it('annualizes PPS growth over the selected timeframe', () => {
    const data = [
      { time: 0, PPS: 100 },
      { time: 86400 * 29, PPS: 110 },
    ]

    const expected = ((110 / 100) ** (365 / 29) - 1) * 100

    expect(calculatePpsPeriodApy(data, '30d')).toBeCloseTo(expected)
  })

  it('returns null when there are not enough valid PPS points', () => {
    const data = [{ time: 0, PPS: 100 }]

    expect(calculatePpsPeriodApy(data, '30d')).toBeNull()
  })

  it('ignores points without PPS values or timestamps', () => {
    const data = [
      { time: undefined, PPS: 100 },
      { time: 86400, PPS: null },
      { time: 86400 * 2, PPS: 100 },
      { time: 86400 * 32, PPS: 105 },
    ]

    const expected = ((105 / 100) ** (365 / 30) - 1) * 100

    expect(calculatePpsPeriodApy(data, '30d')).toBeCloseTo(expected)
  })
})
