import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { VaultExtended } from '@/types/vaultTypes'
import fixture from './allocation-checkpoints.fixture.json'
import { buildReallocationRequestUrl, useReallocationData } from './useReallocationData'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  )
}
it('requests the complete schema 3 response once and preserves signed changes and detail links', async () => {
  vi.stubEnv('VITE_PUBLIC_ALLOCATION_HISTORY_API_URL', 'https://example.test/api/rest/views/allocation-history')
  const fetcher = vi.fn(
    async (_url: string, _options?: RequestInit) => new Response(JSON.stringify(fixture), { status: 200 })
  )
  vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(
    () => useReallocationData(fixture.vault.address, 1, { address: fixture.vault.address } as VaultExtended),
    { wrapper }
  )
  await waitFor(() => expect(result.current.data?.panels).toHaveLength(2))
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    buildReallocationRequestUrl('https://example.test/api/rest/views/allocation-history', fixture.vault.address, 1)
  )
  expect(result.current.data?.panels[0].checkpointChanges).toEqual(fixture.entries[0].interval?.changes)
  expect(result.current.data?.panels[0].flowLedger).toBeUndefined()
  expect(result.current.data?.panels[0].detailsHref).toBe(`https://example.test${fixture.entries[0].detailsHref}`)
  expect(result.current.issues).toEqual([])
})
it('constructs a request with direction only', () => {
  expect(buildReallocationRequestUrl('https://example.test/history/', '0xAbC', 1)).toBe(
    'https://example.test/history/1/0xabc?direction=desc'
  )
})
it('handles unpublished vaults as unavailable history', async () => {
  vi.stubEnv('VITE_PUBLIC_ALLOCATION_HISTORY_API_URL', 'https://example.test/history')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 }))
  )
  const { result } = renderHook(
    () => useReallocationData(fixture.vault.address, 1, { address: fixture.vault.address } as VaultExtended),
    { wrapper }
  )
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.data).toBeNull()
  expect(result.current.error).toBeNull()
})
