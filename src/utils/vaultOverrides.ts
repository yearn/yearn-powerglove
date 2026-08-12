import type { ChainId } from '@/constants/chains'
import { buildVaultOverrideKey, VAULT_OVERRIDES, type VaultOverrideConfig } from '@/constants/vaultOverrides'
import { formatCurrency, formatPercentFromDecimal } from '@/lib/formatters'
import type { Vault, VaultExtended } from '@/types/vaultTypes'

type VaultEntity = Vault | VaultExtended

const mergeObject = <T extends object>(base: T, override?: Partial<T>): T =>
  override ? { ...base, ...override } : base

const mergeOptionalObject = <T extends object>(base?: T, override?: Partial<T>): T | undefined => {
  if (!base && !override) return base
  if (!override) return base
  return { ...(base ?? ({} as T)), ...override }
}

export const getVaultOverride = (chainId: ChainId, address?: string): VaultOverrideConfig | undefined => {
  if (!address) return undefined
  return VAULT_OVERRIDES[buildVaultOverrideKey(chainId, address)]
}

export const isVaultBlacklisted = (chainId: ChainId, address?: string): boolean => {
  const override = getVaultOverride(chainId, address)
  return Boolean(override?.blacklist)
}

export const getVaultBlacklistReason = (chainId: ChainId, address?: string): string | undefined => {
  const override = getVaultOverride(chainId, address)
  return override?.blacklistReason
}

export type VaultOverrideDisplayItem = {
  label: string
  value: string
}

export const getVaultOverrideDisplayItems = (override?: VaultOverrideConfig): VaultOverrideDisplayItem[] => {
  if (!override?.overrides) return []

  const items: VaultOverrideDisplayItem[] = []
  if (override.overrideReason) {
    items.push({ label: 'Reason', value: override.overrideReason })
  }
  const { overrides } = override

  if (overrides.name) {
    items.push({ label: 'Name', value: overrides.name })
  }
  if (overrides.symbol) {
    items.push({ label: 'Symbol', value: overrides.symbol })
  }
  if (overrides.meta?.description) {
    items.push({
      label: 'Description set to',
      value: overrides.meta.description
    })
  }
  if (overrides.meta?.displayName) {
    items.push({
      label: 'Display Name set to',
      value: overrides.meta.displayName
    })
  }
  if (overrides.meta?.displaySymbol) {
    items.push({
      label: 'Display Symbol set to',
      value: overrides.meta.displaySymbol
    })
  }
  if (overrides.tvl?.close !== undefined) {
    items.push({
      label: 'TVL set to',
      value: formatCurrency(overrides.tvl.close ?? 0)
    })
  }
  if (overrides.apy?.monthlyNet !== undefined) {
    items.push({
      label: '30-day APY set to',
      value: formatPercentFromDecimal(overrides.apy.monthlyNet)
    })
  }
  if (overrides.forwardApyNet !== undefined) {
    items.push({
      label: '1-day APY set to',
      value: formatPercentFromDecimal(overrides.forwardApyNet)
    })
  }

  return items
}

export function applyVaultOverride<T extends VaultEntity>(vault: T): T {
  if (!vault?.address || vault.chainId === undefined || vault.chainId === null) {
    return vault
  }

  const override = getVaultOverride(vault.chainId as ChainId, vault.address)
  if (!override?.overrides) return vault

  const { overrides } = override
  const existingMeta = (vault as VaultExtended).meta
  const mergedMetaToken = mergeOptionalObject(existingMeta?.token, overrides.meta?.token)
  const mergedMeta =
    overrides.meta || mergedMetaToken
      ? {
          ...mergeOptionalObject(existingMeta, overrides.meta),
          token: mergedMetaToken ?? existingMeta?.token
        }
      : existingMeta
  const mergedVault = {
    ...vault,
    ...overrides,
    asset: mergeObject(vault.asset, overrides.asset),
    apy: mergeOptionalObject(vault.apy, overrides.apy),
    tvl: mergeOptionalObject(vault.tvl, overrides.tvl),
    fees: mergeObject(vault.fees, overrides.fees),
    meta: mergedMeta
  } as T

  if (overrides.forwardApyNet !== undefined) {
    ;(mergedVault as VaultExtended).forwardApyNet = overrides.forwardApyNet
    ;(mergedVault as VaultExtended).estimatedApySource = 'unknown'
  }

  if (overrides.strategyForwardAprs !== undefined) {
    ;(mergedVault as VaultExtended).strategyForwardAprs = overrides.strategyForwardAprs
  }

  return mergedVault
}

export function applyVaultOverrides<T extends VaultEntity>(vaults: T[]): T[] {
  return vaults
    .filter((vault) => !isVaultBlacklisted(vault.chainId as ChainId, vault.address))
    .map((vault) => applyVaultOverride(vault))
}
