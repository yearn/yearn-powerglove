import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeeYieldChart } from './FeeYieldChart'
import type { FeeHistoryPoint } from './fee-history'
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

const start = Date.parse('2026-02-02T00:00:00Z') / 1000
const period: FeeHistoryPoint = {
  period: '2026-02-02',
  startTimestamp: start,
  endTimestamp: start + 7 * 86400,
  totalFeesPaidUsd: 70,
  grossGainsUsd: null,
  netYieldUsd: null,
  cumulativeGrossGainsUsd: null,
  cumulativeNetYieldUsd: null,
  cumulativeFeesPaidUsd: null
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('fee yield chart', () => {
  it('renders fee and negative earnings yields together with one shared daily TVL request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        datasetId: 'tvl',
        interval: 'daily',
        chart: Array.from({ length: 7 }, (_, i) => ({ timestamp: start + (i + 1) * 86400 - 1, Ethereum: 1000 }))
      })
    } as Response)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    const props = {
      periods: [{ ...period, netYieldUsd: -70 }],
      interval: 'weekly' as const,
      view: 'periodic' as const,
      renderType: 'bar' as const,
      onRenderTypeChange: vi.fn()
    }
    render(
      <QueryClientProvider client={client}>
        <FeeYieldChart {...props} />
        <FeeYieldChart {...props} metric="earnings" />
      </QueryClientProvider>
    )
    const fees = screen.getByRole('region', { name: 'Fees per dollar of TVL' })
    const earnings = screen.getByRole('region', { name: 'Earnings per dollar of TVL' })
    await waitFor(() => expect(earnings.querySelectorAll('.recharts-bar')).toHaveLength(1))
    expect(fees.querySelectorAll('.recharts-bar')).toHaveLength(1)
    expect(within(earnings).getByRole('heading', { name: 'Weekly Earnings per $1 of TVL (Annualized)' })).toBeTruthy()
    const loss = earnings.querySelector('.recharts-bar-rectangle path')
    expect(Number(loss?.getAttribute('height'))).toBeLessThan(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    client.clear()
  })

  it('pins daily TVL and reuses the loaded window for chain filters and shorter date ranges', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        datasetId: 'tvl',
        interval: 'daily',
        chart: Array.from({ length: 7 }, (_, i) => ({
          timestamp: start + (i + 1) * 86400 - 1,
          Ethereum: 1000,
          Polygon: 2000
        }))
      })
    } as Response)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    const chart = (chain: string, selected = period, renderType: 'bar' | 'line' = 'bar') => (
      <QueryClientProvider client={client}>
        <StatsContext.Provider
          value={{ chainFilter: chain, density: 'comfortable', lastFetchedAt: null, setLastFetchedAt: vi.fn() }}
        >
          <FeeYieldChart
            periods={[selected]}
            interval="weekly"
            view="periodic"
            renderType={renderType}
            onRenderTypeChange={vi.fn()}
          />
        </StatsContext.Provider>
      </QueryClientProvider>
    )
    const rendered = render(chart('all'))
    await waitFor(() => expect(document.querySelectorAll('.recharts-bar')).toHaveLength(1))
    expect(String(fetch.mock.calls[0][0])).toContain('datasetId=tvl')
    expect(String(fetch.mock.calls[0][0])).toContain('interval=daily')
    expect(String(fetch.mock.calls[0][0])).not.toContain('chainId=')
    rendered.rerender(chart('1', { ...period, endTimestamp: start + 3 * 86400 }, 'line'))
    await waitFor(() => expect(document.querySelectorAll('.recharts-line')).toHaveLength(1))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Annualized fee yield is unavailable/)).toBeNull()
    rendered.rerender(chart('146'))
    expect(screen.getByText(/Annualized fee yield is unavailable/)).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(1)
    client.clear()
  })
})
