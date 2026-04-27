export type VaultActivityEventType = 'harvest' | 'strategy_reported' | 'unlock_update' | 'debt_update'
export type VaultProfitUnlockMode = 'v3_shares' | 'v2_locked_profit'

export interface VaultActivityReallocationAnnotation {
  direction: 'increase' | 'decrease' | 'flat'
  pairedTransaction: boolean
}

export interface VaultActivityEvent {
  id: string
  eventType: VaultActivityEventType
  sourceEventType?: string | null
  chainId: number
  vaultAddress: string
  strategyAddress?: string | null
  strategyName?: string | null
  txHash: string
  blockNumber: number
  logIndex?: number | null
  timestamp: number
  timestampIso: string
  label: string
  description: string
  valueUsd?: number | null
  assetsDelta?: string | null
  assetsDeltaDisplay?: number | null
  sharesDelta?: string | null
  sharesDeltaDisplay?: number | null
  gain?: string | null
  gainDisplay?: number | null
  loss?: string | null
  lossDisplay?: number | null
  currentDebt?: string | null
  currentDebtDisplay?: number | null
  newDebt?: string | null
  newDebtDisplay?: number | null
  debtDelta?: string | null
  debtDeltaDisplay?: number | null
  debtAdded?: string | null
  debtAddedDisplay?: number | null
  debtPaid?: string | null
  debtPaidDisplay?: number | null
  totalDebt?: string | null
  totalDebtDisplay?: number | null
  totalGain?: string | null
  totalGainDisplay?: number | null
  totalLoss?: string | null
  totalLossDisplay?: number | null
  debtRatio?: string | null
  unlockedShares?: string | null
  unlockedSharesDisplay?: number | null
  lockedShares?: string | null
  lockedSharesDisplay?: number | null
  remainingLockedShares?: string | null
  remainingLockedSharesDisplay?: number | null
  lockedProfit?: string | null
  lockedProfitDisplay?: number | null
  lockedProfitPercent?: number | null
  lockedProfitDegradation?: string | null
  lastReport?: number | null
  unlockPercent?: number | null
  unlockRatePerDay?: number | null
  profitMaxUnlockTime?: number | null
  fullProfitUnlockDate?: number | null
  fullProfitUnlockDateIso?: string | null
  ppsBefore?: number | null
  ppsAfter?: number | null
  profitUnlockMode?: VaultProfitUnlockMode | null
  reallocation?: VaultActivityReallocationAnnotation | null
}

export interface VaultUnlockState {
  chainId: number
  vaultAddress: string
  blockNumber?: number | null
  updatedAt: number
  updatedAtIso: string
  unlockedShares?: string | null
  unlockedSharesDisplay?: number | null
  lockedShares?: string | null
  lockedSharesDisplay?: number | null
  remainingLockedShares?: string | null
  remainingLockedSharesDisplay?: number | null
  lockedProfit?: string | null
  lockedProfitDisplay?: number | null
  lockedProfitPercent?: number | null
  lockedProfitDegradation?: string | null
  lastReport?: number | null
  totalSupply?: string | null
  totalSupplyDisplay?: number | null
  profitUnlockingRate?: string | null
  profitUnlockingRateDisplay?: number | null
  profitMaxUnlockTime?: number | null
  fullProfitUnlockDate?: number | null
  fullProfitUnlockDateIso?: string | null
  totalAssets?: string | null
  totalAssetsDisplay?: number | null
  pricePerShare?: string | null
  pricePerShareDisplay?: number | null
  pps?: number | null
  totalAssetsUsd?: number | null
  unlockPercent?: number | null
  unlockRatePerDay?: number | null
  estimatedDaysToUnlock?: number | null
  profitUnlockMode?: VaultProfitUnlockMode | null
}

export interface VaultActivitySeriesPoint {
  date: string
  timestamp: number
  harvestCount: number
  harvestValueUsd?: number | null
  harvestGainDisplay?: number | null
  remainingLockedSharesDisplay?: number | null
  lockedProfitPercent?: number | null
  unlockPercent?: number | null
  unlockRatePerDay?: number | null
  pps?: number | null
  totalAssetsDisplay?: number | null
}

export interface VaultActivityFixtureMeta {
  source?: string
  fromBlock?: number | null
  toBlock?: number | null
  assetSymbol?: string | null
  assetDecimals?: number | null
  shareSymbol?: string | null
  shareDecimals?: number | null
}

export interface VaultActivityData {
  schemaVersion: 1
  generatedAt: string
  chainId: number
  vaultAddress: string
  currentUnlock: VaultUnlockState | null
  events: VaultActivityEvent[]
  series: VaultActivitySeriesPoint[]
  meta?: VaultActivityFixtureMeta
}
