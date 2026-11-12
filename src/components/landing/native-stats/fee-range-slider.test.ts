import { describe, expect, it } from 'vitest'
import type { CanonicalFeeHistoryBucket } from './canonical-fees'
import { feeRangeDate, feeRangeDay, feeSliderBounds, feeSliderTicks, feeSliderValues } from './fee-range-slider'

function bucket(period: string): CanonicalFeeHistoryBucket {
  return {
    period,
    totalFeesPaidUsd: null,
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
      netYieldUsd: null
    }
  }
}

describe('fee timeline bounds and selection', () => {
  const bounds = { start: '2020-12-28', end: '2026-10-04' }

  it('uses full-history bounds and excludes unfinished weeks without depending on the selection', () => {
    const history = [bucket('2026-10-05'), bucket('2020-12-28'), bucket('2026-09-28')]
    expect(feeSliderBounds(history, Date.parse('2026-10-07T12:00:00Z') / 1000)).toEqual(bounds)
    const selected = { start: '2025-01-15', end: '2025-02-10' }
    expect(feeSliderValues(bounds, selected)).toEqual([feeRangeDay(selected.start), feeRangeDay(selected.end)])
    expect(bounds).toEqual({ start: '2020-12-28', end: '2026-10-04' })
  })

  it('keeps the actual first weekly boundary when a week straddles two calendar months', () => {
    expect(feeSliderBounds([bucket('2020-11-30')], Date.parse('2020-12-07T00:00:00Z') / 1000)).toEqual({
      start: '2020-11-30',
      end: '2020-12-06'
    })
  })

  it('represents inclusive date endpoints in UTC across leap days and daylight-saving dates', () => {
    expect(feeRangeDate(feeRangeDay('2024-02-29') + 1)).toBe('2024-03-01')
    expect(feeRangeDate(feeRangeDay('2026-03-08') + 1)).toBe('2026-03-09')
    expect(feeSliderValues(bounds, null)).toEqual([feeRangeDay(bounds.start), feeRangeDay(bounds.end)])
    expect(feeSliderValues(bounds, { start: '2000-01-01', end: '2030-01-01' })).toEqual(feeSliderValues(bounds, null))
  })

  it('does not invent a timeline without completed history, and keeps tick labels away from the endpoints', () => {
    const now = Date.parse('2026-10-07T12:00:00Z') / 1000
    expect(feeSliderBounds([], now)).toBeNull()
    expect(feeSliderBounds([bucket('2026-10-05')], now)).toBeNull()
    const ticks = feeSliderTicks(bounds)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.every(({ position }) => position >= 15 && position <= 85)).toBe(true)
  })
  it('clamps short TVL selections to one year, or the complete available history when shorter', () => {
    const selected = { start: '2026-01-01', end: '2026-02-01' }
    const [start, end] = feeSliderValues(bounds, selected, 365)
    expect(end - start).toBe(365)
    expect(feeRangeDate(end)).toBe('2026-02-01')
    const short = { start: '2026-01-01', end: '2026-03-01' }
    expect(feeSliderValues(short, selected, 365)).toEqual(feeSliderValues(short, null))
    expect(feeSliderValues(bounds, selected)).toEqual([feeRangeDay(selected.start), feeRangeDay(selected.end)])
  })
})
