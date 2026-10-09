import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeeChartTypeControls } from './ChartTypeToggle'
import { FeesPanel } from './FeesPanel'

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 640, height: 300 })
}))

vi.mock('./ChainFeeHistoryCharts', () => ({
  ChainFeeHistoryCharts: ({ view, chartTypes }: { view: string; chartTypes: FeeChartTypeControls }) => (
    <div
      data-testid="chain-view"
      data-view={view}
      data-render-type={chartTypes.earnings.renderType}
      data-fees-type={chartTypes.fees.renderType}
    />
  )
}))
vi.mock('./VaultTypeFeeCharts', () => ({
  VaultTypeFeeCharts: ({ view, chartTypes }: { view: string; chartTypes: FeeChartTypeControls }) => (
    <div
      data-testid="vault-view"
      data-view={view}
      data-render-type={chartTypes.earnings.renderType}
      data-fees-type={chartTypes.fees.renderType}
    />
  )
}))
vi.mock('./VaultComparisonCharts', () => ({
  VaultComparisonCharts: ({
    view,
    chartTypes,
    selectedKeys,
    onSelectedKeysChange
  }: {
    view: string
    chartTypes: FeeChartTypeControls
    selectedKeys: string[] | null
    onSelectedKeysChange: (keys: string[]) => void
  }) => (
    <div
      data-testid="allocator-view"
      data-view={view}
      data-render-type={chartTypes.earnings.renderType}
      data-fees-type={chartTypes.fees.renderType}
      data-selected={JSON.stringify(selectedKeys)}
    >
      <button type="button" onClick={() => onSelectedKeysChange(['1:custom'])}>
        Choose custom allocator
      </button>
    </div>
  )
}))
vi.mock('./FeeTimeRangeSlider', () => ({ FeeTimeRangeSlider: () => null }))
vi.mock('./FeeYieldChart', () => ({
  FeeYieldChart: ({ view, renderType, metric = 'fees' }: { view: string; renderType: string; metric?: string }) => (
    <div
      data-testid={metric === 'earnings' ? 'earnings-yield-view' : 'fee-yield-view'}
      data-view={view}
      data-render-type={renderType}
    />
  )
}))
vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useFetch: (url: string) => ({
    data: feeDataLoading
      ? null
      : url.startsWith('/api/fees/history')
        ? history
        : url.startsWith('/api/fees/vaults')
          ? { vaults: [], datasetId: 'selected' }
          : url.startsWith('/api/fees?')
            ? summary
            : null,
    loading: feeDataLoading,
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
let feeDataLoading = false

afterEach(() => {
  feeDataLoading = false
  cleanup()
  vi.restoreAllMocks()
})

describe('shared fee chart view', () => {
  it('retains custom allocator selections while fee data reloads for a different range', () => {
    const rendered = render(<FeesPanel chainSelector={<select aria-label="Chain" />} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earnings and fees as bars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose custom allocator' }))
    expect(screen.getByTestId('allocator-view').getAttribute('data-selected')).toBe('["1:custom"]')
    feeDataLoading = true
    rendered.rerender(<FeesPanel chainSelector={<select aria-label="Chain" />} />)
    expect(screen.queryByTestId('allocator-view')).toBeNull()
    feeDataLoading = false
    rendered.rerender(<FeesPanel chainSelector={<select aria-label="Chain" />} />)
    expect(screen.getByTestId('allocator-view').getAttribute('data-selected')).toBe('["1:custom"]')
    expect(screen.getByRole('button', { name: 'Show earnings and fees as bars' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
  })

  it('preserves the chart view and mounted controls when collapsing and reopening the toolbar', () => {
    render(
      <FeesPanel
        chainSelector={
          <select aria-label="Chain" defaultValue="10">
            <option value="10">Optimism</option>
          </select>
        }
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cumulative' }))
    const chain = screen.getByRole('combobox', { name: 'Chain' })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chart controls' }))
    expect(screen.queryByRole('group', { name: 'Chart view' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Expand chart controls' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('heading', { name: 'Cumulative Earnings & Fees' })).toBeTruthy()
    expect(screen.getByTestId('chain-view').getAttribute('data-view')).toBe('cumulative')
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('cumulative')
    expect(screen.getByTestId('allocator-view').getAttribute('data-view')).toBe('cumulative')
    fireEvent.click(screen.getByRole('button', { name: 'Expand chart controls' }))
    expect(screen.getByRole('combobox', { name: 'Chain' })).toBe(chain)
    expect((chain as HTMLSelectElement).value).toBe('10')
    expect(screen.getByRole('button', { name: 'Cumulative' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Collapse chart controls' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('uses per-chart defaults and preserves hidden series across independent render modes and shared views', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-06T18:00:00Z'))
    render(<FeesPanel chainSelector={<select aria-label="Chain" />} />)
    const controls = screen.getByRole('group', { name: 'Chart view' })
    const chart = screen.getByRole('heading', { name: 'Monthly Earnings & Fees' }).closest('.fee-chart-card')
    if (!chart) throw new Error('Combined chart not rendered')
    expect(screen.getAllByRole('heading', { name: /Earnings & Fees/ })).toHaveLength(1)
    expect(screen.getByTestId('chain-view').getAttribute('data-view')).toBe('periodic')
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('periodic')

    expect(chart.querySelectorAll('.recharts-line-curve')).toHaveLength(3)
    expect(screen.getByTestId('chain-view').getAttribute('data-render-type')).toBe('bar')
    expect(screen.getByTestId('vault-view').getAttribute('data-render-type')).toBe('bar')
    expect(screen.getByTestId('allocator-view').getAttribute('data-render-type')).toBe('line')
    expect(screen.getByTestId('fee-yield-view').getAttribute('data-render-type')).toBe('bar')
    expect(screen.getByTestId('earnings-yield-view').getAttribute('data-render-type')).toBe('bar')
    fireEvent.click(within(chart as HTMLElement).getByRole('button', { name: 'Net Yield' }))
    expect(chart.querySelectorAll('.recharts-line-curve')).toHaveLength(2)
    fireEvent.click(within(controls).getByRole('button', { name: 'Cumulative' }))
    expect(screen.getByTestId('chain-view').getAttribute('data-view')).toBe('cumulative')
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('cumulative')
    expect(screen.getByTestId('fee-yield-view').getAttribute('data-view')).toBe('cumulative')
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
    fireEvent.click(screen.getByRole('button', { name: 'Show earnings and fees as bars' }))
    expect(chart.querySelectorAll('.recharts-bar')).toHaveLength(2)
    expect(screen.getByTestId('allocator-view').getAttribute('data-render-type')).toBe('line')
    for (const name of ['chain-view', 'vault-view'])
      expect(screen.getByTestId(name).getAttribute('data-fees-type')).toBe('bar')
    expect(screen.getByTestId('chain-view').getAttribute('data-render-type')).toBe('bar')
    expect(screen.getByTestId('vault-view').getAttribute('data-render-type')).toBe('bar')
  })
})
