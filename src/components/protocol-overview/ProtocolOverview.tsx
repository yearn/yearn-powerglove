import { useMemo } from 'react'
import { ProtocolActivityChart } from '@/components/protocol-overview/ProtocolActivityChart'
import { ProtocolActivityFeed } from '@/components/protocol-overview/ProtocolActivityFeed'
import { ProtocolKpis } from '@/components/protocol-overview/ProtocolKpis'
import { ProtocolOptimizerPanel } from '@/components/protocol-overview/ProtocolOptimizerPanel'
import { ProtocolTvlChart } from '@/components/protocol-overview/ProtocolTvlChart'
import { useVaults } from '@/contexts/useVaults'
import { useProtocolActivity } from '@/hooks/useProtocolActivity'
import { useProtocolTvl } from '@/hooks/useProtocolTvl'

/**
 * Protocol-wide overview rendered above the vaults list on the homepage:
 * KPI row, a stacked TVL-by-chain chart, a deposits/withdrawals activity chart
 * paired with a recent-activity feed, and a compact vault-optimizer panel
 * (selectable sidebar + Before/After strategy-allocation chart). Each section
 * loads independently and degrades gracefully (the in-memory current snapshot
 * renders immediately while historical/activity data resolves lazily + cached).
 */
export function ProtocolOverview() {
  const { vaults } = useVaults()
  const safeVaults = useMemo(() => vaults ?? [], [vaults])

  const { series, isError: tvlError } = useProtocolTvl()
  const activity = useProtocolActivity(safeVaults)

  return (
    <div className="space-y-3">
      <ProtocolKpis vaults={safeVaults} volume24hUsd={activity.volume24hUsd} />

      <ProtocolTvlChart series={series} tvlError={tvlError} />

      {/* Activity: deposits/withdrawals over time, paired with the recent-events feed */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProtocolActivityChart byDay={activity.byDay} isLoading={activity.isLoading} />
        </div>
        <ProtocolActivityFeed feed={activity.feed} isLoading={activity.isLoading} />
      </div>

      {/* Vault optimizer: replaces the former optimizations feed; sits below the activity row */}
      <ProtocolOptimizerPanel />
    </div>
  )
}
