import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchVaultUserEvents } from '@/lib/vault-events'
import { useVaultEvents } from './useVaultEvents'

vi.mock('@/lib/vault-events', () => ({
  fetchVaultUserEvents: vi.fn()
}))

function makeEvents(count: number, vaultAddress: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${vaultAddress}-${index}`,
    type: 'deposit' as const,
    owner: '0x1111111111111111111111111111111111111111',
    assets: '1000000',
    shares: '1000000',
    vaultAddress,
    chainId: 1,
    blockNumber: String(index + 1),
    blockTimestamp: String(index + 1),
    transactionHash: `0x${String(index + 1).padStart(64, '0')}`
  }))
}

describe('useVaultEvents', () => {
  const fetchVaultUserEventsMock = vi.mocked(fetchVaultUserEvents)

  beforeEach(() => {
    fetchVaultUserEventsMock.mockReset()
  })

  it('resets pagination when the selected vault changes', async () => {
    fetchVaultUserEventsMock.mockResolvedValueOnce(makeEvents(120, '0xvault-a'))
    fetchVaultUserEventsMock.mockResolvedValueOnce(makeEvents(10, '0xvault-b'))

    const { result, rerender } = renderHook(({ vaultAddress, chainId }) => useVaultEvents(vaultAddress, chainId), {
      initialProps: {
        vaultAddress: '0xvault-a',
        chainId: 1 as const
      }
    })

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
