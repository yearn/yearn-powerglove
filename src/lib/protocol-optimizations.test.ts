import { describe, expect, it } from 'vitest'
import {
  dedupeLatestOptimizations,
  parseOptimizerTimestamp,
  type RawOptimizationRecord,
  shapeOptimizationItem,
  shapeOptimizerVaults,
  shapeStrategyAllocations
} from '@/lib/protocol-optimizations'

const baseRaw = (overrides: Partial<RawOptimizationRecord>): RawOptimizationRecord => ({
  vault: '0xVAULT',
  strategyDebtRatios: [
    { strategy: '0xS1', targetRatio: 5000, currentRatio: 5000, currentApr: 200, targetApr: 250 },
    { strategy: '0xS2', targetRatio: 5000, currentRatio: 5000, currentApr: 300, targetApr: 300 }
  ],
  currentApr: 283,
  proposedApr: 347,
  explain:
    'crvUSD-2 yVault (1: 0xaAbBcCdDeE1122334455667788990011223344aa)\nTVL: $1,743,062.59\nOptimization: trust-constr',
  source: {
    key: 'doa:optimizations:1:latest',
    chainId: 1,
    revision: 'latest',
    isLatestAlias: true,
    timestampUtc: null,
    latestMatchedTimestampUtc: '2026-07-02 06:14:29 UTC'
  },
  ...overrides
})

const atTimestamp = (vault: string, latest: string | null): RawOptimizationRecord =>
  baseRaw({ vault, source: { ...baseRaw({}).source, latestMatchedTimestampUtc: latest } })

describe('parseOptimizerTimestamp', () => {
  it('parses the UTC timestamp string to seconds', () => {
    expect(parseOptimizerTimestamp('2026-07-02 06:14:29 UTC')).toBeGreaterThan(0)
  })
  it('returns null for empty / invalid input', () => {
    expect(parseOptimizerTimestamp(null)).toBeNull()
    expect(parseOptimizerTimestamp('')).toBeNull()
    expect(parseOptimizerTimestamp('not a date')).toBeNull()
  })
})

describe('shapeStrategyAllocations', () => {
  it('converts bps ratios to percent, computes delta, assigns colors', () => {
    const rows = shapeStrategyAllocations([
      { strategy: '0xS1', targetRatio: 6000, currentRatio: 4000, currentApr: 200, targetApr: 250 },
      { strategy: '0xS2', targetRatio: 4000, currentRatio: 6000 }
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ currentPct: 40, targetPct: 60, deltaPct: 20, currentAprPct: 2, targetAprPct: 2.5 })
    expect(rows[1]).toMatchObject({ currentPct: 60, targetPct: 40, deltaPct: -20, currentAprPct: null })
    expect(rows[0].color).toMatch(/^#/)
    expect(rows[0].color).not.toBe(rows[1].color)
  })

  it('handles missing ratios', () => {
    expect(shapeStrategyAllocations([])).toEqual([])
    expect(shapeStrategyAllocations(undefined as unknown as never)).toEqual([])
  })
})

describe('shapeOptimizationItem', () => {
  it('converts bps-of-percent APRs to percent and computes delta', () => {
    const item = shapeOptimizationItem(baseRaw({}))
    expect(item.currentAprPct).toBeCloseTo(2.83)
    expect(item.proposedAprPct).toBeCloseTo(3.47)
    expect(item.aprDeltaPct).toBeCloseTo(0.64)
  })

  it('reads chainId, vaultLabel, tvl(USD), strategy count + strategies from explain/source', () => {
    const item = shapeOptimizationItem(baseRaw({}))
    expect(item.chainId).toBe(1)
    expect(item.vaultLabel).toBe('crvUSD-2 yVault')
    expect(item.tvlUsd).toBeCloseTo(1743062.59)
    expect(item.strategyCount).toBe(2)
    expect(item.strategies).toHaveLength(2)
    expect(item.timestampSeconds).toBeGreaterThan(0)
  })

  it('falls back to source.chainId when explain has none and nulls non-USD tvl', () => {
    const item = shapeOptimizationItem(
      baseRaw({
        explain: 'Some Vault\nTVL: 1,000 DAI',
        source: { ...baseRaw({}).source, chainId: 137 }
      })
    )
    expect(item.chainId).toBe(137)
    expect(item.tvlUsd).toBeNull()
  })

  it('handles malformed records without throwing', () => {
    const item = shapeOptimizationItem(
      baseRaw({ explain: '', currentApr: Number.NaN, proposedApr: Number.NaN, strategyDebtRatios: [] })
    )
    expect(item.currentAprPct).toBeNull()
    expect(item.proposedAprPct).toBeNull()
    expect(item.aprDeltaPct).toBeNull()
    expect(item.strategyCount).toBe(0)
    expect(item.strategies).toEqual([])
  })
})

describe('shapeOptimizerVaults', () => {
  it('orders by timestamp descending (most recent first) and applies the limit', () => {
    const records = [
      atTimestamp('0xOLD', '2026-06-01 00:00:00 UTC'),
      atTimestamp('0xNEW', '2026-07-02 06:14:29 UTC'),
      atTimestamp('0xMID', '2026-06-15 00:00:00 UTC')
    ]
    const vaults = shapeOptimizerVaults(records, 2)
    expect(vaults).toHaveLength(2)
    expect(vaults[0].vault).toBe('0xNEW')
    expect(vaults[1].vault).toBe('0xMID')
  })

  it('places records without a timestamp after timestamped ones', () => {
    const records = [atTimestamp('0xNONE', null), atTimestamp('0xTS', '2026-07-02 06:14:29 UTC')]
    const vaults = shapeOptimizerVaults(records, 5)
    expect(vaults[0].vault).toBe('0xTS')
    expect(vaults[1].vault).toBe('0xNONE')
  })
})

describe('dedupeLatestOptimizations', () => {
  it('keeps one record per vault, preferring the isLatestAlias record', () => {
    const sameVault = baseRaw({}).source
    const records = [
      baseRaw({
        vault: '0xDUP',
        source: {
          ...sameVault,
          isLatestAlias: false,
          revision: '1782965669',
          timestampUtc: '2026-07-01 00:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }),
      baseRaw({
        vault: '0xDUP',
        source: {
          ...sameVault,
          isLatestAlias: true,
          revision: 'latest',
          timestampUtc: null,
          latestMatchedTimestampUtc: '2026-07-02 06:14:29 UTC'
        }
      }),
      baseRaw({
        vault: '0xDUP',
        source: {
          ...sameVault,
          isLatestAlias: false,
          revision: '1782969280',
          timestampUtc: '2026-07-01 06:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }),
      baseRaw({
        vault: '0xOTHER',
        source: {
          ...sameVault,
          isLatestAlias: true,
          revision: 'latest',
          timestampUtc: null,
          latestMatchedTimestampUtc: '2026-07-02 06:14:29 UTC'
        }
      })
    ]
    const deduped = dedupeLatestOptimizations(records)
    expect(deduped).toHaveLength(2)
    const dup = deduped.find((r) => r.vault === '0xDUP')
    expect(dup?.source.isLatestAlias).toBe(true)
    expect(dup?.source.revision).toBe('latest')
  })

  it('falls back to the newest timestamp when no latest alias is present', () => {
    const src = baseRaw({}).source
    const records = [
      baseRaw({
        vault: '0xDUP',
        source: {
          ...src,
          isLatestAlias: false,
          timestampUtc: '2026-07-01 00:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }),
      baseRaw({
        vault: '0xDUP',
        source: {
          ...src,
          isLatestAlias: false,
          timestampUtc: '2026-07-05 00:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      })
    ]
    const deduped = dedupeLatestOptimizations(records)
    expect(deduped).toHaveLength(1)
    expect(deduped[0].source.timestampUtc).toBe('2026-07-05 00:00:00 UTC')
  })

  it('shapeOptimizerVaults surfaces no duplicates', () => {
    const src = baseRaw({}).source
    const records = [
      baseRaw({
        vault: '0xDUP',
        currentApr: 200,
        proposedApr: 300,
        source: { ...src, isLatestAlias: true, latestMatchedTimestampUtc: '2026-07-02 06:14:29 UTC' }
      }),
      baseRaw({
        vault: '0xDUP',
        currentApr: 200,
        proposedApr: 250,
        source: {
          ...src,
          isLatestAlias: false,
          revision: '1',
          timestampUtc: '2026-07-01 00:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }),
      baseRaw({
        vault: '0xOTHER',
        currentApr: 200,
        proposedApr: 400,
        source: { ...src, isLatestAlias: true, latestMatchedTimestampUtc: '2026-07-02 06:14:29 UTC' }
      })
    ]
    const vaults = shapeOptimizerVaults(records, 60)
    expect(vaults).toHaveLength(2)
    expect(vaults.map((v) => v.vault).sort()).toEqual(['0xDUP', '0xOTHER'])
  })

  it('collapses many revisions of one vault to its latest instance', () => {
    // Reproduces the "many WETH-1" report: the reallocation API emits one record
    // per revision for the same vault. Dedup must keep only the newest.
    const explain =
      'WETH-1 yVault (1: 0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0)\nTVL: $1,234,567.89\nOptimization: trust-constr'
    const base = baseRaw({}).source
    const records: RawOptimizationRecord[] = [
      baseRaw({
        vault: '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0',
        explain,
        source: {
          ...base,
          isLatestAlias: false,
          revision: '1771925237',
          timestampUtc: '2026-06-01 00:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }),
      baseRaw({
        vault: '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0',
        explain,
        source: {
          ...base,
          isLatestAlias: false,
          revision: '1780000000',
          timestampUtc: '2026-06-20 00:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }),
      baseRaw({
        vault: '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0',
        explain,
        source: {
          ...base,
          isLatestAlias: false,
          revision: '1782778468',
          timestampUtc: '2026-06-30 00:14:28 UTC',
          latestMatchedTimestampUtc: null
        }
      })
    ]
    const deduped = dedupeLatestOptimizations(records)
    expect(deduped).toHaveLength(1)
    expect(deduped[0].source.revision).toBe('1782778468')
    // The full sidebar pipeline must surface a single WETH-1 row.
    expect(shapeOptimizerVaults(records, 60)).toHaveLength(1)
  })

  it('still collapses when source.chainId is null but the explain header carries it', () => {
    // The reallocation API can emit a null source.chainId while the explain header
    // still names the chain. Keying on source.chainId alone would split the vault
    // across `1:addr` and `x:addr` keys and leak a duplicate; the explain-first key
    // (mirroring optimization-visualizer's getVaultOptionKey) collapses it.
    const explain =
      'WETH-1 yVault (1: 0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0)\nTVL: $1,234,567.89\nOptimization: trust-constr'
    const base = baseRaw({}).source
    const records: RawOptimizationRecord[] = [
      baseRaw({
        vault: '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0',
        explain,
        source: {
          ...base,
          chainId: null,
          isLatestAlias: false,
          revision: '1',
          timestampUtc: '2026-06-01 00:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }),
      baseRaw({
        vault: '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0',
        explain,
        source: {
          ...base,
          chainId: 1,
          isLatestAlias: false,
          revision: '2',
          timestampUtc: '2026-06-30 00:14:28 UTC',
          latestMatchedTimestampUtc: null
        }
      })
    ]
    expect(dedupeLatestOptimizations(records)).toHaveLength(1)
  })
})
