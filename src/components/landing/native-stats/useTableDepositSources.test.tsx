import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { DirectDepositFeeRow } from './direct-deposit-fees'
import * as sources from './direct-deposit-sources'
import { useTableDepositSources } from './useTableDepositSources'
import type { OriginVault } from './vault-origin'

vi.mock('@/lib/direct-deposit-balances', () => ({
  findDepositSnapshotBlock: vi.fn(),
  readDepositBalanceBatch: vi.fn()
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('preserves source and exclusion identities without repeating deposit scans on unrelated renders', async () => {
  const client = new QueryClient()
  const root = {
    vault: { chainId: 1, address: 'invalid', name: 'Example' },
    capitalUsd: 100,
    perfFee: 0,
    mgmtFee: 0,
    children: []
  }
  const rows: DirectDepositFeeRow[] = [
    {
      vault: root.vault,
      root,
      roots: [root],
      performanceFee: 0,
      managementFee: 0,
      feeRateBasis: 'stack',
      adjustedTvlUsd: 100
    }
  ]
  const vaults = new Map<string, OriginVault>()
  const scan = vi.spyOn(sources, 'directDepositSources')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result, rerender } = renderHook(() => useTableDepositSources(rows, vaults, null, undefined), { wrapper })
  await waitFor(() => expect(result.current.loading).toBe(false))
  const original = result.current
  const calls = scan.mock.calls.length
  rerender()
  expect(result.current.sources).toBe(original.sources)
  expect(result.current.exclusions).toBe(original.exclusions)
  expect(scan).toHaveBeenCalledTimes(calls)
  client.clear()
})
