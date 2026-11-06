import { describe, expect, it } from 'vitest'
import { DIRECT_DEPOSIT_REGISTRY, type DirectDepositGroup } from '@/constants/direct-deposit-registry'
import type { DepositBalances } from '@/lib/direct-deposit-balances'
import type { DirectDepositFeeRow } from './direct-deposit-fees'
import {
  depositShareValue,
  directDepositSources,
  registeredDepositTargets,
  treasuryExclusions
} from './direct-deposit-sources'
import type { OriginGraph, OriginVault } from './vault-origin'
import { originVaultId } from './vault-origin'

const treasury = DIRECT_DEPOSIT_REGISTRY[0].depositors
const connector = DIRECT_DEPOSIT_REGISTRY[1].depositors[0]
const root = {
  vault: { chainId: 1, address: connector.vaultAddress, name: 'yvUSD' },
  capitalUsd: 100,
  perfFee: 1000,
  mgmtFee: 0,
  children: []
}
const row: DirectDepositFeeRow = {
  vault: root.vault,
  root,
  roots: [root],
  performanceFee: 1000,
  managementFee: 0,
  feeRateBasis: 'stack'
}
const id = originVaultId(1, root.vault.address)
const vaults = new Map<string, OriginVault>([
  [id, { ...root.vault, category: 'v3', vaultType: 1, tvlUsd: 100, isRetired: false, strategies: [] }]
])
const balances: DepositBalances = {
  totalSupply: 100n,
  holders: [
    ...treasury.map((holder, index) => ({ address: holder.address, shares: BigInt(index * 5) })),
    { address: connector.address, shares: 20n }
  ]
}
const graph: OriginGraph = { datasetId: 'published', asOfTimestamp: 1000, nodes: [], edges: [] }

describe('registered direct deposit attribution', () => {
  it('scopes holders to their chain and connectors to their verified target', () => {
    const targets = registeredDepositTargets(row)
    expect(targets[0].groups.map((group) => group.id)).toEqual(['treasury', 'alchemix'])
    const unrelated = { ...root, vault: { ...root.vault, address: '0x1111111111111111111111111111111111111111' } }
    expect(registeredDepositTargets({ ...row, roots: [unrelated] })[0].groups.map((group) => group.id)).toEqual([
      'treasury'
    ])
    expect(registeredDepositTargets({ ...row, roots: [{ ...root, vault: { ...root.vault, chainId: 8453 } }] })).toEqual(
      []
    )
    const base = DIRECT_DEPOSIT_REGISTRY[1].depositors[1]
    expect(
      registeredDepositTargets({
        ...row,
        roots: [{ ...root, vault: { ...root.vault, chainId: 8453, address: base.vaultAddress } }]
      })[0].groups.map((group) => group.id)
    ).toEqual(['alchemix'])
  })

  it('partitions the direct total and preserves existing upstream exclusions', () => {
    const result = directDepositSources(registeredDepositTargets(row), vaults, graph, new Map([[id, balances]]), 100)
    expect(result.groups.map((group) => group.amount)).toEqual([15, 20])
    expect(treasuryExclusions(row, result.groups).get(id)).toBe(15)
    expect(result.other).toBe(65)
    const excluded: OriginGraph = {
      ...graph,
      edges: [
        {
          id: 'overlap',
          sourceNodeId: 'upstream',
          targetNodeId: id,
          holderAddress: connector.address,
          tvlUsd: 5,
          deductedTvlUsd: 5,
          kind: 'share'
        }
      ]
    }
    const reduced = directDepositSources(registeredDepositTargets(row), vaults, excluded, new Map([[id, balances]]), 95)
    expect(reduced.groups.map((group) => group.amount)).toEqual([15, 15])
    expect(reduced.other).toBe(65)
  })

  it('does not exclude treasury shares twice after canonical ownership or a bridge exclusion', () => {
    const ownership: OriginGraph = {
      ...graph,
      edges: [
        {
          id: 'owned',
          sourceNodeId: 'upstream',
          targetNodeId: id,
          holderAddress: treasury[1].address,
          tvlUsd: 5,
          deductedTvlUsd: 5,
          kind: 'share'
        }
      ]
    }
    const targets = registeredDepositTargets(row)
    const sources = directDepositSources(targets, vaults, ownership, new Map([[id, balances]]), 95)
    expect(treasuryExclusions(row, sources.groups).get(id)).toBe(10)
    const bridge = directDepositSources(
      targets,
      vaults,
      { ...graph, bridgeExclusions: [{ sourceNodeId: id, tvlUsd: 100 }] },
      new Map(),
      100
    )
    expect(treasuryExclusions(row, bridge.groups).get(id)).toBe(0)
  })

  it('deduplicates product roots and combines balances across the API-supplied members', () => {
    const locked = {
      ...root,
      vault: { ...root.vault, address: '0x1111111111111111111111111111111111111111', name: 'Locked' }
    }
    const lockedId = originVaultId(1, locked.vault.address)
    const targets = registeredDepositTargets({ ...row, feeRateBasis: 'product', roots: [root, locked, root] })
    expect(targets).toHaveLength(2)
    const result = directDepositSources(
      targets,
      new Map([...vaults, [lockedId, { ...vaults.get(id)!, ...locked.vault, tvlUsd: 200 }]]),
      graph,
      new Map([
        [id, balances],
        [lockedId, { ...balances, holders: balances.holders.slice(0, 3) }]
      ]),
      300
    )
    expect(result.groups.map((group) => group.amount)).toEqual([45, 20])
    expect(result.other).toBe(235)
  })

  it('keeps unavailable, partial, zero, and inconsistent observations distinct', () => {
    const targets = registeredDepositTargets(row)
    const missing = directDepositSources(targets, vaults, graph, new Map(), 100)
    expect(missing.groups.map((group) => group.amount)).toEqual([null, null])
    expect(missing.other).toBeNull()
    const partial = {
      ...balances,
      holders: balances.holders.map((holder, index) => ({ ...holder, shares: index === 0 ? null : holder.shares }))
    }
    const result = directDepositSources(targets, vaults, graph, new Map([[id, partial]]), 100)
    expect(result.groups.map((group) => group.amount)).toEqual([null, 20])
    expect(result.other).toBeNull()
    const zero = { ...balances, holders: balances.holders.map((holder) => ({ ...holder, shares: 0n })) }
    expect(directDepositSources(targets, vaults, graph, new Map([[id, zero]]), 100).other).toBe(100)
    const conflict = directDepositSources(targets, vaults, graph, new Map([[id, balances]]), 10)
    expect(conflict.conflict).toBe(true)
    expect(conflict.groups.every((group) => group.amount === null)).toBe(true)
    expect(conflict.other).toBeNull()
    expect(depositShareValue(0n, null, null)).toBe(0)
    expect(depositShareValue(1n, null, 100)).toBeNull()
    expect(depositShareValue(1n, 0n, 100)).toBeNull()
    expect(depositShareValue(101n, 100n, 100)).toBeNull()
    expect(depositShareValue(1n, 100n, null)).toBeNull()
  })

  it('keeps registry identities unique and chain-scoped', () => {
    const registry: readonly DirectDepositGroup[] = DIRECT_DEPOSIT_REGISTRY
    const keys = registry.flatMap((group) =>
      group.depositors.map((holder) => `${holder.chainId}:${holder.address.toLowerCase()}`)
    )
    expect(new Set(keys).size).toBe(keys.length)
    expect(registry[0].depositors).toHaveLength(3)
  })
})
