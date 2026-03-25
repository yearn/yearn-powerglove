import { Link } from '@tanstack/react-router'
import React from 'react'
import { getChainIdByName } from '@/constants/chains'
import { cn } from '@/lib/utils'
import { OptimizedImage } from '../ui/OptimizedImage'

export interface VaultListData {
  id: string
  name: string
  chain: string
  chainIconUri: string
  token: string
  tokenUri: string
  type: string
  APY: string
  apySortValue: number
  apyRawValue: number
  tvl: string
}

interface VaultRowProps {
  vault: VaultListData
}

interface VaultMobileListRowProps extends VaultRowProps {
  isLast?: boolean
}

export const MOBILE_VAULT_ROW_HEIGHT = 72

const TYPE_META_LABELS: Record<string, string> = {
  'Allocator Vault': 'Allocator',
  'Strategy Vault': 'Strategy',
  'Factory Vault': 'Factory',
  'Legacy Vault': 'Legacy',
  'External Vault': 'External'
}

const TYPE_META_CODES: Record<string, string> = {
  'Allocator Vault': 'AV',
  'Strategy Vault': 'SV',
  'Factory Vault': 'FV',
  'Legacy Vault': 'LV',
  'External Vault': 'XV'
}

const VaultIcon = ({
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
      className={cn('rounded-full object-cover', className)}
    />
  )
}

const CompactMetaItem = ({ icon, label }: { icon: React.ReactNode; label: string }) => {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-gray-500">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  )
}

const getTypeLabel = (type: string): string => TYPE_META_LABELS[type] ?? type.replace(/ Vault$/, '')
const getTypeCode = (type: string): string => TYPE_META_CODES[type] ?? type.slice(0, 2).toUpperCase()

export const VaultRow: React.FC<VaultRowProps> = ({ vault }) => {
  return (
    <Link
      to="/vaults/$chainId/$vaultAddress"
      params={{
        chainId: (getChainIdByName(vault.chain) || 1).toString(),
        vaultAddress: vault.id
      }}
      className="flex px-6 py-2 border-b hover:bg-muted/40 transition-colors cursor-pointer bg-white"
      style={{ height: '50px' }}
    >
      <div className="flex-[2] text-left flex items-center">{vault.name}</div>
      <div className="flex-1 flex justify-end items-center gap-2">
        {vault.chain}
        {vault.chainIconUri ? (
          <OptimizedImage src={vault.chainIconUri} alt={vault.chain} className="w-6 h-6" fallbackClassName="w-6 h-6" />
        ) : (
          <div className="w-6 h-6 flex items-center justify-center bg-gray-300 rounded-full text-white">?</div>
        )}
      </div>
      <div className="flex-1 flex justify-end items-center gap-2">
        {vault.token}
        {vault.tokenUri ? (
          <OptimizedImage src={vault.tokenUri} alt={vault.token} className="w-6 h-6" fallbackClassName="w-6 h-6" />
        ) : (
          <div className="w-6 h-6 flex items-center justify-center bg-gray-300 rounded-full">❓</div>
        )}
      </div>
      <div className="flex-1 text-right flex items-center justify-end">{vault.type}</div>
      <div className="flex-1 text-right flex items-center justify-end">{vault.APY}</div>
      <div className="flex-1 text-right flex items-center justify-end">{vault.tvl}</div>
    </Link>
  )
}

export const VaultMobileListRow: React.FC<VaultMobileListRowProps> = ({ vault, isLast = false }) => {
  return (
    <Link
      to="/vaults/$chainId/$vaultAddress"
      params={{
        chainId: (getChainIdByName(vault.chain) || 1).toString(),
        vaultAddress: vault.id
      }}
      className={cn(
        'block h-full bg-white px-3 py-2.5 transition-colors hover:bg-gray-50',
        !isLast && 'border-b border-gray-100'
      )}
    >
      <div className="grid grid-cols-[minmax(0,1.8fr)_4.5rem_5rem] items-center gap-x-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative h-8 w-8 shrink-0">
              <VaultIcon
                src={vault.tokenUri}
                alt={vault.token}
                fallback={vault.token.slice(0, 2)}
                className="h-8 w-8 border border-gray-100 bg-white"
              />
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 ring-1 ring-gray-200">
                <VaultIcon
                  src={vault.chainIconUri}
                  alt={vault.chain}
                  fallback={vault.chain.slice(0, 1)}
                  className="h-3 w-3"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-4 text-gray-950">{vault.name}</div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <CompactMetaItem
                  icon={
                    <VaultIcon
                      src={vault.chainIconUri}
                      alt={vault.chain}
                      fallback={vault.chain.slice(0, 1)}
                      className="h-3 w-3"
                    />
                  }
                  label={vault.chain}
                />
                <CompactMetaItem
                  icon={
                    <VaultIcon
                      src={vault.tokenUri}
                      alt={vault.token}
                      fallback={vault.token.slice(0, 2)}
                      className="h-3 w-3"
                    />
                  }
                  label={vault.token}
                />
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
