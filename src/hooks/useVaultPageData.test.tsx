import { renderHook } from '@testing-library/react'
import { getAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YVUSD_UNLOCKED_ADDRESS } from '@/constants/featuredVaults'
import { useVaultPageData } from './useVaultPageData'

const BLACKLISTED_ADDRESS = '0x1111111111111111111111111111111111111111'
const OPEN_ADDRESS = '0x2222222222222222222222222222222222222222'
const useRestTimeseriesMock = vi.fn()
const useVaultsMock = vi.fn()
const useQueryMock = vi.fn()
const overrideMocks = vi.hoisted(() => ({
  isVaultBlacklisted: vi.fn<(chainId: number, address: string) => boolean>(),
  getVaultBlacklistReason: vi.fn<(chainId: number, address: string) => string | undefined>()
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args)
}))

vi.mock('@/hooks/useRestTimeseries', () => ({
  useRestTimeseries: (...args: unknown[]) => useRestTimeseriesMock(...args)
}))

vi.mock('@/contexts/useVaults', () => ({
  useVaults: () => useVaultsMock()
}))

vi.mock('@/lib/kong-vault-client', () => ({
  fetchKongVaultSnapshotRaw: vi.fn()
}))

vi.mock('@/lib/kong-vault-derivation', () => ({
  mapKongSnapshotToVaultExtended: vi.fn()
}))

vi.mock('@/utils/vaultOverrides', () => ({
  applyVaultOverride: (vault: unknown) => vault,
  getVaultBlacklistReason: (...args: [number, string]) => overrideMocks.getVaultBlacklistReason(...args),
  getVaultOverride: vi.fn(() => undefined),
  isVaultBlacklisted: (...args: [number, string]) => overrideMocks.isVaultBlacklisted(...args)
}))

describe('useVaultPageData', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    useRestTimeseriesMock.mockReset()
    useVaultsMock.mockReset()
    overrideMocks.isVaultBlacklisted.mockReset()
    overrideMocks.getVaultBlacklistReason.mockReset()

    useVaultsMock.mockReturnValue({ vaults: [] })
    useQueryMock.mockReturnValue({ data: null, isLoading: false, error: null })
    useRestTimeseriesMock.mockReturnValue({ data: undefined, isLoading: false, error: null })
    overrideMocks.isVaultBlacklisted.mockImplementation(
      (chainId, address) => chainId === 1 && address.toLowerCase() === BLACKLISTED_ADDRESS
    )
    overrideMocks.getVaultBlacklistReason.mockReturnValue('Hidden vault')
  })

  it('passes a canonical vault address to timeseries queries', () => {
    const vaultAddress = '0x1234567890abcdef1234567890ABCDEF12345678'
    const canonicalAddress = getAddress(vaultAddress)

    renderHook(() => useVaultPageData({ vaultAddress, vaultChainId: 1 }))

    expect(useRestTimeseriesMock).toHaveBeenCalled()
    for (const call of useRestTimeseriesMock.mock.calls) {
      expect(call[0]).toMatchObject({ address: canonicalAddress })
    }
  })

  it('disables all vault data queries for blacklisted vaults', () => {
    const { result } = renderHook(() => useVaultPageData({ vaultAddress: BLACKLISTED_ADDRESS, vaultChainId: 1 }))

    for (const call of useQueryMock.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ enabled: false }))
    }
    for (const call of useRestTimeseriesMock.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ enabled: false }))
    }
    expect(result.current.vaultDetails).toBeNull()
  })

  it('keeps detail queries enabled for valid non-blacklisted vaults', () => {
    renderHook(() => useVaultPageData({ vaultAddress: OPEN_ADDRESS, vaultChainId: 1 }))

    expect(useQueryMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
    expect(useRestTimeseriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, segment: 'apy-historical' })
    )
  })

  it('does not request the generic APR oracle timeseries for yvUSD', () => {
    renderHook(() => useVaultPageData({ vaultAddress: YVUSD_UNLOCKED_ADDRESS, vaultChainId: 1 }))

    expect(useRestTimeseriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, segment: 'apr-oracle' })
    )
  })
})
