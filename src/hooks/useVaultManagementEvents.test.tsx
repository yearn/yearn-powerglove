import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { fetchVaultManagementEventsPage } from '@/lib/vault-events'
import { useVaultManagementEvents } from './useVaultManagementEvents'

vi.mock('@/lib/vault-events', () => ({
  dedupVaultUserEvents: (events: unknown[]) => events,
  fetchVaultManagementEventsPage: vi.fn(),
  fetchVaultUserEventsPage: vi.fn(),
  MANAGEMENT_EVENT_TYPE_OPTIONS: [
    { value: 'all', label: 'All events' },
    { value: 'shutdown', label: 'Shutdown' }
  ],
  sortEventsChronologically: (events: Array<{ blockTimestamp: string }>) =>
    [...events].sort((a, b) => Number(b.blockTimestamp) - Number(a.blockTimestamp))
}))

function makeEvents(count: number, vaultAddress: string, startIndex = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${vaultAddress}-${startIndex + index}`,
    type: 'shutdown' as const,
    chainId: 1,
    blockNumber: String(startIndex + index + 1),
    blockTimestamp: String(startIndex + index + 1),
    transactionHash: `0x${String(startIndex + index + 1).padStart(64, '0')}`,
    vaultAddress
  }))
}

function makePage(events: ReturnType<typeof makeEvents>, hasMore = false, nextOffset = 250) {
  return {
    events,
    hasMore,
    nextOffset
  }
}

describe('useVaultManagementEvents', () => {
  const fetchVaultManagementEventsPageMock = fetchVaultManagementEventsPage as Mock

  beforeEach(() => {
    fetchVaultManagementEventsPageMock.mockReset()
  })

  it('resets pagination when the selected vault changes', async () => {
    fetchVaultManagementEventsPageMock.mockResolvedValueOnce(makePage(makeEvents(120, '0xvault-a')))
    fetchVaultManagementEventsPageMock.mockResolvedValueOnce(makePage(makeEvents(10, '0xvault-b')))

    const { result, rerender } = renderHook(
      ({ vaultAddress, chainId }) => useVaultManagementEvents(vaultAddress, chainId),
      {
        initialProps: {
          vaultAddress: '0xvault-a',
          chainId: 1 as const
        }
      }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setCurrentPage(3)
    })

    expect(result.current.currentPage).toBe(3)

    rerender({
      vaultAddress: '0xvault-b',
      chainId: 1 as const
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.currentPage).toBe(1)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.events).toHaveLength(10)
  })

  it('loads another source page on demand', async () => {
    fetchVaultManagementEventsPageMock.mockResolvedValueOnce(makePage(makeEvents(50, '0xvault-a'), true))
    fetchVaultManagementEventsPageMock.mockResolvedValueOnce(makePage(makeEvents(10, '0xvault-a', 50), false, 500))

    const { result } = renderHook(({ vaultAddress, chainId }) => useVaultManagementEvents(vaultAddress, chainId), {
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
})
