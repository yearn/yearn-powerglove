import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ChainTvlHistory } from './ChainTvlHistory'

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Container,
    ComposedChart: ({ data }: { data: unknown }) => <output data-testid="chart">{JSON.stringify(data)}</output>,
    Area: Container,
    Bar: Container,
    CartesianGrid: Container,
    Line: Container,
    Tooltip: Container,
    XAxis: Container,
    YAxis: Container
  }
})
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: () => ({
    data: {
      meta: { topSeries: ['Vault'], referenceWindowPoints: 1 },
      actualChart: [
        { timestamp: 10, Vault: 100 },
        { timestamp: 20, Vault: 200 }
      ],
      constantPriceChart: [
        { timestamp: 10, Vault: 90 },
        { timestamp: 20, Vault: 180 },
        { timestamp: 30, Vault: 270 }
      ]
    },
    loading: false,
    error: null
  })
}))
afterEach(cleanup)
it('keeps the price-neutral overlay within the selected actual history', () => {
  render(
    <ChainTvlHistory
      chainId={1}
      chainLabel="Ethereum"
      allTimeRange={{ from: 10, to: 30 }}
      selectedRange={{ from: 10, to: 10 }}
      renderType="line"
    />
  )
  const rows = JSON.parse(screen.getByTestId('chart').textContent!)
  expect(rows).toHaveLength(1)
  expect(rows[0].timestamp).toBe(10)
  expect(Object.values(rows[0])).toContain(90)
  expect(Object.values(rows[0])).toContain(100)
})
