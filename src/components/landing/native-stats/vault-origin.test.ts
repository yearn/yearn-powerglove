import { describe, expect, it } from 'vitest'
import { buildVaultOriginRows, type OriginAudit, type OriginGraph, type OriginVault } from './vault-origin'

const vault = (address: string, tvlUsd: number | null): OriginVault => ({
  address,
  chainId: 1,
  name: address,
  category: 'v3',
  vaultType: 1,
  tvlUsd,
  isRetired: false,
  strategies: []
})
function node(address: string, rawTvlUsd: number, nodeType: 'vault' | 'strategy' = 'vault') {
  return {
    id: `1:${address}`,
    address,
    chainId: 1,
    name: address,
    category: nodeType === 'strategy' ? 'strategy' : 'v3',
    nodeType,
    rawTvlUsd,
    externalTvlUsd: 0,
    isRetired: false
  }
}
function edge(source: string, target: string, amount: number, holder = target) {
  return {
    id: `${source}:${target}`,
    sourceNodeId: `1:${source}`,
    targetNodeId: `1:${target}`,
    holderAddress: holder,
    kind: 'registry',
    tvlUsd: amount,
    deductedTvlUsd: 0
  }
}
const graph = (overrides: Partial<OriginGraph> = {}): OriginGraph => ({
  datasetId: 'selected',
  asOfTimestamp: 1,
  nodes: [],
  edges: [],
  ...overrides
})
const audit = (vaults: OriginVault[]): OriginAudit => ({ datasetId: 'selected', vaults })

describe('vault origin attribution', () => {
  it('separates incoming ownership from outgoing allocations through a router, including idle assets', () => {
    const data = audit([vault('0xold', 1494186.79), vault('0xv2', 4711427.15), vault('0xv3', 19470602.78)])
    const result = buildVaultOriginRows(
      data,
      graph({
        nodes: [
          node('0xold', 1494186.79),
          node('0xv2', 4711427.15),
          node('0xrouter', 4711427.15, 'strategy'),
          node('0xv3', 19470602.78)
        ],
        edges: [
          edge('0xold', '0xv2', 1482512.39),
          edge('0xv2', '0xrouter', 4711427.15),
          edge('0xrouter', '0xv3', 4711427.15, '0xrouter')
        ]
      })
    )
    expect(result).toHaveLength(3)
    expect(result[0].nonYearn).toBe(1494186.79)
    expect(result[1]).toMatchObject({ listed: 4711427.15, fromYearn: 1482512.39, toYearn: 4711427.15 })
    expect(result[1].nonYearn).toBeCloseTo(3228914.76)
    expect(result[2].nonYearn).toBeCloseTo(14759175.63)
    expect(result[1].outgoing).toEqual([{ vaultIds: ['1:0xv3'], via: '0xrouter', amount: 4711427.15 }])
  })

  it('shows mostly allocator-funded tokenized strategies with little non-Yearn-originated TVL', () => {
    const result = buildVaultOriginRows(
      audit([vault('0xallocator', 100), vault('0xstrategy', 101)]),
      graph({
        nodes: [node('0xallocator', 100), node('0xstrategy', 101)],
        edges: [edge('0xallocator', '0xstrategy', 100)]
      })
    )
    expect(result[1]).toMatchObject({ fromYearn: 100, nonYearn: 1, toYearn: 0 })
    expect(result[1].yearnShare).toBeCloseTo(100 / 101)
  })

  it('preserves unavailable relationship valuations and distinguishes them from observed zero', () => {
    const parent = vault('0xparent', 10)
    parent.strategies = [{ address: '0xrouter', debtUsd: null, targetVaultAddress: '0xchild', targetVaultChainId: 1 }]
    const result = buildVaultOriginRows(
      audit([parent, vault('0xchild', 20), vault('0xunknown', null), vault('0xzero', 0)]),
      graph({
        nodes: [node('0xparent', 10), node('0xchild', 20), node('0xzero', 0)]
      })
    )
    expect(result[0].toYearn).toBeNull()
    expect(result[1].fromYearn).toBeNull()
    expect(result[1].nonYearn).toBeNull()
    expect(result[2]).toMatchObject({ listed: null, fromYearn: null, nonYearn: null, toYearn: null })
    expect(result[3]).toMatchObject({ listed: 0, fromYearn: 0, nonYearn: 0, toYearn: 0 })
  })

  it('does not invent per-parent splits for a shared router or subtract curation funding', () => {
    const curation = { ...vault('0xcuration', 9), category: 'curation' }
    const result = buildVaultOriginRows(
      audit([vault('0xa', 6), vault('0xb', 4), vault('0xchild', 20), curation]),
      graph({
        nodes: [
          node('0xa', 6),
          node('0xb', 4),
          node('0xrouter', 10, 'strategy'),
          node('0xchild', 20),
          { ...node('0xcuration', 9), category: 'curation' }
        ],
        edges: [
          edge('0xa', '0xrouter', 6),
          edge('0xb', '0xrouter', 4),
          edge('0xrouter', '0xchild', 10, '0xrouter'),
          edge('0xcuration', '0xchild', 9)
        ]
      })
    )
    expect(result[0].toYearn).toBeNull()
    expect(result[1].toYearn).toBeNull()
    expect(result[2]).toMatchObject({ fromYearn: 10, nonYearn: 10 })
    expect(result).toHaveLength(3)
  })

  it('rejects mixed publications', () => {
    expect(() => buildVaultOriginRows(audit([]), graph({ datasetId: 'other' }))).toThrow('publications do not match')
  })

  it('keeps excluded migrated bridge balances from invalidating the receiving vault’s origins', () => {
    const migrated = vault('0xmigrated', 50)
    migrated.strategies = [{ address: '0xchild', debtUsd: 50, targetVaultAddress: '0xchild', targetVaultChainId: 1 }]
    const result = buildVaultOriginRows(
      audit([migrated, vault('0xchild', 20)]),
      graph({
        nodes: [node('0xchild', 20)],
        bridgeExclusions: [{ sourceNodeId: '1:0xmigrated' }]
      })
    )
    expect(result[0].nonYearn).toBeNull()
    expect(result[1]).toMatchObject({ fromYearn: 0, nonYearn: 20 })
  })
})
