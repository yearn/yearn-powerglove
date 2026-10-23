import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useFetch } from './hooks'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('preserves an explicitly pinned publication without appending a second selection', async () => {
  const publicationId = 'a'.repeat(64)
  const url = `/api/comparison/defillama-comparable?publicationId=${publicationId}`
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ publicationId }) })
  vi.stubGlobal('fetch', fetch)
  const { result } = renderHook(() => useFetch(url))
  await waitFor(() => expect(result.current.data).toEqual({ publicationId }))
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0][0]).toBe(url)
})

it('rejects malformed fee stacks before caching and recovers through scoped retry', async () => {
  const publicationId = 'b'.repeat(64)
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ chains: [] }) })
  vi.stubGlobal('fetch', fetch)
  const { result } = renderHook(() => useFetch(`/api/fees/stack?publicationId=${publicationId}`))
  await waitFor(() => expect(result.current.error).toBe('Effective fee stack response is invalid'))
  expect(result.current.data).toBeNull()
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.data).toEqual({ chains: [] }))
  expect(result.current.error).toBeNull()
})
