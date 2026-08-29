import { Info } from 'lucide-react'
import React, { useMemo } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatTvlDisplay } from '@/lib/formatters'
import type { Vault } from '@/types/vaultTypes'

interface ProtocolKpisProps {
  vaults: Vault[]
  /** 24h deposit+withdraw volume in USD, or null while activity is loading. */
  volume24hUsd?: number | null
}

interface KpiCardProps {
  label: string
  value: string
  sublabel?: string
}

const KpiCard = React.memo(function KpiCard({ label, value, sublabel }: KpiCardProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border border-border bg-white p-2.5 sm:p-3">
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">{label}</span>
        {sublabel ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
                aria-label={`More info: ${label}`}
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{sublabel}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <span className="truncate text-[21px] font-semibold text-foreground sm:text-[24px]">{value}</span>
    </div>
  )
})

function ProtocolKpisImpl({ vaults, volume24hUsd }: ProtocolKpisProps) {
  const { totalTvl, activeVaultCount } = useMemo(() => {
    let totalTvl = 0
    let activeVaultCount = 0
    for (const vault of vaults) {
      const close = vault.tvl?.close
      if (typeof close === 'number' && Number.isFinite(close) && close > 0) {
        totalTvl += close
      }
      // Active vaults only — retired vaults are excluded.
      if (!vault.isRetired) activeVaultCount++
    }
    return { totalTvl, activeVaultCount }
  }, [vaults])

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Total TVL" value={formatTvlDisplay(totalTvl)} sublabel="Across all vaults" />
        <KpiCard
          label="Active Vaults"
          value={activeVaultCount.toLocaleString()}
          sublabel="Active V2 + V3 vaults (retired excluded)"
        />
        <KpiCard
          label="24h Volume"
          value={typeof volume24hUsd === 'number' ? formatTvlDisplay(volume24hUsd) : '—'}
          sublabel="Deposits + withdrawals"
        />
      </div>
    </TooltipProvider>
  )
}

export const ProtocolKpis = React.memo(ProtocolKpisImpl)
