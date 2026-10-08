import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChainFeeHistoryCharts } from './ChainFeeHistoryCharts'
import type { CanonicalFeeHistoryBucket } from './canonical-fees'

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 640, height: 300 })
}))

vi.mock('./useChainFeeHistories', () => ({
  useChainFeeHistories: () => ({ data: histories, loading: false, error: false, retry: vi.fn() })
}))

function bucket(period: string, amount: number): CanonicalFeeHistoryBucket {
  return {
    period,
    totalFeesPaidUsd: '10',
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
      netYieldUsd: String(amount)
    }
  }
}

const periods = ['2026-01', '2026-02', '2026-03'].map((period) => ({ period }))
const histories = [
  { chainId: 1, history: { interval: 'monthly', buckets: periods.map(({ period }) => bucket(period, 100)) } },
  {
    chainId: 137,
    history: {
      interval: 'monthly',
      buckets: periods.map(({ period }, index) => bucket(period, index === 1 ? -0.000005 : 0))
    }
  },
  {
    chainId: 42161,
    history: { interval: 'monthly', buckets: periods.map(({ period }, index) => bucket(period, [-20, 0, 10][index])) }
  }
]

afterEach(cleanup)

describe('chain fee chart stacking', () => {
  it('defaults to signed stacked bars and preserves hidden series when switching to lines', () => {
    const props = {
      query: 'interval=monthly',
      chainIds: [1, 137, 42161],
      periods,
      view: 'periodic' as const,
      interval: 'monthly' as const
    }
    const rendered = render(<ChainFeeHistoryCharts {...props} />)
    const chart = screen.getByRole('heading', { name: 'Earnings by Chain' }).closest('.fee-chart-card') as HTMLElement
    const groups = chart.querySelectorAll('.recharts-bar')
    expect(groups).toHaveLength(3)
    const positive = groups[0].querySelector('.recharts-bar-rectangle path')
    const loss = groups[2].querySelector('.recharts-bar-rectangle path')
    if (!positive || !loss) throw new Error('Signed bars not rendered')
    // The -20 contribution starts at the preceding 100 boundary and ends at 80.
    const lossHeight = Number(loss.getAttribute('height'))
    expect(Number(loss.getAttribute('y')) + lossHeight).toBeCloseTo(Number(positive.getAttribute('y')), 2)
    expect(lossHeight).toBeLessThan(0)
    expect(Math.abs(lossHeight)).toBeLessThan(Number(positive.getAttribute('height')))
    fireEvent.click(within(chart).getByRole('button', { name: 'Polygon' }))
    expect(chart.querySelectorAll('.recharts-bar')).toHaveLength(2)
    rendered.rerender(<ChainFeeHistoryCharts {...props} renderType="line" />)
    expect(chart.querySelectorAll('.recharts-area-curve')).toHaveLength(2)
    expect(within(chart).getByRole('button', { name: 'Polygon' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('subtracts losses within the stack and keeps tiny negatives beside the preceding boundary', () => {
    render(
      <ChainFeeHistoryCharts
        query="interval=monthly"
        chainIds={[1, 137, 42161]}
        periods={periods}
        view="periodic"
        interval="monthly"
        renderType="line"
      />
    )
    const chart = screen.getByRole('heading', { name: 'Earnings by Chain' }).closest('.fee-chart-card')
    if (!chart) throw new Error('Earnings chart not rendered')
    const paths = [...chart.querySelectorAll('.recharts-area-curve')]
    expect(paths).toHaveLength(3)
    const ys = paths.map((path) =>
      [...(path.getAttribute('d') ?? '').matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((match) => Number(match[2]))
    )
    expect(ys[0]).toHaveLength(3)
    // Polygon's zero/tiny loss remains at Ethereum's boundary, rather than falling to zero.
    expect(ys[1][0]).toBeCloseTo(ys[0][0], 2)
    expect(ys[1][1]).toBeCloseTo(ys[0][1], 2)
    expect(ys[1][2]).toBeCloseTo(ys[0][2], 2)
    const zero = [...chart.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value')].find(
      (tick) => tick.textContent === '$0'
    )
    if (!zero) throw new Error('Zero tick not rendered')
    const zeroY = Number(zero.getAttribute('y'))
    // 100 + 0 - 20 = 80: the final stack boundary is lower, but still above zero.
    expect(ys[2][0]).toBeGreaterThan(ys[1][0])
    expect(ys[2][0]).toBeLessThan(zeroY)
    expect(ys[2][1]).toBeCloseTo(ys[1][1], 2)
    // A later gain raises the final boundary again.
    expect(ys[2][2]).toBeLessThan(ys[1][2])
  })
})
