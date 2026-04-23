export type KongNumberish = number | string
export type KongNullableNumberish = KongNumberish | null | undefined

export type KongVaultPerformance = {
  oracle?: {
    apr?: KongNullableNumberish
    apy?: KongNullableNumberish
  } | null
  estimated?: {
    apr?: KongNullableNumberish
    apy?: KongNullableNumberish
    type?: string | null
    components?: {
      boost?: KongNullableNumberish
      poolAPY?: KongNullableNumberish
      boostedAPR?: KongNullableNumberish
      baseAPR?: KongNullableNumberish
      rewardsAPR?: KongNullableNumberish
      rewardsAPY?: KongNullableNumberish
      cvxAPR?: KongNullableNumberish
      keepCRV?: KongNullableNumberish
      keepVelo?: KongNullableNumberish
    }
  } | null
  historical?: {
    net?: KongNullableNumberish
    weeklyNet?: KongNullableNumberish
    monthlyNet?: KongNullableNumberish
    inceptionNet?: KongNullableNumberish
  } | null
}

export type KongVaultListItem = {
  chainId: number
  address: string
  name: string
  symbol?: string | null
  apiVersion?: string | null
  inceptTime?: KongNullableNumberish
  decimals?: KongNullableNumberish
  asset?: {
    address: string
    name: string
    symbol: string
    decimals?: KongNullableNumberish
  } | null
  tvl?: KongNullableNumberish
  performance?: KongVaultPerformance | null
  fees?: {
    managementFee?: KongNullableNumberish
    performanceFee?: KongNullableNumberish
  } | null
  category?: string | null
  type?: string | null
  kind?: string | null
  v3?: boolean
  yearn?: boolean
  isRetired?: boolean
  isHidden?: boolean
  isBoosted?: boolean
  isHighlighted?: boolean
  inclusion?: Record<string, boolean>
  migration?: boolean
  origin?: string | null
  strategiesCount?: number
  riskLevel?: KongNullableNumberish
  staking?: {
    address?: string | null
    available?: boolean
  } | null
}

export type KongSnapshotToken = {
  name?: string
  symbol?: string
  address?: string
  chainId?: number
  decimals?: KongNullableNumberish
  description?: string
  displayName?: string
  displaySymbol?: string
  category?: string
  icon?: string
  type?: string
}

export type KongVaultSnapshotComposition = {
  address?: string
  strategy?: string
  name?: string
  status?: string | number | null
  debtRatio?: KongNullableNumberish
  currentDebt?: KongNullableNumberish
  currentDebtUsd?: KongNullableNumberish
  maxDebt?: KongNullableNumberish
  maxDebtUsd?: KongNullableNumberish
  targetDebtRatio?: KongNullableNumberish
  maxDebtRatio?: KongNullableNumberish
  totalDebt?: KongNullableNumberish
  totalDebtUsd?: KongNullableNumberish
  totalGain?: KongNullableNumberish
  totalGainUsd?: KongNullableNumberish
  totalLoss?: KongNullableNumberish
  totalLossUsd?: KongNullableNumberish
  performanceFee?: KongNullableNumberish
  lastReport?: KongNullableNumberish
  latestReportApr?: KongNullableNumberish
  performance?: KongVaultPerformance | null
}

export type KongVaultSnapshotDebt = {
  strategy: string
  currentDebt?: KongNullableNumberish
  currentDebtUsd?: KongNullableNumberish
  maxDebt?: KongNullableNumberish
  maxDebtUsd?: KongNullableNumberish
  targetDebtRatio?: KongNullableNumberish
  maxDebtRatio?: KongNullableNumberish
  debtRatio?: KongNullableNumberish
  totalDebt?: KongNullableNumberish
  totalDebtUsd?: KongNullableNumberish
  totalGain?: KongNullableNumberish
  totalGainUsd?: KongNullableNumberish
  totalLoss?: KongNullableNumberish
  totalLossUsd?: KongNullableNumberish
  performanceFee?: KongNullableNumberish
  lastReport?: KongNullableNumberish
}

export type KongVaultSnapshot = {
  address: string
  chainId: number
  blockNumber?: KongNullableNumberish
  blockTime?: KongNullableNumberish
  apiVersion?: string | null
  inceptTime?: KongNullableNumberish
  name?: string
  symbol?: string
  decimals?: KongNullableNumberish
  asset?: {
    name?: string
    symbol?: string
    address?: string
    chainId?: number
    decimals?: KongNullableNumberish
  }
  totalDebt?: KongNullableNumberish
  totalAssets?: KongNullableNumberish
  apy?: {
    net?: KongNullableNumberish
    grossApr?: KongNullableNumberish
    weeklyNet?: KongNullableNumberish
    monthlyNet?: KongNullableNumberish
    inceptionNet?: KongNullableNumberish
    pricePerShare?: KongNullableNumberish
    weeklyPricePerShare?: KongNullableNumberish
    monthlyPricePerShare?: KongNullableNumberish
  } | null
  tvl?: {
    close?: KongNullableNumberish
    label?: string
    component?: string
  } | null
  fees?: {
    managementFee?: KongNullableNumberish
    performanceFee?: KongNullableNumberish
  } | null
  meta?: {
    kind?: string
    name?: string
    type?: string
    token?: KongSnapshotToken
    address?: string
    chainId?: number
    category?: string
    isHidden?: boolean
    uiNotice?: string
    isBoosted?: boolean
    isRetired?: boolean
    isHighlighted?: boolean
    migration?: {
      target?: string
      contract?: string
      available?: boolean
    }
    sourceURI?: string
    description?: string
    displayName?: string
    displaySymbol?: string
    protocols?: string[]
  }
  performance?: KongVaultPerformance
  composition?: KongVaultSnapshotComposition[]
  debts?: KongVaultSnapshotDebt[]
  strategies?: string[]
  staking?: {
    address?: string
    available?: boolean
    source?: string
    rewards?: Array<{
      address?: string
      name?: string
      symbol?: string
      decimals?: KongNullableNumberish
      price?: KongNullableNumberish
      isFinished?: boolean
      finishedAt?: KongNullableNumberish
      apr?: KongNullableNumberish
      perWeek?: KongNullableNumberish
    }>
  } | null
  inclusion?: Record<string, boolean>
}

export type KongTimeseriesPoint = {
  time: KongNumberish
  component?: string | null
  value: KongNullableNumberish
}
