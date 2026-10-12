import { cleanup, renderHook, waitFor } from '@testing-library/react'
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
