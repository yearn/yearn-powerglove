import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/yearn-data'

function response() {
  const json = vi.fn()
  return { json, status: vi.fn(() => ({ json })), setHeader: vi.fn() }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('hosted Yearn Data proxy', () => {
  it('preserves graph filters and keeps upstream authentication on the server', async () => {
    vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
    vi.stubEnv('YEARN_DATA_API_PROTECTION_BYPASS', 'server-secret')
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ datasetId: 'selected' })))
    vi.stubGlobal('fetch', fetch)
    const res = response()
    await handler({ method: 'GET', url: '/api/tvl/graph?chainId=747474&datasetId=selected' }, res)
    const [url, options] = fetch.mock.calls[0]
    expect(url.toString()).toBe('https://data-preview.vercel.app/api/tvl/graph?chainId=747474&datasetId=selected')
    expect(options.headers['x-vercel-protection-bypass']).toBe('server-secret')
    expect(options.redirect).toBe('manual')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ datasetId: 'selected' })
    expect(JSON.stringify(res.setHeader.mock.calls)).not.toContain('server-secret')
  })

  it('resolves explicit hosted rewrites while retaining API filters', async () => {
    vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ releaseId: 'current' })))
    vi.stubGlobal('fetch', fetch)
    const res = response()
    await handler({ method: 'GET', url: '/api/yearn-data?__statsPath=/api/publication' }, res)
    expect(fetch.mock.calls[0][0].toString()).toBe('https://data-preview.vercel.app/api/publication')
    expect(res.status).toHaveBeenCalledWith(200)
    const graphResponse = response()
    await handler({ method: 'GET', url: '/api/yearn-data?__statsPath=/api/tvl/graph&chainId=1' }, graphResponse)
    expect(graphResponse.status).toHaveBeenCalledWith(200)
    expect(fetch.mock.calls[1][0].toString()).toBe('https://data-preview.vercel.app/api/tvl/graph?chainId=1')
  })

  it('preserves retired publication responses instead of turning them into successful data', async () => {
    vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Data was updated' }), { status: 410 }))
    )
    const res = response()
    await handler({ method: 'GET', url: '/api/tvl?datasetId=old' }, res)
    expect(res.status).toHaveBeenCalledWith(410)
    expect(res.json).toHaveBeenCalledWith({ error: 'Data was updated' })
  })

  it.each([
    ['POST', '/api/tvl', 405],
    ['GET', '/api/unknown', 404],
    ['GET', '/api/tvl/curation-products', 404],
    ['GET', '/api/yearn-data?__statsPath=/api/unknown', 404],
    ['GET', '/api/tvl', 503]
  ])('rejects %s %s without contacting an unconfigured upstream', async (method, url, status) => {
    vi.stubEnv('YEARN_DATA_API_URL', '')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const res = response()
    await handler({ method, url }, res)
    expect(res.status).toHaveBeenCalledWith(status)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects legacy fee payloads before any chart can consume them', async () => {
    vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            datasetId: 'old',
            totalFeesPaidUsd: '624567.52'
          })
        )
      )
    )
    const res = response()
    await handler({ method: 'GET', url: '/api/fees' }, res)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Fee API is outdated or returned the wrong aggregation scope. Check the Yearn Data API target.'
    })
  })

  it('does not follow protected API redirects or expose their body', async () => {
    vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private login details', { status: 302 })))
    const res = response()
    await handler({ method: 'GET', url: '/api/fees' }, res)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: 'Stats API is unavailable' })
  })
})

it.each([410, 500, 503])('keeps upstream %s responses uncacheable while preserving the error', async (status) => {
  vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unavailable' }), {
        status,
        headers: { 'Cache-Control': 'public, max-age=3600', 'Vercel-CDN-Cache-Control': 'public, s-maxage=3600' }
      })
    )
  )
  const res = response()
  await handler({ method: 'GET', url: '/api/tvl' }, res)
  expect(res.status).toHaveBeenCalledWith(status)
  expect(res.json).toHaveBeenCalledWith({ error: 'Unavailable' })
  expect(res.setHeader.mock.calls).toEqual([['Cache-Control', 'no-store']])
})

it('retains cache directives for successful upstream data', async () => {
  vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tvl: 1 }), {
        headers: { 'Cache-Control': 'public, max-age=60', 'Vercel-CDN-Cache-Control': 'public, s-maxage=120' }
      })
    )
  )
  const res = response()
  await handler({ method: 'GET', url: '/api/tvl' }, res)
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=60')
  expect(res.setHeader).toHaveBeenCalledWith('Vercel-CDN-Cache-Control', 'public, s-maxage=120')
})

it('distinguishes a failed upstream request from an incompatible fee response', async () => {
  vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream fetch failed')))
  const res = response()
  await handler({ method: 'GET', url: '/api/fees' }, res)
  expect(res.status).toHaveBeenCalledWith(502)
  expect(res.json).toHaveBeenCalledWith({ error: 'Stats API is unavailable' })
})

it('reports a wrong fee aggregation scope as an incompatible response', async () => {
  vi.stubEnv('YEARN_DATA_API_URL', 'https://data-preview.vercel.app')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          datasetId: 'selected',
          aggregationScope: 'contract'
        })
      )
    )
  )
  const res = response()
  await handler({ method: 'GET', url: '/api/fees/vaults?scope=product' }, res)
  expect(res.status).toHaveBeenCalledWith(502)
  expect(res.json).toHaveBeenCalledWith({
    error: 'Fee API is outdated or returned the wrong aggregation scope. Check the Yearn Data API target.'
  })
  expect(res.setHeader.mock.calls).toEqual([['Cache-Control', 'no-store']])
})
