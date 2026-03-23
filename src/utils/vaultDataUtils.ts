import { format } from 'date-fns'
import { CHAIN_ID_TO_BLOCK_EXPLORER, CHAIN_ID_TO_ICON, CHAIN_ID_TO_NAME, type ChainId } from '@/constants/chains'
import { formatCurrency } from '@/lib/formatters'
import type { TokenAsset } from '@/types/tokenAsset'
import type { Vault, VaultExtended } from '@/types/vaultTypes'

/**
 * Formats vault APY and fee percentages
 */
export function formatVaultMetrics(vaultData: VaultExtended) {
  const estimatedAPY = vaultData?.apy?.net ? `${(vaultData.apy.net * 100).toFixed(2)}%` : '0%'

  const historicalAPY = vaultData?.apy?.inceptionNet ? `${(vaultData.apy.inceptionNet * 100).toFixed(2)}%` : '0%'

  const managementFee = vaultData?.fees?.managementFee ? `${(vaultData.fees.managementFee / 100).toFixed(0)}%` : '0%'

  const performanceFee = vaultData?.fees?.performanceFee
    ? `${(vaultData.fees.performanceFee / 100).toFixed(0)}%`
    : vaultData?.performanceFee
      ? `${(vaultData.performanceFee / 100).toFixed(0)}%`
      : '0%'

  return {
    estimatedAPY,
    historicalAPY,
    managementFee,
    performanceFee
  }
}

/**
 * Generates block explorer and Yearn vault links
 */
export function generateVaultLinks(vaultData: VaultExtended) {
  const blockExplorerLink =
    vaultData?.chainId && vaultData?.address
      ? `${CHAIN_ID_TO_BLOCK_EXPLORER[vaultData.chainId]}/address/${vaultData.address}`
      : '#'

  const yearnVaultLink = vaultData?.apiVersion?.startsWith('3')
    ? `https://yearn.fi/v3/${vaultData.chainId}/${vaultData.address}`
    : vaultData?.chainId && vaultData?.address
      ? `https://yearn.fi/vaults/${vaultData.chainId}/${vaultData.address}`
      : '#'

  return {
    blockExplorerLink,
    yearnVaultLink
  }
}

/**
 * Resolves token icon from token assets array
 */
export function resolveTokenIcon(
  vaultAssetAddress: string,
  _vaultAssetSymbol: string,
  tokenAssets: TokenAsset[]
): string {
  const tokenAsset = tokenAssets.find((token) => token.address.toLowerCase() === vaultAssetAddress.toLowerCase())

  if (tokenAsset) {
    return tokenAsset.logoURI
  }

  return ''
}

/**
 * Formats vault deployment date
 */
export function formatVaultDate(inceptTime: string): string {
  return format(new Date(parseInt(inceptTime, 10) * 1000), 'MMMM yyyy')
}

/**
 * Formats vault TVL as currency
 */
export function formatVaultTVL(tvlValue?: number): string {
  return formatCurrency(tvlValue ?? 0)
}

export function formatVaultDescription(description?: string): string {
  return (description ?? '')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Gets network information for vault
 */
export function getVaultNetworkInfo(chainId: ChainId) {
  return {
    icon: CHAIN_ID_TO_ICON[chainId],
    name: CHAIN_ID_TO_NAME[chainId]
  }
}

export function isLegacyVaultType(vault: { apiVersion?: string; name?: string }): boolean {
  const version = vault.apiVersion?.toLowerCase?.() ?? ''
  if (!version.startsWith('0')) {
    return false
  }
  const name = vault.name?.toLowerCase?.() ?? ''
  return !name.includes('factory')
}

export function getVaultDisplayType(vault: Pick<Vault, 'apiVersion' | 'name' | 'vaultType'>): string {
  const typeId = Number(vault.vaultType)
  if (typeId === 1) return 'Allocator Vault'
  if (typeId === 2) return 'Strategy Vault'

  const name = vault.name?.toLowerCase() ?? ''
  if (name.includes('factory')) {
    return 'Factory Vault'
  }

  if (vault.apiVersion?.startsWith('0')) {
    return 'Legacy Vault'
  }

  return 'External Vault'
}
