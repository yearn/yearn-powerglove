// Protocol-wide user activity (deposits vs withdrawals) from Envio, aggregated
// to USD per day. The existing vault-events lib keys every query to a single
// vault; this module drops that filter to fetch activity across all Yearn
// vaults, with a time window and pagination cap to bound query cost.
import { isExcludedTransactionFrom } from '@/constants/excludedAddresses'
import { priceKey } from '@/lib/asset-prices'
import { queryEnvio } from '@/lib/envio-client'
import type { Vault } from '@/types/vaultTypes'

const ENVIO_PAGE_SIZE = 250
const DAY_SECONDS = 86400

export type ProtocolActivityType = 'deposit' | 'withdraw'

export interface ProtocolActivityEvent {
  type: ProtocolActivityType
  chainId: number
  vaultAddress: string
  /** Raw token amount as emitted by the contract (unscaled by decimals). */
  assets: string
  blockTimestamp: number
  transactionHash: string
  account: string
}

export interface VaultAssetInfo {
  assetAddress: string
  decimals: number
  symbol: string
}

/** Map of `${chainId}:${vaultAddressLower}` -> vault asset metadata. */
export type VaultAssetLookup = Map<string, VaultAssetInfo>

/** Map of `${chainId}:${assetAddressLower}` -> USD price of one human unit. */
export type AssetPriceMap = Map<string, number>

export interface DayActivity {
  /** Unix seconds at UTC midnight for the bucket. */
  day: number
  depositsUsd: number
  withdrawalsUsd: number
  netUsd: number
}

export interface ActivityFeedItem {
  type: ProtocolActivityType
  chainId: number
  vaultAddress: string
  assetSymbol: string
  amountUsd: number | null
  amountRaw: string
  blockTimestamp: number
  transactionHash: string
}

export const vaultKey = (chainId: number, vaultAddress: string): string => `${chainId}:${vaultAddress.toLowerCase()}`

interface RawDepositRow {
  assets: string
  blockTimestamp: number
  chainId: number
  vaultAddress: string
  transactionHash: string
  owner?: string | null
  transactionFrom?: string | null
}
interface RawWithdrawRow {
  assets: string
  blockTimestamp: number
  chainId: number
  vaultAddress: string
  transactionHash: string
  receiver?: string | null
  transactionFrom?: string | null
}

interface RawProtocolActivity {
  Deposit: RawDepositRow[]
  Withdraw: RawWithdrawRow[]
}

const PROTOCOL_ACTIVITY_QUERY = `
  query ProtocolActivity($since: Int, $limit: Int, $offset: Int) {
    Deposit(
      where: { blockTimestamp: { _gte: $since } }
      order_by: { blockTimestamp: desc }
      limit: $limit
      offset: $offset
    ) { assets blockTimestamp chainId vaultAddress transactionHash owner transactionFrom }
    Withdraw(
      where: { blockTimestamp: { _gte: $since } }
      order_by: { blockTimestamp: desc }
      limit: $limit
      offset: $offset
    ) { assets blockTimestamp chainId vaultAddress transactionHash receiver transactionFrom }
  }
`

interface FetchOptions {
  /** Only include events at/after this unix timestamp. */
  sinceSeconds: number
  /** Hard cap on events fetched per type (deposits / withdrawals). */
  maxEventsPerType?: number
}

/**
 * Fetch recent protocol-wide deposits and withdrawals (newest first) until the
 * window is exhausted or `maxEventsPerType` is reached per type. Events from
 * either type that fall outside the window are filtered defensively.
 */
export async function fetchProtocolActivity({
  sinceSeconds,
  maxEventsPerType = 1500
}: FetchOptions): Promise<ProtocolActivityEvent[]> {
  const events: ProtocolActivityEvent[] = []
  await Promise.all([
    paginateType('deposit', sinceSeconds, maxEventsPerType, events),
    paginateType('withdraw', sinceSeconds, maxEventsPerType, events)
  ])
  events.sort((a, b) => b.blockTimestamp - a.blockTimestamp)
  return events
}

async function paginateType(
  type: ProtocolActivityType,
  sinceSeconds: number,
  maxEvents: number,
  sink: ProtocolActivityEvent[]
): Promise<void> {
  let offset = 0
  let collected = 0
  while (collected < maxEvents) {
    const remaining = maxEvents - collected
    const limit = Math.min(ENVIO_PAGE_SIZE, remaining)
    const data = await queryEnvio<RawProtocolActivity>(PROTOCOL_ACTIVITY_QUERY, {
      since: sinceSeconds,
      limit,
      offset
    })
    const rows = type === 'deposit' ? data.Deposit : data.Withdraw
    for (const row of rows) {
      if (row.blockTimestamp < sinceSeconds) continue
      // Skip DAO/treasury management moves so activity reflects organic user flows only.
      if (isExcludedTransactionFrom(row.transactionFrom)) continue
      sink.push({
        type,
        chainId: row.chainId,
        vaultAddress: row.vaultAddress,
        assets: String(row.assets ?? '0'),
        blockTimestamp: row.blockTimestamp,
        transactionHash: row.transactionHash,
        account: type === 'deposit' ? ((row as RawDepositRow).owner ?? '') : ((row as RawWithdrawRow).receiver ?? '')
      })
    }
    collected += rows.length
    offset += limit
    if (rows.length < limit) {
      break // window exhausted for this type
    }
  }
}

/**
 * Resolve the USD value of a single event using the vault's asset metadata and a
 * price map. Returns null when the vault, asset, decimals, or price is unknown
 * so the caller can skip unpriceable events consistently.
 */
export function eventUsd(
  event: ProtocolActivityEvent,
  vaultAssets: VaultAssetLookup,
  prices: AssetPriceMap
): number | null {
  const info = vaultAssets.get(vaultKey(event.chainId, event.vaultAddress))
  if (!info) return null
  const price = prices.get(priceKey(event.chainId, info.assetAddress))
  if (price === undefined) return null
  const raw = Number(event.assets)
  if (!Number.isFinite(raw) || raw <= 0) return null
  return (raw / 10 ** info.decimals) * price
}

/**
 * Bucket events by UTC day and sum deposits/withdrawals in USD. Days with no
 * resolvable events are omitted; unpriceable events are skipped.
 */
export function aggregateActivityByDay(
  events: ProtocolActivityEvent[],
  vaultAssets: VaultAssetLookup,
  prices: AssetPriceMap
): DayActivity[] {
  const buckets = new Map<number, DayActivity>()
  for (const event of events) {
    const usd = eventUsd(event, vaultAssets, prices)
    if (usd === null) continue
    const day = Math.floor(event.blockTimestamp / DAY_SECONDS) * DAY_SECONDS
    let bucket = buckets.get(day)
    if (!bucket) {
      bucket = { day, depositsUsd: 0, withdrawalsUsd: 0, netUsd: 0 }
      buckets.set(day, bucket)
    }
    if (event.type === 'deposit') {
      bucket.depositsUsd += usd
      bucket.netUsd += usd
    } else {
      bucket.withdrawalsUsd += usd
      bucket.netUsd -= usd
    }
  }
  return [...buckets.values()].sort((a, b) => a.day - b.day)
}

/**
 * Total USD volume (deposits + withdrawals) within the trailing 24h ending at
 * `nowSeconds`. Unpriceable events are skipped.
 */
export function computeActivityVolume24h(
  events: ProtocolActivityEvent[],
  vaultAssets: VaultAssetLookup,
  prices: AssetPriceMap,
  nowSeconds: number
): number {
  const cutoff = nowSeconds - DAY_SECONDS
  let volume = 0
  for (const event of events) {
    if (event.blockTimestamp < cutoff) continue
    const usd = eventUsd(event, vaultAssets, prices)
    if (usd !== null) volume += usd
  }
  return volume
}

/**
 * Shape the most recent events into a feed (newest first). `amountUsd` is null
 * when the event can't be priced; the raw amount + asset symbol are always shown.
 */
export function shapeActivityFeed(
  events: ProtocolActivityEvent[],
  vaultAssets: VaultAssetLookup,
  prices: AssetPriceMap,
  limit: number
): ActivityFeedItem[] {
  return [...events]
    .sort((a, b) => b.blockTimestamp - a.blockTimestamp)
    .slice(0, limit)
    .map((event) => {
      const info = vaultAssets.get(vaultKey(event.chainId, event.vaultAddress))
      return {
        type: event.type,
        chainId: event.chainId,
        vaultAddress: event.vaultAddress,
        assetSymbol: info?.symbol ?? '—',
        amountUsd: eventUsd(event, vaultAssets, prices),
        amountRaw: event.assets,
        blockTimestamp: event.blockTimestamp,
        transactionHash: event.transactionHash
      }
    })
}

/**
 * Collect the distinct (chainId, asset address) pairs that need price resolution
 * for the given events, based on the vault-asset lookup.
 */
export function collectDistinctAssets(
  events: ProtocolActivityEvent[],
  vaultAssets: VaultAssetLookup
): Array<{ chainId: number; address: string }> {
  const seen = new Set<string>()
  const out: Array<{ chainId: number; address: string }> = []
  for (const event of events) {
    const info = vaultAssets.get(vaultKey(event.chainId, event.vaultAddress))
    if (!info) continue
    const key = priceKey(event.chainId, info.assetAddress)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ chainId: event.chainId, address: info.assetAddress })
  }
  return out
}

/**
 * Build the vault-asset lookup used for USD resolution from the loaded vault
 * list. Only vaults with an asset address and numeric decimals are included.
 */
export function buildVaultAssetLookup(vaults: Vault[]): VaultAssetLookup {
  const lookup: VaultAssetLookup = new Map()
  for (const vault of vaults) {
    const assetAddress = vault.asset?.address
    const decimals = vault.asset?.decimals
    if (!vault.address || !assetAddress || typeof decimals !== 'number' || !Number.isFinite(decimals)) {
      continue
    }
    lookup.set(vaultKey(vault.chainId, vault.address), {
      assetAddress,
      decimals,
      symbol: vault.asset?.symbol ?? ''
    })
  }
  return lookup
}
