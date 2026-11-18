import { readFile } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'

const VAULT_PATH = /^\/vaults\/([1-9][0-9]*)\/(0x[a-fA-F0-9]{40})\/?$/
const SITE_ORIGIN = 'https://yearn-powerglove.vercel.app'
const IMAGE_URL = 'https://og.yearn.fi/api/og/powerglove'

function renderVaultSocialCard(html: string, pathname: string): string {
  const match = VAULT_PATH.exec(pathname)
  if (!match) return html

  const [, chainId, address] = match
  const image = `${IMAGE_URL}/vault/${chainId}/${address.toLowerCase()}`
  const url = `${SITE_ORIGIN}/vaults/${chainId}/${address}`

  return html
    .split(`content="${IMAGE_URL}"`)
    .join(`content="${image}"`)
    .replace(`property="og:url" content="${SITE_ORIGIN}"`, `property="og:url" content="${url}"`)
}

export default async function handler(req: { method?: string; query?: Record<string, unknown> }, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }

  const { chainId, address } = req.query ?? {}
  const pathname = typeof chainId === 'string' && typeof address === 'string' ? `/vaults/${chainId}/${address}` : ''
  const html = await readFile('dist/index.html', 'utf8')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(req.method === 'HEAD' ? undefined : renderVaultSocialCard(html, pathname))
}
