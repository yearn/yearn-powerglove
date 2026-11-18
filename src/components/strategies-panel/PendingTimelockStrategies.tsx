import { ChevronRight, ExternalLink } from 'lucide-react'
import { formatUnits } from 'viem'
import { ShieldLock } from '@/components/icons/ShieldLock'
import { CHAIN_ID_TO_BLOCK_EXPLORER, type ChainId } from '@/constants/chains'
import { usePendingTimelockStrategies } from '@/hooks/usePendingTimelockStrategies'

export function PendingTimelockStrategies({
  chainId,
  vaultAddress,
  decimals,
  symbol,
  enabled
}: {
  chainId: ChainId
  vaultAddress: string
  decimals: number
  symbol: string
  enabled: boolean
}) {
  const query = usePendingTimelockStrategies(chainId, vaultAddress, enabled)
  if (!enabled) return null
  if (query.isPending)
    return <output className="block px-4 py-3 text-xs text-gray-500">Checking pending strategy changes…</output>
  if (query.isError && !query.data)
    return <output className="block px-4 py-3 text-xs text-gray-500">Pending strategy changes unavailable.</output>
  if (!query.data?.length) return null
  const explorer = CHAIN_ID_TO_BLOCK_EXPLORER[chainId].replace(/\/$/, '')
  const date = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <section aria-label="Pending strategy changes">
      {query.isError ? (
        <output className="block px-4 py-2 text-xs text-gray-500">
          Refresh unavailable; showing the last fetched changes.
        </output>
      ) : null}
      {query.data.map((item) => (
        <details
          key={`${item.operationId}:${item.strategyAddress}`}
          className="group border-t border-[#f5f5f5] text-sm"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-[#f5f5f5]/50 [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#4f4f4f] group-open:rotate-90" />
            <ShieldLock aria-hidden="true" className="h-6 w-6 shrink-0" />
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 md:grid-cols-[minmax(0,1fr)_8rem_12rem] md:items-center md:gap-4">
              <span className="min-w-0 break-words font-medium">
                {item.strategyName || `${item.strategyAddress.slice(0, 6)}…${item.strategyAddress.slice(-4)}`}
              </span>
              <span className="text-xs text-gray-500">
                {item.status === 'ready' ? 'Timelock ready' : 'Pending timelock'}
              </span>
              <span className="text-xs text-gray-500">Unlocks {date(item.eta)}</span>
            </div>
          </summary>
          <div className="space-y-2 border-t border-[#f5f5f5] bg-[#f5f5f5]/30 px-4 py-4 text-xs md:pl-12">
            <p>
              Queued by {item.executorLabel} on {date(item.queuedAt)}
            </p>
            <p>
              Maximum debt:{' '}
              {item.maxDebtRaw === undefined
                ? 'Unavailable'
                : `${Number(formatUnits(BigInt(item.maxDebtRaw), decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {[
                { label: 'Strategy', url: `${explorer}/address/${item.strategyAddress}` },
                { label: 'Timelock', url: `${explorer}/address/${item.timelockAddress}` },
                { label: 'Queued transaction', url: `${explorer}/tx/${item.scheduleTxHash}` }
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  {link.label}
                  <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        </details>
      ))}
    </section>
  )
}
