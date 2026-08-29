import { Link } from '@tanstack/react-router'
import React, { useMemo } from 'react'
import type { ChainId } from '@/constants/chains'
import { CHAIN_ID_TO_BLOCK_EXPLORER, CHAIN_ID_TO_ICON } from '@/constants/chains'
import { formatTvlDisplay } from '@/lib/formatters'
import type { ActivityFeedItem } from '@/lib/protocol-activity'

function formatRelativeTime(blockTimestamp: number, nowSeconds: number): string {
  const diff = Math.max(0, nowSeconds - blockTimestamp)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface ProtocolActivityFeedProps {
  feed: ActivityFeedItem[]
  isLoading: boolean
}

function ProtocolActivityFeedImpl({ feed, isLoading }: ProtocolActivityFeedProps) {
  const nowSeconds = useMemo(() => Math.floor(Date.now() / 1000), [])

  return (
    <section className="border border-border bg-white">
      <div className="p-4 pb-2 sm:p-6 sm:pb-2">
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        <p className="text-xs text-gray-500">Latest deposits &amp; withdrawals across all vaults</p>
      </div>
      <div className="max-h-[320px] overflow-y-auto px-2 pb-3 sm:px-4">
        {isLoading && feed.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-gray-400">Loading activity…</div>
        ) : feed.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-gray-400">No recent activity</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {feed.map((item) => {
              const isDeposit = item.type === 'deposit'
              const explorer = CHAIN_ID_TO_BLOCK_EXPLORER[item.chainId as ChainId]
              return (
                <li key={`${item.chainId}-${item.transactionHash}-${item.vaultAddress}-${item.blockTimestamp}`}>
                  <div className="flex items-center gap-2 px-2 py-2">
                    <img
                      src={CHAIN_ID_TO_ICON[item.chainId as ChainId]}
                      alt=""
                      className="h-4 w-4 shrink-0 rounded-full"
                      loading="lazy"
                    />
                    <span
                      className={`shrink-0 text-xs font-semibold ${isDeposit ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {isDeposit ? 'Deposit' : 'Withdraw'}
                    </span>
                    <span className="min-w-0 shrink truncate text-xs font-medium text-foreground">
                      {typeof item.amountUsd === 'number' ? formatTvlDisplay(item.amountUsd) : item.amountRaw}
                    </span>
                    <Link
                      to="/vaults/$chainId/$vaultAddress"
                      params={{ chainId: item.chainId.toString(), vaultAddress: item.vaultAddress }}
                      className="shrink-0 text-[11px] text-gray-400 transition-colors hover:text-gray-600 hover:underline"
                    >
                      {item.assetSymbol}
                    </Link>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-gray-400">
                        {formatRelativeTime(item.blockTimestamp, nowSeconds)}
                      </span>
                      {explorer ? (
                        <a
                          href={`${explorer}/tx/${item.transactionHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#0657f9] hover:underline"
                        >
                          tx
                        </a>
                      ) : null}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export const ProtocolActivityFeed = React.memo(ProtocolActivityFeedImpl)
