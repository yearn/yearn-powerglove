// Bulk USD-price resolution for vault assets via DefiLlama's coins price API.
//
// Envio Deposit/Withdraw events carry only the raw token `assets` (no USD), so to
// plot activity in USD we resolve a price per distinct (chainId, asset address).
// Kong's `prices` resolver throws server-side for most assets, so we use DefiLlama
// (`coins.llama.fi/prices/current/...`), which batches every asset into a single
// request and returns price + decimals + symbol.

import { getAddress } from 'viem'

export interface AssetKey {
  chainId: number
  address: string
}

// DefiLlama coins chain slugs for every Yearn-supported chain.
const DEFILLAMA_COINS_CHAIN_PREFIX: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  100: 'xdai', // Gnosis
  137: 'polygon',
  250: 'fantom',
  8453: 'base',
  42161: 'arbitrum',
  747474: 'katana',
  80094: 'berachain'
}

const DEFILLAMA_COINS_URL = 'https://coins.llama.fi/prices/current/'

const normalize = (address: string): string => {
  try {
    return getAddress(address)
  } catch {
    return address.toLowerCase()
  }
}

/** Stable map key for a (chainId, asset) pair. */
export const priceKey = (chainId: number, address: string): string => `${chainId}:${normalize(address)}`

interface CoinsPriceResponse {
  coins?: Record<string, { price?: number } | undefined>
}

/**
 * Resolve a USD price for every distinct (chainId, asset) in `keys`. Returns a
 * map keyed by `priceKey(chainId, address)`. Assets on unknown chains or that
 * DefiLlama doesn't price are simply absent; callers treat absence as
 * "unpriceable" and skip the event in USD aggregations.
 */
export async function fetchAssetPriceUsdMap(keys: AssetKey[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (keys.length === 0) {
    return result
  }

  // Dedupe and keep only assets on chains DefiLlama knows about.
  const distinct = new Map<string, AssetKey>()
  for (const key of keys) {
    const slug = DEFILLAMA_COINS_CHAIN_PREFIX[key.chainId]
    if (!slug) continue
    distinct.set(priceKey(key.chainId, key.address), key)
  }
  if (distinct.size === 0) {
    return result
  }

  const coinTokens = [...distinct.values()].map(
    (key) => `${DEFILLAMA_COINS_CHAIN_PREFIX[key.chainId]}:${key.address.toLowerCase()}`
  )
  const url = `${DEFILLAMA_COINS_URL}${coinTokens.join(',')}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`DefiLlama coins request failed (${response.status})`)
  }
  const data = (await response.json()) as CoinsPriceResponse
  const coins = data?.coins ?? {}

  for (const key of distinct.values()) {
    const token = `${DEFILLAMA_COINS_CHAIN_PREFIX[key.chainId]}:${key.address.toLowerCase()}`
    const price = coins[token]?.price
    if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
      result.set(priceKey(key.chainId, key.address), price)
    }
  }
  return result
}
