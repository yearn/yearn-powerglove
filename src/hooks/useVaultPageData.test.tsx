import { renderHook } from '@testing-library/react'
import { getAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@/constants/featuredVaults'
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

  it('requests the APR Oracle chart series for yvUSD', () => {
    useVaultsMock.mockReturnValue({ vaults: [makeVault(YVUSD_UNLOCKED_ADDRESS)] })

    renderHook(() => useVaultPageData({ vaultAddress: YVUSD_UNLOCKED_ADDRESS, vaultChainId: 1 }))

    expect(useRestTimeseriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, segment: 'apr-oracle', components: ['netApy', 'netApr', 'apr'] })
    )
  })

  it('keeps paired yvUSD snapshot estimates when the APR service is unavailable', () => {
    const unlockedVault = {
      ...makeVault(YVUSD_UNLOCKED_ADDRESS),
      forwardApyNet: 0.03,
      estimatedApySource: 'est-yvusd' as const,
      strategyDetails: []
    }
    const lockedVault = {
      ...makeVault(YVUSD_LOCKED_ADDRESS),
      forwardApyNet: 0.07,
      estimatedApySource: 'est-yvusd' as const,
      strategyDetails: []
    }
    useVaultsMock.mockReturnValue({ vaults: [unlockedVault] })
    useQueryMock.mockImplementation((options: { queryKey?: unknown[] }) => {
      const queryKey = options.queryKey ?? []
      const address = queryKey[4]
      if (queryKey[0] === 'yvusd') {
        return { data: undefined, isLoading: false, error: new Error('service unavailable') }
      }
      if (address === YVUSD_UNLOCKED_ADDRESS.toLowerCase()) {
        return { data: { address: YVUSD_UNLOCKED_ADDRESS }, isLoading: false, error: null }
      }
      if (address === lockedVault.address.toLowerCase()) {
        return { data: { address: lockedVault.address }, isLoading: false, error: null }
      }
      return { data: null, isLoading: false, error: null }
    })
    kongMocks.mapKongSnapshotToVaultExtended.mockImplementation((snapshot: { address: string }) =>
      snapshot.address.toLowerCase() === lockedVault.address.toLowerCase() ? lockedVault : unlockedVault
    )

    const { result } = renderHook(() => useVaultPageData({ vaultAddress: YVUSD_UNLOCKED_ADDRESS, vaultChainId: 1 }))

    expect(result.current.vaultDetails?.pairedEstimatedApy).toEqual({ locked: 0.07, unlocked: 0.03 })
  })

  it('keeps the basic Katana estimate while using only Oracle APY for chart history', () => {
    const katanaVault: Vault = {
      ...makeVault(OPEN_ADDRESS),
      chainId: 747474,
      forwardApyNet: 0.07,
      estimatedApySource: 'est-katana'
    }
    useVaultsMock.mockReturnValue({ vaults: [katanaVault] })

    const { result } = renderHook(() => useVaultPageData({ vaultAddress: OPEN_ADDRESS, vaultChainId: 747474 }))

    expect(result.current.vaultDetails?.forwardApyNet).toBe(0.07)
    expect(result.current.vaultDetails?.estimatedApySource).toBe('est-katana')
    expect(useRestTimeseriesMock).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, segment: 'apr-oracle' })
    )
    expect(useQueryMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['katana-estimated-apr']) })
    )
  })

  it('uses the staked yBOLD oracle APY when weekly history is unavailable', () => {
    const baseVault = makeVault(YBOLD_VAULT_ADDRESS)
    const stakedVault = {
      ...makeVault(YBOLD_STAKING_ADDRESS),
      oracleNetApy: 0.04,
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

  it('uses max(7-day PPS APY, Oracle net APY) for the yBOLD estimate', () => {
    const baseVault = makeVault(YBOLD_VAULT_ADDRESS)
    const stakedVault = {
      ...makeVault(YBOLD_STAKING_ADDRESS),
      oracleNetApy: 0.0495,
      historicalWeeklyApy: 0.046,
      forwardApyNet: 0.055,
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

    expect(result.current.vaultDetails?.forwardApyNet).toBe(0.0495)
    expect(result.current.vaultDetails?.estimatedApySource).toBe('est-ybold')
  })

  it('does not expose the base yBOLD estimate without a staked snapshot', () => {
    useVaultsMock.mockReturnValue({ vaults: [makeVault(YBOLD_VAULT_ADDRESS)] })

    const { result } = renderHook(() => useVaultPageData({ vaultAddress: YBOLD_VAULT_ADDRESS, vaultChainId: 1 }))

    expect(result.current.vaultDetails?.name).toBe('yBOLD')
    expect(result.current.vaultDetails?.forwardApyNet).toBeNull()
    expect(result.current.vaultDetails?.estimatedApySource).toBeNull()
  })
})
