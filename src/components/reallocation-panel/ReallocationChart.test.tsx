import { describe, expect, it } from 'vitest'
import {
  buildReallocationPanels,
  buildStateTransitionSankeyGraph,
  type CurrentAllocationInput,
  type ReallocationNormalizedChange
} from '@/lib/reallocation-panels'

function makeChange({
  sourceKey,
  timestampUtc,
  strategies,
  tvl = 100,
  tvlUnit = 'USD',
  currentVaultAprPct = 4,
  targetVaultAprPct = 4.2
}: {
  sourceKey: string
  timestampUtc: string | null
  strategies: ReallocationNormalizedChange['strategies']
  tvl?: number
  tvlUnit?: string
  currentVaultAprPct?: number | null
  targetVaultAprPct?: number | null
}): ReallocationNormalizedChange {
  return {
    sourceKey,
    timestampUtc,
    tvl,
    tvlUnit,
    currentVaultAprPct,
    targetVaultAprPct,
    strategies
  }
}

describe('buildReallocationPanels', () => {
  it('uses a live current panel instead of a proposal tail when current allocations are available', () => {
    const changes = [
      makeChange({
        sourceKey: 'latest',
        timestampUtc: '2026-04-22 10:00:00 UTC',
        strategies: [
          {
            strategyKey: 'alpha',
            strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Alpha',
            isUnallocated: false,
            currentAllocationPct: 60,
            targetAllocationPct: 45,
            currentAprPct: 2.2,
            targetAprPct: 2.6
          },
          {
            strategyKey: 'beta',
            strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            name: 'Beta',
            isUnallocated: false,
            currentAllocationPct: 40,
            targetAllocationPct: 55,
            currentAprPct: 1.8,
            targetAprPct: 2.4
          }
        ]
      })
    ]
    const currentAllocation: CurrentAllocationInput = {
      timestampUtc: '2026-04-23T14:30:00.000Z',
      tvl: 100,
      tvlUnit: 'USD',
      vaultAprPct: 4.4,
      strategies: [
        {
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          allocationPct: 45,
          aprPct: 2.5
        },
        {
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          allocationPct: 55,
          aprPct: 2.4
        }
      ]
    }

    const panels = buildReallocationPanels(changes, currentAllocation)

    expect(panels).toHaveLength(1)
    expect(panels[0]?.kind).toBe('current')
    expect(panels[0]?.beforeState.strategies.map((strategy) => strategy.allocationPct)).toEqual([60, 40])
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([45, 55])
  })

  it('carries historical ordering across adjacent panels', () => {
    const olderSnapshot = makeChange({
      sourceKey: 'older',
      timestampUtc: '2026-04-20 08:30:00 UTC',
      strategies: [
        {
          strategyKey: 'alpha',
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          isUnallocated: false,
          currentAllocationPct: 50,
          targetAllocationPct: 50,
          currentAprPct: 2.1,
          targetAprPct: 2.2
        },
        {
          strategyKey: 'beta',
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          isUnallocated: false,
          currentAllocationPct: 30,
          targetAllocationPct: 30,
          currentAprPct: 1.7,
          targetAprPct: 1.8
        },
        {
          strategyKey: 'gamma',
          strategyAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
          name: 'Gamma',
          isUnallocated: false,
          currentAllocationPct: 20,
          targetAllocationPct: 20,
          currentAprPct: 1.6,
          targetAprPct: 1.65
        }
      ]
    })
    const latestSnapshot = makeChange({
      sourceKey: 'latest',
      timestampUtc: '2026-04-22 10:00:00 UTC',
      strategies: [
        {
          strategyKey: 'gamma',
          strategyAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
          name: 'Gamma',
          isUnallocated: false,
          currentAllocationPct: 25,
          targetAllocationPct: 20,
          currentAprPct: 1.6,
          targetAprPct: 1.7
        },
        {
          strategyKey: 'alpha',
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          isUnallocated: false,
          currentAllocationPct: 55,
          targetAllocationPct: 50,
          currentAprPct: 2.1,
          targetAprPct: 2.25
        },
        {
          strategyKey: 'delta',
          strategyAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
          name: 'Delta',
          isUnallocated: false,
          currentAllocationPct: 20,
          targetAllocationPct: 30,
          currentAprPct: 1.9,
          targetAprPct: 2.4
        }
      ]
    })

    const panels = buildReallocationPanels([latestSnapshot, olderSnapshot])

    expect(panels).toHaveLength(2)
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.name)).toEqual(['Alpha', 'Gamma', 'Delta'])
    expect(panels[1]?.beforeState.strategies.map((strategy) => strategy.name)).toEqual(['Alpha', 'Gamma', 'Delta'])
  })
})

describe('buildStateTransitionSankeyGraph', () => {
  it('creates direct overlap links before allocating the remaining flow', () => {
    const panels = buildReallocationPanels([
      makeChange({
        sourceKey: 'latest',
        timestampUtc: '2026-04-22 10:00:00 UTC',
        strategies: [
          {
            strategyKey: 'alpha',
            strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Alpha',
            isUnallocated: false,
            currentAllocationPct: 60,
            targetAllocationPct: 45,
            currentAprPct: 2.2,
            targetAprPct: 2.6
          },
          {
            strategyKey: 'beta',
            strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            name: 'Beta',
            isUnallocated: false,
            currentAllocationPct: 40,
            targetAllocationPct: 55,
            currentAprPct: 1.8,
            targetAprPct: 2.4
          }
        ]
      })
    ])

    const graph = buildStateTransitionSankeyGraph(panels[0]!.beforeState.strategies, panels[0]!.afterState.strategies)

    expect(graph.links.map((link) => link.value)).toEqual([45, 40, 15])
  })
})
