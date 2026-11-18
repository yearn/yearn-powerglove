import { describe, expect, it } from 'vitest'
import { defaultFeeTimeRange, resolveFeeTimeframe } from './fee-timeframe'

const now = Date.parse('2026-10-06T18:00:00Z') / 1000

describe('fee chart timeframe', () => {
  it('defaults to the last four calendar years ending with a completed UTC week', () => {
    expect(defaultFeeTimeRange(now)).toEqual({ start: '2022-10-04', end: '2026-10-04' })
    expect(resolveFeeTimeframe(defaultFeeTimeRange(now), now)).toEqual({
      since: Date.parse('2022-10-04T00:00:00Z') / 1000,
      until: Date.parse('2026-10-05T00:00:00Z') / 1000,
      interval: 'monthly'
    })
    expect(defaultFeeTimeRange(Date.parse('2026-10-04T23:59:59Z') / 1000)).toEqual({
      start: '2022-09-27',
      end: '2026-09-27'
    })
    expect(defaultFeeTimeRange(Date.parse('2026-10-05T00:00:00Z') / 1000)).toEqual({
      start: '2022-10-04',
      end: '2026-10-04'
    })
  })

  it('preserves the completed-year and all-time presets', () => {
    expect(resolveFeeTimeframe('1y', now)).toEqual({
      since: Date.parse('2025-10-01T00:00:00Z') / 1000,
      until: Date.parse('2026-10-01T00:00:00Z') / 1000,
      interval: 'weekly'
    })
    expect(resolveFeeTimeframe('all', now)).toEqual({
      since: undefined,
      until: Date.parse('2026-10-01T00:00:00Z') / 1000,
      interval: 'monthly'
    })
  })

  it('includes the full selected end date without rounding partial weeks or months', () => {
    expect(resolveFeeTimeframe({ start: '2026-01-15', end: '2026-02-10' }, now)).toEqual({
      since: Date.parse('2026-01-15T00:00:00Z') / 1000,
      until: Date.parse('2026-02-11T00:00:00Z') / 1000,
      interval: 'weekly'
    })
  })

  it('allows one-day ranges across daylight-saving changes and leap days using UTC', () => {
    for (const day of ['2026-03-08', '2024-02-29']) {
      const result = resolveFeeTimeframe({ start: day, end: day }, now)
      expect(result.since).toBe(Date.parse(`${day}T00:00:00Z`) / 1000)
      expect(result.until - (result.since ?? 0)).toBe(86400)
      expect(result.interval).toBe('weekly')
    }
  })

  it('uses monthly buckets for custom ranges longer than a year', () => {
    const range = resolveFeeTimeframe({ start: '2024-01-15', end: '2026-09-20' }, now)
    expect(range.interval).toBe('monthly')
    expect(range.until).toBe(Date.parse('2026-09-21T00:00:00Z') / 1000)
  })
})
