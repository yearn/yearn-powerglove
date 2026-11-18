import { Check, Copy, ExternalLink } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/components/ui/use-mobile'
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
      <div className="mb-0.5 text-[10px] text-gray-500 sm:mb-1 sm:text-sm">{label}</div>
      <div className="min-w-0 text-base font-bold">{children}</div>
    </div>
  )
}

export function VaultIdentity({
  data
}: {
  data: Pick<MainInfoPanelProps, 'vaultId' | 'deploymentDate' | 'deploymentLabel' | 'vaultName' | 'apiVersion'>
}) {
  return (
    <>
      <div className="mb-1 flex flex-wrap items-center gap-2 sm:mb-2">
        <div className="text-xs text-gray-500 sm:text-sm">{data.vaultId}</div>
        <div className="inline-block bg-gray-100 px-2 py-0.5 text-[10px] sm:py-1 sm:text-xs">
          {data.deploymentLabel ?? 'Deployed'}: {data.deploymentDate}
        </div>
      </div>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:mb-2 sm:items-end sm:gap-3">
        <h1 className="min-w-0 text-2xl font-bold sm:text-3xl" data-vault-title-source>
          {data.vaultName}
        </h1>
        <div className="shrink-0 text-xs text-gray-500 sm:text-sm">{data.apiVersion}</div>
      </div>
    </>
  )
}

export function MainInfoPanel({
  showAction = true,
  showIdentity = true,
  ...data
}: MainInfoPanelProps & { showAction?: boolean; showIdentity?: boolean }) {
  const isMobile = useIsMobile()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(data.vaultAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const vaultToken = (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      {data.vaultToken.icon ? (
        <img
          src={data.vaultToken.icon}
          alt={data.vaultToken.name}
          className="h-4 w-4 shrink-0 rounded-full sm:h-6 sm:w-6"
        />
      ) : (
        <div className="flex h-4 w-4 shrink-0 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-gray-300 text-white">
          ?
        </div>
      )}
      <span className="truncate" title={data.vaultToken.name}>
        {data.vaultToken.name}
      </span>
    </div>
  )

  const network = (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      {data.network.icon ? (
        <img src={data.network.icon} alt={data.network.name} className="h-4 w-4 shrink-0 rounded-full sm:h-6 sm:w-6" />
      ) : (
        <div className="flex h-4 w-4 shrink-0 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-gray-300 text-white">
          ?
        </div>
      )}
      <span className="truncate" title={data.network.name}>
        {data.network.name}
      </span>
    </div>
  )

  const desktopVaultAddress = (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      <span className="truncate font-mono text-xs sm:text-sm" title={data.vaultAddress}>
        <span className="sm:hidden">{data.vaultAddress.slice(0, 4) + '…' + data.vaultAddress.slice(-3)}</span>
        <span className="hidden sm:inline">{data.vaultAddress.slice(0, 5) + '...' + data.vaultAddress.slice(-4)}</span>
      </span>
      <button
        type="button"
        className="shrink-0 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0657f9]"
        onClick={handleCopy}
        aria-label={copied ? 'Vault address copied' : 'Copy vault address'}
      >
        {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
      </button>
      <a
        href={data.blockExplorerLink}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0657f9]"
        aria-label="View vault address on block explorer"
      >
        <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
      </a>
    </div>
  )

  const vaultAddress = isMobile ? (
    <Drawer shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="text-base font-bold text-left underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0657f9]"
          aria-label="Vault address actions"
        >
          {data.vaultAddress.slice(0, 4)}…{data.vaultAddress.slice(-3)}
        </button>
      </DrawerTrigger>
      <DrawerContent className="bg-white">
        <DrawerHeader>
          <DrawerTitle>Vault address</DrawerTitle>
          <DrawerDescription className="break-all font-mono">{data.vaultAddress}</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-2 px-4">
          <button type="button" onClick={handleCopy} className="border border-border px-4 py-3 text-left">
            {copied ? 'Copied' : 'Copy address'}
          </button>
          <a href={data.blockExplorerLink} target="_blank" rel="noreferrer" className="border border-border px-4 py-3">
            View on block explorer
          </a>
        </div>
        <DrawerFooter>
          <DrawerClose className="border border-border px-4 py-3">Done</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ) : (
    desktopVaultAddress
  )

  const renderTotalSupply = (compactClassName: string, fullClassName: string) => (
    <span title={data.totalSupply}>
      <span className={compactClassName}>{data.compactTotalSupply ?? data.totalSupply}</span>
      <span className={fullClassName}>{data.totalSupply}</span>
    </span>
  )
  return (
    <div className="bg-white sm:border sm:border-border sm:border-b-0 sm:border-t-0">
      <div className="px-4 pb-3 pt-2 sm:px-6 sm:pb-6 sm:pt-3">
        <div className="grid min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[1100px]:gap-x-12">
          <div className="min-w-0">{showIdentity && <VaultIdentity data={data} />}</div>

          <div className="w-full max-w-xl min-w-0 pt-2 sm:pt-3 min-[1100px]:col-start-1 min-[1100px]:row-start-2">
            <div className="grid min-w-0 grid-cols-3 content-start gap-x-2 gap-y-2 sm:gap-x-6 sm:gap-y-5">
              <Stat label={data.expectedApyLabel ?? 'Expected APY'}>
                <ApyMetricValue metric={data.oneDayAPY} />
              </Stat>
              <Stat label="7-day APY">
                <ApyMetricValue metric={data.sevenDayAPY} />
              </Stat>
              <Stat label="30-day APY">
                <ApyMetricValue metric={data.thirtyDayAPY} />
              </Stat>
              <Stat label={data.tvlLabel ?? 'Total Supply'}>{renderTotalSupply('sm:hidden', 'hidden sm:inline')}</Stat>
              <Stat label="Management Fee">
                <span className="tabular-nums">{data.managementFee}</span>
              </Stat>
              <Stat label="Performance Fee">
                <span className="tabular-nums">{data.performanceFee}</span>
              </Stat>
              <Stat label="Network">{network}</Stat>
              <Stat label="Vault Token">{vaultToken}</Stat>
              <Stat label={data.vaultAddressLabel ?? 'Vault Address'}>{vaultAddress}</Stat>
            </div>
          </div>

          <div className="mt-3 min-w-0 sm:mt-10 min-[1100px]:col-start-2 min-[1100px]:row-start-2 min-[1100px]:mt-0 min-[1100px]:pt-3">
            <div className="min-w-0">
              <p className="max-w-2xl whitespace-pre-line text-xs leading-4 text-gray-600 sm:text-base sm:leading-6">
                {data.description}
              </p>
            </div>

            {showAction ? (
              <a
                className="mt-3 text-xs sm:mt-4 sm:text-base inline-flex shrink-0 items-center rounded-none bg-[#0657f9] px-4 py-2 text-white hover:bg-[#0657f9]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0657f9] focus-visible:ring-offset-2"
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
