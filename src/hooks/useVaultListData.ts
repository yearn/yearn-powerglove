import { useMemo } from 'react'
import type { VaultListData } from '@/components/vaults-list/VaultRow'
import { CHAIN_ID_TO_ICON, CHAIN_ID_TO_NAME } from '@/constants/chains'
import { buildPairedApyDisplay, buildSingleApyDisplay, getEstimatedApySourceLabel } from '@/lib/apy-display'
import { formatApyDisplay, formatTvlDisplay, normalizeApyDisplayValue } from '@/lib/formatters'
import { lastSimulationPoint } from '@/lib/tranche-mock-data'
import type { TokenAsset } from '@/types/tokenAsset'
import type { Vault } from '@/types/vaultTypes'
import { getVaultDisplayType, resolveTokenIcon } from '@/utils/vaultDataUtils'

export function useVaultListData(vaults: Vault[], tokenAssets: TokenAsset[]): VaultListData[] {
  // Memoize the data transformation to avoid recalculation on every render
  return useMemo((): VaultListData[] => {
    const rows = vaults.map((vault) => {
      const pairedEstimatedApy = vault.pairedEstimatedApy
      const pairedThirtyDayApy = vault.pairedThirtyDayApy
      const mobileApyRawValue = vault.apy?.monthlyNet ?? vault.apy?.net ?? 0
      const apyRawValue = pairedThirtyDayApy ? pairedThirtyDayApy.locked : mobileApyRawValue
      const estimatedApyRawValue = pairedEstimatedApy ? pairedEstimatedApy.locked : (vault.forwardApyNet ?? null)
      const estimatedSource = vault.estimatedApySource
      const estimatedAPY = pairedEstimatedApy
        ? buildPairedApyDisplay(pairedEstimatedApy, {
            locked: 'est-yvusd',
            unlocked: 'est-yvusd'
          })
        : {
            ...buildSingleApyDisplay(estimatedApyRawValue),
            tooltipItems:
              estimatedApyRawValue !== null && estimatedSource
                ? [{ label: 'Processing', value: getEstimatedApySourceLabel(estimatedSource) }]
                : undefined
          }
      const desktopThirtyDayAPY = pairedThirtyDayApy
        ? buildPairedApyDisplay(pairedThirtyDayApy)
        : buildSingleApyDisplay(apyRawValue)

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

    const mockups: VaultListData[] = (['senior', 'junior', 'equity'] as const).map((id) => {
      const summary = lastSimulationPoint.tranches[id]
      const apy = summary.thirtyDayApy
      return {
        id: `${id}-yvusd-simulation`,
        name: `${{ senior: 'Senior', junior: 'Junior', equity: 'Equity' }[id]} yvUSD (simulated)`,
        chain: CHAIN_ID_TO_NAME[1],
        chainIconUri: CHAIN_ID_TO_ICON[1],
        token: 'USDC',
        tokenUri: resolveTokenIcon('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', tokenAssets),
        type: 'Tranched Vault',
        tvl: formatTvlDisplay(summary.nav),
        isTranchedMockup: true,
        isJuniorMockup: id === 'junior',
        isEquityMockup: id === 'equity',
        estimatedAPY: { display: '-', tooltipItems: [{ label: 'Simulation', value: 'No forward estimate' }] },
        estimatedApySortValue: Number.NaN,
        APY: buildSingleApyDisplay(apy).display,
        desktopThirtyDayAPY: {
          ...buildSingleApyDisplay(apy),
          tooltipItems: [
            {
              label: 'Simulated 30-day APY',
              value:
                id === 'senior' ? 'As of November 1, 2026' : 'Includes seven-day profit unlocking · November 1, 2026'
            }
          ]
        },
        apySortValue: apy === null ? Number.NaN : normalizeApyDisplayValue(apy),
        apyRawValue: apy === null ? Number.NaN : apy * 100
      }
    })
    return [...mockups, ...rows]
  }, [vaults, tokenAssets])
}
