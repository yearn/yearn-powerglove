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

export function utcMonthStartTimestamp(timestampSeconds: number, monthOffset = 0): number {
  const date = new Date(timestampSeconds * 1000)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1) / 1000
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
  if (value === null) return total
  return (total ?? 0) + value
}

export function buildFeeHistorySeries(buckets: CanonicalFeeHistoryBucket[]): FeeHistoryPoint[] {
  let cumulativeGrossGainsUsd: number | null = null
  let cumulativeNetYieldUsd: number | null = null
  let cumulativeFeesPaidUsd: number | null = null

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

export function buildCumulativeFeeHistorySeries(points: FeeHistoryPoint[]): FeeHistoryPoint[] {
  const first = points[0]
  if (!first) return []

  const opening: FeeHistoryPoint = {
    period: `${first.period}-01`,
    grossGainsUsd: null,
    netYieldUsd: null,
    totalFeesPaidUsd: null,
    cumulativeGrossGainsUsd: points.some((point) => point.grossGainsUsd !== null) ? 0 : null,
    cumulativeNetYieldUsd: points.some((point) => point.netYieldUsd !== null) ? 0 : null,
    cumulativeFeesPaidUsd: points.some((point) => point.totalFeesPaidUsd !== null) ? 0 : null
  }

  return [
    opening,
    ...points.map((point) => {
      const [year, month] = point.period.split('-').map(Number)
      return { ...point, period: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10) }
    })
  ]
}
