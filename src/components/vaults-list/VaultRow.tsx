import { Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getChainIdByName } from '@/constants/chains'
import { cn } from '@/lib/utils'
import type { ApyDisplayValue } from '@/types/dataTypes'

export interface VaultListData {
  isJuniorMockup?: boolean
  isEquityMockup?: boolean
  isTranchedMockup?: boolean
  id: string
  name: string
  chain: string
  chainIconUri: string
  token: string
  tokenUri: string
  type: string
  estimatedAPY: ApyDisplayValue
  estimatedApySortValue: number
  APY: string
  desktopThirtyDayAPY: ApyDisplayValue
  apySortValue: number
  apyRawValue: number
  tvl: string
  tvlUsd?: number | null
  apiVersion?: string
  isRetired?: boolean
}

export type VaultIconStyle = 'behind' | 'badge'

interface VaultRowProps {
  iconStyle?: VaultIconStyle
  vault: VaultListData
}

interface VaultMobileListRowProps extends VaultRowProps {
  isLast?: boolean
}

export const MOBILE_VAULT_ROW_HEIGHT = 72

const TYPE_META_LABELS: Record<string, string> = {
  'Single Asset': 'Single Asset',
  'Tokenized Strategy': 'Tokenized Strategy',
  'Factory Vault': 'Factory',
  'Legacy Vault': 'Legacy',
  'External Vault': 'External'
}

const TYPE_META_CODES: Record<string, string> = {
  'Single Asset': 'SA',
  'Tokenized Strategy': 'TS',
  'Factory Vault': 'FV',
  'Legacy Vault': 'LV',
  'External Vault': 'XV'
}

export const VaultIcon = ({
  src,
  alt,
  fallback,
  className
}: {
  src?: string
  alt: string
  fallback: string
  className: string
}) => {
  const [hasError, setHasError] = React.useState(false)

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold uppercase text-gray-600',
          className
        )}
      >
        {fallback}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={cn('object-contain', className)}
    />
  )
}

const VaultLogoPair = ({
  vault,
  mobile = false,
  iconStyle = 'badge'
}: {
  vault: VaultListData
  mobile?: boolean
  iconStyle?: VaultIconStyle
}) => (
  <div className={cn('relative isolate shrink-0', mobile ? 'h-10 w-14' : 'h-[30px] w-[42px]')}>
    <VaultIcon
      src={vault.chainIconUri}
      alt={vault.chain}
      fallback={vault.chain.slice(0, 1)}
      className={cn(
        'absolute',
        iconStyle === 'badge'
          ? ['bottom-0 translate-y-1/4 z-20 opacity-100', mobile ? 'left-1 h-6 w-6' : 'left-[3px] h-[18px] w-[18px]']
          : ['left-0 top-0 z-0 opacity-50', mobile ? 'h-8 w-8' : 'h-6 w-6']
      )}
    />
    <VaultIcon
      src={vault.tokenUri}
      alt={vault.token}
      fallback={vault.token.slice(0, 2)}
      className={cn('absolute top-0 z-10', mobile ? 'left-4 h-10 w-10' : 'left-3 h-[30px] w-[30px]')}
    />
  </div>
)

const CompactMetaItem = ({ icon, label }: { icon?: React.ReactNode; label: string }) => {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-gray-500">
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </div>
  )
}

const getTypeLabel = (type: string): string => TYPE_META_LABELS[type] ?? type.replace(/ Vault$/, '')
const getTypeCode = (type: string): string => TYPE_META_CODES[type] ?? type.slice(0, 2).toUpperCase()

export const DesktopApyValue = ({ metric }: { metric: ApyDisplayValue }) => {
  if (!metric.tooltipItems?.length) {
    return <span className="whitespace-nowrap tabular-nums">{metric.display}</span>
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="whitespace-nowrap border-b border-dotted border-gray-400 tabular-nums">
            {metric.display}
          </span>
        </TooltipTrigger>
        <TooltipContent className="space-y-1.5">
          {metric.tooltipItems.map((item) => (
            <div key={item.label} className="flex min-w-44 items-center justify-between gap-5">
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

export function RetiredVaultWarning() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label="retired"
            className="inline-flex shrink-0 text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TriangleAlert size={14} aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>retired</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export const VaultRow: React.FC<VaultRowProps> = ({ vault, iconStyle = 'badge' }) => {
  return (
    <Link
      to={
        vault.isEquityMockup
          ? '/mockups/equity-yvusd'
          : vault.isJuniorMockup
            ? '/mockups/junior-yvusd'
            : vault.isTranchedMockup
              ? '/mockups/tranched-vault'
              : '/vaults/$chainId/$vaultAddress'
      }
      params={
        vault.isTranchedMockup
          ? undefined
          : {
              chainId: (getChainIdByName(vault.chain) || 1).toString(),
              vaultAddress: vault.id
            }
      }
      className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)] gap-x-6 pl-6 pr-10 py-2 border-b hover:bg-muted/40 transition-colors cursor-pointer bg-white"
      style={{ height: '50px' }}
    >
      <div className="min-w-0 flex-[2] text-left flex items-center gap-2">
        <VaultLogoPair vault={vault} iconStyle={iconStyle} />
        <span className="truncate">{vault.name}</span>
        {vault.isRetired && <RetiredVaultWarning />}
      </div>
      <div className="relative -left-24 grid w-full min-w-0 max-w-96 grid-cols-3 items-center gap-x-1 justify-self-end">
        <div className="min-w-0 flex-1 text-right flex items-center justify-end text-sm">
          <DesktopApyValue metric={vault.estimatedAPY} />
        </div>
        <div className="min-w-0 flex-1 text-right flex items-center justify-end text-sm">
          <DesktopApyValue metric={vault.desktopThirtyDayAPY} />
        </div>
        <div className="min-w-0 flex-1 text-right flex items-center justify-end">{vault.tvl}</div>
      </div>
      <div className="grid w-full min-w-0 max-w-96 grid-cols-3 items-center gap-x-1 justify-self-end">
        <div className="min-w-0 text-right" title={vault.token}>
          <span className="block truncate">{vault.token}</span>
        </div>
        <div className="min-w-0 text-right">{vault.chain}</div>
        <div className="min-w-0 text-right text-xs">{vault.type}</div>
      </div>
    </Link>
  )
}

export const VaultMobileListRow: React.FC<VaultMobileListRowProps> = ({
  vault,
  isLast = false,
  iconStyle = 'badge'
}) => {
  return (
    <Link
      to={
        vault.isEquityMockup
          ? '/mockups/equity-yvusd'
          : vault.isJuniorMockup
            ? '/mockups/junior-yvusd'
            : vault.isTranchedMockup
              ? '/mockups/tranched-vault'
              : '/vaults/$chainId/$vaultAddress'
      }
      params={
        vault.isTranchedMockup
          ? undefined
          : {
              chainId: (getChainIdByName(vault.chain) || 1).toString(),
              vaultAddress: vault.id
            }
      }
      className={cn(
        'block h-full bg-white px-3 py-2.5 transition-colors hover:bg-gray-50',
        !isLast && 'border-b border-gray-100'
      )}
    >
      <div className="grid grid-cols-[minmax(0,1.8fr)_4.5rem_5rem] items-center gap-x-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <VaultLogoPair vault={vault} mobile iconStyle={iconStyle} />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold leading-4 text-gray-950">{vault.name}</span>
                {vault.isRetired && <RetiredVaultWarning />}
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <CompactMetaItem label={vault.chain} />
                <CompactMetaItem label={vault.token} />
                <CompactMetaItem
                  icon={
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-900 text-[8px] font-semibold uppercase text-white">
                      {getTypeCode(vault.type)}
                    </span>
                  }
                  label={getTypeLabel(vault.type)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 text-right">
          <span className="sr-only">30D APY</span>
          <div className="truncate text-[13px] font-semibold tabular-nums text-gray-950">{vault.APY}</div>
        </div>

        <div className="min-w-0 text-right">
          <span className="sr-only">TVL</span>
          <div className="truncate text-[13px] font-semibold tabular-nums text-gray-950">{vault.tvl}</div>
        </div>
      </div>
    </Link>
  )
}
