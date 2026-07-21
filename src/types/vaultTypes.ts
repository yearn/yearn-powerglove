import type { ChainId } from '../constants/chains'

export type EstimatedApySource =
  | 'oracle'
  | '7day-hist'
  | 'est-crv'
  | 'est-aero'
  | 'est-velo'
  | 'est-katana'
  | 'est-yvusd'
  | 'unknown'

export type PairedApyValues = {
  locked: number | null
  unlocked: number | null
}

export type VaultSimple = {
  address: string
  symbol: string
  name: string
  chainId: ChainId
  inceptTime: string
  kind?: string
  asset: {
    name: string
    symbol: string
    decimals: number
    address: string
  }
  apiVersion?: string
  pricePerShare: number
  apy?: {
    grossApr: number
    net: number
    inceptionNet: number
    weeklyNet?: number
    monthlyNet?: number
  }
  tvl?: {
    close: number
  }
  vaultType?: string
  yearn?: boolean
  v3?: boolean
  erc4626?: boolean
  liquidLocker?: boolean
  fees: {
    managementFee: number
    performanceFee: number
  }
  managementFee: number
  performanceFee: number
  forwardApyNet?: number | null
  estimatedApySource?: EstimatedApySource | null
  historicalWeeklyApy?: number | null
  historicalMonthlyApy?: number | null
  pairedEstimatedApy?: PairedApyValues
  pairedThirtyDayApy?: PairedApyValues
  strategyForwardAprs?: Record<string, number | null>
  yvUsdStrategyApyByAddress?: Record<string, { apy: number; name?: string }>
}

export type Vault = VaultSimple &
  Partial<{
    tvl: {
      blockTime?: string
      close: number
      component?: string
      label?: string
    }
    strategies: string[]
    debts: {
      strategy: string
      currentDebt: string
      currentDebtUsd: number
      maxDebt: string
      maxDebtUsd: number
      targetDebtRatio: string
      maxDebtRatio: string
      debtRatio: number
      totalDebt: number
      totalDebtUsd: number
      totalGain: number
      totalGainUsd: number
      totalLoss: number
      totalLossUsd: number
    }[]
  }>

export type VaultExtended = VaultSimple &
  Vault &
  Partial<{
    decimals: number
    governance: string
    guardian: string
    management: string
    allocator: string
    meta: {
      description: string
      displayName: string
      displaySymbol: string
      protocols: string[]
      token: {
        category: string
        description: string
        displayName: string
        displaySymbol: string
        icon: string
        type: string
      }
    }
    strategyDetails: VaultDerivedStrategy[]
  }>

export type VaultStrategyStatus = 'active' | 'not_active' | 'unallocated'

export type VaultDerivedStrategy = {
  address: string
  name: string
  status: VaultStrategyStatus
  debtRatio: number
  currentDebt: string
  currentDebtUsd: number
  maxDebt: string
  maxDebtUsd: number
  targetDebtRatio: string
  maxDebtRatio: string
  totalDebt: string
  totalDebtUsd: number
  totalGain: number
  totalGainUsd: number
  totalLoss: number
  totalLossUsd: number
  performanceFee: number
  managementFee: number
  lastReport: number
  netApr: number | null
  estimatedApy: number | null
}

export type VaultDebt = {
  strategy: string
  currentDebt: string
  currentDebtUsd: number
  maxDebt: string
  maxDebtUsd: number
  targetDebtRatio: string
  maxDebtRatio: string
  debtRatio: number
  totalDebt: number
  totalDebtUsd: number
  totalGain: number
  totalGainUsd: number
  totalLoss: number
  totalLossUsd: number
}

export type EnrichedVaultDebt = {
  strategy: string
  chainId?: ChainId
  v3Debt: {
    currentDebt: string
    currentDebtUsd: number
    maxDebt: string
    maxDebtUsd: number
    targetDebtRatio: string
    maxDebtRatio: string
  }
  v2Debt: {
    debtRatio: number
    totalDebt: number
    totalDebtUsd: number
    totalGain: number
    totalGainUsd: number
    totalLoss: number
    totalLossUsd: number
  }
  address?: string
  name?: string
  erc4626?: boolean
  yearn?: boolean
  v3?: boolean
  managementFee?: number
  performanceFee?: number
  grossApr?: number
  netApy?: number
  inceptionNetApy?: number
  assetSymbol?: string
}

export type VaultStrategy = {
  chainId: number
  address: string
  name: string
  erc4626?: boolean
  v3?: boolean
  yearn?: boolean
  currentDebt: string
  currentDebtUsd?: number
  maxDebt: string
  maxDebtUsd?: string
  targetDebtRatio?: string
  maxDebtRatio?: string
}

export type DebtResult = {
  vaults: Vault[]
}

export interface strategy {
  address: string
  name?: string | null
  apr?: number | null
}

export type TimePeriod = '7d' | '30d' | '90d' | '180d' | '1y' | 'all'
