import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeesPanel } from './FeesPanel'

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 640, height: 300 })
}))

vi.mock('./ChainFeeHistoryCharts', () => ({
  ChainFeeHistoryCharts: ({ view }: { view: string }) => <div data-testid="chain-view" data-view={view} />
}))
vi.mock('./VaultTypeFeeCharts', () => ({
  VaultTypeFeeCharts: ({ view }: { view: string }) => <div data-testid="vault-view" data-view={view} />
}))
vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useFetch: (url: string) => ({
    data: url.startsWith('/api/fees/history')
      ? history
      : url.startsWith('/api/fees/vaults')
        ? { vaults: [], datasetId: 'selected' }
        : url.startsWith('/api/fees?')
          ? summary
          : null,
    loading: false,
    error: null,
    fetchedAt: null,
    retry: vi.fn()
  })
}))

const earnings = {
  rawGrossGainsUsd: '100',
  rawLossesUsd: '10',
  rawNetYieldUsd: '90',
  grossGainsUsd: '100',
  lossesUsd: '10',
  netYieldUsd: '90'
}
const summary = {
  datasetId: 'selected',
  totalFeesPaidUsd: '10',
  grossGainsUsd: '100',
  lossesUsd: '10',
  netLifetimeEarningsUsd: '90',
  lifetimeEarnings: earnings
}
const history = {
  datasetId: 'selected',
  interval: 'monthly',
  buckets: ['2026-01', '2026-02', '2026-03'].map((period) => ({
    period,
    totalFeesPaidUsd: '10',
    lifetimeEarnings: earnings
  }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('shared fee chart view', () => {
  it('switches all chart groups together and preserves hidden main-chart series across modes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-06T18:00:00Z'))
    render(<FeesPanel chainSelector={<select aria-label="Chain" />} />)
    const controls = screen.getByRole('group', { name: 'Chart view' })
    const chart = screen.getByRole('heading', { name: 'Monthly Earnings & Fees' }).closest('.fee-chart-card')
    if (!chart) throw new Error('Combined chart not rendered')
    expect(screen.getAllByRole('heading', { name: /Earnings & Fees/ })).toHaveLength(1)
    expect(screen.getByTestId('chain-view').getAttribute('data-view')).toBe('periodic')
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('periodic')

    fireEvent.click(within(chart as HTMLElement).getByRole('button', { name: 'Net Yield' }))
    expect(chart.querySelectorAll('.recharts-line-curve')).toHaveLength(2)
    fireEvent.click(within(controls).getByRole('button', { name: 'Cumulative' }))
    expect(screen.getByTestId('chain-view').getAttribute('data-view')).toBe('cumulative')
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('cumulative')
    expect(screen.getAllByRole('heading', { name: /Earnings & Fees/ })).toHaveLength(1)
    expect(
      within(chart as HTMLElement)
        .getByRole('button', { name: 'Net Yield' })
        .getAttribute('aria-pressed')
    ).toBe('false')
    expect(chart.querySelectorAll('.recharts-line-curve')).toHaveLength(2)
    const path = chart.querySelector('.recharts-line-curve')?.getAttribute('d') ?? ''
    expect(path.match(/[MLC]/g)).toHaveLength(4)

    fireEvent.click(within(controls).getByRole('button', { name: 'Monthly' }))
    expect(screen.getByTestId('chain-view').getAttribute('data-view')).toBe('periodic')
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('periodic')
    expect(chart.querySelectorAll('.recharts-line-curve')).toHaveLength(2)
  })
})
