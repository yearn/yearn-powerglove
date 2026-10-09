const DATA_ROUTES = new Set([
  '/api/publication',
  '/api/tvl',
  '/api/tvl/graph',
  '/api/tvl/history/runs/latest',
  '/api/tvl/history/runs/latest/constant-price',
  '/api/tvl/curation-products',
  '/api/audit/tree',
  '/api/fees',
  '/api/fees/history',
  '/api/fees/vaults',
  '/api/fees/stack',
  '/api/profitability',
  '/api/analytics/publication',
  '/api/comparison',
  '/api/comparison/defillama-comparable'
])

type Response = {
  status: (code: number) => { json: (body: unknown) => unknown }
  setHeader: (name: string, value: string) => void
}

// Vercel runs this proxy on the server. Its upstream access token never reaches Vite.
export default async function handler(req: { method?: string; url?: string }, res: Response) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const request = new URL(req.url ?? '/', 'https://powerglove.invalid')
  const path = (request.searchParams.get('__statsPath') ?? request.pathname).replace(/\/$/, '')
  request.searchParams.delete('__statsPath')
  if (!DATA_ROUTES.has(path)) return res.status(404).json({ error: 'Not found' })

  const target = process.env.YEARN_DATA_API_URL
  if (!target) return res.status(503).json({ error: 'Stats API is not configured' })

  try {
    const upstream = new URL(target)
    if (upstream.protocol !== 'https:' || upstream.username || upstream.password) {
      return res.status(503).json({ error: 'Stats API is not configured' })
    }
    upstream.pathname = path
    upstream.search = request.search
    upstream.hash = ''
    const headers: Record<string, string> = { Accept: 'application/json' }
    const token = process.env.YEARN_DATA_API_PROTECTION_BYPASS
    if (token && upstream.hostname.endsWith('.vercel.app')) headers['x-vercel-protection-bypass'] = token
    const response = await fetch(upstream, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(55_000)
    })
    // An authentication redirect is not API data; never forward credentials to it.
    if (response.status >= 300 && response.status < 400) {
      return res.status(502).json({ error: 'Stats API is unavailable' })
    }
    const body = await response.json()
    res.setHeader('Cache-Control', response.headers.get('Cache-Control') ?? 'no-store')
    const cdnCache = response.headers.get('Vercel-CDN-Cache-Control')
    if (cdnCache) res.setHeader('Vercel-CDN-Cache-Control', cdnCache)
    return res.status(response.status).json(body)
  } catch {
    return res.status(502).json({ error: 'Stats API is unavailable' })
  }
}
