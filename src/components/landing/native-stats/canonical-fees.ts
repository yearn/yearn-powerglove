export interface LifetimeEarnings {
  rawGrossGainsUsd: string | null
  rawLossesUsd: string | null
  rawNetYieldUsd: string | null
  grossGainsUsd: string | null
  lossesUsd: string | null
  netYieldUsd: string | null
}

export interface DepositorFeeTotals {
  totalFeesPaidUsd: string | null
  protocolFeesUsd: string | null
  managerFeesUsd: string | null
  performanceFeesUsd: string | null
  managementFeesUsd: string | null
  strategistFeesUsd: string | null
  totalRefundsUsd: string | null
}

export interface CanonicalFeeSummary extends DepositorFeeTotals {
  grossGainsUsd: string | null
  lossesUsd: string | null
  netLifetimeEarningsUsd: string | null
  lifetimeEarnings: LifetimeEarnings
  datasetId?: string
}

export interface CanonicalFeeHistoryBucket extends DepositorFeeTotals {
  period: string
  startTimestamp?: number
  endTimestamp?: number
  lifetimeEarnings: LifetimeEarnings
}

export type FeeHistoryInterval = 'monthly' | 'weekly'

export interface CanonicalFeeHistory {
  interval: FeeHistoryInterval
  buckets: CanonicalFeeHistoryBucket[]
  datasetId?: string
}

export interface CanonicalVaultFee extends DepositorFeeTotals {
  address: string
  chainId: number
  name: string | null
  contractFamily: string
  lifetimeEarnings: LifetimeEarnings
}

function isMoney(value: unknown): boolean {
  return value === null || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value))
}

export function isCanonicalFeeSummary(value: unknown): value is CanonicalFeeSummary {
  if (typeof value !== 'object' || value === null) return false
  const summary = value as Record<string, unknown>
  if (['totalGains', 'totalLosses', 'totalFeeRevenue'].some((field) => field in summary)) return false
  const meta = summary.meta
  if (typeof meta === 'object' && meta !== null && (meta as Record<string, unknown>).source === 'kong-vault-reports')
    return false
  const earnings = summary.lifetimeEarnings
  if (typeof earnings !== 'object' || earnings === null) return false
  return (
    ['totalFeesPaidUsd', 'grossGainsUsd', 'lossesUsd', 'netLifetimeEarningsUsd'].every((field) =>
      isMoney(summary[field])
    ) &&
    ['grossGainsUsd', 'lossesUsd', 'netYieldUsd'].every((field) =>
      isMoney((earnings as Record<string, unknown>)[field])
    )
  )
}
