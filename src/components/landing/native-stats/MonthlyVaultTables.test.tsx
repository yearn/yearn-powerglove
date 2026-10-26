import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { type ReactNode, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CanonicalVaultFee } from './canonical-fees'
import { MonthlyVaultTables } from './MonthlyVaultTables'
import { completedFeeMonths } from './monthly-vault-data'
import { StatsContext } from './StatsContext'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>
}))
vi.mock('@/lib/kong-vault-client', () => ({
  fetchKongVaultListRaw: async () => [
    { chainId: 1, address: '0xaaa', name: 'Alice' },
    { chainId: 137, address: '0xaaa', name: 'Bob' },
    { chainId: 1, address: '0xbbb', name: 'Untracked' }
  ]
}))
vi.mock('./hooks', async (original) => ({
  ...(await original<typeof import('./hooks')>()),
  useFetch: () => ({
    data: { aggregationScope: 'product', datasetId: 'selected' },
    loading: false,
    error: null,
    retry: vi.fn()
  })
}))
const vault = (chainId: number, name: string, amount: string | null): CanonicalVaultFee => ({
  chainId,
  name,
  address: '0xaaa',
  contractFamily: 'yearn-v3-allocator',
  totalFeesPaidUsd: amount,
  protocolFeesUsd: null,
  managerFeesUsd: null,
  managementFeesUsd: null,
  performanceFeesUsd: null,
  strategistFeesUsd: null,
  totalRefundsUsd: null,
  lifetimeEarnings: {
    rawGrossGainsUsd: null,
    rawLossesUsd: null,
    rawNetYieldUsd: null,
    grossGainsUsd: null,
    lossesUsd: null,
    netYieldUsd: amount === null ? null : String(-Number(amount) * 2)
  }
})
function Table() {
  const [chainFilter, setChainFilter] = useState('all')
  return (
    <StatsContext.Provider
      value={{ chainFilter, density: 'comfortable', lastFetchedAt: null, setLastFetchedAt: vi.fn() }}
    >
      <MonthlyVaultTables
        chainSelector={
          <select aria-label="Chain" value={chainFilter} onChange={(e) => setChainFilter(e.target.value)}>
            <option value="all">All Chains</option>
            <option value="1">Ethereum</option>
          </select>
        }
      />
    </StatsContext.Provider>
  )
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
describe('monthly fee table', () => {
  it('pins one grouped 12-month request, displays all vaults, and filters/sorts without refetching', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-12T00:00:00Z'))
    let active = 0,
      peak = 0
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const params = new URL(String(url), 'http://localhost').searchParams
      if (!params.has('since'))
        return {
          ok: true,
          json: async () => ({
            aggregationScope: 'product',
            datasetId: 'selected',
            vaults: [vault(1, 'Alice', '201.75'), vault(137, 'Bob', '42')]
          })
        } as Response
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return {
        ok: true,
        json: async () => ({
          aggregationScope: 'product',
          datasetId: 'selected',
          interval: 'monthly',
          dataCutoffTimestamp: Date.now() / 1000,
          buckets: completedFeeMonths(Date.now() / 1000).map((period) => ({
            ...period,
            vaults:
              period.period === '2025-10'
                ? [vault(1, 'Alice', '100.25'), vault(137, 'Bob', '42')]
                : period.period === '2025-11'
                  ? [vault(1, 'Alice', '101.5')]
                  : []
          }))
        })
      } as Response
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    render(
      <QueryClientProvider client={client}>
        <Table />
      </QueryClientProvider>
    )
    expect(screen.getByText('Loading monthly earnings for all vaults…')).toBeTruthy()
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Monthly vault metric' })).getByRole('button', { name: 'Fees' })
    )
    const table = await screen.findByRole('table', { name: /Vault fees for/ })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(14)
    const rows = within(table).getAllByRole('row').slice(2)
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toContain('Alice')
    expect(within(rows[0]).getAllByRole('cell')[0].textContent).toBe('$202')
    expect(
      within(rows[0])
        .getAllByRole('cell')
        .slice(3)
        .every((cell) => cell.textContent === '$0')
    ).toBe(true)
    expect(
      within(rows[2])
        .getAllByRole('cell')
        .slice(1)
        .every((cell) => cell.textContent === '—')
    ).toBe(true)
    const type = screen.getByRole('combobox', { name: 'Vault type' })
    fireEvent.change(type, { target: { value: 'External' } })
    expect(within(table).getAllByRole('row').slice(2)).toHaveLength(1)
    expect(within(table).getAllByRole('row')[2].textContent).toContain('Untracked')
    fireEvent.change(type, { target: { value: 'all' } })
    const toggle = screen.getByRole('group', { name: 'Monthly vault metric' })
    fireEvent.click(within(toggle).getByRole('button', { name: 'Earnings' }))
    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(screen.queryByRole('table', { name: /Vault fees for/ })).toBeNull()
    expect(screen.getByRole('table', { name: /Vault earnings for/ }).textContent).toContain('-$404')
    fireEvent.click(within(toggle).getByRole('button', { name: 'Fees' }))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(peak).toBe(1)
    const queries = fetch.mock.calls.map(([url]) => new URL(String(url), 'http://localhost').searchParams)
    expect(queries.every((params) => params.get('datasetId') === 'selected')).toBe(true)
    expect(queries.every((params) => params.get('scope') === 'product')).toBe(true)
    expect(queries.filter((params) => params.has('since'))).toHaveLength(1)
    expect(queries[1].get('since')).toBe(String(Date.parse('2025-10-01') / 1000))
    expect(queries[1].get('until')).toBe(String(Date.parse('2026-10-01') / 1000))
    expect(queries[1].get('interval')).toBe('monthly')
    const totalRow = within(table).getByRole('rowheader', { name: 'All vaults' }).closest('tr')!
    expect(within(totalRow).getAllByRole('cell')[0].textContent).toBe('$244Partial · 1/3 vaults incomplete')
    expect(within(totalRow).getAllByText('Partial · 1/3 vaults unavailable')).toHaveLength(12)
    const totalsBeforeSort = totalRow.textContent
    fireEvent.click(within(table).getByRole('button', { name: 'Sort by annual total' }))
    expect(within(table).getAllByRole('row')[1].textContent).toBe(totalsBeforeSort)
    expect(within(table).getAllByRole('row')[2].textContent).toContain('Bob')
    fireEvent.change(screen.getByRole('textbox', { name: 'Search vault fees' }), { target: { value: 'Alice' } })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).queryByText(/Partial/)).toBeNull()
    fireEvent.click(within(toggle).getByRole('button', { name: 'Earnings' }))
    expect(screen.getByRole('textbox', { name: 'Search vault earnings' }).getAttribute('value')).toBe('Alice')
    expect(screen.getAllByRole('link', { name: 'Alice' })).toHaveLength(1)
    fireEvent.click(within(toggle).getByRole('button', { name: 'Fees' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search vault fees' }), { target: { value: '' } })
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Chain' })[0], { target: { value: '1' } })
    expect(screen.queryByRole('link', { name: 'Bob' })).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
    client.clear()
  })
  it('blocks mixed publications and retries without displaying failed months as zero', async () => {
    let invalid = true
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const params = new URL(String(url), 'http://localhost').searchParams
      return {
        ok: true,
        json: async () => ({
          aggregationScope: 'product',
          datasetId: invalid && params.has('since') ? 'wrong' : 'selected',
          vaults: [vault(1, 'Alice', '10')],
          interval: 'monthly',
          dataCutoffTimestamp: Date.now() / 1000,
          buckets: completedFeeMonths(Date.now() / 1000).map((period) => ({
            ...period,
            vaults: [vault(1, 'Alice', '10')]
          }))
        })
      } as Response
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <Table />
      </QueryClientProvider>
    )
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Monthly vault metric' })).getByRole('button', { name: 'Fees' })
    )
    await screen.findByRole('button', { name: 'Retry monthly fees' })
    expect(screen.queryByRole('table')).toBeNull()
    invalid = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry monthly fees' }))
    await waitFor(() => expect(screen.getByRole('table', { name: /Vault fees for/ })).toBeTruthy())
    expect(screen.getByRole('table', { name: /Vault fees for/ }).textContent).toContain('$120')
    client.clear()
  })
})
