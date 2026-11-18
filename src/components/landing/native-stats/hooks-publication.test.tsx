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

it('reselects a retired publication on retry while sharing concurrent initial selection', async () => {
  const oldId = 'c'.repeat(64)
  const newId = 'd'.repeat(64)
  let selections = 0
  const fetch = vi.fn(async (url: string) => {
    if (url === '/api/analytics/publication')
      return { ok: true, status: 200, json: async () => ({ publicationId: ++selections === 1 ? oldId : newId }) }
    if (url.includes(oldId)) return { ok: false, status: 410, json: async () => ({ error: 'Retired publication' }) }
    return { ok: true, status: 200, json: async () => ({ publicationId: newId }) }
  })
  vi.stubGlobal('fetch', fetch)
  const { result } = renderHook(() => ({
    first: useFetch('/api/profitability?rotation-test=1'),
    second: useFetch('/api/comparison?rotation-test=1')
  }))
  await waitFor(() => expect(result.current.first.status).toBe(410))
  await waitFor(() => expect(result.current.second.status).toBe(410))
  expect(selections).toBe(1)
  act(() => {
    result.current.first.retry()
    result.current.second.retry()
  })
  await waitFor(() => expect(result.current.first.data).toEqual({ publicationId: newId }))
  await waitFor(() => expect(result.current.second.data).toEqual({ publicationId: newId }))
  expect(selections).toBe(2)
})
