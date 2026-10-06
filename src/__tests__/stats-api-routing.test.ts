import { describe, expect, it } from 'vitest'
import { getStatsApiLane } from '@/components/landing/native-stats/hooks'

describe('stats API routing', () => {
  it('routes fee and profitability endpoints to the fees service', () => {
    expect(getStatsApiLane('/api/fees')).toBe('fees')
    expect(getStatsApiLane('/api/fees/history?interval=monthly')).toBe('fees')
    expect(getStatsApiLane('/api/profitability')).toBe('fees')
  })

  it('keeps TVL, comparison, and audit endpoints on the TVL service', () => {
    expect(getStatsApiLane('/api/tvl')).toBe('tvl')
    expect(getStatsApiLane('/api/comparison')).toBe('tvl')
    expect(getStatsApiLane('/api/audit/tree')).toBe('tvl')
  })
})
