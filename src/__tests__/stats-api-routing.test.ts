import { describe, expect, it } from 'vitest'
import { getStatsApiLane } from '@/components/landing/native-stats/hooks'

describe('stats API routing', () => {
  it('routes core fees and prepared financial analytics to yearn-data', () => {
    expect(getStatsApiLane('/api/fees')).toBe('fees')
    expect(getStatsApiLane('/api/fees/history?interval=monthly')).toBe('fees')
    expect(getStatsApiLane('/api/fees/vaults?chainId=1')).toBe('fees')
    expect(getStatsApiLane('/api/fees/stack')).toBe('fees')
    expect(getStatsApiLane('/api/profitability')).toBe('fees')
  })

  it('routes migrated TVL views to yearn-data and retains supplementary analytics', () => {
    expect(getStatsApiLane('/api/tvl')).toBe('tvl')
    expect(getStatsApiLane('/api/comparison')).toBe('tvl')
    expect(getStatsApiLane('/api/audit/tree')).toBe('tvl')
    expect(getStatsApiLane('/api/tvl/history/runs/latest/constant-price')).toBe('tvl')
    expect(getStatsApiLane('/api/tvl/curation-products')).toBe('tvl')
    expect(getStatsApiLane('/api/comparison/defillama-comparable')).toBe('tvl')
    expect(getStatsApiLane('/api/analytics/publication')).toBe('tvl')
    expect(getStatsApiLane('/api/tvl/graph')).toBe('tvl-analytics')
  })
})
