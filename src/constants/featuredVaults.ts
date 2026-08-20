import type { ChainId } from '@/constants/chains'
import { getYvUsdApiVault, type YvUsdAprServiceResponse } from '@/lib/yvusd-apr-client'
import type { Vault } from '@/types/vaultTypes'

export const YBOLD_CHAIN_ID = 1 as ChainId
export const YBOLD_VAULT_ADDRESS = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'
export const YBOLD_STAKING_ADDRESS = '0x23346B04a7f55b8760E5860AA5A77383D63491cD'

export const YVUSD_CHAIN_ID = 1 as ChainId
export const YVUSD_UNLOCKED_ADDRESS = '0x696d02Db93291651ED510704c9b286841d506987'
export const YVUSD_LOCKED_ADDRESS = '0xAaaFEa48472f77563961Cdb53291DEDfB46F9040'

export const YVUSD_DESCRIPTION =
  'USD denominated, cross-chain, cross asset vault. Unlocked yvUSD stays liquid, while locked yvUSD can earn higher yield by allowing the vault to take longer duration positions.'

const toAddressKey = (address: string) => address.toLowerCase()

const isSameVault = (vault: Pick<Vault, 'chainId' | 'address'>, chainId: ChainId, address: string) =>
  vault.chainId === chainId && vault.address.toLowerCase() === toAddressKey(address)

export const getYvUsdSnapshotEstimatedApy = (
  vault: Pick<Vault, 'estimatedApySource' | 'forwardApyNet'> | null | undefined
): number | null => (vault?.estimatedApySource === 'est-yvusd' ? (vault.forwardApyNet ?? null) : null)

export const isYBoldAddress = (chainId: ChainId, address?: string) =>
  chainId === YBOLD_CHAIN_ID &&
  Boolean(address) &&
  [YBOLD_VAULT_ADDRESS, YBOLD_STAKING_ADDRESS].some((candidate) => toAddressKey(candidate) === address!.toLowerCase())

export const isYvUsdAddress = (chainId: ChainId, address?: string) =>
  chainId === YVUSD_CHAIN_ID &&
  Boolean(address) &&
  [YVUSD_UNLOCKED_ADDRESS, YVUSD_LOCKED_ADDRESS].some((candidate) => toAddressKey(candidate) === address!.toLowerCase())

export const getCanonicalVaultAddress = (chainId: ChainId, address: string): string => {
  if (isYBoldAddress(chainId, address)) return YBOLD_VAULT_ADDRESS
  if (isYvUsdAddress(chainId, address)) return YVUSD_UNLOCKED_ADDRESS
  return address
}

export const getYieldDataAddress = (chainId: ChainId, address: string): string => {
  if (isYBoldAddress(chainId, address)) return YBOLD_STAKING_ADDRESS
  return getCanonicalVaultAddress(chainId, address)
}

export const getVaultEventAddresses = (chainId: ChainId, address: string): string[] => {
  if (isYBoldAddress(chainId, address)) {
    return [YBOLD_VAULT_ADDRESS, YBOLD_STAKING_ADDRESS]
  }

  if (isYvUsdAddress(chainId, address)) {
    return [YVUSD_UNLOCKED_ADDRESS, YVUSD_LOCKED_ADDRESS]
  }

  return [address]
}

const mergeYBoldVault = (baseVault: Vault, stakedVault: Vault): Vault => {
  const weeklyApy = stakedVault.historicalWeeklyApy ?? null
  const oracleApy = stakedVault.estimatedApySource === 'oracle' ? (stakedVault.forwardApyNet ?? null) : null

  return {
    ...baseVault,
    name: 'yBOLD',
    symbol: 'yBOLD',
    apy: stakedVault.apy ?? baseVault.apy,
    fees: {
      ...baseVault.fees,
      performanceFee: stakedVault.fees?.performanceFee ?? baseVault.fees.performanceFee
    },
    performanceFee: stakedVault.performanceFee ?? baseVault.performanceFee,
    forwardApyNet: weeklyApy ?? oracleApy,
    estimatedApySource: weeklyApy !== null ? '7day-hist' : oracleApy !== null ? 'oracle' : null,
    historicalWeeklyApy: weeklyApy,
    historicalMonthlyApy: stakedVault.historicalMonthlyApy ?? null,
    strategyForwardAprs: stakedVault.strategyForwardAprs ?? baseVault.strategyForwardAprs
  }
}

const normalizeYvUsdVault = (
  vault: Vault,
  lockedVault: Vault | undefined,
  aprData?: YvUsdAprServiceResponse
): Vault => {
  const yvUsdVault = getYvUsdApiVault(aprData, YVUSD_UNLOCKED_ADDRESS)
  const lockedYvUsdVault = getYvUsdApiVault(aprData, YVUSD_LOCKED_ADDRESS)
  const unlockedEstimatedApy = yvUsdVault?.apy ?? getYvUsdSnapshotEstimatedApy(vault)
  const lockedEstimatedApy = lockedYvUsdVault?.apy ?? getYvUsdSnapshotEstimatedApy(lockedVault)

  return {
    ...vault,
    name: 'yvUSD',
    symbol: 'yvUSD',
    apy:
      yvUsdVault?.apy !== undefined
        ? {
            ...vault.apy,
            grossApr: yvUsdVault.apr ?? vault.apy?.grossApr ?? 0,
            net: yvUsdVault.apy,
            weeklyNet: yvUsdVault.apy,
            monthlyNet: yvUsdVault.apy,
            inceptionNet: vault.apy?.inceptionNet ?? yvUsdVault.apy
          }
        : vault.apy,
    forwardApyNet: unlockedEstimatedApy,
    estimatedApySource: unlockedEstimatedApy !== null ? 'est-yvusd' : null,
    pairedEstimatedApy: {
      locked: lockedEstimatedApy,
      unlocked: unlockedEstimatedApy
    },
    pairedThirtyDayApy: {
      locked: lockedVault?.historicalMonthlyApy ?? null,
      unlocked: vault.historicalMonthlyApy ?? null
    }
  }
}

export function combineFeaturedVaults(vaults: Vault[], yvUsdAprData?: YvUsdAprServiceResponse): Vault[] {
  const yBoldBase = vaults.find((vault) => isSameVault(vault, YBOLD_CHAIN_ID, YBOLD_VAULT_ADDRESS))
  const yBoldStaked = vaults.find((vault) => isSameVault(vault, YBOLD_CHAIN_ID, YBOLD_STAKING_ADDRESS))
  const lockedYvUsd = vaults.find((vault) => isSameVault(vault, YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS))

  return vaults
    .filter((vault) => !isSameVault(vault, YBOLD_CHAIN_ID, YBOLD_STAKING_ADDRESS))
    .filter((vault) => !isSameVault(vault, YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS))
    .map((vault) => {
      if (isSameVault(vault, YBOLD_CHAIN_ID, YBOLD_VAULT_ADDRESS) && yBoldBase) {
        return yBoldStaked
          ? mergeYBoldVault(yBoldBase, yBoldStaked)
          : { ...yBoldBase, name: 'yBOLD', symbol: 'yBOLD', forwardApyNet: null, estimatedApySource: null }
      }

      if (isSameVault(vault, YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS)) {
        return normalizeYvUsdVault(vault, lockedYvUsd, yvUsdAprData)
      }

      return vault
    })
}
