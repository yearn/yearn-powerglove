import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { VaultManagementTimelineSequenceItem } from '@/lib/vault-management-display'
import { VaultEventRow } from './VaultEventRow'

interface VaultDebtSequenceRowProps {
  item: VaultManagementTimelineSequenceItem
  assetSymbol?: string
  assetDecimals?: number
  strategyNamesByAddress?: Record<string, string>
}

function toBigInt(value: string | undefined): bigint | null {
  if (!value) {
    return null
  }

  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function formatUnits(value: string, decimals: number = 18): string {
  const bigValue = toBigInt(value)
  if (bigValue === null) {
    return '0'
  }

  const divisor = 10n ** BigInt(decimals)
  const whole = bigValue / divisor
  const fraction = bigValue % divisor

  if (fraction === 0n) {
    return whole.toLocaleString()
  }

  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  const fullValue = `${whole}.${fractionStr}`
  const num = Number(fullValue)
  if (!Number.isFinite(num)) {
    return fullValue
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  })
}

function formatSignedDelta(value: bigint, decimals: number, symbol?: string): string {
  const sign = value > 0n ? '+' : value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${formatUnits(absolute.toString(), decimals)}${symbol ? ` ${symbol}` : ''}`
}

function formatRelativeTime(blockTimestamp: string | number): string {
  const ts = typeof blockTimestamp === 'string' ? Number(blockTimestamp) : blockTimestamp
  if (!Number.isFinite(ts) || ts <= 0) {
    return ''
  }

  let timestampSeconds: number
  if (ts > 1e17) timestampSeconds = Math.floor(ts / 1e9)
  else if (ts > 1e14) timestampSeconds = Math.floor(ts / 1e6)
  else if (ts > 1e11) timestampSeconds = Math.floor(ts / 1e3)
  else timestampSeconds = Math.floor(ts)

  const nowSeconds = Math.floor(Date.now() / 1000)
  const secondsAgo = nowSeconds - timestampSeconds

  if (secondsAgo <= 0 || secondsAgo < 60) return 'just now'
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`
  if (secondsAgo < 86_400) return `${Math.floor(secondsAgo / 3_600)}h ago`
  return `${Math.floor(secondsAgo / 86_400)}d ago`
}

export const VaultDebtSequenceRow: React.FC<VaultDebtSequenceRowProps> = React.memo(
  ({ item, assetSymbol = '', assetDecimals = 18, strategyNamesByAddress = {} }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const relativeTime = formatRelativeTime(item.blockTimestamp)

    const totalDelta = useMemo(
      () =>
        item.items.reduce((sum, timelineItem) => {
          const currentDebt = toBigInt(timelineItem.event.currentDebt) ?? 0n
          const newDebt = toBigInt(timelineItem.event.newDebt) ?? 0n
          return sum + (newDebt - currentDebt)
        }, 0n),
      [item.items]
    )

    const description =
      item.direction === 'decrease'
        ? 'Consecutive withdrawal-driven debt decreases were grouped together.'
        : 'Consecutive deposit-driven debt increases were grouped together.'

    const handleToggle = (target: EventTarget | null) => {
      if (target instanceof HTMLElement && target.closest('a, button, [data-no-row-toggle]')) {
        return
      }

      setIsExpanded((expanded) => !expanded)
    }

    return (
      <div className="border-b border-border last:border-b-0">
        <div
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          className="grid cursor-pointer grid-cols-1 items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4"
          onClick={(event) => handleToggle(event.target)}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-white">
              <span className="text-sm text-[#4f4f4f]">{item.direction === 'decrease' ? '∆↓' : '∆↑'}</span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-black">{item.title}</span>
                <span className="text-sm text-[#4f4f4f]">
                  {item.items.length} transaction{item.items.length === 1 ? '' : 's'}
                </span>
                {relativeTime ? <span className="text-xs text-[#808080]">{relativeTime}</span> : null}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center rounded-full border border-border bg-white px-2 py-1 text-[11px] font-medium text-[#4f4f4f]">
                  {item.reason.label}
                </span>
                <span className="text-xs leading-relaxed text-[#4f4f4f]">{description}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-3 self-start">
            <div className="text-right">
              <div
                className={cn(
                  'font-numeric text-sm',
                  item.direction === 'decrease' ? 'text-[#7f1d1d]' : 'text-green-700'
                )}
              >
                {formatSignedDelta(totalDelta, assetDecimals, assetSymbol)}
              </div>
            </div>

            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
            )}
          </div>
        </div>

        {isExpanded ? (
          <div className="border-t border-border bg-muted/20">
            <div className="divide-y divide-border pl-20 pr-4">
              {item.items.map((timelineItem) => (
                <VaultEventRow
                  key={timelineItem.id}
                  event={timelineItem.event}
                  assetSymbol={assetSymbol}
                  assetDecimals={assetDecimals}
                  strategyNamesByAddress={strategyNamesByAddress}
                  reason={timelineItem.reason}
                  nested
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }
)
