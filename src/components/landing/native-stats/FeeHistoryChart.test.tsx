import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { cloneElement, type ReactElement, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatsChartType } from './ChartTypeToggle'
import { FeeHistoryChart } from './FeesPanel'
import { FeeYieldChart } from './FeeYieldChart'
import { buildCumulativeFeeHistorySeries, type FeeHistoryPoint } from './fee-history'
import { StatsContext } from './StatsContext'

vi.mock('recharts', async (original) => ({
  ...(await original<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 640, height: 300 })
}))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: () => ({ data: { datasetId: 'tvl' }, loading: false, error: null, retry: vi.fn() })
}))
const day = 86400
const start = Date.parse('2026-02-02T00:00:00Z') / 1000
const periods: FeeHistoryPoint[] = [0, 1].map((offset) => ({
  period: new Date((start + offset * 7 * day) * 1000).toISOString().slice(0, 10),
  startTimestamp: start + offset * 7 * day,
  endTimestamp: start + (offset + 1) * 7 * day,
  grossGainsUsd: 100,
  netYieldUsd: 90,
  totalFeesPaidUsd: 10,
  cumulativeGrossGainsUsd: (offset + 1) * 100,
  cumulativeNetYieldUsd: (offset + 1) * 90,
  cumulativeFeesPaidUsd: (offset + 1) * 10
}))
function Chart({
  chain = 'all',
  cumulative = false,
  withYield = false
}: {
  chain?: string
  cumulative?: boolean
  withYield?: boolean
}) {
  const [renderType, setRenderType] = useState<StatsChartType>('line')
  return (
    <StatsContext.Provider
      value={{ chainFilter: chain, density: 'comfortable', lastFetchedAt: null, setLastFetchedAt: vi.fn() }}
    >
      <FeeHistoryChart
        title="Earnings and Fees"
        description="Test chart"
        interval="weekly"
        periods={periods}
        cumulative={cumulative}
        data={cumulative ? buildCumulativeFeeHistorySeries(periods) : periods}
        renderType={renderType}
        onRenderTypeChange={setRenderType}
        series={[
          {
            key: 'fees',
            dataKey: cumulative ? 'cumulativeFeesPaidUsd' : 'totalFeesPaidUsd',
            label: 'Gross Fees',
            color: '#16a34a'
          }
        ]}
      />
      {withYield && (
        <FeeYieldChart
          periods={periods}
          interval="weekly"
          view="periodic"
          renderType="bar"
          onRenderTypeChange={vi.fn()}
        />
      )}
    </StatsContext.Provider>
  )
}
beforeEach(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
function daily() {
  return {
    datasetId: 'tvl',
    interval: 'daily',
    chart: Array.from({ length: 14 }, (_, index) => ({
      timestamp: start + (index + 1) * day - 1,
      Ethereum: 100_000_000,
      Polygon: 100_000_000
    }))
  }
}

describe('TVL context on earnings and fees', () => {
  it('uses opposite chart types, a separate TVL axis, and shares the yield-chart request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => daily() } as Response)
    const queries = client()
    const { container } = render(
      <QueryClientProvider client={queries}>
        <Chart withYield />
      </QueryClientProvider>
    )
    const main = container.querySelector('.fee-chart-card') as HTMLElement
    await waitFor(() => expect(main.querySelectorAll('.fee-tvl-overlay.recharts-bar')).toHaveLength(1))
    expect(main.querySelectorAll('.recharts-line')).toHaveLength(1)
    expect(main.querySelectorAll('.fee-tvl-overlay .recharts-bar-rectangle')).toHaveLength(2)
    expect(main.querySelector('.fee-tvl-overlay path')?.getAttribute('fill-opacity')).toBe('0.18')
    const axes = main.querySelectorAll('.recharts-yAxis')
    expect(axes).toHaveLength(2)
    expect(axes[0].textContent).not.toContain('M')
    expect(axes[1].textContent).toContain('M')
    expect(axes[1].textContent).toContain('TVL')
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Fees per dollar of TVL' }).querySelectorAll('.recharts-bar')
      ).toHaveLength(1)
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(fetch.mock.calls[0][0])).toContain('datasetId=tvl')
    fireEvent.click(screen.getByRole('button', { name: 'Show earnings and fees as bars' }))
    expect(main.querySelectorAll('.fee-tvl-overlay.recharts-line')).toHaveLength(1)
    expect(main.querySelectorAll('.recharts-bar')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'TVL' }))
    expect(main.querySelector('.fee-tvl-overlay')).toBeNull()
    expect(main.querySelectorAll('.recharts-yAxis')).toHaveLength(1)
    expect(main.querySelectorAll('.recharts-bar')).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(1)
    queries.clear()
  })

  it('keeps TVL as a balance in cumulative view and leaves unavailable chain periods blank', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => daily() } as Response)
    const queries = client()
    const chart = (chain: string, cumulative = false) => (
      <QueryClientProvider client={queries}>
        <Chart chain={chain} cumulative={cumulative} />
      </QueryClientProvider>
    )
    const view = render(chart('1'))
    const overlay = () => document.querySelector('.fee-tvl-overlay')
    await waitFor(() => expect(overlay()?.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2))
    const originalHeights = [...(overlay()?.querySelectorAll('.recharts-bar-rectangle path') ?? [])].map((p) =>
      p.getAttribute('height')
    )
    view.rerender(chart('1', true))
    const cumulativeHeights = [...(overlay()?.querySelectorAll('.recharts-bar-rectangle path') ?? [])].map((p) =>
      p.getAttribute('height')
    )
    expect(cumulativeHeights).toEqual(originalHeights)
    view.rerender(chart('146'))
    expect(overlay()).toBeNull()
    expect(screen.getByText('TVL is unavailable for these periods.')).toBeTruthy()
    expect(document.querySelectorAll('.recharts-line')).toHaveLength(1)
    queries.clear()
  })

  it('keeps earnings and fees visible if the TVL request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response)
    const queries = client()
    render(
      <QueryClientProvider client={queries}>
        <Chart />
      </QueryClientProvider>
    )
    await screen.findByRole('button', { name: 'Retry TVL' })
    expect(document.querySelectorAll('.recharts-line')).toHaveLength(1)
    expect(document.querySelector('.fee-tvl-overlay')).toBeNull()
    queries.clear()
  })
})
