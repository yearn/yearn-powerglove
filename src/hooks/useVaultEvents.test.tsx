import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { fetchVaultUserEventsPageByType } from '@/lib/vault-events'
import type { VaultUserEventType } from '@/types/vaultEventTypes'
import { useVaultEvents } from './useVaultEvents'

vi.mock('@/lib/vault-events', () => ({
  dedupVaultUserEvents: (events: unknown[]) => events,
  fetchVaultUserEventsPageByType: vi.fn(),
  sortEventsChronologically: (events: Array<{ blockTimestamp: string }>) =>
    [...events].sort((a, b) => Number(b.blockTimestamp) - Number(a.blockTimestamp))
}))

function makeEvents(count: number, vaultAddress: string, type: VaultUserEventType = 'deposit', startIndex = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${vaultAddress}-${type}-${startIndex + index}`,
    type,
    owner: '0x1111111111111111111111111111111111111111',
    assets: '1000000',
    shares: '1000000',
    vaultAddress,
    chainId: 1,
    blockNumber: String(startIndex + index + 1),
    blockTimestamp: String(startIndex + index + 1),
    transactionHash: `0x${String(startIndex + index + 1).padStart(64, '0')}`
  }))
}

function makePage(events: ReturnType<typeof makeEvents>, hasMore = false, nextOffset = 250) {
  return {
    events,
    hasMore,
    nextOffset
  }
}

describe('useVaultEvents', () => {
  const fetchVaultUserEventsPageByTypeMock = fetchVaultUserEventsPageByType as Mock

  beforeEach(() => {
    fetchVaultUserEventsPageByTypeMock.mockReset()
  })

  it('resets pagination when the selected vault changes', async () => {
    fetchVaultUserEventsPageByTypeMock.mockImplementation(
      (vaultAddress: string, _chainId: number, eventType: VaultUserEventType) => {
        if (eventType !== 'deposit') {
          return Promise.resolve(makePage([]))
        }

        return Promise.resolve(
          makePage(vaultAddress === '0xvault-a' ? makeEvents(120, vaultAddress) : makeEvents(10, vaultAddress))
        )
      }
    )

    const { result, rerender } = renderHook(({ vaultAddress, chainId }) => useVaultEvents(vaultAddress, chainId), {
      initialProps: {
        vaultAddress: '0xvault-a',
        chainId: 1 as const
      }
    })

    await waitFor(() => expect(result.current.totalCount).toBe(120))

    act(() => {
      result.current.setCurrentPage(3)
    })

    expect(result.current.currentPage).toBe(3)

    rerender({
      vaultAddress: '0xvault-b',
      chainId: 1 as const
    })

    await waitFor(() => expect(result.current.totalCount).toBe(10))

    expect(result.current.currentPage).toBe(1)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.events).toHaveLength(10)
  })

  it('loads another source page on demand', async () => {
    fetchVaultUserEventsPageByTypeMock.mockImplementation(
      (_vaultAddress: string, _chainId: number, eventType: VaultUserEventType, offset = 0) => {
        if (eventType !== 'deposit') {
          return Promise.resolve(makePage([]))
        }

        if (offset === 0) {
          return Promise.resolve(makePage(makeEvents(50, '0xvault-a'), true))
        }

        return Promise.resolve(makePage(makeEvents(10, '0xvault-a', 'deposit', 50), false, 500))
      }
    )

    const { result } = renderHook(({ vaultAddress, chainId }) => useVaultEvents(vaultAddress, chainId), {
      initialProps: {
        vaultAddress: '0xvault-a',
        chainId: 1 as const
      }
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.events).toHaveLength(50)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.hasMoreEvents).toBe(true)

    await act(async () => {
      await result.current.loadMoreEvents()
    })

    expect(result.current.hasMoreEvents).toBe(false)
    expect(result.current.totalPages).toBe(2)

    act(() => {
      result.current.setCurrentPage(2)
    })

    expect(result.current.events).toHaveLength(10)
  })

  it('renders loaded event types while another event type is still pending', async () => {
    let resolveTransfer:
      | ((page: { events: ReturnType<typeof makeEvents>; hasMore: boolean; nextOffset: number }) => void)
      | undefined

    fetchVaultUserEventsPageByTypeMock.mockImplementation(
      (_vaultAddress: string, _chainId: number, eventType: VaultUserEventType) => {
        if (eventType === 'transfer') {
          return new Promise((resolve) => {
            resolveTransfer = resolve
          })
        }

        return Promise.resolve(makePage(eventType === 'deposit' ? makeEvents(1, '0xvault-a') : []))
      }
    )

    const { result } = renderHook(({ vaultAddress, chainId }) => useVaultEvents(vaultAddress, chainId), {
      initialProps: {
        vaultAddress: '0xvault-a',
        chainId: 1 as const
      }
    })

    await waitFor(() => expect(result.current.events).toHaveLength(1))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.pendingEventTypes).toEqual(['transfer'])

    await act(async () => {
      resolveTransfer?.(makePage([]))
    })

    expect(result.current.pendingEventTypes).toEqual([])
  })
})
