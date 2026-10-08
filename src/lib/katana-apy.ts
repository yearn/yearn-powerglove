import { buildSingleApyDisplay, formatApyValue } from '@/lib/apy-display'
import type { ApyDisplayValue } from '@/types/dataTypes'
import type { Vault } from '@/types/vaultTypes'

export const KATANA_CHAIN_ID = 747474

// Keep PPS history raw; displayed historical values include current app rewards.
export const getThirtyDayDisplayApy = (vault: Vault): number | null | undefined => {
  if (vault.chainId !== KATANA_CHAIN_ID) {
    return vault.apy?.monthlyNet
  }

  const monthly = vault.historicalMonthlyApy ?? vault.apy?.monthlyNet ?? 0
  const weekly = vault.historicalWeeklyApy ?? vault.apy?.weeklyNet ?? 0
  const base = monthly !== 0 ? monthly : weekly
  return base + (vault.katanaAppRewardsApr ?? 0)
}

export const getSevenDayDisplayApy = (vault: Vault): number | null | undefined => {
  if (vault.chainId !== KATANA_CHAIN_ID) {
    return vault.apy?.weeklyNet
  }
  return (vault.historicalWeeklyApy ?? vault.apy?.weeklyNet ?? 0) + (vault.katanaAppRewardsApr ?? 0)
}

export const buildKatanaApyDisplay = (vault: Vault, total: number | null | undefined): ApyDisplayValue => {
  const metric = buildSingleApyDisplay(total)
  if (vault.chainId !== KATANA_CHAIN_ID || total === null || total === undefined) {
    return metric
  }

  const rewards = vault.katanaAppRewardsApr
  return {
    ...metric,
    tooltipItems: [
      { label: 'Native APY', value: formatApyValue(total - (rewards ?? 0)) },
      { label: 'Rewards APR', value: formatApyValue(rewards) }
    ]
  }
}
