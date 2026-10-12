import { expect, it } from 'vitest'
import { directDepositFeeRows, externalTvlByVault, feeStackLayers } from './direct-deposit-fees'
import type { FeeStackNode } from './types'

it('uses the selected vault rate without charging parent fees again or duplicating vaults', () => {
  const child: FeeStackNode = {
    vault: { address: '0xchild', chainId: 1, name: 'Child' },
    perfFee: 1000,
    mgmtFee: 0,
    capitalUsd: 100,
    children: [],
    availability: { state: 'available' }
  }
  const root = { ...child, vault: { ...child.vault, address: '0xroot' }, children: [child] }
  const result = directDepositFeeRows([{ root, maxDepth: 2, effectivePerfFee: 1900, effectiveMgmtFee: 0 }])
  expect(result[0].root).toBe(root)
  expect(feeStackLayers(root).map(({ node, depth }) => [node.vault.address, depth])).toEqual([
    ['0xroot', 0],
    ['0xchild', 1]
  ])
  expect(result.map((row) => row.performanceFee)).toEqual([1900, 1000])
  expect(
    directDepositFeeRows([
      { root, maxDepth: 2, effectivePerfFee: 1900, effectiveMgmtFee: 0 },
      { root: child, maxDepth: 1, effectivePerfFee: 1000, effectiveMgmtFee: 0 }
    ])
  ).toHaveLength(2)
  expect(
    directDepositFeeRows([
      {
        root: { ...root, children: [{ ...child, availability: { state: 'partial' } }] },
        maxDepth: 2,
        effectivePerfFee: null,
        effectiveMgmtFee: null
      }
    ]).map((row) => row.performanceFee)
  ).toEqual([null, null])
})

it('uses only external TVL from the matching dataset, preserving genuine zeros', () => {
  const graph = {
    datasetId: 'selected',
    nodes: [
      { chainId: 1, address: '0xABC', externalTvlUsd: 0 },
      { chainId: 10, address: '0xabc', externalTvlUsd: 42 },
      { chainId: 1, address: '0xmissing', externalTvlUsd: null }
    ]
  }
  const values = externalTvlByVault(graph, 'selected')
  expect(values.get('1:0xabc')).toBe(0)
  expect(values.get('10:0xabc')).toBe(42)
  expect(values.has('1:0xmissing')).toBe(false)
  expect(externalTvlByVault(graph, 'other').size).toBe(0)
})
