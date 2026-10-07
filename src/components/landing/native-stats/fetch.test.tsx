import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveStatsApiBase, useFetch } from './hooks'

function response(value: unknown) {
  return { ok: true, status: 200, json: async () => value } as Response
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('published fee requests', () => {
  it('retains the existing TVL origin when the new data origin is absent', () => {
    vi.stubGlobal('window', undefined)
    vi.stubEnv('VITE_PUBLIC_YEARN_DATA_API_URL', '')
    vi.stubEnv('VITE_PUBLIC_YEARN_TVL_API_URL', 'https://tvl.example/')
    vi.stubEnv('VITE_PUBLIC_YEARN_FEES_API_URL', 'https://fees.example/')
    expect(resolveStatsApiBase('tvl')).toBe('https://tvl.example')
    expect(resolveStatsApiBase('fees')).toBe('https://fees.example')
  })

  it('keeps production core, analytics and TVL origins independent', () => {
    vi.stubGlobal('window', undefined)
    vi.stubEnv('VITE_PUBLIC_YEARN_DATA_API_URL', 'https://data.example/')
    vi.stubEnv('VITE_PUBLIC_YEARN_FEES_API_URL', 'https://analytics.example/')
    vi.stubEnv('VITE_PUBLIC_YEARN_TVL_API_URL', 'https://tvl.example/')
    expect(resolveStatsApiBase('fees')).toBe('https://data.example')
    expect(resolveStatsApiBase('fee-analytics')).toBe('https://analytics.example')
    expect(resolveStatsApiBase('tvl')).toBe('https://data.example')
    expect(resolveStatsApiBase('tvl-analytics')).toBe('https://tvl.example')
  })

  it('does not expose a previous range while the next range loads', async () => {
    let complete: (value: Response) => void = () => {}
    const pending = new Promise<Response>((resolve) => {
      complete = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ amount: '1' }))
        .mockReturnValueOnce(pending)
    )
    const { result, rerender } = renderHook(
      ({ chain }) => useFetch<{ amount: string }>(`/api/fees?chainId=${chain}&since=111`),
      { initialProps: { chain: 1 } }
    )
    await waitFor(() => expect(result.current.data?.amount).toBe('1'))
    rerender({ chain: 10 })
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
    await act(async () => {
      complete(response({ amount: '2' }))
    })
    await waitFor(() => expect(result.current.data?.amount).toBe('2'))
  })

  it('ignores a late response from an earlier filter', async () => {
    let complete: (value: Response) => void = () => {}
    const pending = new Promise<Response>((resolve) => {
      complete = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(pending)
        .mockResolvedValueOnce(response({ amount: 'new' }))
    )
    const { result, rerender } = renderHook(
      ({ chain }) => useFetch<{ amount: string }>(`/api/fees?chainId=${chain}&since=222`),
      { initialProps: { chain: 1 } }
    )
    rerender({ chain: 10 })
    await waitFor(() => expect(result.current.data?.amount).toBe('new'))
    await act(async () => {
      complete(response({ amount: 'old' }))
    })
    expect(result.current.data?.amount).toBe('new')
  })

  it('does not let a superseded refresh replace the newer cached publication', async () => {
    let complete: (value: Response) => void = () => {}
    const pending = new Promise<Response>((resolve) => {
      complete = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ amount: 'initial' }))
        .mockReturnValueOnce(pending)
        .mockResolvedValueOnce(response({ amount: 'new' }))
    )
    const url = '/api/fees?since=444'
    const first = renderHook(() => useFetch<{ amount: string }>(url))
    await waitFor(() => expect(first.result.current.data?.amount).toBe('initial'))
    act(() => first.result.current.refresh())
    act(() => first.result.current.refresh())
    await waitFor(() => expect(first.result.current.data?.amount).toBe('new'))
    await act(async () => complete(response({ amount: 'old' })))
    expect(first.result.current.data?.amount).toBe('new')
    first.unmount()
    const second = renderHook(() => useFetch<{ amount: string }>(url))
    expect(second.result.current.data?.amount).toBe('new')
  })

  it('waits for dataset selection and supports retry after HTTP failure', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        json: async () => ({ error: 'Try again' })
      })
      .mockResolvedValueOnce(response({ amount: '10' }))
    vi.stubGlobal('fetch', fetch)
    const { result, rerender } = renderHook(
      ({ enabled }) => useFetch<{ amount: string }>('/api/fees?since=333', { enabled }),
      { initialProps: { enabled: false } }
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    rerender({ enabled: true })
    await waitFor(() => expect(result.current.status).toBe(503))
    expect(result.current.data).toBeNull()
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.data?.amount).toBe('10'))
    expect(result.current.error).toBeNull()
  })
})
