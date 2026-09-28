import { describe, expect, it } from 'vitest'
import {
  buildStackedTvlData,
  type ChainTvlSeries,
  downsampleStackedRows,
  getLatestTvlByChain,
  getProtocolTvlPointLimit,
  mapDefiLlamaToChainSeries
} from '@/lib/protocol-tvl'

const DAY = 86400

describe('mapDefiLlamaToChainSeries', () => {
  it('keeps known chains, skips unknown, sorts points ascending', () => {
    const raw = {
      chainTvls: {
        Ethereum: {
          tvl: [
            { date: 200, totalLiquidityUSD: 5 },
            { date: 100, totalLiquidityUSD: 3 }
          ]
        },
        Sepolia: { tvl: [{ date: 1, totalLiquidityUSD: 9 }] }, // unknown -> dropped
        Polygon: { tvl: [{ date: 10, totalLiquidityUSD: 2 }] }
      }
    }
    const series = mapDefiLlamaToChainSeries(raw)
    const names = series.map((s) => s.chainId).sort()
    expect(names).toEqual([1, 137])
    const eth = series.find((s) => s.chainId === 1)
    expect(eth?.points.map((p) => p.time)).toEqual([100, 200])
  })

  it('ignores non-finite values', () => {
    const raw = {
      chainTvls: {
        Ethereum: {
          tvl: [
            { date: 1, totalLiquidityUSD: 1 },
            { date: 2, totalLiquidityUSD: Number.NaN },
            { date: 3, totalLiquidityUSD: 4 }
          ]
        }
      }
    }
    const series = mapDefiLlamaToChainSeries(raw)
    expect(series[0].points).toHaveLength(2)
  })

  it('handles empty / malformed input', () => {
    expect(mapDefiLlamaToChainSeries({})).toEqual([])
    expect(mapDefiLlamaToChainSeries({ chainTvls: {} })).toEqual([])
  })
})

describe('getLatestTvlByChain', () => {
  const series: ChainTvlSeries[] = [
    {
      chainId: 1,
      name: 'Ethereum',
      color: '#627EEA',
      points: [
        { time: 1, tvl: 100 },
        { time: 2, tvl: 150 }
      ]
    },
    {
      chainId: 8453,
      name: 'Base',
      color: '#0052FF',
      points: [
        { time: 1, tvl: 10 },
        { time: 2, tvl: 40 }
      ]
    },
    { chainId: 137, name: 'Polygon', color: '#8247E5', points: [{ time: 1, tvl: 0 }] } // zero last -> dropped
  ]

  it('takes the last point per chain, drops zero, sorts by TVL desc', () => {
    const result = getLatestTvlByChain(series)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ chainId: 1, tvl: 150 })
    expect(result[1]).toMatchObject({ chainId: 8453, tvl: 40 })
  })

  it('returns empty for no series', () => {
    expect(getLatestTvlByChain([])).toEqual([])
  })
})

describe('buildStackedTvlData', () => {
  const series: ChainTvlSeries[] = [
    {
      chainId: 1,
      name: 'Ethereum',
      color: '#627EEA',
      points: [
        { time: 0, tvl: 100 },
        { time: DAY, tvl: 110 },
        { time: 2 * DAY, tvl: 120 }
      ]
    },
    {
      chainId: 8453,
      name: 'Base',
      color: '#0052FF',
      // Base starts later (no point at t=0): pre-inception must read 0.
      points: [
        { time: DAY, tvl: 10 },
        { time: 2 * DAY, tvl: 20 }
      ]
    }
  ]

  it('aligns on shared time index, zeroes pre-inception, computes totals', () => {
    const rows = buildStackedTvlData(series, 'all')
    expect(rows.map((r) => r.time)).toEqual([0, DAY, 2 * DAY])
    expect(rows[0]).toMatchObject({ Ethereum: 100, Base: 0, total: 100 })
    expect(rows[1]).toMatchObject({ Ethereum: 110, Base: 10, total: 120 })
    expect(rows[2]).toMatchObject({ Ethereum: 120, Base: 20, total: 140 })
  })

  it('respects timeframe by keeping only the last N points', () => {
    const rows = buildStackedTvlData(series, '90d')
    // 90d limit > 3 points, so all kept
    expect(rows).toHaveLength(3)
  })

  it('returns empty for no series', () => {
    expect(buildStackedTvlData([], 'all')).toEqual([])
  })
})

describe('downsampleStackedRows', () => {
  it('keeps rows unchanged when under the cap', () => {
    const rows = [
      { time: 0, total: 10, A: 10 },
      { time: 1, total: 20, A: 20 }
    ]
    expect(downsampleStackedRows(rows, 400)).toBe(rows)
  })

  it('reduces to roughly maxPoints and preserves first/last timestamps', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      time: i,
      total: i,
      A: i,
      B: 0
    }))
    const out = downsampleStackedRows(rows, 100)
    expect(out.length).toBeLessThanOrEqual(100)
    expect(out.length).toBeGreaterThan(80)
    expect(out[0].time).toBe(0)
    expect(out[out.length - 1].time).toBe(999)
  })

  it('re-sums totals from surviving chain values on sampled rows', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      time: i,
      total: i * 3,
      A: i,
      B: i * 2
    }))
    const out = downsampleStackedRows(rows, 50)
    for (const row of out) {
      expect(row.total).toBe(row.A + row.B)
    }
  })
})

describe('getProtocolTvlPointLimit', () => {
  it('maps known timeframes', () => {
    expect(getProtocolTvlPointLimit('30d')).toBe(30)
    expect(getProtocolTvlPointLimit('90d')).toBe(90)
    expect(getProtocolTvlPointLimit('1y')).toBe(365)
    expect(getProtocolTvlPointLimit('all')).toBe(Number.POSITIVE_INFINITY)
  })
})
