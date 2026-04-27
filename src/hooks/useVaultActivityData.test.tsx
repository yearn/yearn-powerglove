import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVaultActivityData } from './useVaultActivityData'

const vaultAddress = '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

describe('useVaultActivityData', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('loads a valid local fixture', async () => {
    vi.stubEnv('VITE_PUBLIC_YEARNFI_API_URL', '')
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        generatedAt: '2026-04-26T00:00:00.000Z',
        chainId: 1,
        vaultAddress,
        currentUnlock: null,
        events: [
          {
            eventType: 'strategy_reported',
            txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
            blockNumber: 123,
            timestamp: 1776520800,
            gain: '1000000'
          }
        ],
        meta: {
          assetDecimals: 6
        }
      })
    })

    const { result } = renderHook(() => useVaultActivityData(vaultAddress, 1), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetch).toHaveBeenCalledWith('/data/vault-activity/1/0xabcdefabcdefabcdefabcdefabcdefabcdefabcd.json', {
      headers: {
        Accept: 'application/json'
      }
    })
    expect(result.current.error).toBeNull()
    expect(result.current.data?.events[0].gain).toBe('1000000')
    expect(result.current.data?.events[0].gainDisplay).toBe(1)
  })

  it('returns null for a missing local fixture', async () => {
    vi.stubEnv('VITE_PUBLIC_YEARNFI_API_URL', '')
    mockFetch({
      ok: false,
      status: 404,
      json: async () => null
    })

    const { result } = renderHook(() => useVaultActivityData(vaultAddress, 1), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns a non-fatal error state for malformed fixture JSON', async () => {
    vi.stubEnv('VITE_PUBLIC_YEARNFI_API_URL', '')
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 99
      })
    })

    const { result } = renderHook(() => useVaultActivityData(vaultAddress, 1), {
      wrapper: createWrapper()
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.data).toBeNull()
    expect(result.current.error?.message).toContain('Unsupported vault activity fixture schemaVersion')
  })
})
