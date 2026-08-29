// Brand colors per chain, used for the protocol TVL-by-chain stacked area chart.
// No chain -> color map existed before; this is the new map referenced by the
// protocol overview charts.
import type { ChainId } from '@/constants/chains'
import { CHAIN_ID_TO_NAME } from '@/constants/chains'

// Brand colors for each Yearn-supported chain. Values are the canonical brand
// hex used across the ecosystem (matching visual.yearn.dev / DefiLlama vibes).
export const CHAIN_ID_TO_COLOR: Record<ChainId, string> = {
  1: '#627EEA', // Ethereum
  10: '#FF0420', // Optimism
  100: '#48A9A6', // Gnosis
  137: '#8247E5', // Polygon
  250: '#13B5EC', // Fantom
  8453: '#0052FF', // Base
  42161: '#28A0F0', // Arbitrum
  747474: '#C026D3', // Katana
  80094: '#7B2BF9' // Berachain
}

// DefiLlama reports chain TVL keyed by display name. Map those names back to the
// chain ids this app understands. Only the chains DefiLlama tracks for Yearn
// appear here; chains absent from DefiLlama (e.g. Gnosis, Berachain) simply have
// no historical series and are excluded from the historical chart.
export const DEFILLAMA_CHAIN_NAME_TO_CHAIN_ID: Record<string, ChainId> = {
  Ethereum: 1,
  Optimism: 10,
  Polygon: 137,
  Fantom: 250,
  Arbitrum: 42161,
  Base: 8453,
  Katana: 747474
}

export interface ChainColorEntry {
  chainId: ChainId
  name: string
  color: string
}

// Returns chain color entries ordered by the given TVL (descending). Used to
// stack the largest chains first in the protocol TVL chart for visual clarity.
export function getOrderedChainColorEntries(tvlByChainId: Partial<Record<ChainId, number>>): ChainColorEntry[] {
  return (Object.keys(CHAIN_ID_TO_NAME) as unknown as ChainId[])
    .map((chainId) => {
      const id = Number(chainId) as ChainId
      return {
        chainId: id,
        name: CHAIN_ID_TO_NAME[id],
        color: CHAIN_ID_TO_COLOR[id],
        tvl: tvlByChainId[id] ?? 0
      }
    })
    .filter((entry) => entry.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl)
    .map(({ chainId, name, color }) => ({ chainId, name, color }))
}
