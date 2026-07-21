import { useMemo } from 'react'
import { isYvUsdAddress } from '@/constants/featuredVaults'
import { buildSingleApyDisplay } from '@/lib/apy-display'
import type { MainInfoPanelProps } from '@/types/dataTypes'
import type { TokenAsset } from '@/types/tokenAsset'
import type { VaultExtended } from '@/types/vaultTypes'
import {
  formatVaultDate,
  formatVaultDescription,
  formatVaultMetrics,
  formatVaultTVL,
  generateVaultLinks,
  getVaultNetworkInfo,
  isLegacyVaultType,
  resolveTokenIcon
} from '@/utils/vaultDataUtils'

interface UseMainInfoPanelDataProps {
  vaultDetails: VaultExtended | null
  tokenAssets: TokenAsset[]
}

/**
 * Transforms vault data into the format required by MainInfoPanel component
 * Extracted from the original hydrateMainInfoPanelData function
 */
export function useMainInfoPanelData({
  vaultDetails,
  tokenAssets
}: UseMainInfoPanelDataProps): MainInfoPanelProps | null {
  return useMemo(() => {
    if (!vaultDetails) return null

    // Date formatting
    const deploymentDate = formatVaultDate(vaultDetails.inceptTime)

    const vaultName = vaultDetails.name
    const isYvUsd = isYvUsdAddress(vaultDetails.chainId, vaultDetails.address)
    const description = formatVaultDescription(vaultDetails.meta?.description)
    const chainId = vaultDetails.chainId

    // Token icon resolution
    const vaultToken = {
      icon: resolveTokenIcon(vaultDetails.asset.address, vaultDetails.asset.symbol, tokenAssets),
      name: vaultDetails.asset.symbol
    }

    // Currency formatting
    const totalSupply = formatVaultTVL(vaultDetails.tvl?.close ?? 0)

    // Network information
    const network = getVaultNetworkInfo(chainId)

    // APY formatting
    const isLegacyVault = isLegacyVaultType(vaultDetails)
    const forwardApyNet = isLegacyVault ? null : (vaultDetails.forwardApyNet ?? null)
    const oneDayAPY = buildSingleApyDisplay(isLegacyVault ? null : forwardApyNet)
    const thirtyDayAPY = buildSingleApyDisplay(vaultDetails.apy?.monthlyNet)

    // Fee formatting
    const { managementFee, performanceFee } = formatVaultMetrics(vaultDetails)

    // Version and link generation
    const apiVersion = vaultDetails?.apiVersion || 'N/A'

    const { blockExplorerLink, yearnVaultLink } = generateVaultLinks(vaultDetails)

    return {
      vaultId: isYvUsd ? 'yvUSD' : vaultDetails.symbol,
      deploymentDate,
      vaultName: isYvUsd ? 'yvUSD' : vaultName,
      description,
      vaultToken,
      totalSupply,
      network,
      oneDayAPY,
      thirtyDayAPY,
      managementFee,
      performanceFee,
      apiVersion,
      vaultAddress: vaultDetails.address,
      blockExplorerLink,
      yearnVaultLink
    }
  }, [vaultDetails, tokenAssets])
}
