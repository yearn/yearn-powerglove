import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { type ComponentProps, cloneElement, type ReactElement, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatsChartType } from './ChartTypeToggle'
import type { CanonicalFeeHistoryBucket, CanonicalVaultFee } from './canonical-fees'
import { fetchAllocatorHistory, VaultComparisonCharts } from './VaultComparisonCharts'

vi.mock('recharts', async (original) => ({
  ...(await original<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 640, height: 300 })
}))
const amounts = {
  protocolFeesUsd: null,
  managerFeesUsd: null,
  performanceFeesUsd: null,
  managementFeesUsd: null,
  strategistFeesUsd: null,
  totalRefundsUsd: null
}
const pnl = {
  rawGrossGainsUsd: null,
  rawLossesUsd: null,
  rawNetYieldUsd: null,
  grossGainsUsd: null,
  lossesUsd: null,
  netYieldUsd: '100'
}
const vault = (chainId: number, name: string, family = 'yearn-v3-allocator'): CanonicalVaultFee => ({
  ...amounts,
  chainId,
  name,
  contractFamily: family,
  address: '0x0000000000000000000000000000000000000001',
  totalFeesPaidUsd: '20',
  lifetimeEarnings: pnl
})
const catalog = [
  vault(1, 'Ethereum allocator'),
  vault(747474, 'Katana allocator'),
  vault(1, 'Tokenized strategy', 'yearn-v3-tokenized-strategy'),
  vault(1, 'V2 vault', 'yearn-v2-vault')
]
type ComparisonProps = Omit<
  ComponentProps<typeof VaultComparisonCharts>,
  'selectedKeys' | 'onSelectedKeysChange' | 'renderType' | 'onRenderTypeChange'
>
function SelectionHarness({ initialType = 'bar', ...props }: ComparisonProps & { initialType?: StatsChartType }) {
  const [keys, setKeys] = useState<string[] | null>(null)
  const [renderType, setRenderType] = useState<StatsChartType>(initialType)
  return (
    <VaultComparisonCharts
      {...props}
      selectedKeys={keys}
      onSelectedKeysChange={setKeys}
      renderType={renderType}
      onRenderTypeChange={setRenderType}
    />
  )
}
const props: ComparisonProps = {
  query: 'datasetId=selected&interval=monthly&since=1767225600&until=1772323200',
  rankedVaults: catalog,
  periods: [{ period: '2026-01' }, { period: '2026-02' }],
  interval: 'monthly' as const,
  view: 'periodic' as const
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('custom allocator comparisons', () => {
  it('loads weekly history for smoothed lines even in a monthly range and reuses it across render changes', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const params = new URL(String(url), 'http://localhost').searchParams
      const buckets: CanonicalFeeHistoryBucket[] = []
      for (
        let timestamp = Number(params.get('since'));
        timestamp < Number(params.get('until'));
        timestamp += 7 * 86400
      ) {
        buckets.push({
          ...amounts,
          period: new Date(timestamp * 1000).toISOString().slice(0, 10),
          totalFeesPaidUsd: '20',
          lifetimeEarnings: { ...pnl, netYieldUsd: String(buckets.length * 10) }
        })
      }
      if (params.get('interval') === 'monthly') {
        buckets.splice(
          0,
          buckets.length,
          ...props.periods.map(({ period }) => ({ ...amounts, period, totalFeesPaidUsd: '20', lifetimeEarnings: pnl }))
        )
      }
      return {
        ok: true,
        json: async () =>
          params.has('vaultAddress')
            ? { aggregationScope: 'product', datasetId: 'selected', interval: params.get('interval'), buckets }
            : { aggregationScope: 'product', datasetId: 'selected', vaults: catalog }
      } as Response
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    const chart = () => (
      <QueryClientProvider client={client}>
        <SelectionHarness {...props} initialType="line" />
      </QueryClientProvider>
    )
    render(chart())
    const section = screen.getByRole('region', { name: 'V3 vault product comparison' })
    await waitFor(() => expect(section.querySelectorAll('.recharts-line-curve')).toHaveLength(2))
    expect(screen.getByText('4-week moving average · Average weekly net earnings (USD)')).toBeTruthy()
    const requests = () => fetch.mock.calls.filter(([url]) => String(url).includes('vaultAddress='))
    expect(requests()).toHaveLength(2)
    for (const [url] of requests()) {
      const params = new URL(String(url), 'http://localhost').searchParams
      expect(params.get('interval')).toBe('weekly')
      expect(params.get('since')).toBe(String(Date.parse('2025-12-15T00:00:00Z') / 1000))
      expect(params.get('until')).toBe(String(Date.parse('2026-02-23T00:00:00Z') / 1000))
      expect(params.get('datasetId')).toBe('selected')
      expect(params.get('scope')).toBe('product')
    }
    const first = section.querySelector('.recharts-line-curve')?.getAttribute('d') ?? ''
    expect(first.match(/[ML]/g)).toHaveLength(7)
    const metric = screen.getByRole('group', { name: 'Vault product metric' })
    fireEvent.click(within(metric).getByRole('button', { name: 'Fees' }))
    expect(screen.getByText('4-week moving average · Average weekly fees (USD)')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Earnings by Vault Product' })).toBeNull()
    expect(section.querySelectorAll('.recharts-line-curve')).toHaveLength(2)
    expect(requests()).toHaveLength(2)
    fireEvent.click(within(metric).getByRole('button', { name: 'Earnings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show earnings by vault product as bars' }))
    await waitFor(() => expect(section.querySelectorAll('.recharts-bar')).toHaveLength(2))
    expect(section.querySelectorAll('.recharts-line-curve')).toHaveLength(0)
    expect(screen.queryByText('4-week moving average · Average weekly net earnings (USD)')).toBeNull()
    expect(requests()).toHaveLength(4)
    const loaded = requests().length
    fireEvent.click(screen.getByRole('button', { name: 'Show earnings by vault product as lines' }))
    await waitFor(() => expect(section.querySelectorAll('.recharts-line-curve')).toHaveLength(2))
    expect(requests()).toHaveLength(loaded)
    client.clear()
  })

  it('offers only allocators, reuses selected histories, and applies shared controls and chain filters', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const params = new URL(String(url), 'http://localhost').searchParams
      return {
        ok: true,
        json: async () =>
          params.has('vaultAddress')
            ? {
                aggregationScope: 'product',
                datasetId: 'selected',
                interval: 'monthly',
                buckets: props.periods.map(({ period }) => ({
                  ...amounts,
                  period,
                  totalFeesPaidUsd: '20',
                  lifetimeEarnings: { ...pnl, netYieldUsd: params.get('chainId') === '1' ? '100' : '-10' }
                }))
              }
            : { aggregationScope: 'product', datasetId: 'selected', vaults: catalog }
      } as Response
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    const chart = (overrides: Partial<ComparisonProps> = {}) => (
      <QueryClientProvider client={client}>
        <SelectionHarness {...props} {...overrides} />
      </QueryClientProvider>
    )
    const rendered = render(chart())
    const section = screen.getByRole('region', { name: 'V3 vault product comparison' })
    await waitFor(() => expect(section.querySelectorAll('.recharts-bar')).toHaveLength(2))
    const requests = () => fetch.mock.calls.filter(([url]) => String(url).includes('vaultAddress='))
    expect(requests()).toHaveLength(2)
    expect(screen.queryByLabelText('Selected allocator vaults')).toBeNull()
    expect(screen.queryByText(/Choose allocators to compare/)).toBeNull()
    expect(
      requests()
        .map(([url]) => new URL(String(url), 'http://localhost').searchParams.get('chainId'))
        .sort()
    ).toEqual(['1', '747474'])
    for (const [url] of requests()) expect(String(url)).toContain('datasetId=selected')

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(section.querySelectorAll('.recharts-bar')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Choose vaults (0)' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.queryByText('Tokenized strategy')).toBeNull()
    expect(screen.queryByText('V2 vault')).toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search V3 vault products' }), {
      target: { value: 'Katana' }
    })
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(screen.getByRole('checkbox', { name: /Katana allocator/ }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    await waitFor(() => expect(section.querySelectorAll('.recharts-bar')).toHaveLength(1))
    expect(requests()).toHaveLength(2)
    rendered.rerender(chart({ view: 'cumulative' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show earnings by vault product as lines' }))
    const metric = screen.getByRole('group', { name: 'Vault product metric' })
    fireEvent.click(within(metric).getByRole('button', { name: 'Fees' }))
    await waitFor(() => expect(section.querySelectorAll('.recharts-line-curve')).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Choose vaults (1)' })).toBeTruthy()
    expect(requests()).toHaveLength(2)
    rendered.rerender(chart({ query: `${props.query}&chainId=1` }))
    expect(section.querySelectorAll('.recharts-line-curve')).toHaveLength(0)
    expect(screen.getByText('Choose V3 vault products to build your comparison.')).toBeTruthy()
    rendered.rerender(chart({ view: 'cumulative' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show fees by vault product as bars' }))
    await waitFor(() => expect(section.querySelectorAll('.recharts-bar')).toHaveLength(1))
    const fees = screen
      .getByRole('heading', { name: 'Fees by Vault Product' })
      .closest('.fee-chart-card') as HTMLElement
    fireEvent.click(within(fees).getByRole('button', { name: /Katana allocator/ }))
    expect(fees.querySelectorAll('.recharts-bar')).toHaveLength(0)
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Vault product metric' })).getByRole('button', { name: 'Earnings' })
    )
    expect(fees.querySelectorAll('.recharts-bar')).toHaveLength(0)
    client.clear()
  })

  it('rejects a response from another publication', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ aggregationScope: 'product', datasetId: 'different', interval: 'monthly', buckets: [] })
    } as Response)
    await expect(fetchAllocatorHistory('', props.query, catalog[0], new AbortController().signal)).rejects.toThrow(
      'selected publication'
    )
  })
})
