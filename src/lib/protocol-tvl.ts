// Protocol-level TVL helpers for the homepage overview.
//
// Current per-chain TVL is derived in-memory from the loaded vault list
// (sum of vault.tvl.close per chain). Historical per-chain TVL has no source in
// the configured Yearn backends (Kong tvls/sparklines are per-vault and either
// row-capped at 1000 or only 3 points; yDaemon exposes no historical aggregate),
// so the multi-year series comes from DefiLlama's per-chain protocol breakdown.

import { CHAIN_ID_TO_COLOR, DEFILLAMA_CHAIN_NAME_TO_CHAIN_ID } from '@/constants/chainColors'
import type { ChainId } from '@/constants/chains'
import { CHAIN_ID_TO_NAME } from '@/constants/chains'

const DEFILLAMA_PROTOCOL_URL = 'https://api.llama.fi/protocol/yearn-finance'

export interface ChainTvlPoint {
  /** Unix seconds (UTC midnight, daily). */
  time: number
  /** TVL in USD. */
  tvl: number
}

export interface ChainTvlSeries {
  chainId: ChainId
  name: string
  color: string
  points: ChainTvlPoint[]
}

export interface CurrentChainTvl {
  chainId: ChainId
  name: string
  color: string
  tvl: number
}

/** Shape of the subset of the DefiLlama protocol response that we consume. */
export interface DefiLlamaProtocolResponse {
  chainTvls?: Record<
    string,
    {
      tvl?: Array<{ date: number; totalLiquidityUSD: number }>
    }
  >
}

/**
 * Derive the current per-chain TVL from the most recent point of each historical
 * series. Used for the chart legend/ordering so the legend stays on the same
 * footing as the historical area (DefiLlama), rather than the broader in-memory
 * vault snapshot, which would exceed the chart's scale.
 */
export function getLatestTvlByChain(series: ChainTvlSeries[]): CurrentChainTvl[] {
  return series
    .map((s) => {
      const last = s.points[s.points.length - 1]
      return {
        chainId: s.chainId,
        name: s.name,
        color: s.color,
        tvl: last ? last.tvl : 0
      }
    })
    .filter((entry) => entry.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl)
}

/**
 * Convert DefiLlama's per-chain `chainTvls` object into normalized per-chain
 * series, keeping only chains this app recognizes. Pure over the raw response.
 */
export function mapDefiLlamaToChainSeries(raw: DefiLlamaProtocolResponse): ChainTvlSeries[] {
  const chainTvls = raw?.chainTvls ?? {}
  const series: ChainTvlSeries[] = []

  for (const [chainName, payload] of Object.entries(chainTvls)) {
    const chainId = DEFILLAMA_CHAIN_NAME_TO_CHAIN_ID[chainName]
    if (!chainId) {
      continue // unknown / testnet chain — skip
    }
    const rawPoints = payload?.tvl ?? []
    if (rawPoints.length === 0) {
      continue
    }

    const points: ChainTvlPoint[] = []
    for (const point of rawPoints) {
      const value = point?.totalLiquidityUSD
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue
      }
      points.push({ time: point.date, tvl: value })
    }
    if (points.length === 0) {
      continue
    }

    points.sort((a, b) => a.time - b.time)
    series.push({
      chainId,
      name: CHAIN_ID_TO_NAME[chainId],
      color: CHAIN_ID_TO_COLOR[chainId],
      points
    })
  }

  return series
}

/** Timeframe -> number of daily points to keep from the end of the series. */
export function getProtocolTvlPointLimit(timeframe: ProtocolTvlTimeframe): number {
  switch (timeframe) {
    case '30d':
      return 30
    case '90d':
      return 90
    case '1y':
      return 365
    case 'all':
      return Number.POSITIVE_INFINITY
    default:
      return 365
  }
}

export type ProtocolTvlTimeframe = '30d' | '90d' | '1y' | 'all'

export type StackedTvlRow = { time: number; total: number } & Record<string, number>

/**
 * Align independent per-chain series onto a shared daily time index, producing
 * one row per timestamp with a column per chain plus a `total`. Values are
 * forward-filled after a chain's inception (daily DefiLlama data is mostly
 * contiguous) and treated as 0 before inception. The result is sliced to the
 * requested timeframe (last N points) and lightly downsampled for rendering.
 *
 * `seriesOrder` controls stacking order (bottom first); pass chains ordered by
 * current TVL descending for the most prominent chains at the base.
 */
export function buildStackedTvlData(
  series: ChainTvlSeries[],
  timeframe: ProtocolTvlTimeframe,
  seriesOrder?: ChainTvlSeries[]
): StackedTvlRow[] {
  const ordered = (seriesOrder ?? series).filter((s) => s.points.length > 0)
  if (ordered.length === 0) {
    return []
  }

  // Union of all timestamps, ascending.
  const allTimes = new Set<number>()
  for (const s of ordered) {
    for (const p of s.points) {
      allTimes.add(p.time)
    }
  }
  const times = [...allTimes].sort((a, b) => a - b)

  const limit = getProtocolTvlPointLimit(timeframe)
  const effectiveTimes = Number.isFinite(limit) ? times.slice(-limit) : times

  // Per-chain value lookup + forward-fill cursor.
  const lookups = ordered.map((s) => ({
    key: s.name,
    map: new Map(s.points.map((p) => [p.time, p.tvl])),
    lastSeen: 0,
    started: false
  }))

  const rows: StackedTvlRow[] = []
  for (const t of effectiveTimes) {
    const row: StackedTvlRow = { time: t, total: 0 }
    for (const entry of lookups) {
      const explicit = entry.map.get(t)
      if (explicit !== undefined) {
        entry.lastSeen = explicit
        entry.started = true
      }
      const value = entry.started ? entry.lastSeen : 0
      row[entry.key] = value
      row.total += value
    }
    rows.push(row)
  }

  return downsampleStackedRows(rows, 400)
}

/**
 * Reduce a stacked series to at most `maxPoints` rows by uniform striding. Keeps
 * the first and last points. Each sampled row re-sums its `total` from the
 * surviving chain values so totals stay exact for the rendered points.
 */
export function downsampleStackedRows(rows: StackedTvlRow[], maxPoints: number): StackedTvlRow[] {
  if (rows.length <= maxPoints) {
    return rows
  }
  const keys = Object.keys(rows[0]).filter((k) => k !== 'time' && k !== 'total')
  const lastIndex = rows.length - 1
  const denom = maxPoints - 1
  // Uniform index interpolation across [0 .. lastIndex] so the sampled set
  // always includes the true first and last points and is exactly maxPoints.
  const sampled: StackedTvlRow[] = []
  for (let i = 0; i < maxPoints; i++) {
    const source = rows[Math.round((i * lastIndex) / denom)]
    const row: StackedTvlRow = { time: source.time, total: 0 }
    let total = 0
    for (const key of keys) {
      const v = source[key] ?? 0
      row[key] = v
      total += v
    }
    row.total = total
    sampled.push(row)
  }
  return sampled
}

/**
 * Fetch Yearn's per-chain TVL history from DefiLlama and normalize it. Errors
 * propagate to the caller (the react-query hook surfaces them gracefully).
 */
export async function fetchProtocolTvlByChain(): Promise<ChainTvlSeries[]> {
  const response = await fetch(DEFILLAMA_PROTOCOL_URL)
  if (!response.ok) {
    throw new Error(`DefiLlama request failed (${response.status})`)
  }
  const raw = (await response.json()) as DefiLlamaProtocolResponse
  return mapDefiLlamaToChainSeries(raw)
}
