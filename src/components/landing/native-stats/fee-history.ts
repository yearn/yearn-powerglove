import type { CanonicalFeeHistoryBucket } from './canonical-fees'

export interface FeeHistoryPoint {
  period: string
  grossGainsUsd: number | null
  netYieldUsd: number | null
  totalFeesPaidUsd: number | null
  cumulativeGrossGainsUsd: number | null
  cumulativeNetYieldUsd: number | null
  cumulativeFeesPaidUsd: number | null
}

export function canonicalDecimalToNumber(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function utcMonthStartTimestamp(timestampSeconds: number): number {
  const date = new Date(timestampSeconds * 1000)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000
}

export function completedMonthlyBuckets(
  buckets: CanonicalFeeHistoryBucket[],
  currentMonthStartTimestamp: number
): CanonicalFeeHistoryBucket[] {
  const currentMonth = new Date(currentMonthStartTimestamp * 1000)
  const currentPeriod = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, '0')}`
  return buckets.filter((bucket) => bucket.period < currentPeriod)
}

function addCumulative(total: number | null, value: number | null): number | null {
  if (total === null || value === null) return null
  return total + value
}

export function buildFeeHistorySeries(buckets: CanonicalFeeHistoryBucket[]): FeeHistoryPoint[] {
  let cumulativeGrossGainsUsd: number | null = 0
  let cumulativeNetYieldUsd: number | null = 0
  let cumulativeFeesPaidUsd: number | null = 0

  return buckets.map((bucket) => {
    const grossGainsUsd = canonicalDecimalToNumber(bucket.lifetimeEarnings.grossGainsUsd)
    const netYieldUsd = canonicalDecimalToNumber(bucket.lifetimeEarnings.netYieldUsd)
    const totalFeesPaidUsd = canonicalDecimalToNumber(bucket.totalFeesPaidUsd)

    cumulativeGrossGainsUsd = addCumulative(cumulativeGrossGainsUsd, grossGainsUsd)
    cumulativeNetYieldUsd = addCumulative(cumulativeNetYieldUsd, netYieldUsd)
    cumulativeFeesPaidUsd = addCumulative(cumulativeFeesPaidUsd, totalFeesPaidUsd)

    return {
      period: bucket.period,
      grossGainsUsd,
      netYieldUsd,
      totalFeesPaidUsd,
      cumulativeGrossGainsUsd,
      cumulativeNetYieldUsd,
      cumulativeFeesPaidUsd
    }
  })
}
