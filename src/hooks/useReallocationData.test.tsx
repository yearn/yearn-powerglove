import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildObservedReallocationPanels,
  buildReallocationQueryKey,
  buildReallocationRequestUrl,
  isValidChartResponse,
  useReallocationData
} from '@/hooks/useReallocationData'

const strategyA = '0x1111111111111111111111111111111111111111'
const strategyB = '0x2222222222222222222222222222222222222222'

function state(blockNumber: number, strategyAAmount: number, strategyBAmount: number, idleAmount: number) {
  return {
    blockNumber,
    blockTimestamp: blockNumber * 10,
    totalAssets: String(strategyAAmount + strategyBAmount + idleAmount),
    totalIdle: String(idleAmount),
    allocations: [
      { strategyAddress: strategyA, currentDebt: String(strategyAAmount) },
      { strategyAddress: strategyB, currentDebt: String(strategyBAmount) }
    ]
  }
}

function flow(
  source: { type: 'strategy'; address: string } | { type: 'idle' | 'external' | 'accounting' },
  target: { type: 'strategy'; address: string } | { type: 'idle' | 'external' | 'accounting' },
  amount: number,
  kind: 'deposit' | 'idle_deployment' | 'idle_deallocation' | 'strategy_reallocation' | 'reported_gain',
  attribution: 'observed_event' | 'derived_from_debt_updates' = 'observed_event'
) {
  return { source, target, amount: String(amount), kind, attribution }
}

function interval(
  fromEntryId: string,
  toEntryId: string | null,
  flows: ReturnType<typeof flow>[],
  endKind: 'allocation_entry' | 'safe_head' = 'allocation_entry'
) {
  return {
    fromEntryId,
    toEntryId,
    endKind,
    flows,
    reconciliation: {
      balanceStatus: 'reconciled' as const,
      attributionStatus: 'complete' as const,
      unattributedAmount: '0'
    }
  }
}

const execution = {
  automation: 'automatic' as const,
  mechanism: 'allocator_keeper' as const,
  targetStatus: 'matched' as const
}
const expectedAprImpact = {
  status: 'unavailable' as const,
  reason: 'no_matched_doa_policy'
}

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('allocation history request', () => {
  it('keys chart history by chain and normalized vault address', () => {
    expect(buildReallocationQueryKey('0xAbC', 1)).toEqual(['allocation-history', 'chart', 1, '0xabc'])
  })

  it('builds the chart projection URL and preserves an opaque cursor', () => {
    expect(buildReallocationRequestUrl('https://api.example/history/', '0xAbC', 1, 'cursor/value+1')).toBe(
      'https://api.example/history/1/0xabc?projection=chart&limit=25&direction=desc&cursor=cursor%2Fvalue%2B1'
    )
  })

  it('requires a current snapshot on the first page but accepts null on cursor pages', () => {
    const response = {
      schemaVersion: 2,
      projection: 'chart' as const,
      generatedAt: 1,
      vault: { chainId: 1, address: '0xabc' },
      strategies: {},
      boundaryStates: {},
      entries: [],
      currentSnapshot: null,
      pagination: { nextCursor: 'next' }
    }

    expect(isValidChartResponse(response, '0xAbC', 1, true)).toBe(false)
    expect(isValidChartResponse(response, '0xAbC', 1, false)).toBe(true)
  })

  it('validates exact raw balances instead of removed BPS fields', () => {
    const currentState = state(110, 400, 710, 0)
    const response = {
      schemaVersion: 2,
      projection: 'chart' as const,
      generatedAt: 1,
      vault: { chainId: 1, address: '0xabc' },
      strategies: { [strategyA]: 'Strategy A', [strategyB]: 'Strategy B' },
      boundaryStates: {},
      entries: [],
      currentSnapshot: {
        ...currentState,
        id: 'current',
        kind: 'current_snapshot' as const,
        interval: null
      },
      pagination: { nextCursor: null }
    }

    expect(isValidChartResponse(response, '0xAbC', 1, true)).toBe(true)
    expect(
      isValidChartResponse(
        { ...response, currentSnapshot: { ...response.currentSnapshot, totalIdle: '1' } },
        '0xAbC',
        1,
        true
      )
    ).toBe(false)
  })
})

describe('useReallocationData backend discovery', () => {
  it('loads an arbitrary vault when the backend returns chart history', async () => {
    const vaultAddress = '0xb13CF163d916917d9cD6E836905cA5f12a1dEF4B'
    const boundaryState = state(99, 800, 200, 0)
    const entryState = state(101, 700, 300, 0)
    const currentState = state(102, 700, 300, 0)
    const entry = {
      id: 'strategy-1',
      kind: 'strategy_reallocation' as const,
      after: entryState,
      endBlock: 101,
      endTimestamp: entryState.blockTimestamp,
      execution,
      expectedAprImpact,
      detailsHref: '/details/strategy-1',
      interval: interval('strategy-0', 'strategy-1', [
        flow(
          { type: 'strategy', address: strategyA },
          { type: 'strategy', address: strategyB },
          100,
          'strategy_reallocation',
          'derived_from_debt_updates'
        )
      ])
    }
    const response = {
      schemaVersion: 2,
      projection: 'chart',
      generatedAt: 1,
      vault: { chainId: 8453, address: vaultAddress, name: 'True Yield Dollar' },
      strategies: { [strategyA]: 'Strategy A', [strategyB]: 'Strategy B' },
      boundaryStates: { 'strategy-0': boundaryState },
      entries: [entry],
      currentSnapshot: {
        ...currentState,
        id: 'current',
        kind: 'current_snapshot',
        interval: interval('strategy-1', null, [], 'safe_head')
      },
      pagination: { nextCursor: null }
    }
    vi.stubEnv('VITE_PUBLIC_ALLOCATION_HISTORY_API_URL', 'https://api.example/history')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))

    const { result } = renderHook(
      () => useReallocationData(vaultAddress, 8453, { address: vaultAddress, name: 'True Yield Dollar' } as never),
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/history/8453/0xb13cf163d916917d9cd6e836905ca5f12a1def4b?projection=chart&limit=25&direction=desc'
    )
    expect(result.current.data).toMatchObject({ chainId: 8453, vaultLabel: 'True Yield Dollar' })
    expect(result.current.data?.panels).toHaveLength(2)
  })

  it('keeps the chart hidden when the backend has no matching vault', async () => {
    const vaultAddress = '0x0000000000000000000000000000000000000001'
    vi.stubEnv('VITE_PUBLIC_ALLOCATION_HISTORY_API_URL', 'https://api.example/history')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }))

    const { result } = renderHook(
      () => useReallocationData(vaultAddress, 1, { address: vaultAddress, name: 'Unknown vault' } as never),
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.hasOlderEntries).toBe(false)
  })
})

describe('buildObservedReallocationPanels', () => {
  it('resolves shared names and page-boundary states while preserving hidden interval flows', () => {
    const boundaryState = state(99, 800, 200, 0)
    const firstAfter = state(101, 700, 300, 0)
    const secondAfter = state(107, 400, 700, 0)
    const safeHead = state(108, 400, 710, 0)
    const entries = [
      {
        id: 'strategy-1',
        kind: 'strategy_reallocation' as const,
        after: firstAfter,
        endBlock: 101,
        endTimestamp: firstAfter.blockTimestamp,
        execution,
        expectedAprImpact,
        detailsHref: '/details/strategy-1',
        interval: interval('strategy-0', 'strategy-1', [
          flow(
            { type: 'strategy', address: strategyA },
            { type: 'strategy', address: strategyB },
            100,
            'strategy_reallocation',
            'derived_from_debt_updates'
          )
        ])
      },
      {
        id: 'strategy-2',
        kind: 'strategy_reallocation' as const,
        after: secondAfter,
        endBlock: 107,
        endTimestamp: secondAfter.blockTimestamp,
        execution,
        expectedAprImpact,
        detailsHref: '/details/strategy-2',
        interval: interval('strategy-1', 'strategy-2', [
          flow(
            { type: 'strategy', address: strategyA },
            { type: 'idle' },
            200,
            'idle_deallocation',
            'derived_from_debt_updates'
          ),
          flow({ type: 'external' }, { type: 'idle' }, 100, 'deposit'),
          flow(
            { type: 'strategy', address: strategyA },
            { type: 'strategy', address: strategyB },
            100,
            'strategy_reallocation',
            'derived_from_debt_updates'
          ),
          flow(
            { type: 'idle' },
            { type: 'strategy', address: strategyB },
            300,
            'idle_deployment',
            'derived_from_debt_updates'
          )
        ])
      }
    ]
    const currentSnapshot = {
      ...safeHead,
      id: 'current',
      kind: 'current_snapshot' as const,
      interval: interval(
        'strategy-2',
        null,
        [flow({ type: 'accounting' }, { type: 'strategy', address: strategyB }, 10, 'reported_gain')],
        'safe_head'
      )
    }
    const { panels, issues } = buildObservedReallocationPanels(
      entries,
      currentSnapshot,
      new Map([['strategy-0', boundaryState]]),
      new Map([
        [strategyA, 'Strategy A'],
        [strategyB, 'Strategy B']
      ])
    )

    expect(issues).toEqual([])
    expect(panels).toHaveLength(3)
    expect(panels[0]?.beforeState.strategies.map((strategy) => strategy.allocationAmount)).toEqual(['800', '200'])
    expect(panels[0]?.afterState.strategies).toEqual(panels[1]?.beforeState.strategies)
    expect(panels[1]?.afterState.strategies).toEqual(panels[2]?.beforeState.strategies)
    expect(panels[1]?.afterState.strategies.map((strategy) => strategy.name)).toEqual(['Strategy A', 'Strategy B'])
    expect(panels[1]?.flowLedger).toMatchObject({
      intervalCount: 1,
      attributionStatus: 'complete',
      unattributedAmount: '0'
    })
    expect(panels[1]?.flowLedger?.flows.map((item) => item.kind)).toEqual([
      'idle_deallocation',
      'deposit',
      'strategy_reallocation',
      'idle_deployment'
    ])
    expect(panels[2]?.flowLedger).toMatchObject({ intervalCount: 1, attributionStatus: 'complete' })
    expect(panels[2]?.afterState.strategies.map((strategy) => strategy.allocationAmount)).toEqual(['400', '710'])
  })

  it('rejects an interval whose compact flows do not balance its referenced states', () => {
    const before = state(100, 800, 200, 0)
    const after = state(101, 700, 300, 0)
    const entry = {
      id: 'strategy-1',
      kind: 'strategy_reallocation' as const,
      after,
      endBlock: 101,
      endTimestamp: after.blockTimestamp,
      execution,
      expectedAprImpact,
      detailsHref: '/details/strategy-1',
      interval: interval('strategy-0', 'strategy-1', [])
    }

    expect(
      buildObservedReallocationPanels(
        [entry],
        { ...after, id: 'current', kind: 'current_snapshot', interval: null },
        new Map([['strategy-0', before]]),
        new Map([
          [strategyA, 'Strategy A'],
          [strategyB, 'Strategy B']
        ])
      )
    ).toEqual({
      panels: [],
      issues: [{ entryId: 'strategy-1', reason: 'Interval flows do not reconcile with observed balances' }]
    })
  })
})
