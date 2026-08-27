import { describe, expect, it } from 'vitest'
import {
  combineFeaturedVaults,
  getCanonicalVaultAddress,
  getVaultEventAddresses,
  getYieldDataAddress,
  YBOLD_CHAIN_ID,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@/constants/featuredVaults'
import type { Vault } from '@/types/vaultTypes'

const makeVault = (address: string, name: string, monthlyNet: number): Vault => ({
  address,
  symbol: name,
  name,
  chainId: 1,
  inceptTime: '0',
  asset: {
    name,
    symbol: name,
    decimals: 18,
    address: '0x0000000000000000000000000000000000000001'
  },
  apiVersion: '3.0.0',
  pricePerShare: 1,
  apy: {
    grossApr: 0,
    net: monthlyNet,
    inceptionNet: monthlyNet,
    weeklyNet: monthlyNet,
    monthlyNet
  },
  tvl: {
    close: 100
  },
  yearn: true,
  v3: true,
  erc4626: true,
  fees: {
    managementFee: 0,
    performanceFee: 0
  },
  managementFee: 0,
  performanceFee: 0,
  forwardApyNet: monthlyNet,
  estimatedApySource: 'oracle',
  historicalWeeklyApy: monthlyNet,
  historicalMonthlyApy: monthlyNet,
  strategyForwardAprs: {}
})

describe('featured vault grouping', () => {
  it('routes yBOLD display to the base vault while using staking yield data', () => {
    expect(getCanonicalVaultAddress(YBOLD_CHAIN_ID, YBOLD_STAKING_ADDRESS)).toBe(YBOLD_VAULT_ADDRESS)
    expect(getYieldDataAddress(YBOLD_CHAIN_ID, YBOLD_VAULT_ADDRESS)).toBe(YBOLD_STAKING_ADDRESS)
    expect(getVaultEventAddresses(YBOLD_CHAIN_ID, YBOLD_VAULT_ADDRESS)).toEqual([
      YBOLD_VAULT_ADDRESS,
      YBOLD_STAKING_ADDRESS
    ])
  })

  it('routes locked yvUSD to the unlocked page without flattening it into yBOLD-style yield data', () => {
    expect(getCanonicalVaultAddress(YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS)).toBe(YVUSD_UNLOCKED_ADDRESS)
    expect(getYieldDataAddress(YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS)).toBe(YVUSD_UNLOCKED_ADDRESS)
    expect(getVaultEventAddresses(YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS)).toEqual([
      YVUSD_UNLOCKED_ADDRESS,
      YVUSD_LOCKED_ADDRESS
    ])
  })

  it('hides duplicate list entries and applies staked yBOLD APY to the combined row', () => {
    const stakedYBold = makeVault(YBOLD_STAKING_ADDRESS, 'ysyBOLD', 0.05)
    stakedYBold.oracleNetApy = 0.07
    const vaults = combineFeaturedVaults([
      makeVault(YBOLD_VAULT_ADDRESS, 'yvBOLD', 0.01),
      stakedYBold,
      makeVault(YVUSD_UNLOCKED_ADDRESS, 'yvUSD', 0.02),
      makeVault(YVUSD_LOCKED_ADDRESS, 'yvUSD (Locked)', 0.08)
    ])

    expect(vaults.map((vault) => vault.address)).toEqual([YBOLD_VAULT_ADDRESS, YVUSD_UNLOCKED_ADDRESS])
    expect(vaults[0].name).toBe('yBOLD')
    expect(vaults[0].apy?.monthlyNet).toBe(0.05)
    expect(vaults[0].forwardApyNet).toBe(0.07)
    expect(vaults[0].estimatedApySource).toBe('est-ybold')
    expect(vaults[1].name).toBe('yvUSD')
    expect(vaults[1].apy?.monthlyNet).toBe(0.02)
    expect(vaults[1].pairedThirtyDayApy).toEqual({ locked: 0.08, unlocked: 0.02 })
    expect(vaults[1].pairedEstimatedApy).toEqual({ locked: null, unlocked: null })
  })
  it('falls back to the staked yBOLD oracle APY when weekly history is unavailable', () => {
    const stakedVault: Vault = {
      ...makeVault(YBOLD_STAKING_ADDRESS, 'ysyBOLD', 0.05),
      oracleNetApy: 0.04,
      historicalWeeklyApy: null,
      forwardApyNet: 0.04,
      estimatedApySource: 'oracle'
    }

    const [vault] = combineFeaturedVaults([makeVault(YBOLD_VAULT_ADDRESS, 'yvBOLD', 0.01), stakedVault])

    expect(vault.forwardApyNet).toBe(0.04)
    expect(vault.estimatedApySource).toBe('oracle')
  })

  it('falls back to the staked yBOLD weekly APY when Oracle net APY is unavailable', () => {
    const stakedVault: Vault = {
      ...makeVault(YBOLD_STAKING_ADDRESS, 'ysyBOLD', 0.05),
      oracleNetApy: null,
      estimatedApySource: 'unknown'
    }

    const [vault] = combineFeaturedVaults([makeVault(YBOLD_VAULT_ADDRESS, 'yvBOLD', 0.01), stakedVault])

    expect(vault.forwardApyNet).toBe(0.05)
    expect(vault.estimatedApySource).toBe('7day-hist')
  })

  it('does not expose the base yBOLD estimate when staked yield data is unavailable', () => {
    const [vault] = combineFeaturedVaults([makeVault(YBOLD_VAULT_ADDRESS, 'yvBOLD', 0.01)])

    expect(vault.name).toBe('yBOLD')
    expect(vault.forwardApyNet).toBeNull()
    expect(vault.estimatedApySource).toBeNull()
  })

  it('stores locked-first yvUSD estimates from the APR service', () => {
    const vaults = combineFeaturedVaults(
      [makeVault(YVUSD_UNLOCKED_ADDRESS, 'yvUSD', 0.02), makeVault(YVUSD_LOCKED_ADDRESS, 'Locked yvUSD', 0.08)],
      {
        [YVUSD_UNLOCKED_ADDRESS]: { address: YVUSD_UNLOCKED_ADDRESS, apy: 0.03 },
        [YVUSD_LOCKED_ADDRESS]: { address: YVUSD_LOCKED_ADDRESS, apy: 0.07 }
      }
    )

    expect(vaults[0].pairedEstimatedApy).toEqual({ locked: 0.07, unlocked: 0.03 })
    expect(vaults[0].estimatedApySource).toBe('est-yvusd')
  })

  it('keeps yvUSD snapshot estimates when the APR service is unavailable', () => {
    const unlockedVault: Vault = {
      ...makeVault(YVUSD_UNLOCKED_ADDRESS, 'yvUSD', 0.02),
      forwardApyNet: 0.03,
      estimatedApySource: 'est-yvusd'
    }
    const lockedVault: Vault = {
      ...makeVault(YVUSD_LOCKED_ADDRESS, 'Locked yvUSD', 0.08),
      forwardApyNet: 0.07,
      estimatedApySource: 'est-yvusd'
    }

    const vaults = combineFeaturedVaults([unlockedVault, lockedVault])

    expect(vaults[0].pairedEstimatedApy).toEqual({ locked: 0.07, unlocked: 0.03 })
    expect(vaults[0].estimatedApySource).toBe('est-yvusd')
  })
})
