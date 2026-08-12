import { renderHook } from '@testing-library/react'
import { getAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@/constants/featuredVaults'
import type { Vault } from '@/types/vaultTypes'
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

const kongMocks = vi.hoisted(() => ({
  mapKongSnapshotToVaultExtended: vi.fn()
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
  mapKongSnapshotToVaultExtended: (...args: unknown[]) => kongMocks.mapKongSnapshotToVaultExtended(...args)
}))

vi.mock('@/utils/vaultOverrides', () => ({
  applyVaultOverride: (vault: unknown) => vault,
  getVaultBlacklistReason: (...args: [number, string]) => overrideMocks.getVaultBlacklistReason(...args),
  getVaultOverride: vi.fn(() => undefined),
  isVaultBlacklisted: (...args: [number, string]) => overrideMocks.isVaultBlacklisted(...args)
}))

const makeVault = (address: string): Vault => ({
  address,
  symbol: 'yvBOLD',
  name: 'yvBOLD',
  chainId: 1,
  inceptTime: '0',
  asset: {
    name: 'BOLD',
    symbol: 'BOLD',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000001'
  },
  apiVersion: '3.0.0',
  pricePerShare: 1,
  apy: {
    grossApr: 0,
    net: 0.01,
    inceptionNet: 0.01,
    weeklyNet: 0.01,
    monthlyNet: 0.01
  },
  tvl: { close: 100 },
  yearn: true,
  v3: true,
  erc4626: true,
  fees: { managementFee: 0, performanceFee: 0 },
  managementFee: 0,
  performanceFee: 0,
  forwardApyNet: 0.01,
  estimatedApySource: 'oracle',
  historicalWeeklyApy: 0.01,
  historicalMonthlyApy: 0.01,
  strategyForwardAprs: {}
})

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
    kongMocks.mapKongSnapshotToVaultExtended.mockReset()
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

  it('uses the staked yBOLD oracle APY when weekly history is unavailable', () => {
    const baseVault = makeVault(YBOLD_VAULT_ADDRESS)
    const stakedVault = {
      ...makeVault(YBOLD_STAKING_ADDRESS),
      historicalWeeklyApy: null,
      forwardApyNet: 0.04,
      estimatedApySource: 'oracle' as const,
      strategyDetails: []
    }

    useVaultsMock.mockReturnValue({ vaults: [baseVault] })
    useQueryMock.mockImplementation((options: { queryKey?: unknown[] }) => ({
      data: options.queryKey?.includes(YBOLD_STAKING_ADDRESS.toLowerCase()) ? { address: YBOLD_STAKING_ADDRESS } : null,
      isLoading: false,
      error: null
    }))
    kongMocks.mapKongSnapshotToVaultExtended.mockReturnValue(stakedVault)

    const { result } = renderHook(() => useVaultPageData({ vaultAddress: YBOLD_VAULT_ADDRESS, vaultChainId: 1 }))

    expect(result.current.vaultDetails?.forwardApyNet).toBe(0.04)
    expect(result.current.vaultDetails?.estimatedApySource).toBe('oracle')
  })

  it('does not expose the base yBOLD estimate without a staked snapshot', () => {
    useVaultsMock.mockReturnValue({ vaults: [makeVault(YBOLD_VAULT_ADDRESS)] })

    const { result } = renderHook(() => useVaultPageData({ vaultAddress: YBOLD_VAULT_ADDRESS, vaultChainId: 1 }))

    expect(result.current.vaultDetails?.name).toBe('yBOLD')
    expect(result.current.vaultDetails?.forwardApyNet).toBeNull()
    expect(result.current.vaultDetails?.estimatedApySource).toBeNull()
  })
})
