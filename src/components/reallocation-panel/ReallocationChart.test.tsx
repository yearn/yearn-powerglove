import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReallocationChart } from '@/components/reallocation-panel/ReallocationChart'
import {
  buildComparisonStrategies,
  buildReallocationColorMap,
  buildReallocationPanels,
  buildStateTransitionSankeyGraph,
  type CurrentAllocationInput,
  formatReallocationTimestamp,
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
  it('formats allocation dates with years and without times', () => {
    expect(formatReallocationTimestamp('2026-04-20 08:30:00 UTC')).toBe('Apr 20, 2026')
  })

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
  it('shows simulated DOA APR only for strategy reallocations', () => {
    const basePanel = buildReallocationPanels([
      makeChange({
        sourceKey: 'executed',
        timestampUtc: '2026-04-22 10:00:00 UTC',
        strategies: [
          {
            strategyKey: 'alpha',
            strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Alpha',
            isUnallocated: false,
            currentAllocationPct: 90,
            targetAllocationPct: 100,
            currentAprPct: null,
            targetAprPct: null
          },
          {
            strategyKey: 'unallocated',
            strategyAddress: null,
            name: 'Idle',
            isUnallocated: true,
            currentAllocationPct: 10,
            targetAllocationPct: 0,
            currentAprPct: null,
            targetAprPct: null
          }
        ]
      })
    ])[0]!
    const expectedAprImpact = {
      status: 'available' as const,
      source: 'doa' as const,
      scope: 'proposal' as const,
      policyId: 'policy-1',
      baselineAprPct: 2.87,
      proposedAprPct: 2.91,
      deltaAprPct: 0.04,
      publishedAt: '2026-04-22T10:00:00Z',
      relationship: 'governing_policy',
      applicationStatus: 'inferred_from_historical_config'
    }
    const idlePanel = {
      ...basePanel,
      kind: 'executed' as const,
      flowKind: 'idle_deployment' as const,
      expectedAprImpact
    }
    const { container, rerender } = render(
      <ReallocationChart
        panels={[idlePanel]}
        activePanelIndex={0}
        onActivePanelIndexChange={() => undefined}
        colorByStrategyKey={buildReallocationColorMap([idlePanel], false)}
      />
    )

    expect(screen.queryByText('DOA expected APR')).toBeNull()
    expect(screen.queryByText(/ledger interval/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /about the interval ledger/i })).toBeNull()
    expect(container.firstElementChild?.classList.contains('isolate')).toBe(true)
    expect(container.firstElementChild?.classList.contains('z-0')).toBe(true)
    const chartHeader = screen.getByTestId('reallocation-chart-header')
    expect(chartHeader.classList.contains('lg:h-28')).toBe(true)
    expect(chartHeader.classList.contains('border')).toBe(false)
    expect(chartHeader.classList.contains('border-b')).toBe(false)
    expect(chartHeader.firstElementChild?.classList.contains('lg:items-start')).toBe(true)
    expect(screen.getByTestId('reallocation-chart-viewport').classList.contains('rounded-lg')).toBe(true)
    expect(screen.getByTestId('reallocation-chart-viewport').classList.contains('border')).toBe(true)

    const strategyPanel = { ...idlePanel, flowKind: 'strategy_reallocation' as const }
    rerender(
      <ReallocationChart
        panels={[strategyPanel]}
        activePanelIndex={0}
        onActivePanelIndexChange={() => undefined}
        colorByStrategyKey={buildReallocationColorMap([strategyPanel], false)}
      />
    )

    expect(screen.getByText('DOA expected APR')).toBeTruthy()
    expect(screen.getByText(/\+0\.04 pp expected/)).toBeTruthy()
  })

  it('keeps current-state metadata in the left header and aligns navigation with historical panels', () => {
    const historicalPanel = buildReallocationPanels([
      makeChange({
        sourceKey: 'current-header',
        timestampUtc: '2026-04-22 10:00:00 UTC',
        strategies: [
          {
            strategyKey: 'alpha',
            strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Alpha',
            isUnallocated: false,
            currentAllocationPct: 90,
            targetAllocationPct: 100,
            currentAprPct: null,
            targetAprPct: null
          },
          {
            strategyKey: 'unallocated',
            strategyAddress: null,
            name: 'Idle',
            isUnallocated: true,
            currentAllocationPct: 10,
            targetAllocationPct: 0,
            currentAprPct: null,
            targetAprPct: null
          }
        ]
      })
    ])[0]!
    const currentPanel = { ...historicalPanel, id: 'current', kind: 'current' as const }
    const panels = [historicalPanel, currentPanel]

    render(
      <ReallocationChart
        panels={panels}
        activePanelIndex={1}
        onActivePanelIndexChange={() => undefined}
        colorByStrategyKey={buildReallocationColorMap(panels, false)}
      />
    )

    const infoSection = screen.getByText('Live allocation comparison').parentElement
    expect(infoSection).not.toBeNull()
    const lastSeenLabel = within(infoSection!).getByText('Last Seen')
    expect(lastSeenLabel).toBeTruthy()
    expect(lastSeenLabel.parentElement?.classList.contains('whitespace-nowrap')).toBe(true)
    expect(lastSeenLabel.parentElement?.classList.contains('text-xs')).toBe(true)
    expect(within(infoSection!).getByText('Current')).toBeTruthy()
    expect(screen.queryByText(/Panel \d+ of \d+/)).toBeNull()
    expect(screen.getByRole('button', { name: /older/i }).parentElement?.classList.contains('lg:col-start-3')).toBe(
      true
    )
  })

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
    expect(screen.getAllByText('Apr 20, 2026')).toHaveLength(1)
    expect(screen.queryByText('Current')).toBeNull()
    expect(screen.queryByText('Proposed')).toBeNull()
    expect(screen.getByText('→')).toBeTruthy()

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

  it('abstracts paired idle movements into direct strategy flow', () => {
    const beforeStrategies = [
      {
        strategyKey: 'alpha',
        strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        name: 'Alpha',
        isUnallocated: false,
        allocationPct: 80,
        aprPct: null
      },
      {
        strategyKey: 'beta',
        strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        name: 'Beta',
        isUnallocated: false,
        allocationPct: 20,
        aprPct: null
      }
    ]
    const afterStrategies = [
      { ...beforeStrategies[0]!, allocationPct: 50 },
      { ...beforeStrategies[1]!, allocationPct: 50 }
    ]

    const graph = buildStateTransitionSankeyGraph(beforeStrategies, afterStrategies, {
      deallocations: [{ strategyKey: 'alpha', allocationPct: 20 }],
      deployments: [{ strategyKey: 'beta', allocationPct: 20 }],
      eventCount: 2
    })

    expect(graph.nodes.some((node) => node.side === 'center')).toBe(false)
    expect(graph.links).toEqual(expect.arrayContaining([{ source: 'before:alpha', target: 'after:beta', value: 30 }]))
  })

  it('routes only the unmatched idle balance through the bottom-center node', () => {
    const beforeStrategies = [
      {
        strategyKey: 'alpha',
        strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        name: 'Alpha',
        isUnallocated: false,
        allocationPct: 80,
        aprPct: null
      },
      {
        strategyKey: 'beta',
        strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        name: 'Beta',
        isUnallocated: false,
        allocationPct: 20,
        aprPct: null
      }
    ]
    const afterStrategies = [
      { ...beforeStrategies[0]!, allocationPct: 50 },
      { ...beforeStrategies[1]!, allocationPct: 50 }
    ]

    const graph = buildStateTransitionSankeyGraph(beforeStrategies, afterStrategies, {
      deallocations: [{ strategyKey: 'alpha', allocationPct: 20 }],
      deployments: [{ strategyKey: 'beta', allocationPct: 15 }],
      eventCount: 2
    })

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: 'center:unallocated',
        side: 'center',
        inboundValue: 5,
        outboundValue: 0
      })
    )
    expect(graph.links).toEqual(
      expect.arrayContaining([
        { source: 'before:alpha', target: 'after:beta', value: 25 },
        { source: 'before:alpha', target: 'center:unallocated', value: 5 }
      ])
    )
  })

  it('nets matched idle flows into strategy ribbons while retaining external flow', () => {
    const alphaAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const betaAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const beforeStrategies = [
      {
        strategyKey: alphaAddress,
        strategyAddress: alphaAddress,
        name: 'Alpha',
        isUnallocated: false,
        allocationPct: 70,
        allocationAmount: '700',
        aprPct: null
      },
      {
        strategyKey: betaAddress,
        strategyAddress: betaAddress,
        name: 'Beta',
        isUnallocated: false,
        allocationPct: 30,
        allocationAmount: '300',
        aprPct: null
      }
    ]
    const afterStrategies = [
      { ...beforeStrategies[0]!, allocationPct: 36.363636, allocationAmount: '400' },
      { ...beforeStrategies[1]!, allocationPct: 63.636364, allocationAmount: '700' }
    ]
    const evidence = { eventCount: 1, transactionCount: 1 }
    const graph = buildStateTransitionSankeyGraph(beforeStrategies, afterStrategies, undefined, {
      intervalCount: 2,
      balanceStatus: 'reconciled',
      attributionStatus: 'complete',
      unattributedAmount: '0',
      flows: [
        {
          source: { type: 'strategy', address: alphaAddress, name: 'Alpha' },
          target: { type: 'idle' },
          amount: '300',
          kind: 'idle_deallocation',
          attribution: 'derived_from_debt_updates',
          evidence
        },
        {
          source: { type: 'external' },
          target: { type: 'idle' },
          amount: '100',
          kind: 'deposit',
          attribution: 'observed_event',
          evidence
        },
        {
          source: { type: 'idle' },
          target: { type: 'strategy', address: betaAddress, name: 'Beta' },
          amount: '400',
          kind: 'idle_deployment',
          attribution: 'derived_from_debt_updates',
          evidence
        }
      ]
    })

    const outboundByNode = new Map<string, number>()
    const inboundByNode = new Map<string, number>()
    for (const link of graph.links) {
      outboundByNode.set(link.source, (outboundByNode.get(link.source) ?? 0) + link.value)
      inboundByNode.set(link.target, (inboundByNode.get(link.target) ?? 0) + link.value)
    }

    for (const node of graph.nodes.filter((candidate) => candidate.side === 'before')) {
      expect(outboundByNode.get(node.id)).toBeCloseTo(node.outboundValue ?? 0, 5)
      expect(node.outboundValue).toBeGreaterThan(0)
    }
    for (const node of graph.nodes.filter((candidate) => candidate.side === 'after')) {
      expect(inboundByNode.get(node.id)).toBeCloseTo(node.inboundValue ?? 0, 5)
      expect(node.inboundValue).toBeGreaterThan(0)
    }
    expect(graph.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'center:external-source', centerRole: 'source' })])
    )
    expect(graph.nodes.some((node) => node.id === 'center:unallocated')).toBe(false)
    expect(graph.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: `before:${alphaAddress}`,
          target: `after:${betaAddress}`,
          attributions: ['derived_from_debt_updates']
        }),
        expect.objectContaining({
          source: 'center:external-source',
          target: `after:${betaAddress}`,
          attributions: ['observed_event', 'derived_from_debt_updates']
        })
      ])
    )
  })
})

describe('older panel pagination', () => {
  it('prefetches the next API page when the user reaches two panels from the oldest loaded edge', () => {
    const newer = makeChange({
      sourceKey: 'newer',
      timestampUtc: '2026-04-22 10:00:00 UTC',
      strategies: [
        {
          strategyKey: 'alpha',
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          isUnallocated: false,
          currentAllocationPct: 60,
          targetAllocationPct: 40,
          currentAprPct: 2,
          targetAprPct: 2
        },
        {
          strategyKey: 'beta',
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          isUnallocated: false,
          currentAllocationPct: 40,
          targetAllocationPct: 60,
          currentAprPct: 2,
          targetAprPct: 2
        }
      ]
    })
    const panels = buildReallocationPanels([
      newer,
      { ...newer, sourceKey: 'older-1', timestampUtc: '2026-04-21 10:00:00 UTC' },
      { ...newer, sourceKey: 'older-2', timestampUtc: '2026-04-20 10:00:00 UTC' },
      { ...newer, sourceKey: 'older-3', timestampUtc: '2026-04-19 10:00:00 UTC' }
    ])
    const onActivePanelIndexChange = vi.fn()
    const onLoadOlderPanels = vi.fn()
    render(
      <ReallocationChart
        panels={panels}
        activePanelIndex={2}
        onActivePanelIndexChange={onActivePanelIndexChange}
        colorByStrategyKey={buildReallocationColorMap(panels, false)}
        hasOlderPanels
        onLoadOlderPanels={onLoadOlderPanels}
      />
    )

    expect(onLoadOlderPanels).toHaveBeenCalledOnce()
    expect(onActivePanelIndexChange).not.toHaveBeenCalled()
  })
})
