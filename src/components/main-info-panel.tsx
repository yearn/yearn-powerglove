import { Check, Copy, ExternalLink } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ApyDisplayValue, MainInfoPanelProps } from '@/types/dataTypes'

const ApyMetricValue = ({ metric }: { metric: ApyDisplayValue }) => {
  if (!metric.tooltipItems?.length) {
    return <div className="tabular-nums">{metric.display}</div>
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="border-b border-dotted border-gray-400 bg-transparent p-0 text-left tabular-nums outline-none focus-visible:border-[#0657f9] focus-visible:ring-2 focus-visible:ring-[#0657f9]/30"
          >
            {metric.display}
          </button>
        </TooltipTrigger>
        <TooltipContent className="space-y-1.5">
          {metric.tooltipItems.map((item) => (
            <div key={item.label} className="flex min-w-48 items-center justify-between gap-5">
              <span className="text-gray-500">{item.label}</span>
              <span className="font-medium tabular-nums">
                {item.value}
                {item.detail ? <span className="ml-1.5 font-normal text-gray-500">({item.detail})</span> : null}
              </span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function Stat({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-1 text-sm text-gray-500">{label}</div>
      <div className="min-w-0 font-bold">{children}</div>
    </div>
  )
}

export function MainInfoPanel({ showAction = true, ...data }: MainInfoPanelProps & { showAction?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(data.vaultAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const vaultToken = (
    <div className="flex items-center gap-2">
      {data.vaultToken.icon ? (
        <img src={data.vaultToken.icon} alt={data.vaultToken.name} className="h-6 w-6 rounded-full" />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-white">?</div>
      )}
      <span>{data.vaultToken.name}</span>
    </div>
  )

  const network = (
    <div className="flex items-center gap-2">
      {data.network.icon ? (
        <img src={data.network.icon} alt={data.network.name} className="h-6 w-6 rounded-full" />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-white">?</div>
      )}
      <span>{data.network.name}</span>
    </div>
  )

  const vaultAddress = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate font-mono text-sm" title={data.vaultAddress}>
        {data.vaultAddress.slice(0, 5) + '...' + data.vaultAddress.slice(-4)}
      </span>
      <button
        type="button"
        className="shrink-0 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0657f9]"
        onClick={handleCopy}
        aria-label={copied ? 'Vault address copied' : 'Copy vault address'}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <a
        href={data.blockExplorerLink}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0657f9]"
        aria-label="View vault address on block explorer"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  )

  const renderTotalSupply = (compactClassName: string, fullClassName: string) => (
    <span title={data.totalSupply}>
      <span className={compactClassName}>{data.compactTotalSupply ?? data.totalSupply}</span>
      <span className={fullClassName}>{data.totalSupply}</span>
    </span>
  )
  return (
    <div className="bg-white sm:border sm:border-border sm:border-b-0 sm:border-t-0">
      <div className="px-4 pb-6 pt-3 sm:px-6">
        <div className="grid min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[1100px]:gap-x-12">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="text-sm text-gray-500">{data.vaultId}</div>
              <div className="inline-block bg-gray-100 px-2 py-1 text-xs">Deployed: {data.deploymentDate}</div>
            </div>
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
              <h1 className="text-3xl font-bold" data-vault-title-source>
                {data.vaultName}
              </h1>
              <div className="text-sm text-gray-500">{data.apiVersion}</div>
            </div>
          </div>

          <div className="w-full max-w-xl min-w-0 pt-3 min-[1100px]:col-start-1 min-[1100px]:row-start-2">
            <div className="grid min-w-0 grid-cols-2 content-start gap-x-6 gap-y-5 sm:grid-cols-3">
              <Stat label="Expected APY">
                <ApyMetricValue metric={data.oneDayAPY} />
              </Stat>
              <Stat label="7-day APY">
                <ApyMetricValue metric={data.sevenDayAPY} />
              </Stat>
              <Stat label="30-day APY">
                <ApyMetricValue metric={data.thirtyDayAPY} />
              </Stat>
              <Stat label="Total Supply">{renderTotalSupply('sm:hidden', 'hidden sm:inline')}</Stat>
              <Stat label="Management Fee">
                <span className="tabular-nums">{data.managementFee}</span>
              </Stat>
              <Stat label="Performance Fee">
                <span className="tabular-nums">{data.performanceFee}</span>
              </Stat>
              <Stat label="Network">{network}</Stat>
              <Stat label="Vault Token">{vaultToken}</Stat>
              <Stat label="Vault Address">{vaultAddress}</Stat>
            </div>
          </div>

          <div className="mt-10 min-w-0 min-[1100px]:col-start-2 min-[1100px]:row-start-2 min-[1100px]:mt-0 min-[1100px]:pt-3">
            <div className="min-w-0">
              <p className="max-w-2xl whitespace-pre-line text-gray-600">{data.description}</p>
            </div>

            {showAction ? (
              <a
                className="mt-4 inline-flex shrink-0 items-center rounded-none bg-[#0657f9] px-4 py-2 text-white hover:bg-[#0657f9]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0657f9] focus-visible:ring-offset-2"
                href={data.yearnVaultLink}
                target="_blank"
                rel="noreferrer"
              >
                View vault on yearn.fi <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
