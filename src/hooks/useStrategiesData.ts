import { useMemo } from 'react'
import type { ChainId } from '@/constants/chains'
import { useTokenAssetsContext } from '@/contexts/useTokenAssets'
import { useVaults } from '@/contexts/useVaults'
import { formatApyDisplay, formatTvlDisplay } from '@/lib/formatters'
import type { Strategy, StrategyAllocationChartDatum } from '@/types/dataTypes'
import type { VaultDerivedStrategy, VaultExtended } from '@/types/vaultTypes'
import { isLegacyVaultType } from '@/utils/vaultDataUtils'

export interface StrategiesData {
  strategies: Strategy[]
  allocationChartData: StrategyAllocationChartDatum[]
  isLoading: boolean
  error: Error | undefined
}

const getFallbackStrategyDetails = (vaultDetails: VaultExtended): VaultDerivedStrategy[] => {
  if (Array.isArray(vaultDetails.strategyDetails) && vaultDetails.strategyDetails.length > 0) {
    return vaultDetails.strategyDetails
  }

  if (!Array.isArray(vaultDetails.debts)) {
    return []
  }

  return vaultDetails.debts.map((debt, index) => ({
    address: debt.strategy,
    name: `Strategy ${index + 1}`,
    status: debt.debtRatio > 0 ? 'active' : 'unallocated',
    debtRatio: debt.debtRatio,
    currentDebt: debt.currentDebt,
    currentDebtUsd: debt.currentDebtUsd,
    maxDebt: debt.maxDebt,
    maxDebtUsd: debt.maxDebtUsd,
    targetDebtRatio: debt.targetDebtRatio,
    maxDebtRatio: debt.maxDebtRatio,
    totalDebt: String(debt.totalDebt ?? 0),
    totalDebtUsd: debt.totalDebtUsd,
    totalGain: debt.totalGain,
    totalGainUsd: debt.totalGainUsd,
    totalLoss: debt.totalLoss,
    totalLossUsd: debt.totalLossUsd,
    performanceFee: vaultDetails.fees?.performanceFee ?? vaultDetails.performanceFee ?? 0,
    managementFee: vaultDetails.fees?.managementFee ?? vaultDetails.managementFee ?? 0,
    lastReport: 0,
    netApr: null,
    estimatedApy: null
  }))
}

export const hasAllocatedDebt = (strategy: Pick<VaultDerivedStrategy, 'status' | 'debtRatio'>): boolean => {
  return strategy.debtRatio > 0
}

export const resolveStrategyAllocationAmountUsd = (
  strategy: Pick<VaultDerivedStrategy, 'totalDebtUsd' | 'currentDebtUsd'>
): number => {
  if (strategy.totalDebtUsd > 0) {
    return strategy.totalDebtUsd
  }

  return strategy.currentDebtUsd
}

export const buildAllocationChartData = ({
  chartStrategies,
  vaultTvlUsd
}: {
  chartStrategies: Array<
    Pick<Strategy, 'id' | 'name' | 'allocationPercent' | 'allocationAmount' | 'allocationAmountUsd'>
  >
  vaultTvlUsd: number | null
}): StrategyAllocationChartDatum[] => {
  const strategyChartData: StrategyAllocationChartDatum[] = chartStrategies.map((strategy) => ({
    id: String(strategy.id),
    name: strategy.name,
    value: strategy.allocationPercent,
    amount: strategy.allocationAmount
  }))

  const allocatedPercentTotal = chartStrategies.reduce((sum, strategy) => sum + strategy.allocationPercent, 0)
  const unallocatedPercent = Math.max(0, 100 - allocatedPercentTotal)

  if (vaultTvlUsd !== null && unallocatedPercent > 0) {
    const allocatedUsdTotal = chartStrategies.reduce((sum, strategy) => sum + strategy.allocationAmountUsd, 0)
    const unallocatedAmountUsd = Math.max(0, vaultTvlUsd - allocatedUsdTotal)

    strategyChartData.push({
      id: 'unallocated',
      name: 'Unallocated',
      value: unallocatedPercent,
      amount: formatTvlDisplay(unallocatedAmountUsd)
    })
  }

  return strategyChartData
}

export function useStrategiesData(vaultChainId: ChainId, vaultDetails: VaultExtended): StrategiesData {
  const { assets: tokenAssets } = useTokenAssetsContext()
  const { vaults } = useVaults()
  const isLegacyVault = isLegacyVaultType(vaultDetails)

  const indexedVaults = useMemo(() => {
    const map = new Map<string, VaultExtended>()
    vaults.forEach((vault) => {
      const key = `${vault.chainId}-${vault.address.toLowerCase()}`
      map.set(key, vault as VaultExtended)
      map.set(vault.address.toLowerCase(), vault as VaultExtended)
    })
    return map
  }, [vaults])

  const sourceStrategies = useMemo(() => getFallbackStrategyDetails(vaultDetails), [vaultDetails])

  const strategies = useMemo((): Strategy[] => {
    const managementFee = vaultDetails.fees?.managementFee ?? vaultDetails.managementFee ?? 0

    return sourceStrategies.map((strategy, index) => {
      const keyedByAddress = indexedVaults.get(strategy.address.toLowerCase())
      const keyedByChain = indexedVaults.get(`${vaultChainId}-${strategy.address.toLowerCase()}`)
      const linkedVault = keyedByChain ?? keyedByAddress
      const tokenSymbol = linkedVault?.asset?.symbol || vaultDetails.asset.symbol || ''
      const strategyDisplayName =
        strategy.name && !strategy.name.startsWith('Strategy ') ? strategy.name : linkedVault?.name || strategy.name

      const strategyUsdValue = resolveStrategyAllocationAmountUsd(strategy)
      const hasAllocation = hasAllocatedDebt(strategy)
      const allocationPercent = hasAllocation ? strategy.debtRatio / 100 : 0
      const displayApr = strategy.estimatedApy ?? strategy.netApr
      const estimatedAPY = isLegacyVault || displayApr === null ? ' - ' : formatApyDisplay(displayApr)

      const tokenIconUri =
        tokenAssets.find((token) => token.address.toLowerCase() === linkedVault?.asset?.address?.toLowerCase())
          ?.logoURI ||
        tokenAssets.find((token) => token.symbol === tokenSymbol)?.logoURI ||
        ''

      return {
        id: index,
        name: strategyDisplayName || 'Unknown Strategy',
        allocationPercent,
        allocationAmount: formatTvlDisplay(strategyUsdValue),
        allocationAmountUsd: strategyUsdValue,
        estimatedAPY,
        tokenSymbol,
        tokenIconUri,
        estimatedApySource: 'graph',
        details: {
          chainId: linkedVault?.chainId ?? vaultChainId,
          vaultAddress: strategy.address,
          managementFee,
          performanceFee:
            strategy.performanceFee || vaultDetails.fees?.performanceFee || vaultDetails.performanceFee || 0,
          isVault: Boolean(linkedVault),
          isEndorsed: linkedVault?.yearn || false
        }
      }
    })
  }, [sourceStrategies, indexedVaults, vaultChainId, vaultDetails, tokenAssets, isLegacyVault])

  const chartStrategies = useMemo(() => {
    return strategies.filter((s) => s.allocationPercent > 0).sort((a, b) => b.allocationPercent - a.allocationPercent)
  }, [strategies])

  const allocationChartData = useMemo(() => {
    return buildAllocationChartData({
      chartStrategies,
      vaultTvlUsd: typeof vaultDetails.tvl?.close === 'number' ? vaultDetails.tvl.close : null
    })
  }, [chartStrategies, vaultDetails.tvl?.close])

  return {
    strategies,
    allocationChartData,
    isLoading: false,
    error: undefined
  }
}
