import type { TvlSummary } from './types'

export type LegacyTvlSummary = Omit<
  TvlSummary,
  | 'activeVaultTvl'
  | 'retiredVaultTvl'
  | 'overlapExcluded'
  | 'vaultBridgeExcluded'
  | 'overlapByChain'
  | 'crossChainOverlapByChain'
> & {
  activeVaultTvl?: number
  retiredVaultTvl?: number
  overlapExcluded?: number
  vaultBridgeExcluded?: number
  overlapByChain?: Record<string, number>
  crossChainOverlapByChain?: Record<string, number>
  activeTvl?: number
  retiredTvl?: number
  overlapAmount?: number
  crossChainOverlap?: number
}

export interface AdjustedChainTvl {
  chain: string
  tvl: number
}

const TVL_BY_CHAIN_EXCLUDED_CHAINS = new Set(['Berachain', 'Sonic'])

export function normalizeTvlSummary(data: LegacyTvlSummary): TvlSummary {
  return {
    ...data,
    activeVaultTvl: data.activeVaultTvl ?? data.activeTvl ?? 0,
    retiredVaultTvl: data.retiredVaultTvl ?? data.retiredTvl ?? 0,
    overlapExcluded: data.overlapExcluded ?? data.overlapAmount ?? 0,
    vaultBridgeExcluded: data.vaultBridgeExcluded ?? data.crossChainOverlap ?? 0,
    overlapByChain: data.overlapByChain ?? {},
    crossChainOverlapByChain: data.crossChainOverlapByChain ?? {}
  }
}

export function getAdjustedChainTvl(
  rawTvl: number,
  nestedOverlap: number | undefined,
  crossChainOverlap: number | undefined
): number {
  return rawTvl - (nestedOverlap ?? 0) - (crossChainOverlap ?? 0)
}

export function buildAdjustedChainTvl(
  data: Pick<TvlSummary, 'tvlByChain' | 'overlapByChain' | 'crossChainOverlapByChain'>,
  chainFilter: string
): AdjustedChainTvl[] {
  return (
    Object.entries(data.tvlByChain)
      .filter(([chain]) => !TVL_BY_CHAIN_EXCLUDED_CHAINS.has(chain) && (chainFilter === 'all' || chain === chainFilter))
      .map(([chain, rawTvl]) => ({
        chain,
        tvl: getAdjustedChainTvl(rawTvl, data.overlapByChain[chain], data.crossChainOverlapByChain[chain])
      }))
      // Keep negative adjusted values visible. They signal upstream overlap larger than raw TVL and must not disappear silently.
      .filter(({ tvl }) => tvl !== 0)
      .sort((a, b) => b.tvl - a.tvl)
  )
}

export function buildChainTvlCsvRows(chainData: Array<AdjustedChainTvl & { label: string }>): Array<[string, number]> {
  return chainData.map(({ label, tvl }) => [label, tvl])
}

export function resolveChainId(chain: string, chainNames: Record<number, string>): number | null {
  const namedChain = Object.entries(chainNames).find(([, name]) => name === chain)
  if (namedChain) return Number(namedChain[0])
  const fallback = /^Chain (\d+)$/.exec(chain)
  return fallback ? Number(fallback[1]) : null
}

export function toggleSelectedChain(current: string | null, next: string): string | null {
  return current === next ? null : next
}
