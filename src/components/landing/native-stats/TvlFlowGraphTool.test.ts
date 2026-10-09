import { describe, expect, it } from 'vitest'
import {
  buildTvlFlowGraphUrl,
  enrichTvlFlowStrategyNodes,
  findTvlFlowAllocatorVaults,
  findTvlFlowVaultNodeId,
  fitTvlFlowBounds,
  graphEdgeGeometry,
  type SpotFlowEdge,
  type SpotFlowNode,
  staggerChildRowPositions
} from './TvlFlowGraphTool'

const vaultNode: SpotFlowNode = {
  id: '1:0xabcdef',
  name: 'Example Vault',
  address: '0xAbCdEf',
  chainId: 1,
  nodeType: 'vault',
  category: 'v3',
  rawTvlUsd: 1_000_000,
  externalTvlUsd: 1_000_000,
  isRetired: false
}

describe('TVL flow graph helpers', () => {
  it('builds the standalone category-filtered graph URL', () => {
    expect(buildTvlFlowGraphUrl(1, 'v3')).toBe('/api/tvl/graph?chainId=1&includeRetired=true&category=v3')
  })

  it('builds an all-category graph URL for an embedded vault', () => {
    expect(buildTvlFlowGraphUrl(747474)).toBe('/api/tvl/graph?chainId=747474&includeRetired=true')
  })

  it('caps the default fit at the visual height of five graph rows', () => {
    const singleRowBounds = fitTvlFlowBounds({ x: 0, y: 0, width: 284, height: 136 }, { width: 1_180, height: 680 })
    const fiveRowBounds = fitTvlFlowBounds({ x: 0, y: -232, width: 284, height: 600 }, { width: 1_180, height: 680 })

    expect(singleRowBounds).toEqual(fiveRowBounds)
  })

  it('matches the requested vault case-insensitively on the requested chain', () => {
    expect(findTvlFlowVaultNodeId([vaultNode], { address: '0xABCDEF', chainId: 1 })).toBe(vaultNode.id)
    expect(findTvlFlowVaultNodeId([vaultNode], { address: '0xabcdef', chainId: 10 })).toBeNull()
  })

  it('does not select strategy nodes as vault roots', () => {
    expect(
      findTvlFlowVaultNodeId([{ ...vaultNode, nodeType: 'strategy' }], { address: vaultNode.address, chainId: 1 })
    ).toBeNull()
  })

  it('enriches strategy names from current allocation metadata by chain and address', () => {
    const strategyNode = { ...vaultNode, nodeType: 'strategy' as const, name: vaultNode.address }
    const [enrichedNode] = enrichTvlFlowStrategyNodes(
      [strategyNode],
      [
        { address: vaultNode.address.toUpperCase(), chainId: 1, name: 'Resolved Strategy' },
        { address: vaultNode.address, chainId: 10, name: 'Wrong Chain Strategy' }
      ]
    )

    expect(enrichedNode?.name).toBe('Resolved Strategy')
  })

  it('finds every allocator vault below the requested root', () => {
    const nestedAllocator = {
      ...vaultNode,
      id: '1:0xnested',
      address: '0x0000000000000000000000000000000000000002',
      name: 'Nested allocator'
    }
    const nestedStrategy = {
      ...vaultNode,
      id: '1:0xstrategy',
      address: '0x0000000000000000000000000000000000000003',
      name: 'Nested strategy',
      nodeType: 'strategy' as const
    }
    const unrelatedVault = {
      ...vaultNode,
      id: '1:0xunrelated',
      address: '0x0000000000000000000000000000000000000004',
      name: 'Unrelated allocator'
    }
    const edges: SpotFlowEdge[] = [
      {
        id: 'root-to-nested',
        sourceNodeId: vaultNode.id,
        targetNodeId: nestedAllocator.id,
        holderAddress: nestedAllocator.address,
        kind: 'auto',
        tvlUsd: 100
      },
      {
        id: 'nested-to-strategy',
        sourceNodeId: nestedAllocator.id,
        targetNodeId: nestedStrategy.id,
        holderAddress: nestedStrategy.address,
        kind: 'strategy',
        tvlUsd: 100
      },
      {
        id: 'unrelated-to-strategy',
        sourceNodeId: unrelatedVault.id,
        targetNodeId: nestedStrategy.id,
        holderAddress: nestedStrategy.address,
        kind: 'strategy',
        tvlUsd: 100
      }
    ]

    expect(
      findTvlFlowAllocatorVaults([vaultNode, nestedAllocator, nestedStrategy, unrelatedVault], edges, {
        address: vaultNode.address,
        chainId: vaultNode.chainId
      })
    ).toEqual([
      { address: vaultNode.address, chainId: vaultNode.chainId },
      { address: nestedAllocator.address, chainId: nestedAllocator.chainId }
    ])
  })

  it('finds parent allocators without crossing into sibling branches', () => {
    const parentAllocator = {
      ...vaultNode,
      id: '1:0xparent',
      address: '0x0000000000000000000000000000000000000010',
      name: 'Parent allocator'
    }
    const parentStrategy = {
      ...vaultNode,
      id: '1:0xparentstrategy',
      address: '0x0000000000000000000000000000000000000011',
      name: 'Parent strategy',
      nodeType: 'strategy' as const
    }
    const siblingAllocator = {
      ...vaultNode,
      id: '1:0xsibling',
      address: '0x0000000000000000000000000000000000000012',
      name: 'Sibling allocator'
    }
    const siblingStrategy = {
      ...vaultNode,
      id: '1:0xsiblingstrategy',
      address: '0x0000000000000000000000000000000000000013',
      name: 'Sibling strategy',
      nodeType: 'strategy' as const
    }
    const edges: SpotFlowEdge[] = [
      {
        id: 'parent-to-strategy',
        sourceNodeId: parentAllocator.id,
        targetNodeId: parentStrategy.id,
        holderAddress: parentStrategy.address,
        kind: 'strategy',
        tvlUsd: 100
      },
      {
        id: 'strategy-to-root',
        sourceNodeId: parentStrategy.id,
        targetNodeId: vaultNode.id,
        holderAddress: vaultNode.address,
        kind: 'auto',
        tvlUsd: 100
      },
      {
        id: 'sibling-to-strategy',
        sourceNodeId: siblingAllocator.id,
        targetNodeId: siblingStrategy.id,
        holderAddress: siblingStrategy.address,
        kind: 'strategy',
        tvlUsd: 100
      },
      {
        id: 'parent-to-sibling',
        sourceNodeId: parentAllocator.id,
        targetNodeId: siblingAllocator.id,
        holderAddress: siblingAllocator.address,
        kind: 'auto',
        tvlUsd: 100
      }
    ]

    expect(
      findTvlFlowAllocatorVaults(
        [parentAllocator, parentStrategy, vaultNode, siblingAllocator, siblingStrategy],
        edges,
        { address: vaultNode.address, chainId: vaultNode.chainId }
      )
    ).toEqual([{ address: parentAllocator.address, chainId: parentAllocator.chainId }])
  })

  it('keeps four children on one centered row', () => {
    const positions = staggerChildRowPositions(4, 1_000, 200)

    expect(new Set(positions.map(({ y }) => y))).toEqual(new Set([200]))
    expect(positions).toHaveLength(4)
  })

  it('stagger-wraps larger sibling groups into two balanced rows', () => {
    const positions = staggerChildRowPositions(9, 1_000, 200)
    const firstRowY = Math.min(...positions.map(({ y }) => y))
    const firstRow = positions.filter(({ y }) => y === firstRowY)
    const secondRow = positions.filter(({ y }) => y !== firstRowY)
    const averageX = (row: typeof positions) => row.reduce((sum, { x }) => sum + x, 0) / row.length

    expect(firstRow).toHaveLength(5)
    expect(secondRow).toHaveLength(4)
    expect(firstRowY).toBe(256)
    expect(secondRow[0]?.y).toBe(352)
    expect(averageX(firstRow)).toBe(averageX(secondRow))
    expect(secondRow[0]?.x).toBeGreaterThan(firstRow[0]?.x ?? Number.POSITIVE_INFINITY)
    expect(secondRow[0]?.x).toBeLessThan(firstRow[1]?.x ?? Number.NEGATIVE_INFINITY)
  })

  it('routes lower staggered edges through the gap and labels them above the target', () => {
    const geometry = graphEdgeGeometry({ x: 500, y: 32, depth: 0 }, { x: 727, y: 244, depth: 1 })

    expect(geometry.routedAroundSiblingRow).toBe(true)
    expect(geometry.path).toContain('L 837 244')
    expect(geometry.labelX).toBe(837)
    expect(geometry.labelY).toBe(236)
  })

  it('keeps the direct curve for the first child row', () => {
    const geometry = graphEdgeGeometry({ x: 500, y: 32, depth: 0 }, { x: 597, y: 148, depth: 1 })

    expect(geometry.routedAroundSiblingRow).toBe(false)
    expect(geometry.path).not.toContain(' L ')
  })
})
