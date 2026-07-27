import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReallocationChart } from '@/components/reallocation-panel/ReallocationChart'
import {
  buildComparisonStrategies,
  buildReallocationColorMap,
  buildReallocationPanels,
  buildStateTransitionSankeyGraph,
  type CurrentAllocationInput,
  getReallocationPanelLabels,
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
  it('creates one same-record recommendation panel for every optimizer run', () => {
    const older = makeChange({
      sourceKey: 'older',
      timestampUtc: '2026-04-20 08:30:00 UTC',
      currentVaultAprPct: 0.59,
      targetVaultAprPct: 0.61,
      strategies: [
        {
          strategyKey: 'alpha',
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          isUnallocated: false,
          currentAllocationPct: 60,
          targetAllocationPct: 45,
          currentAprPct: 1.1,
          targetAprPct: 1.25
        },
        {
          strategyKey: 'beta',
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          isUnallocated: false,
          currentAllocationPct: 40,
          targetAllocationPct: 55,
          currentAprPct: 0.9,
          targetAprPct: 1.05
        }
      ]
    })
    const later = makeChange({
      sourceKey: 'later',
      timestampUtc: '2026-04-22 10:00:00 UTC',
      currentVaultAprPct: 0.72,
      targetVaultAprPct: 0.79,
      strategies: [
        {
          strategyKey: 'alpha',
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          isUnallocated: false,
          currentAllocationPct: 45,
          targetAllocationPct: 35,
          currentAprPct: 1.3,
          targetAprPct: 1.42
        },
        {
          strategyKey: 'beta',
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          isUnallocated: false,
          currentAllocationPct: 55,
          targetAllocationPct: 65,
          currentAprPct: 1.05,
          targetAprPct: 1.2
        }
      ]
    })

    const panels = buildReallocationPanels([later, older, { ...older, sourceKey: 'older-alias' }])

    expect(panels).toHaveLength(2)
    expect(panels.map((panel) => panel.id)).toEqual(['historical:older', 'historical:later'])
    expect(panels.map((panel) => panel.kind)).toEqual(['historical', 'historical'])
    expect(panels[0]?.beforeTimestampUtc).toBe(older.timestampUtc)
    expect(panels[0]?.afterTimestampUtc).toBe(older.timestampUtc)
    expect(panels[1]?.beforeTimestampUtc).toBe(later.timestampUtc)
    expect(panels[1]?.afterTimestampUtc).toBe(later.timestampUtc)
    expect(panels[0]?.beforeState.vaultAprPct).toBe(0.59)
    expect(panels[0]?.afterState.vaultAprPct).toBe(0.61)
    expect(panels[1]?.beforeState.vaultAprPct).toBe(0.72)
    expect(panels[1]?.afterState.vaultAprPct).toBe(0.79)
    expect(panels[0]?.beforeState.strategies.map((strategy) => strategy.allocationPct)).toEqual([60, 40])
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([45, 55])
    expect(panels[1]?.beforeState.strategies.map((strategy) => strategy.allocationPct)).toEqual([45, 55])
    expect(panels[1]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([35, 65])

    const olderStrategies = buildComparisonStrategies(panels[0]!, {})
    const laterStrategies = buildComparisonStrategies(panels[1]!, {})
    expect(olderStrategies[0]).toMatchObject({
      currentAprPct: 1.1,
      targetAprPct: 1.25
    })
    expect(olderStrategies[0]?.aprDeltaPct).toBeCloseTo(0.15)
    expect(laterStrategies[0]).toMatchObject({
      currentAprPct: 1.3,
      targetAprPct: 1.42
    })
    expect(laterStrategies[0]?.aprDeltaPct).toBeCloseTo(0.12)
    expect(getReallocationPanelLabels(panels[0]!)).toMatchObject({
      beforeLabel: 'Current',
      afterLabel: 'Proposed',
      beforeAprLabel: 'APR at current debt',
      afterAprLabel: 'APR at target debt'
    })
  })

  it('keeps unknown strategy APRs unavailable', () => {
    const panels = buildReallocationPanels([
      makeChange({
        sourceKey: 'unknown-apr',
        timestampUtc: '2026-04-22 10:00:00 UTC',
        strategies: [
          {
            strategyKey: 'alpha',
            strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Alpha',
            isUnallocated: false,
            currentAllocationPct: 100,
            targetAllocationPct: 100,
            currentAprPct: null,
            targetAprPct: null
          }
        ]
      })
    ])

    expect(panels[0]?.beforeState.strategies[0]?.aprPct).toBeNull()
    expect(panels[0]?.afterState.strategies[0]?.aprPct).toBeNull()
    expect(buildComparisonStrategies(panels[0]!, {})[0]).toMatchObject({
      currentAprPct: null,
      targetAprPct: null,
      aprDeltaPct: null
    })
  })

  it('keeps the current live-allocation comparison after recommendation history', () => {
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

    expect(panels).toHaveLength(2)
    expect(panels.map((panel) => panel.kind)).toEqual(['historical', 'current'])
    expect(panels[0]?.beforeState.strategies.map((strategy) => strategy.allocationPct)).toEqual([60, 40])
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([45, 55])
    expect(panels[1]?.beforeState.strategies.map((strategy) => strategy.allocationPct)).toEqual([60, 40])
    expect(panels[1]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([45, 55])
  })

  it('does not add a redundant live panel when allocations match the latest current state', () => {
    const change = makeChange({
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
    const currentAllocation: CurrentAllocationInput = {
      timestampUtc: '2026-04-23T14:30:00.000Z',
      tvl: 100,
      tvlUnit: 'USD',
      vaultAprPct: 4.4,
      strategies: [
        {
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          allocationPct: 60,
          aprPct: 2.5
        },
        {
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          allocationPct: 40,
          aprPct: 2.4
        }
      ]
    }

    const panels = buildReallocationPanels([change], currentAllocation)

    expect(panels).toHaveLength(1)
    expect(panels[0]?.kind).toBe('historical')
    expect(panels[0]?.beforeTimestampUtc).toBe(change.timestampUtc)
    expect(panels[0]?.afterTimestampUtc).toBe(change.timestampUtc)
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
    expect(panels[0]?.beforeState.strategies.map((strategy) => strategy.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(panels[1]?.beforeState.strategies.map((strategy) => strategy.name)).toEqual(['Alpha', 'Gamma', 'Delta'])
    expect(panels[1]?.afterState.strategies.map((strategy) => strategy.name)).toEqual(['Alpha', 'Gamma', 'Delta'])
  })
})

describe('ReallocationChart', () => {
  it('displays same-record vault APR improvements in percentage points', () => {
    const panels = buildReallocationPanels([
      makeChange({
        sourceKey: 'later',
        timestampUtc: '2026-04-22 10:00:00 UTC',
        currentVaultAprPct: 0.72,
        targetVaultAprPct: 0.79,
        strategies: [
          {
            strategyKey: 'alpha',
            strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Alpha',
            isUnallocated: false,
            currentAllocationPct: 40,
            targetAllocationPct: 60,
            currentAprPct: 1.3,
            targetAprPct: 1.42
          },
          {
            strategyKey: 'beta',
            strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            name: 'Beta',
            isUnallocated: false,
            currentAllocationPct: 60,
            targetAllocationPct: 40,
            currentAprPct: 1.05,
            targetAprPct: 1.2
          }
        ]
      }),
      makeChange({
        sourceKey: 'older',
        timestampUtc: '2026-04-20 08:30:00 UTC',
        currentVaultAprPct: 0.59,
        targetVaultAprPct: 0.61,
        strategies: [
          {
            strategyKey: 'alpha',
            strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Alpha',
            isUnallocated: false,
            currentAllocationPct: 60,
            targetAllocationPct: 40,
            currentAprPct: 1.1,
            targetAprPct: 1.25
          },
          {
            strategyKey: 'beta',
            strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            name: 'Beta',
            isUnallocated: false,
            currentAllocationPct: 40,
            targetAllocationPct: 60,
            currentAprPct: 0.9,
            targetAprPct: 1.05
          }
        ]
      })
    ])
    const colorByStrategyKey = buildReallocationColorMap(panels, false)
    const { rerender } = render(
      <ReallocationChart
        panels={panels}
        activePanelIndex={0}
        onActivePanelIndexChange={() => undefined}
        colorByStrategyKey={colorByStrategyKey}
      />
    )

    expect(screen.getByText(/\+0\.02 pp/)).toBeTruthy()
    expect(screen.queryByText(/\+0\.13/)).toBeNull()

    rerender(
      <ReallocationChart
        panels={panels}
        activePanelIndex={1}
        onActivePanelIndexChange={() => undefined}
        colorByStrategyKey={colorByStrategyKey}
      />
    )

    expect(screen.getByText(/\+0\.07 pp/)).toBeTruthy()
    expect(screen.queryByText(/\+0\.13/)).toBeNull()
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
