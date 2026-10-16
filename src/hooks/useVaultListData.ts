import { useMemo } from 'react'
import type { VaultListData } from '@/components/vaults-list/VaultRow'
import { CHAIN_ID_TO_ICON, CHAIN_ID_TO_NAME } from '@/constants/chains'
import { buildPairedApyDisplay, getEstimatedApySourceLabel } from '@/lib/apy-display'
import { formatApyDisplay, formatTvlDisplay, normalizeApyDisplayValue } from '@/lib/formatters'
import { buildKatanaApyDisplay, getThirtyDayDisplayApy, KATANA_CHAIN_ID } from '@/lib/katana-apy'
import type { TokenAsset } from '@/types/tokenAsset'
import type { Vault } from '@/types/vaultTypes'
import { getVaultDisplayType, resolveTokenIcon } from '@/utils/vaultDataUtils'

export function useVaultListData(vaults: Vault[], tokenAssets: TokenAsset[]): VaultListData[] {
  // Memoize the data transformation to avoid recalculation on every render
  return useMemo((): VaultListData[] => {
    return vaults.map((vault) => {
      const pairedEstimatedApy = vault.pairedEstimatedApy
      const pairedThirtyDayApy = vault.pairedThirtyDayApy
      const mobileApyRawValue = getThirtyDayDisplayApy(vault) ?? vault.apy?.net ?? 0
      const apyRawValue = pairedThirtyDayApy ? pairedThirtyDayApy.locked : mobileApyRawValue
      const estimatedApyRawValue = pairedEstimatedApy ? pairedEstimatedApy.locked : (vault.forwardApyNet ?? null)
      const estimatedSource = vault.estimatedApySource
      const estimatedMetric = buildKatanaApyDisplay(vault, estimatedApyRawValue)
      const estimatedAPY = pairedEstimatedApy
        ? buildPairedApyDisplay(pairedEstimatedApy, {
            locked: 'est-yvusd',
            unlocked: 'est-yvusd'
          })
        : {
            ...estimatedMetric,
            tooltipItems:
              vault.chainId === KATANA_CHAIN_ID
                ? estimatedMetric.tooltipItems
                : estimatedApyRawValue !== null && estimatedSource
                  ? [{ label: 'Processing', value: getEstimatedApySourceLabel(estimatedSource) }]
                  : undefined
          }
      const desktopThirtyDayAPY = pairedThirtyDayApy
        ? buildPairedApyDisplay(pairedThirtyDayApy)
        : buildKatanaApyDisplay(vault, apyRawValue)

      return {
        id: vault.address, // Use the vault's address as a unique ID
        name: vault.name,
        chain: `${CHAIN_ID_TO_NAME[vault.chainId]}`,
        chainIconUri: CHAIN_ID_TO_ICON[vault.chainId],
        token: vault.asset.symbol,
        tokenUri: resolveTokenIcon(vault.asset.address, vault.asset.symbol, tokenAssets),
        type: getVaultDisplayType(vault),
        estimatedAPY,
        estimatedApySortValue:
          estimatedApyRawValue === null ? Number.NaN : normalizeApyDisplayValue(estimatedApyRawValue),
        APY: formatApyDisplay(mobileApyRawValue), // Mobile keeps the existing single-value display.
        desktopThirtyDayAPY,
        apySortValue: apyRawValue === null ? Number.NaN : normalizeApyDisplayValue(apyRawValue),
        apyRawValue: apyRawValue === null ? Number.NaN : apyRawValue * 100,
        tvl: formatTvlDisplay(vault.tvl?.close ?? 0)
      }
    })
  }, [vaults, tokenAssets])
}
