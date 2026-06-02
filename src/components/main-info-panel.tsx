import { Check, Copy, ExternalLink } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import type { MainInfoPanelProps } from '@/types/dataTypes'

type MainInfoPanelComponentProps = MainInfoPanelProps & {
  navigation?: ReactNode
  primaryHeaderRef?: (node: HTMLDivElement | null) => void
  tabsHeaderRef?: (node: HTMLDivElement | null) => void
  primaryHeaderStickyTop?: number
  tabsHeaderStickyTop?: number
}

export type VaultAtAGlanceItem = {
  label: string
  value: ReactNode
}

export function getVaultAtAGlanceItems(data: MainInfoPanelProps): VaultAtAGlanceItem[] {
  return [
    { label: 'Est. APY', value: data.oneDayAPY },
    { label: 'Historical APY', value: data.thirtyDayAPY },
    {
      label: 'Network',
      value: (
        <span className="inline-flex min-w-0 items-center gap-2">
          {data.network.icon ? (
            <img src={data.network.icon} alt={data.network.name} className="h-5 w-5 shrink-0 rounded-full" />
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs text-white">
              ?
            </span>
          )}
          <span className="truncate">{data.network.name}</span>
        </span>
      )
    },
    {
      label: 'Vault Token',
      value: (
        <span className="inline-flex min-w-0 items-center gap-2">
          {data.vaultToken.icon ? (
            <img src={data.vaultToken.icon} alt={data.vaultToken.name} className="h-5 w-5 shrink-0 rounded-full" />
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs text-white">
              ?
            </span>
          )}
          <span className="truncate">{data.vaultToken.name}</span>
        </span>
      )
    },
    { label: 'Total Supply', value: data.totalSupply },
    { label: 'Management Fee', value: data.managementFee },
    { label: 'Performance Fee', value: data.performanceFee }
  ]
}

export function VaultAtAGlance({ items, className }: { items: VaultAtAGlanceItem[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-5 gap-y-2', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="mb-1 text-xs text-gray-500">{item.label}</dt>
          <dd className="min-w-0 text-sm font-medium text-[#111111]">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function HeaderMetricGrid({
  items,
  className,
  minColumns = 0
}: {
  items: VaultAtAGlanceItem[]
  className?: string
  minColumns?: number
}) {
  const emptySlots = Math.max(0, minColumns - items.length)
  const emptySlotKeys = ['empty-a', 'empty-b', 'empty-c', 'empty-d'].slice(0, emptySlots)

  return (
    <dl className={cn('grid min-w-0 grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-3 pl-4', className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="mb-1 text-xs text-gray-500">{item.label}</dt>
          <dd className="min-w-0 truncate text-sm font-medium text-[#111111]">{item.value}</dd>
        </div>
      ))}
      {emptySlotKeys.map((key) => (
        <div key={key} aria-hidden="true" className="hidden md:block" />
      ))}
    </dl>
  )
}

export function MainInfoPanel(data: MainInfoPanelComponentProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(data.vaultAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const shortVaultAddress = `${data.vaultAddress.slice(0, 8)}...${data.vaultAddress.slice(-8)}`
  const metricItems = getVaultAtAGlanceItems(data)
  const primaryMetricItems = metricItems.filter((item) =>
    ['Est. APY', 'Historical APY', 'Total Supply'].includes(item.label)
  )
  const secondaryMetricItems = metricItems.filter((item) =>
    ['Management Fee', 'Performance Fee', 'Network', 'Vault Token'].includes(item.label)
  )

  return (
    <>
      <div
        ref={data.primaryHeaderRef}
        className="grid grid-cols-1 gap-4 bg-white px-4 py-2 sm:border-x sm:border-border sm:px-6 md:sticky md:z-20 md:grid-cols-[minmax(0,1fr)_minmax(36rem,0.95fr)] md:items-center"
        style={{ top: data.primaryHeaderStickyTop ?? 54 }}
      >
        <div className="min-w-0">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
            <h1 className="truncate text-2xl font-bold leading-tight">{data.vaultName}</h1>
            <div className="text-sm text-gray-500">{data.apiVersion}</div>
          </div>
        </div>
        <HeaderMetricGrid items={primaryMetricItems} className="grid-cols-3 md:grid-cols-4" minColumns={4} />
      </div>

      <div className="grid grid-cols-1 gap-4 bg-white px-4 pb-1 sm:border-x sm:border-border sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(36rem,0.95fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm text-gray-500">{data.vaultId}</div>
            <div className="inline-block bg-gray-100 px-2 py-1 text-xs">Deployed: {data.deploymentDate}</div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-[#111111]">{shortVaultAddress}</span>
            <button
              type="button"
              className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-700"
              onClick={handleCopy}
              aria-label="Copy vault address"
            >
              {copied ? <Check className="h-4 w-4 text-gray-400" /> : <Copy className="h-4 w-4" />}
            </button>
            {data.blockExplorerLink ? (
              <a
                href={data.blockExplorerLink}
                target="_blank"
                rel="noreferrer"
                className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-700"
                aria-label="Open vault address in block explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>

        <HeaderMetricGrid items={secondaryMetricItems} className="grid-cols-2 md:grid-cols-4" minColumns={4} />
      </div>

      {(data.navigation || data.yearnVaultLink) && (
        <div
          ref={data.tabsHeaderRef}
          className="flex flex-col gap-3 border-b border-border bg-white px-4 pt-0 sm:border-x sm:border-border sm:px-6 md:sticky md:z-20 md:flex-row md:items-stretch md:justify-between"
          style={{ top: data.tabsHeaderStickyTop ?? 54 }}
        >
          {data.navigation ? (
            <div className="flex min-w-0 flex-1 justify-center md:justify-end">{data.navigation}</div>
          ) : (
            <div />
          )}
          {data.yearnVaultLink ? (
            <a
              className="hidden shrink-0 items-center justify-center rounded-none bg-[#0657f9] px-4 py-2 text-sm text-white transition-colors hover:bg-[#0657f9]/90 md:inline-flex md:self-stretch"
              href={data.yearnVaultLink}
              target="_blank"
              rel="noreferrer"
            >
              Go to Vault
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          ) : null}
        </div>
      )}
    </>
  )
}
