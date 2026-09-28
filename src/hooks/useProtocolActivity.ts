import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchAssetPriceUsdMap } from '@/lib/asset-prices'
import {
  type ActivityFeedItem,
  aggregateActivityByDay,
  buildVaultAssetLookup,
  collectDistinctAssets,
  computeActivityVolume24h,
  type DayActivity,
  fetchProtocolActivity,
  shapeActivityFeed
} from '@/lib/protocol-activity'
import type { Vault } from '@/types/vaultTypes'

const DAY_SECONDS = 86400
const STALE_TIME = 15 * 60 * 1000
const DEFAULT_WINDOW_DAYS = 30

export interface ProtocolActivityResult {
  byDay: DayActivity[]
  volume24hUsd: number | null
  feed: ActivityFeedItem[]
  eventsCount: number
  isLoading: boolean
  isError: boolean
  error: Error | null
}

/**
 * Loads protocol-wide deposit/withdraw activity (trailing `days`, default 30),
 * resolves per-asset USD prices, and exposes daily aggregates, the trailing
 * 24h volume (drives the KPI), and a recent-events feed. Lazy and cached (15
 * min); disabled until the vault list is available since it's needed for USD
 * resolution.
 */
export function useProtocolActivity(vaults: Vault[], days: number = DEFAULT_WINDOW_DAYS): ProtocolActivityResult {
  const lookup = useMemo(() => buildVaultAssetLookup(vaults), [vaults])
  const vaultCount = vaults.length

  const query = useQuery({
    queryKey: ['protocol', 'activity', days, vaultCount],
    enabled: lookup.size > 0,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const sinceSeconds = nowSeconds - days * DAY_SECONDS
      const events = await fetchProtocolActivity({ sinceSeconds })

      const assets = collectDistinctAssets(events, lookup)
      const prices = assets.length > 0 ? await fetchAssetPriceUsdMap(assets) : new Map<string, number>()

      const byDay = aggregateActivityByDay(events, lookup, prices)
      const volume24hUsd = computeActivityVolume24h(events, lookup, prices, nowSeconds)
      const feed = shapeActivityFeed(events, lookup, prices, 12)
      return { byDay, volume24hUsd, feed, eventsCount: events.length }
    }
  })

  return {
    byDay: query.data?.byDay ?? [],
    volume24hUsd: query.data?.volume24hUsd ?? null,
    feed: query.data?.feed ?? [],
    eventsCount: query.data?.eventsCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null
  }
}
