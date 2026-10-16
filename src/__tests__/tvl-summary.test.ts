import { describe, expect, it } from 'vitest'
import {
  buildAdjustedChainTvl,
  buildChainTvlCsvRows,
  type LegacyTvlSummary,
  normalizeTvlSummary,
  resolveChainId,
  toggleSelectedChain
} from '@/components/landing/native-stats/tvl-summary'

function legacySummary(overrides: Partial<LegacyTvlSummary> = {}): LegacyTvlSummary {
  return {
    totalTvl: 0,
    v1Tvl: 0,
    v2Tvl: 0,
    v3Tvl: 0,
    curationTvl: 0,
    crossChainOverlapByCategory: {
      v1: 0,
      v2: 0,
      v3: 0,
      curation: 0
    },
    tvlByChain: {},
    tvlByCategory: {
      v1: 0,
      v2: 0,
      v3: 0,
      curation: 0
    },
    retiredTvlByCategory: {
      v1: 0,
      v2: 0,
      v3: 0,
      curation: 0
    },
    retiredVaults: [],
    vaultCount: {
      total: 0,
      v1: 0,
      v2: 0,
      v3: 0,
      curation: 0,
      active: 0,
      retired: 0
    },
    ...overrides
  }
}

describe('TVL by Chain adjustment', () => {
  it('retains explicit unavailable amounts and skips unavailable chart values', () => {
    const data = normalizeTvlSummary(
      legacySummary({
        totalTvl: null,
        activeVaultTvl: null,
        retiredVaultTvl: null,
        overlapExcluded: null,
        vaultBridgeExcluded: null,
        tvlByChain: { Katana: null, Ethereum: 100 },
        overlapByChain: { Katana: null, Ethereum: 10 }
      })
    )
    expect(data.totalTvl).toBeNull()
    expect(data.activeVaultTvl).toBeNull()
    expect(data.overlapExcluded).toBeNull()
    expect(data.vaultBridgeExcluded).toBeNull()
    expect(buildAdjustedChainTvl(data, 'all')).toEqual([{ chain: 'Ethereum', tvl: 90 }])
  })

  it('subtracts nested and cross-chain overlap from the raw chain TVL', () => {
    const data = normalizeTvlSummary(
      legacySummary({
        tvlByChain: { Ethereum: 358_588_329.88620764 },
        overlapByChain: { Ethereum: 23_468_684.668276418 },
        crossChainOverlapByChain: { Ethereum: 136_039_757.2144876 }
      })
    )

    const [ethereum] = buildAdjustedChainTvl(data, 'all')

    expect(ethereum?.chain).toBe('Ethereum')
    expect(ethereum?.tvl).toBeCloseTo(199_079_888.0034436)
  })

  it('subtracts only nested overlap when no cross-chain value exists for the chain', () => {
    const data = normalizeTvlSummary(
      legacySummary({
        tvlByChain: { Base: 100 },
        overlapByChain: { Base: 25 },
        crossChainOverlapByChain: {}
      })
    )

    expect(buildAdjustedChainTvl(data, 'all')).toEqual([{ chain: 'Base', tvl: 75 }])
  })

  it('leaves raw chain TVL unchanged when neither overlap field has a value', () => {
    const data = normalizeTvlSummary(
      legacySummary({
        tvlByChain: { Katana: 100 },
        overlapByChain: {},
        crossChainOverlapByChain: {}
      })
    )

    expect(buildAdjustedChainTvl(data, 'all')).toEqual([{ chain: 'Katana', tvl: 100 }])
  })

  it('normalizes legacy responses without crossChainOverlapByChain to an empty record', () => {
    const data = normalizeTvlSummary(
      legacySummary({
        tvlByChain: { Ethereum: 100 },
        overlapByChain: { Ethereum: 10 }
      })
    )

    expect(data.crossChainOverlapByChain).toEqual({})
    expect(buildAdjustedChainTvl(data, 'all')).toEqual([{ chain: 'Ethereum', tvl: 90 }])
  })

  it('uses the same adjusted value for the rendered chain data and CSV rows', () => {
    const data = normalizeTvlSummary(
      legacySummary({
        tvlByChain: { Ethereum: 200 },
        overlapByChain: { Ethereum: 25 },
        crossChainOverlapByChain: { Ethereum: 50 }
      })
    )
    const chainData = buildAdjustedChainTvl(data, 'all').map((row) => ({ ...row, label: row.chain }))

    expect(chainData[0]?.tvl).toBe(125)
    expect(buildChainTvlCsvRows(chainData)).toEqual([['Ethereum', 125]])
  })

  it('excludes Berachain and Sonic from the table and CSV source', () => {
    const data = normalizeTvlSummary(
      legacySummary({
        tvlByChain: { Ethereum: 100, Berachain: 2, Sonic: 1 },
        overlapByChain: {},
        crossChainOverlapByChain: {}
      })
    )
    const chainData = buildAdjustedChainTvl(data, 'all').map((row) => ({ ...row, label: row.chain }))

    expect(chainData).toEqual([{ chain: 'Ethereum', label: 'Ethereum', tvl: 100 }])
    expect(buildChainTvlCsvRows(chainData)).toEqual([['Ethereum', 100]])
    expect(buildAdjustedChainTvl(data, 'Berachain')).toEqual([])
    expect(buildAdjustedChainTvl(data, 'Sonic')).toEqual([])
  })

  it('keeps negative adjusted upstream values visible instead of silently dropping them', () => {
    const data = normalizeTvlSummary(
      legacySummary({
        tvlByChain: { Ethereum: 10 },
        overlapByChain: { Ethereum: 7 },
        crossChainOverlapByChain: { Ethereum: 5 }
      })
    )

    expect(buildAdjustedChainTvl(data, 'all')).toEqual([{ chain: 'Ethereum', tvl: -2 }])
  })

  it('resolves named and fallback chain identifiers for history queries', () => {
    expect(resolveChainId('Ethereum', { 1: 'Ethereum', 8453: 'Base' })).toBe(1)
    expect(resolveChainId('Chain 999', { 1: 'Ethereum' })).toBe(999)
    expect(resolveChainId('Unknown', { 1: 'Ethereum' })).toBeNull()
  })

  it('selects a chain row and collapses it when selected again', () => {
    expect(toggleSelectedChain(null, 'Ethereum')).toBe('Ethereum')
    expect(toggleSelectedChain('Ethereum', 'Base')).toBe('Base')
    expect(toggleSelectedChain('Ethereum', 'Ethereum')).toBeNull()
  })
})
