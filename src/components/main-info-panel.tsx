import { Check, Copy, ExternalLink } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import type { MainInfoPanelProps } from '@/types/dataTypes'

type MainInfoPanelComponentProps = MainInfoPanelProps & {
  navigation?: ReactNode
}

export type VaultAtAGlanceItem = {
  label: string
  value: ReactNode
}

export function getVaultAtAGlanceItems(data: MainInfoPanelProps): VaultAtAGlanceItem[] {
  return [
    { label: 'Est. APY', value: data.oneDayAPY },
    { label: '30-day APY', value: data.thirtyDayAPY },
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

export function MainInfoPanel(data: MainInfoPanelComponentProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(data.vaultAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const shortVaultAddress = `${data.vaultAddress.slice(0, 8)}...${data.vaultAddress.slice(-8)}`
  const metricItems = getVaultAtAGlanceItems(data)

  return (
    <div className="border-b border-border bg-white sm:border-x sm:border-border">
      <div className="grid grid-cols-1 gap-5 px-4 sm:px-6 md:grid-cols-2">
        <div className="min-w-0 pt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="text-sm text-gray-500">{data.vaultId}</div>
            <div className="bg-gray-100 text-xs inline-block px-2 py-1">Deployed: {data.deploymentDate}</div>
          </div>

          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
            <h1 className="truncate text-2xl font-bold leading-tight">{data.vaultName}</h1>
            <div className="text-sm text-gray-500">{data.apiVersion}</div>
          </div>

          <div className="flex items-center gap-2 text-sm">
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

        <div className="hidden min-w-0 md:block">
          <VaultAtAGlance items={metricItems} className="pl-6 lg:grid-cols-4" />
        </div>
      </div>

      {(data.navigation || data.yearnVaultLink) && (
        <div className="flex flex-col gap-3 px-4 pt-0 sm:px-6 md:flex-row md:items-stretch md:justify-between">
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
    </div>
  )
}
