// src/lib/historical-allocation.ts
//
// Builds the "Historical Allocation" chart series (each strategy's share of
// vault debt over time) from Kong `vaultReports` rows, i.e. decoded
// `StrategyReported` events. Mirrors the reconstruction used by the standalone
// `*-doa-history.html` debt-optimizer replays, but sourced from Kong's indexed
// `evmlog` data instead of an RPC sweep — see `kong-data.md`.
//
// Every `StrategyReported` event carries the strategy's realized `current_debt`
// at that block. We walk the reports in chronological order, keep the latest
// known debt per strategy, and snapshot each strategy's share of the running
// total at every block that produced a report. Between reports a strategy's
// debt is assumed constant, so the resulting series is a step function — which
// is exactly what the stacked area chart renders.

import { assignStrategyColors } from '@/lib/strategyColors'

/** One decoded `StrategyReported` row from Kong `vaultReports`. */
export interface VaultReportEvent {
  strategy: string
  /** Raw uint debt (asset units) as a string — parsed as BigInt. */
  currentDebt: string | null
  currentDebtUsd?: number | null
  aprNet?: number | null
  blockNumber: number
  /** Unix seconds (BigInt-as-string from the GraphQL BigInt scalar). */
  blockTime: string
  logIndex: number
  transactionHash: string
  eventName: string
}

export interface AllocationStrategyMeta {
  /** Lowercased strategy address. */
  key: string
  label: string
  color: string
  /** Share (%) in the most recent snapshot. */
  latestSharePct: number
  /** Largest share (%) seen across the whole series. */
  peakSharePct: number
  /** Last known debt in USD, if Kong had a price for it. */
  latestDebtUsd: number | null
  reportCount: number
}

export interface AllocationPoint {
  /** Unix milliseconds. */
  time: number
  /** Axis label, e.g. "Mar 2026". */
  date: string
  /** Tooltip label, e.g. "Mar 14, 2026". */
  tooltipDate: string
  totalDebtUsd: number | null
  /** Per-strategy share (%) keyed by lowercased strategy address. */
  [strategyKey: string]: number | string | null
}

export interface HistoricalAllocationSeries {
  points: AllocationPoint[]
  strategies: AllocationStrategyMeta[]
  reportCount: number
}

const monthYearFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const BPS_SCALE = 10_000n

function resolveLabel(
  key: string,
  namesByAddress: Record<string, { name: string } | string | undefined> | undefined
): string {
  const entry = namesByAddress?.[key]
  const name = typeof entry === 'string' ? entry : entry?.name
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}

/**
 * Reconstruct per-strategy allocation shares over time from raw report events.
 *
 * Pure and deterministic — safe to unit test without a network.
 */
export function buildHistoricalAllocationSeries(
  reports: VaultReportEvent[],
  namesByAddress?: Record<string, { name: string } | string | undefined>
): HistoricalAllocationSeries {
  const valid = reports.filter((report) => {
    if (!report || !report.strategy || !report.currentDebt || !report.blockTime) return false
    try {
      // Reject non-numeric debt strings up front so BigInt never throws below.
      void BigInt(report.currentDebt)
      return true
    } catch {
      return false
    }
  })

  if (valid.length === 0) {
    return { points: [], strategies: [], reportCount: reports.length }
  }

  const sorted = [...valid].sort((a, b) => {
    const ta = Number(a.blockTime)
    const tb = Number(b.blockTime)
    if (ta !== tb) return ta - tb
    return a.logIndex - b.logIndex
  })

  const latestDebt = new Map<string, bigint>()
  const latestDebtUsd = new Map<string, number>()
  const reportCountByKey = new Map<string, number>()
  const appearanceOrder: string[] = []
  const seen = new Set<string>()

  const points: AllocationPoint[] = []

  // Emit one snapshot per distinct block time, after applying every report in
  // that block. Collapses same-block reports into a single chart point.
  const flushSnapshot = (blockTimeSeconds: number) => {
    let total = 0n
    for (const debt of latestDebt.values()) total += debt
    if (total <= 0n) return // skip leading/fully-withdrawn buckets

    const millis = blockTimeSeconds * 1000
    const point: AllocationPoint = {
      time: millis,
      date: monthYearFormatter.format(millis),
      tooltipDate: fullDateFormatter.format(millis),
      totalDebtUsd: null
    }

    for (const [key, debt] of latestDebt) {
      // Integer division to basis points avoids float drift; divide by 100 -> %.
      const basisPoints = Number((debt * BPS_SCALE) / total)
      point[key] = basisPoints / 100
    }

    let totalUsd = 0
    for (const usd of latestDebtUsd.values()) totalUsd += usd
    point.totalDebtUsd = totalUsd > 0 ? totalUsd : null

    points.push(point)
  }

  let currentBucketTime: number | null = null
  for (const report of sorted) {
    const key = report.strategy.toLowerCase()
    const blockTimeSeconds = Number(report.blockTime)

    if (currentBucketTime !== null && blockTimeSeconds !== currentBucketTime) {
      flushSnapshot(currentBucketTime)
    }
    currentBucketTime = blockTimeSeconds

    latestDebt.set(key, BigInt(report.currentDebt as string))
    if (typeof report.currentDebtUsd === 'number' && Number.isFinite(report.currentDebtUsd)) {
      latestDebtUsd.set(key, report.currentDebtUsd)
    }
    reportCountByKey.set(key, (reportCountByKey.get(key) ?? 0) + 1)
    if (!seen.has(key)) {
      seen.add(key)
      appearanceOrder.push(key)
    }
  }
  if (currentBucketTime !== null) flushSnapshot(currentBucketTime)

  const colorMap = assignStrategyColors(appearanceOrder)
  const lastPoint = points[points.length - 1]

  const strategies: AllocationStrategyMeta[] = appearanceOrder.map((key) => {
    let peakSharePct = 0
    for (const point of points) {
      const share = point[key]
      if (typeof share === 'number' && share > peakSharePct) peakSharePct = share
    }
    const latestSharePct = lastPoint && typeof lastPoint[key] === 'number' ? (lastPoint[key] as number) : 0

    return {
      key,
      label: resolveLabel(key, namesByAddress),
      color: colorMap.get(key) ?? '#888888',
      latestSharePct,
      peakSharePct,
      latestDebtUsd: latestDebtUsd.get(key) ?? null,
      reportCount: reportCountByKey.get(key) ?? 0
    }
  })

  // Largest band on the bottom of the stack (drawn first), like the IPOR chart.
  strategies.sort((a, b) => b.latestSharePct - a.latestSharePct)

  return { points, strategies, reportCount: reports.length }
}

export const ALLOCATION_TIMEFRAMES = [
  { label: '30 Days', mobileLabel: '30D', value: '30d', days: 30 },
  { label: '90 Days', mobileLabel: '90D', value: '90d', days: 90 },
  { label: '1 Year', mobileLabel: '1Y', value: '1y', days: 365 },
  { label: 'All Time', mobileLabel: 'All', value: 'all', days: null }
] as const

export type AllocationTimeframeValue = (typeof ALLOCATION_TIMEFRAMES)[number]['value']

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Filter the allocation series to a timeframe window. The window is anchored to
 * the latest data point (not "now") so the most recent reports are always
 * included even for stale vaults. "all" returns every point. Assumes `points`
 * are already sorted ascending by `time` (which `buildHistoricalAllocationSeries`
 * guarantees).
 */
export function filterAllocationPoints(points: AllocationPoint[], value: AllocationTimeframeValue): AllocationPoint[] {
  if (value === 'all' || points.length === 0) return points

  const timeframe = ALLOCATION_TIMEFRAMES.find((entry) => entry.value === value)
  const days = timeframe?.days
  if (!days) return points

  const anchor = points[points.length - 1]?.time
  if (typeof anchor !== 'number') return points

  const cutoff = anchor - days * MS_PER_DAY
  return points.filter((point) => point.time >= cutoff)
}

/**
 * Keep only strategies that hold a non-trivial share somewhere in the window,
 * so the ranged view isn't cluttered with flat-zero bands. The returned objects
 * are the same references passed in, preserving their stable colors/labels.
 */
export function selectVisibleStrategies(
  points: AllocationPoint[],
  strategies: AllocationStrategyMeta[],
  minShare = 0.01
): AllocationStrategyMeta[] {
  if (points.length === 0) return []
  return strategies.filter((strategy) => {
    for (const point of points) {
      const share = point[strategy.key]
      if (typeof share === 'number' && share > minShare) return true
    }
    return false
  })
}
