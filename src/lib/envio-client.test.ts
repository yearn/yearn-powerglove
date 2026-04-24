import { afterEach, describe, expect, it, vi } from 'vitest'
import { isEnvioConfigured, queryEnvio } from '@/lib/envio-client'

describe('envio-client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('requires an explicit GraphQL endpoint', async () => {
    vi.stubEnv('VITE_PUBLIC_ENVIO_GRAPHQL_URL', '')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    expect(isEnvioConfigured()).toBe(false)
    await expect(queryEnvio('{ ping }')).rejects.toThrow(
      'Historical user events require VITE_PUBLIC_ENVIO_GRAPHQL_URL to be configured.'
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts requests to the configured endpoint', async () => {
    vi.stubEnv('VITE_PUBLIC_ENVIO_GRAPHQL_URL', 'https://envio.example/graphql')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ping: true } })
    } as Response)

    await expect(queryEnvio<{ ping: boolean }>('{ ping }')).resolves.toEqual({ ping: true })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://envio.example/graphql',
      expect.objectContaining({
        method: 'POST'
      })
    )
  })
})
