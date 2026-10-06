import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useChainFeeHistories } from './useChainFeeHistories'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function history(datasetId: string, interval = 'monthly') {
  return new Response(JSON.stringify({ datasetId, interval, buckets: [] }))
}

describe('useChainFeeHistories', () => {
  it('pins every chain to the selected dataset and timeframe', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(history('selected', 'weekly')))
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() =>
      useChainFeeHistories('since=100&until=200&interval=weekly&datasetId=selected', [1, 10])
    )
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/fees/history?since=100&until=200&interval=weekly&datasetId=selected&chainId=1',
      '/api/fees/history?since=100&until=200&interval=weekly&datasetId=selected&chainId=10'
    ])
  })

  it('rejects a response with the wrong bucket interval', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(history('selected', 'monthly')))
    )
    const { result } = renderHook(() => useChainFeeHistories('datasetId=selected&interval=weekly', [1]))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('rejects mixed datasets and retries the whole breakdown', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(history('other'))
      .mockImplementation(() => Promise.resolve(history('selected')))
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useChainFeeHistories('datasetId=selected', [1, 10]))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.data).toBeNull()
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(result.current.error).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('does not render a partial stack when one chain request fails', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(history('selected'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useChainFeeHistories('datasetId=selected', [1, 10]))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('ignores an older response after the window changes', async () => {
    let resolveOld: (response: Response) => void = () => {}
    const old = new Promise<Response>((resolve) => {
      resolveOld = resolve
    })
    const fetch = vi
      .fn()
      .mockReturnValueOnce(old)
      .mockImplementation(() => Promise.resolve(history('selected')))
    vi.stubGlobal('fetch', fetch)
    const { result, rerender } = renderHook(({ query }) => useChainFeeHistories(query, [1]), {
      initialProps: { query: 'datasetId=selected&since=100' }
    })
    rerender({ query: 'datasetId=selected&since=200' })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    const current = result.current.data
    await act(async () => resolveOld(history('selected')))
    expect(result.current.data).toBe(current)
  })
})
