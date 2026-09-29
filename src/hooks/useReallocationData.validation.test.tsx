import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildObservedReallocationPanels, isValidChartResponse, useReallocationData } from '@/hooks/useReallocationData'

const vault = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const strategy = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
function makeResponse() {
  const before = {
    blockNumber: 100,
    blockTimestamp: 1000,
    totalAssets: '100',
    totalIdle: '100',
    allocations: []
  }
  const after = {
    blockNumber: 101,
    blockTimestamp: 1010,
    totalAssets: '100',
    totalIdle: '0',
    allocations: [{ strategyAddress: strategy, currentDebt: '100' }]
  }
  const reconciliation = {
    balanceStatus: 'reconciled' as const,
    attributionStatus: 'complete' as const,
    unattributedAmount: '0'
  }
  return {
    schemaVersion: 2,
    projection: 'chart' as const,
    generatedAt: 1020,
    vault: { address: vault, chainId: 1 },
    strategies: { [strategy]: 'Strategy' },
    boundaryStates: { opening: before },
    entries: [
      {
        id: 'entry',
        kind: 'strategy_reallocation' as const,
        after,
        endBlock: 101,
        endTimestamp: 1010,
        execution: {
          automation: 'automatic' as const,
          mechanism: 'allocator_keeper' as const,
          targetStatus: 'matched' as const
        },
        expectedAprImpact: { status: 'unavailable' as const, reason: 'no_matched_doa_policy' },
        detailsHref: '/details/entry',
        interval: {
          fromEntryId: 'opening',
          toEntryId: 'entry',
          endKind: 'allocation_entry' as const,
          reconciliation,
          flows: [
            {
              source: { type: 'idle' as const },
              target: { type: 'strategy' as const, address: strategy },
              amount: '100',
              kind: 'idle_deployment' as const,
              attribution: 'observed_event' as const
            }
          ]
        }
      }
    ],
    currentSnapshot: {
      ...after,
      id: 'current',
      kind: 'current_snapshot' as const,
      interval: {
        fromEntryId: 'entry',
        toEntryId: null,
        endKind: 'safe_head' as const,
        flows: [],
        reconciliation
      }
    },
    pagination: { nextCursor: null }
  }
}
function build(response: ReturnType<typeof makeResponse>) {
  return buildObservedReallocationPanels(
    response.entries,
    response.currentSnapshot,
    new Map(Object.entries(response.boundaryStates)),
    new Map(Object.entries(response.strategies))
  )
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('allocation history failure handling', () => {
  it.each([
    { expectedAprImpact: undefined },
    { expectedAprImpact: null },
    { expectedAprImpact: { status: 'available', publishedAt: null } },
    { execution: { automation: null } },
    { execution: null },
    { endTimestamp: {} },
    { endBlock: '101' },
    { detailsHref: 42 },
    { after: null },
    { interval: undefined }
  ])('rejects malformed entry fields without throwing: %j', (fields) => {
    const response = makeResponse()
    const malformed = { ...response, entries: [{ ...response.entries[0], ...fields }] }
    expect(isValidChartResponse(malformed, vault, 1, true)).toBe(false)
  })

  it.each([null, { pagination: {} }, { currentSnapshot: undefined }, { vault: { address: 42 } }])(
    'rejects malformed response fields without throwing: %j',
    (fields) => {
      const response = fields === null ? null : { ...makeResponse(), ...fields }
      expect(isValidChartResponse(response, vault, 1, true)).toBe(false)
    }
  )

  it('accepts explicit unavailable APR metadata and valid observed intervals', () => {
    const response = makeResponse()
    expect(isValidChartResponse(response, vault, 1, true)).toBe(true)
    expect(build(response).issues).toEqual([])
    expect(build(response).panels).toHaveLength(2)
  })

  it('reports a one-unit flow mismatch while retaining a valid current interval', () => {
    const response = makeResponse()
    response.entries[0].interval.flows[0].amount = '101'
    const result = build(response)
    expect(result.panels.map(({ kind }) => kind)).toEqual(['current'])
    expect(result.issues).toEqual([
      { entryId: 'entry', reason: 'Interval flows do not reconcile with observed balances' }
    ])
  })

  it('reports missing boundary evidence while retaining a valid current interval', () => {
    const response = makeResponse()
    const result = buildObservedReallocationPanels(response.entries, response.currentSnapshot, new Map(), new Map())
    expect(result.panels.map(({ kind }) => kind)).toEqual(['current'])
    expect(result.issues).toEqual([{ entryId: 'entry', reason: 'Missing boundary state: opening' }])
  })

  it('reports an invalid current interval while retaining verified history', () => {
    const response = makeResponse()
    response.currentSnapshot.totalIdle = '1'
    response.currentSnapshot.totalAssets = '101'
    const result = build(response)
    expect(result.panels.map(({ kind }) => kind)).toEqual(['executed'])
    expect(result.issues).toEqual([
      { entryId: 'current', reason: 'Current interval flows do not reconcile with observed balances' }
    ])
  })

  it('returns a controlled query error for missing APR metadata', async () => {
    const response = makeResponse()
    const malformed = {
      ...response,
      entries: response.entries.map((entry) => ({ ...entry, expectedAprImpact: undefined }))
    }
    vi.stubEnv('VITE_PUBLIC_ALLOCATION_HISTORY_API_URL', 'https://api.example/history')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(malformed)))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useReallocationData(vault, 1, { address: vault } as never), { wrapper })
    await waitFor(() => expect(result.current.error).toBe('Allocation history API returned an invalid chart response'))
    expect(result.current.data).toBeNull()
    expect(result.current.issues).toEqual([])
  })
})
