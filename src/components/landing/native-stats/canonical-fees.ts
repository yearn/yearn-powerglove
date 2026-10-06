export type CoverageStatus = 'complete' | 'syncing' | 'partial' | 'unavailable' | 'error'

export interface CoverageBreakdown {
  status: CoverageStatus
  vaultCount: number
  completeVaultCount: number
  syncingVaultCount: number
  partialVaultCount: number
  unavailableVaultCount: number
  errorVaultCount: number
  firstSupportedBlock: number | null
  cursorBlock: number | null
  targetBlock: number | null
  lastSuccessAt: string | null
}

export interface FeeCoverage {
  methodologyVersion: string
  feeDefinition: string
  status: CoverageStatus
  canonicalEventCount: number
  directlyObservedEventCount: number
  contractDerivedEventCount: number
  directFeeReportEventCount: number
  reconstructedEventCount: number
  roundingIntervalEventCount: number
  zeroFeeReportCount: number
  unpricedEventCount: number
  unresolvedReportCount: number
  quarantinedEventCount: number
  feeDistributionCount: number
  classifiedDistributionCount: number
  feeReportValidationCount: number
  feeReportValidationMismatchCount: number
  feeReportValidationUnavailableCount: number
  unsupportedVaultCount: number
  firstSupportedTimestamp: number | null
  latestFinalizedTimestamp: number | null
  byChain: Record<string, CoverageBreakdown>
  byContractFamily: Record<string, CoverageBreakdown>
}

export interface LifetimeEarnings {
  methodologyVersion: string
  definition: string
  scope: 'yearn-data-comparable'
  priceBasis: 'canonical-utc-eod'
  includedContractFamilies: ['yearn-v2-vault', 'yearn-v3-allocator']
  excludedFeeEventCount: number
  reportCount: number
  pricedReportCount: number
  unpricedReportCount: number
  incidentAdjustedReportCount: number
  rawGrossGainsUsd: string
  rawLossesUsd: string
  rawNetYieldUsd: string
  grossGainsUsd: string
  lossesUsd: string
  netYieldUsd: string
}

export interface TokenizedStrategyYield {
  methodologyVersion: string
  definition: string
  scope: 'v3-tokenized-strategies'
  priceBasis: 'canonical-utc-eod'
  includedContractFamilies: ['yearn-v3-tokenized-strategy']
  reportCount: number
  pricedReportCount: number
  unpricedReportCount: number
  grossGainsUsd: string
  lossesUsd: string
  netYieldUsd: string
}

export interface VaultReportedEarnings {
  methodologyVersion: string
  definition: string
  scope: 'individual-vault'
  priceBasis: 'canonical-utc-eod'
  reportCount: number
  pricedReportCount: number
  unpricedReportCount: number
  grossGainsUsd: string
  lossesUsd: string
  netYieldUsd: string
}

export interface DepositorFeeTotals {
  totalFeesPaidUsd: string
  protocolFeesUsd: string | null
  managerFeesUsd: string | null
  performanceFeesUsd: string | null
  managementFeesUsd: string | null
  strategistFeesUsd: string | null
  totalRefundsUsd: string | null
}

export interface CanonicalFeeSummary extends DepositorFeeTotals {
  grossGainsUsd: string
  lossesUsd: string
  netLifetimeEarningsUsd: string
  lifetimeEarnings: LifetimeEarnings
  tokenizedStrategyYield: TokenizedStrategyYield
  feeCoverage: FeeCoverage
}

export interface CanonicalFeeHistoryBucket extends DepositorFeeTotals {
  period: string
  lifetimeEarnings: LifetimeEarnings
  tokenizedStrategyYield: TokenizedStrategyYield
  canonicalEventCount: number
  zeroFeeReportCount: number
  unpricedEventCount: number
}

export interface CanonicalFeeHistory {
  interval: string
  buckets: CanonicalFeeHistoryBucket[]
  feeCoverage: FeeCoverage
}

export interface CanonicalVaultFee extends DepositorFeeTotals {
  address: string
  chainId: number
  name: string | null
  tvlUsd: number
  contractFamily: string
  reportedEarnings: VaultReportedEarnings
  lifetimeEarnings: LifetimeEarnings
  feeCoverage: FeeCoverage
}

const LEGACY_SUMMARY_FIELDS = ['totalGains', 'totalLosses', 'totalFeeRevenue'] as const

export function isCanonicalFeeSummary(value: unknown): value is CanonicalFeeSummary {
  if (typeof value !== 'object' || value === null) return false
  const summary = value as Record<string, unknown>
  if (LEGACY_SUMMARY_FIELDS.some((field) => field in summary)) return false
  const meta = summary.meta
  if (typeof meta === 'object' && meta !== null && (meta as Record<string, unknown>).source === 'kong-vault-reports')
    return false

  const lifetimeEarnings = summary.lifetimeEarnings
  const tokenizedStrategyYield = summary.tokenizedStrategyYield
  const feeCoverage = summary.feeCoverage

  return (
    typeof summary.totalFeesPaidUsd === 'string' &&
    typeof summary.grossGainsUsd === 'string' &&
    typeof summary.lossesUsd === 'string' &&
    typeof summary.netLifetimeEarningsUsd === 'string' &&
    typeof lifetimeEarnings === 'object' &&
    lifetimeEarnings !== null &&
    typeof tokenizedStrategyYield === 'object' &&
    tokenizedStrategyYield !== null &&
    typeof feeCoverage === 'object' &&
    feeCoverage !== null
  )
}
