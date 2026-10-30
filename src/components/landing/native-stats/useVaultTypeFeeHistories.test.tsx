import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { useVaultTypeFeeHistories } from './useVaultTypeFeeHistories'

const { catalog } = vi.hoisted(() => ({ catalog: vi.fn() }))
vi.mock('@/lib/kong-vault-client', () => ({ fetchKongVaultListRaw: catalog }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('rejects an empty catalog even when tolerant consumers have cached it, and retries', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['fee-vault-type-catalog'], [])
  catalog.mockResolvedValueOnce([]).mockResolvedValueOnce([{ address: '0xvault', chainId: 1 }])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useVaultTypeFeeHistories('', []), { wrapper })
  await waitFor(() => expect(result.current.error).toBe(true))
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.error).toBe(false))
  expect(result.current.catalog).toHaveLength(1)
  client.clear()
})
