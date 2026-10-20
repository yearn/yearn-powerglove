const DEFAULT_YVUSD_APR_SERVICE_API = 'https://yvusd-api.yearn.fi/api/aprs'

const getUpstreamUrl = (): URL => {
  const configuredUrl = (process.env.YVUSD_APR_SERVICE_API || DEFAULT_YVUSD_APR_SERVICE_API).replace(/\/$/, '')
  return new URL(configuredUrl)
}

export default async function handler(
  req: { method?: string; query?: Record<string, unknown> },
  res: {
    status: (code: number) => { json: (body: unknown) => unknown }
    setHeader: (name: string, value: string) => void
  }
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const upstreamUrl = getUpstreamUrl()
    Object.entries(req.query ?? {}).forEach(([key, value]) => {
      if (typeof value === 'string') {
        upstreamUrl.searchParams.set(key, value)
      }
    })

    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'yvUSD APR upstream error',
        status: response.status
      })
    }

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
    return res.status(200).json(await response.json())
  } catch (error) {
    console.error('Error proxying yvUSD APR request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
