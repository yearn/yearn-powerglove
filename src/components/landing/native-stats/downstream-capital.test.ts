import { describe, expect, it } from 'vitest'
import { downstreamCapital } from './downstream-capital'
import type { OriginGraph, OriginVault } from './vault-origin'

const vault: OriginVault = {
  chainId: 1,
  address: '0xroot',
  name: 'Root',
  category: 'v3',
  vaultType: 1,
  tvlUsd: 100,
  countedTvlUsd: 60,
  isRetired: false,
  strategies: []
}
const position = (address: string, debtUsd: number | null) => ({
  address,
  debtUsd,
  targetVaultAddress: null,
  targetVaultChainId: null
})
const graph: OriginGraph = {
  datasetId: 'test',
  asOfTimestamp: 1,
  nodes: [
    {
      id: '1:0xstrategy',
      chainId: 1,
      address: '0xstrategy',
      name: 'Strategy',
      category: 'strategy',
      nodeType: 'strategy',
      rawTvlUsd: 100,
      externalTvlUsd: 0,
      isRetired: false
    }
  ],
  edges: []
}
function build(strategies: OriginVault['strategies'], edges = graph.edges) {
  return downstreamCapital(
    [{ vault, capitalUsd: 60 }],
    new Map([['1:0xroot', { ...vault, strategies }]]),
    { ...graph, edges },
    new Map()
  )[0]
}
const total = (root: ReturnType<typeof build>) => root.children.reduce((sum, node) => sum + (node.capitalUsd ?? 0), 0)

describe('full downstream capital', () => {
  it('includes non-fee-stack strategies and derived idle while preserving unknown fees', () => {
    const root = build([position('0xstrategy', 80)])
    expect(root.children.map((node) => [node.kind, node.capitalUsd])).toEqual([
      ['strategy', 48],
      ['idle', 12]
    ])
    expect(root.children[0].perfFee).toBeNull()
    expect(root.children[0].mgmtFee).toBeNull()
    expect(total(root)).toBe(60)
  })
  it('counts a router debt once even if several positions describe its destinations', () => {
    const root = build([position('0xstrategy', 80), position('0xstrategy', 80)])
    expect(root.children).toHaveLength(2)
    expect(root.children[0].capitalUsd).toBe(48)
    expect(total(root)).toBe(60)
  })
  it('keeps missing or conflicting debts unavailable and labels the remainder unresolved', () => {
    for (const positions of [
      [position('0xstrategy', null)],
      [position('0xstrategy', 50), position('0xstrategy', 80)]
    ]) {
      const root = build(positions)
      expect(root.children[0].capitalUsd).toBeNull()
      expect(root.children[1]).toMatchObject({ kind: 'unresolved', capitalUsd: 60 })
      expect(root.children.some((node) => node.kind === 'idle')).toBe(false)
    }
    expect(build([]).children[0].kind).toBe('unresolved')
  })
  it('uses the published asset-capped allocation when recorded debt exceeds assets', () => {
    const root = build(
      [position('0xstrategy', 400)],
      [
        {
          id: 'allocation',
          sourceNodeId: '1:0xroot',
          targetNodeId: '1:0xstrategy',
          holderAddress: '0xstrategy',
          kind: 'strategy',
          tvlUsd: 100,
          valueSource: 'parent-tvl-capped-debt-estimate'
        }
      ]
    )
    expect(root.children).toHaveLength(1)
    expect(root.children[0].capitalUsd).toBe(60)
    expect(root.children[0].note).toContain('capped')
    expect(total(root)).toBe(60)
  })
  it('shows an explicit signed adjustment instead of silently clipping excess uncapped debt', () => {
    const root = build([position('0xstrategy', 150)])
    expect(root.children.map((node) => [node.kind, node.capitalUsd])).toEqual([
      ['strategy', 90],
      ['adjustment', -30]
    ])
    expect(total(root)).toBe(60)
  })
  it('terminates circular allocation paths', () => {
    const fullGraph: OriginGraph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: '1:0xroot',
          ...vault,
          name: 'Root',
          nodeType: 'vault',
          rawTvlUsd: 100,
          externalTvlUsd: 60
        }
      ],
      edges: [
        {
          id: 'out',
          sourceNodeId: '1:0xroot',
          targetNodeId: '1:0xstrategy',
          holderAddress: '0xstrategy',
          kind: 'strategy',
          tvlUsd: 100
        },
        {
          id: 'back',
          sourceNodeId: '1:0xstrategy',
          targetNodeId: '1:0xroot',
          holderAddress: '0xstrategy',
          kind: 'registry',
          tvlUsd: 100
        }
      ]
    }
    const root = downstreamCapital([{ vault, capitalUsd: 60 }], new Map([['1:0xroot', vault]]), fullGraph, new Map())[0]
    expect(root.children[0].children[0].note).toContain('circular')
    expect(root.children[0].children[0].children).toEqual([])
  })
})
