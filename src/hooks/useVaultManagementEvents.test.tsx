import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchVaultManagementEvents } from '@/lib/vault-events'
import { useVaultManagementEvents } from './useVaultManagementEvents'

vi.mock('@/lib/vault-events', () => ({
  fetchVaultManagementEvents: vi.fn(),
  MANAGEMENT_EVENT_TYPE_OPTIONS: [
    { value: 'all', label: 'All events' },
    { value: 'shutdown', label: 'Shutdown' }
  ]
}))

function makeEvents(count: number, vaultAddress: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${vaultAddress}-${index}`,
    type: 'shutdown' as const,
    chainId: 1,
    blockNumber: String(index + 1),
    blockTimestamp: String(index + 1),
    transactionHash: `0x${String(index + 1).padStart(64, '0')}`,
    vaultAddress
  }))
}

describe('useVaultManagementEvents', () => {
  const fetchVaultManagementEventsMock = vi.mocked(fetchVaultManagementEvents)

  beforeEach(() => {
    fetchVaultManagementEventsMock.mockReset()
  })

  it('resets pagination when the selected vault changes', async () => {
    fetchVaultManagementEventsMock.mockResolvedValueOnce(makeEvents(120, '0xvault-a'))
    fetchVaultManagementEventsMock.mockResolvedValueOnce(makeEvents(10, '0xvault-b'))

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
})
