import type { CanonicalFeeHistoryBucket, FeeHistoryInterval } from './canonical-fees'

export interface FeeHistoryPeriod {
  period: string
  startTimestamp?: number
  endTimestamp?: number
}

export interface FeeHistoryPoint extends FeeHistoryPeriod {
  grossGainsUsd: number | null
  netYieldUsd: number | null
  totalFeesPaidUsd: number | null
  cumulativeGrossGainsUsd: number | null
  cumulativeNetYieldUsd: number | null
  cumulativeFeesPaidUsd: number | null
}

export function feeHistoryBoundary(point: FeeHistoryPeriod, edge: 'start' | 'end'): string {
  const timestamp = edge === 'start' ? point.startTimestamp : point.endTimestamp
  if (timestamp !== undefined) return new Date(timestamp * 1000).toISOString().slice(0, 10)
  if (point.period.length === 10) {
    return edge === 'start'
      ? point.period
      : new Date(Date.parse(`${point.period}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10)
  }
  const [year, month] = point.period.split('-').map(Number)
  return edge === 'start' ? `${point.period}-01` : new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
}

export function formatFeeHistoryTick(period: string, interval: FeeHistoryInterval): string {
  return interval === 'monthly'
    ? period.slice(0, 7)
    : new Date(`${period}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
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

export function completedFeeHistoryBuckets(
  buckets: CanonicalFeeHistoryBucket[],
  until: number
): CanonicalFeeHistoryBucket[] {
  return buckets.filter((bucket) => {
    // Check the original calendar boundary before clipping it to the requested range.
    const endTimestamp = bucket.endTimestamp ?? Date.parse(feeHistoryBoundary(bucket, 'end')) / 1000
    return endTimestamp <= until
  })
}

function addCumulative(total: number | null, value: number | null): number | null {
  if (value === null) return total
  return (total ?? 0) + value
}

export function buildFeeHistorySeries(
  buckets: CanonicalFeeHistoryBucket[],
  range: { since?: number; until?: number } = {}
): FeeHistoryPoint[] {
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

    const startTimestamp = bucket.startTimestamp ?? Date.parse(feeHistoryBoundary(bucket, 'start')) / 1000
    const endTimestamp = bucket.endTimestamp ?? Date.parse(feeHistoryBoundary(bucket, 'end')) / 1000

    return {
      period: bucket.period,
      ...(bucket.startTimestamp === undefined && range.since === undefined
        ? {}
        : { startTimestamp: Math.max(startTimestamp, range.since ?? startTimestamp) }),
      ...(bucket.endTimestamp === undefined && range.until === undefined
        ? {}
        : { endTimestamp: Math.min(endTimestamp, range.until ?? endTimestamp) }),
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
    period: feeHistoryBoundary(first, 'start'),
    grossGainsUsd: null,
    netYieldUsd: null,
    totalFeesPaidUsd: null,
    cumulativeGrossGainsUsd: points.some((point) => point.grossGainsUsd !== null) ? 0 : null,
    cumulativeNetYieldUsd: points.some((point) => point.netYieldUsd !== null) ? 0 : null,
    cumulativeFeesPaidUsd: points.some((point) => point.totalFeesPaidUsd !== null) ? 0 : null
  }

  return [opening, ...points.map((point) => ({ ...point, period: feeHistoryBoundary(point, 'end') }))]
}
