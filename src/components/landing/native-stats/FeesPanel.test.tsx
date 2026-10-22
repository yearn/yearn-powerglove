import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChartTypeControl } from './ChartTypeToggle'
import type { ChartViewControl } from './ChartViewToggle'
import { FeesPanel } from './FeesPanel'
import { StatsContext, StatsTimeRangeContext } from './StatsContext'

vi.mock('./EffectiveFeesTable', () => ({ EffectiveFeesTable: () => <div>Effective fees table</div> }))

vi.mock('./MonthlyVaultTables', () => ({ MonthlyVaultTables: () => <div>Monthly tables</div> }))

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 640, height: 300 })
}))

vi.mock('./ChainFeeHistoryCharts', () => ({
  ChainFeeHistoryCharts: ({ view, renderType, onViewChange }: ChartViewControl & ChartTypeControl) => (
    <div data-testid="chain-view" data-view={view} data-render-type={renderType}>
      <button type="button" onClick={() => onViewChange?.('cumulative')}>
        Set chain cumulative
      </button>
    </div>
  )
}))
vi.mock('./VaultTypeFeeCharts', () => ({
  VaultTypeFeeCharts: ({ view, renderType, onViewChange }: ChartViewControl & ChartTypeControl) => (
    <div data-testid="vault-view" data-view={view} data-render-type={renderType}>
      <button type="button" onClick={() => onViewChange?.('cumulative')}>
        Set vault type cumulative
      </button>
    </div>
  )
}))
vi.mock('./VaultComparisonCharts', () => ({
  VaultComparisonCharts: ({
    view,
    renderType,
    selectedKeys,
    onSelectedKeysChange,
    onViewChange
  }: {
    view: string
    onViewChange: (view: 'periodic' | 'cumulative') => void
    renderType: string
    selectedKeys: string[] | null
    onSelectedKeysChange: (keys: string[]) => void
  }) => (
    <div
      data-testid="allocator-view"
      data-view={view}
      data-render-type={renderType}
      data-selected={JSON.stringify(selectedKeys)}
    >
      <button type="button" onClick={() => onViewChange('cumulative')}>
        Set allocator cumulative
      </button>
      <button type="button" onClick={() => onSelectedKeysChange(['1:custom'])}>
        Choose custom allocator
      </button>
    </div>
  )
}))
vi.mock('./useFeeTvlHistory', () => ({
  useFeeTvlHistory: () => ({ data: null, loading: false, error: null, retry: vi.fn() })
}))
vi.mock('./FeeYieldChart', () => ({
  FeeYieldChart: ({ renderType, metric = 'fees' }: { renderType: string; metric?: string }) => (
    <div data-testid={metric === 'earnings' ? 'earnings-yield-view' : 'fee-yield-view'} data-render-type={renderType} />
  )
}))
vi.mock('./hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks')>()),
  useFetch: (url: string) => {
    requestedUrls.push(url)
    return {
      data: feeDataLoading
        ? null
        : url.startsWith('/api/fees/history')
          ? history
          : url.startsWith('/api/fees/vaults')
            ? {
                vaults: [],
                datasetId: 'selected',
                aggregationScope: url.includes('scope=product') ? 'product' : 'contract'
              }
            : url.startsWith('/api/fees/stack')
              ? { chains: [], entries: [] }
              : url.startsWith('/api/fees?')
                ? new URL(url, 'http://localhost').searchParams.has('since')
                  ? summary
                  : { ...allTimeSummary, datasetId: allTimeMismatch ? 'other' : 'selected' }
                : null,
      loading: feeDataLoading,
      error: null,
      fetchedAt: null,
      retry: vi.fn()
    }
  }
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
const allTimeSummary = {
  ...summary,
  totalFeesPaidUsd: '1000',
  grossGainsUsd: '2000',
  lossesUsd: '200',
  netLifetimeEarningsUsd: '1800'
}
let allTimeMismatch = false
const history = {
  datasetId: 'selected',
  interval: 'monthly',
  buckets: ['2026-01', '2026-02', '2026-03'].map((period) => ({
    period,
    totalFeesPaidUsd: '10',
    lifetimeEarnings: earnings
  }))
}
const requestedUrls: string[] = []
let feeDataLoading = false

afterEach(() => {
  feeDataLoading = false
  allTimeMismatch = false
  requestedUrls.length = 0
  cleanup()
  vi.restoreAllMocks()
})

describe('shared fee chart view', () => {
  it('retains custom allocator selections while fee data reloads for a different range', () => {
    const rendered = render(<FeesPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earnings and fees as bars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose custom allocator' }))
    expect(screen.getByTestId('allocator-view').getAttribute('data-selected')).toBe('["1:custom"]')
    feeDataLoading = true
    rendered.rerender(<FeesPanel />)
    expect(screen.queryByTestId('allocator-view')).toBeNull()
    feeDataLoading = false
    rendered.rerender(<FeesPanel />)
    expect(screen.getByTestId('allocator-view').getAttribute('data-selected')).toBe('["1:custom"]')
    expect(screen.getByRole('button', { name: 'Show earnings and fees as bars' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
  })

  it('changes a chain view without changing the overall, yield, vault type, or allocator view', () => {
    render(<FeesPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Set chain cumulative' }))
    expect(screen.getByTestId('chain-view').getAttribute('data-view')).toBe('cumulative')
    expect(screen.getByRole('heading', { name: 'Monthly Earnings & Fees' })).toBeTruthy()
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('periodic')
    expect(screen.getByTestId('allocator-view').getAttribute('data-view')).toBe('periodic')
    fireEvent.click(screen.getByRole('button', { name: 'Set allocator cumulative' }))
    expect(screen.getByTestId('allocator-view').getAttribute('data-view')).toBe('cumulative')
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('periodic')
  })

  it('uses per-chart defaults and preserves hidden series across independent render modes and shared views', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-06T18:00:00Z'))
    render(<FeesPanel />)
    const controls = screen.getByRole('group', { name: 'Earnings and fees chart view' })
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
    expect(screen.queryByTestId('earnings-yield-view')).toBeNull()
    fireEvent.click(within(chart as HTMLElement).getByRole('button', { name: 'Net Yield' }))
    expect(chart.querySelectorAll('.recharts-line-curve')).toHaveLength(2)
    fireEvent.click(within(controls).getByRole('button', { name: 'Cumulative' }))
    expect(screen.getByTestId('chain-view').getAttribute('data-view')).toBe('periodic')
    expect(screen.getByTestId('vault-view').getAttribute('data-view')).toBe('periodic')
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
    expect(screen.getByTestId('chain-view').getAttribute('data-render-type')).toBe('bar')
    expect(screen.getByTestId('vault-view').getAttribute('data-render-type')).toBe('bar')
  })
})

it('orders the adjusted TVL table and fee charts as requested without supplementary analysis', () => {
  render(<FeesPanel />)
  const items = [
    screen.getByText('Effective fees table'),
    screen.getByRole('heading', { name: 'Monthly Earnings & Fees' }),
    screen.getByTestId('fee-yield-view'),
    screen.getByTestId('chain-view'),
    screen.getByTestId('vault-view'),
    screen.getByTestId('allocator-view'),
    screen.getByText('Monthly tables')
  ]
  for (let index = 1; index < items.length; index++) {
    expect(items[index - 1].compareDocumentPosition(items[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
  expect(screen.queryByRole('heading', { name: 'TVL vs Fee Yield' })).toBeNull()
})

it('uses the same selected dates as TVL when fetching canonical fee charts', () => {
  const display = (start: string) => (
    <StatsTimeRangeContext.Provider value={{ range: { start, end: '2026-10-01' }, setRange: vi.fn() }}>
      <FeesPanel />
    </StatsTimeRangeContext.Provider>
  )
  const rendered = render(display('2024-01-01'))
  const feesQuery = () =>
    new URL(
      requestedUrls
        .filter((url) => url.startsWith('/api/fees?') && new URL(url, 'http://localhost').searchParams.has('since'))
        .slice(-1)[0]!,
      'http://localhost'
    ).searchParams
  expect(feesQuery().get('since')).toBe(String(Date.parse('2024-01-01T00:00:00Z') / 1000))
  expect(feesQuery().get('until')).toBe(String(Date.parse('2026-10-02T00:00:00Z') / 1000))
  rendered.rerender(display('2025-01-01'))
  expect(feesQuery().get('since')).toBe(String(Date.parse('2025-01-01T00:00:00Z') / 1000))
})

it('shows all-time and selected-range amounts side by side, pinned to the same dataset and chain', () => {
  render(
    <StatsContext.Provider
      value={{ chainFilter: '137', density: 'comfortable', lastFetchedAt: null, setLastFetchedAt: vi.fn() }}
    >
      <StatsTimeRangeContext.Provider value={{ range: { start: '2024-01-01', end: '2026-10-01' }, setRange: vi.fn() }}>
        <FeesPanel />
      </StatsTimeRangeContext.Provider>
    </StatsContext.Provider>
  )
  const fees = screen.getByRole('region', { name: 'Gross Fees' })
  expect(within(fees).getByText('All time')).toBeTruthy()
  expect(within(fees).getByText('Since Jan 1, 2024')).toBeTruthy()
  expect(within(fees).getByText('$1.0K')).toBeTruthy()
  expect(within(fees).getByText('$10')).toBeTruthy()
  const net = screen.getByRole('region', { name: 'Net Yield' })
  expect(within(net).getByText('$1.8K')).toBeTruthy()
  expect(within(net).getByText('$90')).toBeTruthy()
  const request = requestedUrls.find(
    (url) => url.startsWith('/api/fees?') && !new URL(url, 'http://localhost').searchParams.has('since')
  )!
  const params = new URL(request, 'http://localhost').searchParams
  expect(params.get('datasetId')).toBe('selected')
  expect(params.get('chainId')).toBe('137')
  expect(params.has('until')).toBe(false)
})

it('keeps all-time values unavailable when they come from a different publication', () => {
  allTimeMismatch = true
  render(<FeesPanel />)
  const fees = screen.getByRole('region', { name: 'Gross Fees' })
  expect(within(fees).queryByText('$1.0K')).toBeNull()
  expect(within(fees).getByText('—')).toBeTruthy()
  expect(within(fees).getByText('$10')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Retry all-time totals' })).toBeTruthy()
})
