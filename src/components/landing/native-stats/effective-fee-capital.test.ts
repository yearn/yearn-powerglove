import { describe, expect, it } from 'vitest'
import type { DirectDepositFeeRow } from './direct-deposit-fees'
import { effectiveFeeCapital, feeCapitalVaults, reportedDepositTvl } from './effective-fee-capital'
import type { FeeStackNode } from './types'
import type { OriginAudit, OriginGraph } from './vault-origin'

const root: FeeStackNode = {
  vault: { address: '0xroot', chainId: 1, name: 'Root' },
  capitalUsd: 200,
  perfFee: 1000,
  mgmtFee: 0,
  children: [
    {
      vault: { address: '0xchild', chainId: 1, name: 'Child' },
      capitalUsd: 120,
      perfFee: 2000,
      mgmtFee: 0,
      children: []
    }
  ]
}
const row: DirectDepositFeeRow = {
  vault: root.vault,
  root,
  roots: [root],
  performanceFee: 2800,
  managementFee: 0,
  feeRateBasis: 'stack',
  adjustedTvlUsd: 120
}
const audit: OriginAudit = {
  datasetId: 'selected',
  vaults: [
    {
      address: '0xroot',
      chainId: 1,
      name: 'Root',
      category: 'v3',
      vaultType: 1,
      tvlUsd: 200,
      countedTvlUsd: 120,
      isRetired: false,
      strategies: [
        { address: '0xchild', debtUsd: 120, targetVaultAddress: '0xchild', targetVaultChainId: 1 },
        { address: '0xordinary', debtUsd: 60, targetVaultAddress: null, targetVaultChainId: null }
      ]
    }
  ]
}
const graph: OriginGraph = {
  datasetId: 'selected',
  asOfTimestamp: 1,
  nodes: [
    {
      id: '1:0xchild',
      ...root.children[0].vault,
      name: 'Child',
      nodeType: 'vault',
      category: 'v3',
      rawTvlUsd: 120,
      externalTvlUsd: 120,
      isRetired: false
    }
  ],
  edges: [
    {
      id: 'allocation',
      sourceNodeId: '1:0xroot',
      targetNodeId: '1:0xchild',
      holderAddress: '0xchild',
      kind: 'auto',
      tvlUsd: 120
    }
  ]
}

describe('effective fee capital attribution', () => {
  it('reconciles reported assets, excluded upstream ownership, and adjusted downstream capital without changing rates', () => {
    const capital = effectiveFeeCapital(row, feeCapitalVaults(audit, 'selected'), graph, 'selected')
    expect(capital).toMatchObject({
      reported: 200,
      upstream: 80,
      adjusted: 120,
      direct: 120,
      excludedBridges: 0,
      unattributedUpstream: 80
    })
    expect(capital.downstreamRoots?.[0].capitalUsd).toBe(120)
    expect(capital.downstreamRoots?.[0].children[0].capitalUsd).toBe(72)
    expect(capital.downstreamRoots?.[0].perfFee).toBe(1000)
    expect(capital.downstreamRoots?.[0].children[0].perfFee).toBe(2000)
    expect(capital.downstreamRoots?.[0].children.map((child) => [child.kind, child.capitalUsd])).toEqual([
      ['vault', 72],
      ['strategy', 36],
      ['idle', 12]
    ])
    expect(root.children[0].capitalUsd).toBe(120)
    expect(row.performanceFee).toBe(2800)
  })
  it('uses per-member adjustments for canonical products and never substitutes gross totals for adjusted TVL', () => {
    const locked = { ...root, vault: { ...root.vault, address: '0xlocked' }, capitalUsd: 40, children: [] }
    const combined = { ...row, roots: [root, locked], adjustedTvlUsd: 200, feeRateBasis: 'product' as const }
    const data = {
      ...audit,
      vaults: [
        { ...audit.vaults[0], countedTvlUsd: 160 },
        { ...audit.vaults[0], address: '0xlocked', tvlUsd: 40, countedTvlUsd: 40 }
      ]
    }
    const capital = effectiveFeeCapital(combined, feeCapitalVaults(data, 'selected'), graph, 'selected')
    expect(capital).toMatchObject({ reported: 240, adjusted: 200, upstream: 40 })
    expect(capital.downstreamRoots?.map((root) => root.capitalUsd)).toEqual([160, 40])
    expect(capital.downstreamRoots?.[0].children[0].capitalUsd).toBe(96)
    expect(reportedDepositTvl({ ...combined, roots: [root, root, locked] }, feeCapitalVaults(data, 'selected'))).toBe(
      240
    )
  })
  it('preserves zero and unavailable amounts and refuses an invented per-member split', () => {
    const data = { ...audit, vaults: [{ ...audit.vaults[0], countedTvlUsd: 0 }] }
    expect(
      effectiveFeeCapital({ ...row, adjustedTvlUsd: 0 }, feeCapitalVaults(data, 'selected'), graph, 'selected')
        .downstreamRoots?.[0].capitalUsd
    ).toBe(0)
    const missing = effectiveFeeCapital(
      { ...row, adjustedTvlUsd: null },
      feeCapitalVaults(audit, 'selected'),
      graph,
      'selected'
    )
    expect(missing.adjusted).toBeNull()
    expect(missing.upstream).toBeNull()
    expect(missing.downstreamRoots).toBeNull()
    expect(
      effectiveFeeCapital({ ...row, adjustedTvlUsd: 150 }, feeCapitalVaults(audit, 'selected'), graph, 'selected')
        .downstreamRoots
    ).toBeNull()
    expect(reportedDepositTvl(row, new Map())).toBeNull()
  })
  it('rejects TVL from another publication and cannot show its upstream provenance', () => {
    expect(feeCapitalVaults(audit, 'other').size).toBe(0)
    const capital = effectiveFeeCapital(
      row,
      feeCapitalVaults(audit, 'selected'),
      { ...graph, datasetId: 'other' },
      'selected'
    )
    expect(capital.reported).toBe(200)
    expect(capital.upstream).toBeNull()
    expect(capital.positions).toEqual([])
  })
  it('separates migrated bridge exclusions from upstream ownership', () => {
    const data = { ...audit, vaults: [{ ...audit.vaults[0], countedTvlUsd: 0 }] }
    const capital = effectiveFeeCapital(
      { ...row, adjustedTvlUsd: 0 },
      feeCapitalVaults(data, 'selected'),
      { ...graph, bridgeExclusions: [{ sourceNodeId: '1:0xroot', tvlUsd: 200 }] },
      'selected'
    )
    expect(capital).toMatchObject({ reported: 200, upstream: 0, excludedBridges: 200, adjusted: 0 })
  })
})
