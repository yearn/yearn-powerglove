// Protocol-wide vault optimizations, sourced from the reallocation API
// (`VITE_PUBLIC_REALLOCATION_API_URL`, e.g. visual.yearn.dev/api/change).
//
// The global GET returns every vault's latest optimization record in one call:
// APR before/after (in bps of percent), the per-strategy debt ratios, and a
// human-readable `explain` parsed for vault label, chain, and TVL. This powers
// the compact optimizer panel (sidebar list of vaults + a Before/After strategy
// allocation chart), which recreates the core of visual.yearn.dev on the
// homepage — without any per-vault follow-up fetch.
import { parseExplainMetadata } from '@/lib/explain-parser'
import { assignStrategyColors } from '@/lib/strategyColors'

interface RawStrategyDebtRatio {
  strategy: string
  targetRatio: number
  currentRatio: number
  currentApr?: number | null
  targetApr?: number | null
}

interface RawOptimizationSource {
  key: string
  chainId: number | null
  revision: string
  isLatestAlias: boolean
  timestampUtc?: string | null
  latestMatchedTimestampUtc?: string | null
}

export interface RawOptimizationRecord {
  vault: string
  strategyDebtRatios: RawStrategyDebtRatio[]
  currentApr: number
  proposedApr: number
  explain: string
  source: RawOptimizationSource
}

/** One strategy's current vs proposed allocation within a vault. */
export interface StrategyAllocationRow {
  key: string
  name: string
  shortAddress: string
  /** Allocation as percent (raw bps out of 10000 / 100). */
  currentPct: number
  targetPct: number
  deltaPct: number
  /** Strategy APR as percent (raw bps of percent / 100), when reported. */
  currentAprPct: number | null
  targetAprPct: number | null
  color: string
}

export interface ProtocolOptimizationItem {
  vault: string
  chainId: number | null
  vaultLabel: string | null
  /** Unix seconds; null when no timestamp is available (sorted last). */
  timestampSeconds: number | null
  /** Current and proposed vault APR as percent (raw bps-of-percent / 100). */
  currentAprPct: number | null
  proposedAprPct: number | null
  aprDeltaPct: number | null
  strategyCount: number
  /** TVL in USD when the optimizer reported it in USD, else null. */
  tvlUsd: number | null
  strategies: StrategyAllocationRow[]
}

/** Parse the optimizer's "YYYY-MM-DD HH:MM:SS UTC" timestamp to unix seconds. */
export function parseOptimizerTimestamp(value?: string | null): number | null {
  if (!value) return null
  const normalized = value.trim().replace(' ', 'T').replace(' UTC', 'Z')
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

const shortAddress = (address: string): string =>
  address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address

/**
 * Convert a raw record's `strategyDebtRatios` into chart-ready allocation rows,
 * assigning a stable color per strategy from the Yearn palette. Ratios are bps
 * (out of 10000); APRs are bps-of-percent.
 */
export function shapeStrategyAllocations(ratios: RawStrategyDebtRatio[]): StrategyAllocationRow[] {
  const safe = Array.isArray(ratios) ? ratios : []
  const colors = assignStrategyColors(safe.map((r) => (r.strategy ?? '').toLowerCase()))
  return safe.map((ratio, index) => {
    const key = (ratio.strategy ?? '').toLowerCase()
    const currentPct = Number.isFinite(ratio.currentRatio) ? ratio.currentRatio / 100 : 0
    const targetPct = Number.isFinite(ratio.targetRatio) ? ratio.targetRatio / 100 : 0
    return {
      key,
      name: `Strategy ${index + 1}`,
      shortAddress: shortAddress(ratio.strategy ?? ''),
      currentPct,
      targetPct,
      deltaPct: targetPct - currentPct,
      currentAprPct:
        ratio.currentApr !== null && ratio.currentApr !== undefined && Number.isFinite(ratio.currentApr)
          ? ratio.currentApr / 100
          : null,
      targetAprPct:
        ratio.targetApr !== null && ratio.targetApr !== undefined && Number.isFinite(ratio.targetApr)
          ? ratio.targetApr / 100
          : null,
      color: colors.get(key) ?? '#0657F9'
    }
  })
}

/**
 * Convert a raw optimization record into a sidebar + chart item. APR values from
 * the API are in basis points of percent (e.g. 283 -> 2.83%); ratios are in bps.
 */
export function shapeOptimizationItem(raw: RawOptimizationRecord): ProtocolOptimizationItem {
  const metadata = parseExplainMetadata(raw.explain ?? '')
  const chainId = metadata.chainId ?? raw.source.chainId ?? null
  const timestampSeconds = raw.source.isLatestAlias
    ? parseOptimizerTimestamp(raw.source.latestMatchedTimestampUtc)
    : parseOptimizerTimestamp(raw.source.timestampUtc)

  const currentAprPct = Number.isFinite(raw.currentApr) ? raw.currentApr / 100 : null
  const proposedAprPct = Number.isFinite(raw.proposedApr) ? raw.proposedApr / 100 : null
  const aprDeltaPct = currentAprPct !== null && proposedAprPct !== null ? proposedAprPct - currentAprPct : null
  const tvlUsd = metadata.tvlUnit === 'USD' && typeof metadata.tvl === 'number' ? metadata.tvl : null

  return {
    vault: raw.vault,
    chainId,
    vaultLabel: metadata.vaultLabel,
    timestampSeconds,
    currentAprPct,
    proposedAprPct,
    aprDeltaPct,
    strategyCount: raw.strategyDebtRatios?.length ?? 0,
    tvlUsd,
    strategies: shapeStrategyAllocations(raw.strategyDebtRatios)
  }
}

const optimizationRecordKey = (record: RawOptimizationRecord): string => {
  // Key on the chainId the vault reports in its `explain` header (e.g. "WETH-1
  // yVault (1: 0x…)"), falling back to `source.chainId`. The header always carries
  // the chain, but `source.chainId` can arrive null/absent from the reallocation
  // API — keying on source alone then splits one vault across two keys (`1:addr`
  // vs `x:addr`) and leaks duplicate rows (the "many WETH-1" symptom). Mirrors
  // optimization-visualizer's getVaultOptionKey(metadata.chainId ?? source.chainId).
  const chainId = parseExplainMetadata(record.explain ?? '').chainId ?? record.source.chainId ?? null
  return `${chainId ?? 'x'}:${record.vault.toLowerCase()}`
}

// Whether `a` is a more current optimization record than `b`. The "latest"
// alias (isLatestAlias) always wins; otherwise the larger timestamp wins.
function isNewerOptimization(a: RawOptimizationRecord, b: RawOptimizationRecord): boolean {
  const aLatest = a.source.isLatestAlias === true
  const bLatest = b.source.isLatestAlias === true
  if (aLatest !== bLatest) return aLatest
  const ta =
    parseOptimizerTimestamp(a.source.latestMatchedTimestampUtc) ?? parseOptimizerTimestamp(a.source.timestampUtc) ?? 0
  const tb =
    parseOptimizerTimestamp(b.source.latestMatchedTimestampUtc) ?? parseOptimizerTimestamp(b.source.timestampUtc) ?? 0
  return ta > tb
}

/**
 * Collapse the many per-vault revision records returned by `/api/change` to one
 * record per vault (keyed by chainId + address), keeping the latest. Mirrors the
 * dedup in optimization-visualizer's buildVaultOptions.
 */
export function dedupeLatestOptimizations(records: RawOptimizationRecord[]): RawOptimizationRecord[] {
  const byKey = new Map<string, RawOptimizationRecord>()
  for (const record of records) {
    const key = optimizationRecordKey(record)
    const existing = byKey.get(key)
    if (!existing || isNewerOptimization(record, existing)) {
      byKey.set(key, record)
    }
  }
  return [...byKey.values()]
}

/**
 * Shape + order the raw records for the optimizer sidebar: most recent
 * optimization first (by timestamp, descending), records without a timestamp
 * last, capped at `limit`.
 */
export function shapeOptimizerVaults(records: RawOptimizationRecord[], limit: number): ProtocolOptimizationItem[] {
  return dedupeLatestOptimizations(records)
    .map(shapeOptimizationItem)
    .sort((a, b) => {
      const aT = a.timestampSeconds
      const bT = b.timestampSeconds
      if (aT !== null && bT !== null) return bT - aT
      if (aT !== null) return -1
      if (bT !== null) return 1
      return a.vault.localeCompare(b.vault)
    })
    .slice(0, limit)
}

/** Fetch the global optimization list. Throws if the API URL is unset. */
export async function fetchProtocolOptimizations(): Promise<RawOptimizationRecord[]> {
  const url = import.meta.env.VITE_PUBLIC_REALLOCATION_API_URL?.trim() ?? ''
  if (!url) {
    throw new Error('Protocol optimizations require VITE_PUBLIC_REALLOCATION_API_URL to be configured.')
  }
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Optimizations request failed (${response.status})`)
  }
  const data = (await response.json()) as RawOptimizationRecord[]
  return Array.isArray(data) ? data : []
}
