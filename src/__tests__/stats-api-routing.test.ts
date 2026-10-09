import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStatsApiLane, resolveStatsApiBase } from '@/components/landing/native-stats/hooks'

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
    expect(getStatsApiLane('/api/tvl/graph')).toBe('tvl')
  })
})

describe('hosted stats origin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses the same-origin data proxy for core views on shareable hosts', () => {
    vi.stubGlobal('window', { location: { hostname: 'powerglove-preview.vercel.app' } })
    vi.stubEnv('VITE_PUBLIC_YEARN_DATA_API_URL', '')
    vi.stubEnv('VITE_PUBLIC_YEARN_TVL_API_URL', 'https://old-tvl.example')
    expect(resolveStatsApiBase('tvl')).toBe('')
    expect(resolveStatsApiBase('fees')).toBe('')
    expect(resolveStatsApiBase('tvl-analytics')).toBe('https://old-tvl.example')
  })

  it('supports an explicitly configured public data API', () => {
    vi.stubGlobal('window', { location: { hostname: 'powerglove-preview.vercel.app' } })
    vi.stubEnv('VITE_PUBLIC_YEARN_DATA_API_URL', 'https://data.example/')
    expect(resolveStatsApiBase('tvl')).toBe('https://data.example')
  })
})
