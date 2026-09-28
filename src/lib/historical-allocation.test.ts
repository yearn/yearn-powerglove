import { describe, expect, it } from 'vitest'
import {
  buildHistoricalAllocationSeries,
  filterAllocationPoints,
  selectVisibleStrategies,
  type VaultReportEvent
} from '@/lib/historical-allocation'

const report = (
  overrides: Partial<VaultReportEvent> & { strategy: string; currentDebt: string; blockTime: string }
): VaultReportEvent => ({
  currentDebtUsd: null,
  aprNet: null,
  blockNumber: 1,
  logIndex: 0,
  transactionHash: '0x0',
  eventName: 'StrategyReported',
  ...overrides
})

describe('buildHistoricalAllocationSeries', () => {
  it('returns an empty series when there are no usable reports', () => {
    const result = buildHistoricalAllocationSeries([])
    expect(result.points).toEqual([])
    expect(result.strategies).toEqual([])
    expect(result.reportCount).toBe(0)
  })

  it('drops reports with missing or non-numeric debt', () => {
    const result = buildHistoricalAllocationSeries([
      report({ strategy: '0xaaa', currentDebt: 'not-a-number', blockTime: '1000' }),
      report({ strategy: '0xbbb', currentDebt: '', blockTime: '1000' })
    ])
    expect(result.points).toEqual([])
  })

  it('reconstructs per-strategy share of total debt at each report block', () => {
    const result = buildHistoricalAllocationSeries([
      report({ strategy: '0xAaAa', currentDebt: '100', blockTime: '1000', logIndex: 1 }),
      report({ strategy: '0xBbBb', currentDebt: '300', blockTime: '2000', logIndex: 1 }),
      report({ strategy: '0xAaAa', currentDebt: '100', blockTime: '3000', logIndex: 1 })
    ])

    expect(result.points).toHaveLength(3)

    // First snapshot: only strategy A reported -> A owns 100%.
    expect(result.points[0]!['0xaaaa']).toBe(100)

    // Second snapshot: A=100, B=300 -> A=25%, B=75%.
    expect(result.points[1]!['0xaaaa']).toBe(25)
    expect(result.points[1]!['0xbbbb']).toBe(75)

    // Shares are stable when nothing changes.
    expect(result.points[2]!['0xaaaa']).toBe(25)
    expect(result.points[2]!['0xbbbb']).toBe(75)

    // Strategies ordered by latest share descending (largest band first).
    expect(result.strategies.map((s) => s.key)).toEqual(['0xbbbb', '0xaaaa'])
    expect(result.strategies[0]!.latestSharePct).toBe(75)
    expect(result.strategies[1]!.peakSharePct).toBe(100)
  })

  it('collapses multiple reports in the same block into one snapshot', () => {
    const result = buildHistoricalAllocationSeries([
      report({ strategy: '0xAaAa', currentDebt: '100', blockTime: '1000', logIndex: 1 }),
      report({ strategy: '0xBbBb', currentDebt: '100', blockTime: '1000', logIndex: 2 })
    ])

    expect(result.points).toHaveLength(1)
    expect(result.points[0]!['0xaaaa']).toBe(50)
    expect(result.points[0]!['0xbbbb']).toBe(50)
  })

  it('uses resolved names and falls back to a truncated address', () => {
    const result = buildHistoricalAllocationSeries(
      [report({ strategy: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa', currentDebt: '10', blockTime: '1000' })],
      { '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': { name: 'USDC Lender' } }
    )

    expect(result.strategies[0]!.label).toBe('USDC Lender')

    const fallback = buildHistoricalAllocationSeries([
      report({ strategy: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa', currentDebt: '10', blockTime: '1000' })
    ])
    expect(fallback.strategies[0]!.label).toBe('0xaaaa…aaaa')
  })
})

describe('filterAllocationPoints', () => {
  const DAY = 24 * 60 * 60 * 1000
  const points = [
    { time: 0 * DAY, date: 'd0', tooltipDate: 'd0', totalDebtUsd: null },
    { time: 20 * DAY, date: 'd20', tooltipDate: 'd20', totalDebtUsd: null },
    { time: 40 * DAY, date: 'd40', tooltipDate: 'd40', totalDebtUsd: null },
    { time: 100 * DAY, date: 'd100', tooltipDate: 'd100', totalDebtUsd: null }
  ]

  it('returns every point for "all"', () => {
    expect(filterAllocationPoints(points, 'all')).toHaveLength(4)
  })

  it('anchors the window to the latest point, not "now"', () => {
    // Latest point is at day 100; a 30d window keeps only day 100.
    const filtered = filterAllocationPoints(points, '30d')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.time).toBe(100 * DAY)
  })

  it('keeps the trailing 90 days relative to the latest point', () => {
    // Latest point is day 100 -> cutoff is day 10, so day 20/40/100 are kept.
    const filtered = filterAllocationPoints(points, '90d')
    expect(filtered.map((p) => p.time)).toEqual([20 * DAY, 40 * DAY, 100 * DAY])
  })

  it('returns an empty array unchanged', () => {
    expect(filterAllocationPoints([], '30d')).toEqual([])
  })
})

describe('selectVisibleStrategies', () => {
  const points = [
    { time: 1, date: 'a', tooltipDate: 'a', totalDebtUsd: null, '0xaaaa': 90, '0xbbbb': 10, '0xcccc': 0 },
    { time: 2, date: 'b', tooltipDate: 'b', totalDebtUsd: null, '0xaaaa': 100, '0xbbbb': 0, '0xcccc': 0 }
  ]
  const strategies = [
    {
      key: '0xaaaa',
      label: 'A',
      color: '#000',
      latestSharePct: 100,
      peakSharePct: 100,
      latestDebtUsd: null,
      reportCount: 1
    },
    {
      key: '0xbbbb',
      label: 'B',
      color: '#111',
      latestSharePct: 0,
      peakSharePct: 10,
      latestDebtUsd: null,
      reportCount: 1
    },
    {
      key: '0xcccc',
      label: 'C',
      color: '#222',
      latestSharePct: 0,
      peakSharePct: 0,
      latestDebtUsd: null,
      reportCount: 1
    }
  ]

  it('keeps strategies with a non-trivial share in the window and drops flat-zero ones', () => {
    const visible = selectVisibleStrategies(points, strategies)
    expect(visible.map((s) => s.key)).toEqual(['0xaaaa', '0xbbbb'])
    // Same object references => stable colors/labels preserved.
    expect(visible[0]).toBe(strategies[0])
  })

  it('returns nothing for an empty window', () => {
    expect(selectVisibleStrategies([], strategies)).toEqual([])
  })
})
