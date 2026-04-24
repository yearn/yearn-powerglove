import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import React from 'react'
import { formatAllocationPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Strategy } from '@/types/dataTypes'
import type { KongVaultSnapshotComposition } from '@/types/kong'
import { getKongNormalizedScalarValue, type NormalizationContext } from './KongDataTab'

interface StrategyRowProps {
  strategy: Strategy
  isExpanded: boolean
  onToggle: () => void
  isUnallocated?: boolean
  composition?: KongVaultSnapshotComposition
  kongNormalizationContext?: NormalizationContext | null
}

type CompositionScalar = string | number | boolean | null
type CompositionValue = CompositionScalar | CompositionValue[] | { [key: string]: CompositionValue | undefined }

interface CompositionDetailRow {
  id: string
  label: string
  path: string[]
  value: CompositionScalar
}

const detailRowClassName = 'grid gap-1 py-2.5 sm:grid-cols-[minmax(8rem,10rem)_minmax(0,1fr)] sm:gap-3'
const detailLabelClassName = 'text-[11px] uppercase tracking-[0.1em] text-[#808080]'
const detailLinkClassName =
  'inline-flex min-w-0 items-center gap-1 text-[#4f4f4f] underline decoration-[#d9d9d9] underline-offset-4 transition-colors hover:text-black'

const isCompositionRecord = (value: CompositionValue | undefined): value is { [key: string]: CompositionValue } => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isCompositionScalar = (value: CompositionValue | undefined): value is CompositionScalar => {
  return value === null || ['boolean', 'number', 'string'].includes(typeof value)
}

const isAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value)

const isUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const isNumericString = (value: string): boolean => /^-?\d+(\.\d+)?$/.test(value)

const titleCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((segment) => {
      const lower = segment.toLowerCase()
      if (['apy', 'apr', 'tvl', 'usd', 'uri', 'pps', 'id'].includes(lower)) {
        return lower.toUpperCase()
      }

      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
    })
    .join(' ')

const normalizeCompositionPathSegment = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const hiddenCompositionLeafKeys = new Set(['name', 'status', 'totalgain', 'totalloss', 'totalgainusd', 'totallossusd'])

const shouldHideCompositionPath = (path: string[]): boolean => {
  const normalizedPath = path.map(normalizeCompositionPathSegment)
  const normalizedLeaf = normalizedPath[normalizedPath.length - 1] ?? ''

  if (hiddenCompositionLeafKeys.has(normalizedLeaf)) {
    return true
  }

  if (normalizedPath.join('.') === 'performance.oracle.apr') {
    return true
  }

  if (normalizedPath.includes('historical')) {
    return true
  }

  return false
}

const formatNumberLike = (value: number | string): string => {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)
  }

  if (!isNumericString(value)) {
    return value
  }

  if (/^-?\d+$/.test(value)) {
    try {
      return BigInt(value).toLocaleString('en-US')
    } catch {
      return value
    }
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return value
  }

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(numeric)
}

const flattenCompositionRows = (value: CompositionValue, path: string[] = []): CompositionDetailRow[] => {
  if (!isCompositionRecord(value)) {
    return []
  }

  const rows: CompositionDetailRow[] = []

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue
    }

    const nextPath = [...path, key]

    if (shouldHideCompositionPath(nextPath)) {
      continue
    }

    if (isCompositionRecord(entry)) {
      rows.push(...flattenCompositionRows(entry, nextPath))
      continue
    }

    if (Array.isArray(entry)) {
      rows.push({
        id: nextPath.join('.'),
        label: titleCase(nextPath.join(' ')),
        path: nextPath,
        value: entry.length === 1 ? '1 entry' : `${entry.length} entries`
      })
      continue
    }

    if (isCompositionScalar(entry)) {
      rows.push({
        id: nextPath.join('.'),
        label: titleCase(nextPath.join(' ')),
        path: nextPath,
        value: entry
      })
    }
  }

  return rows
}

const CompositionValueDisplay = ({
  row,
  normalizationContext
}: {
  row: CompositionDetailRow
  normalizationContext?: NormalizationContext | null
}) => {
  const { value } = row

  if (value === null) {
    return <span className="text-[#9a9a9a]">null</span>
  }

  if (typeof value === 'boolean') {
    return <span className="font-mono tabular-nums">{value ? 'true' : 'false'}</span>
  }

  if (typeof value === 'string' && isUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1 text-[#4f4f4f] underline decoration-[#d9d9d9] underline-offset-4 transition-colors hover:text-black"
      >
        <span className="break-all">{value}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    )
  }

  if (typeof value === 'string' && isAddress(value)) {
    const baseUrl = normalizationContext?.blockExplorerBaseUrl
    const href = baseUrl ? `${baseUrl}/address/${value}` : null

    if (!href) {
      return <span className="break-all font-mono text-[#111111]">{value}</span>
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-w-0 items-center gap-1 text-[#4f4f4f] underline decoration-[#d9d9d9] underline-offset-4 transition-colors hover:text-black"
      >
        <span className="break-all font-mono">{value}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    )
  }

  const normalized =
    normalizationContext && (typeof value === 'string' || typeof value === 'number')
      ? getKongNormalizedScalarValue({
          path: ['composition', ...row.path],
          value,
          context: normalizationContext
        })
      : null

  if (normalized) {
    const [primaryValue, ...referenceParts] = normalized.value.split(' | ')
    const referenceValue = referenceParts.length > 0 ? referenceParts.join(' | ') : String(value)

    return (
      <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums">
        <span className="break-all font-medium text-[#111111]">{primaryValue}</span>
        <span className="text-[#9a9a9a]">|</span>
        <span className="break-all font-mono text-[12px] font-normal text-[#9a9a9a]">{referenceValue}</span>
      </span>
    )
  }

  return <span className="break-all font-medium tabular-nums text-[#111111]">{formatNumberLike(value)}</span>
}

export const StrategyRow: React.FC<StrategyRowProps> = React.memo(
  ({ strategy, isExpanded, onToggle, isUnallocated = false, composition, kongNormalizationContext }) => {
    const compositionRows = React.useMemo(
      () => (composition ? flattenCompositionRows(composition as CompositionValue) : []),
      [composition]
    )
    const hasDataLink = strategy.details.isVault
    const hasVaultLink = strategy.details.isVault && strategy.details.isEndorsed
    const hasDetailRows = hasDataLink || hasVaultLink || compositionRows.length > 0
    const dataPath = `/vaults/${strategy.details.chainId}/${strategy.details.vaultAddress}`
    const dataUrl = typeof window !== 'undefined' ? `${window.location.origin}${dataPath}` : dataPath
    const yearnVaultUrl = `https://yearn.fi/v3/${strategy.details.chainId}/${strategy.details.vaultAddress}`

    return (
      <div
        className={cn('border-t border-[#f5f5f5]', (strategy.allocationPercent === 0 || isUnallocated) && 'opacity-50')}
      >
        <div
          className={cn('cursor-pointer p-3 hover:bg-[#f5f5f5]/50', isExpanded && 'bg-[#f5f5f5]/30')}
          onClick={onToggle}
        >
          <div className="md:hidden">
            <div className="flex items-start gap-3">
              <div className="flex w-5 justify-center pt-1">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {strategy.tokenIconUri ? (
                    <img src={strategy.tokenIconUri} alt={strategy.tokenSymbol} className="h-6 w-6 shrink-0" />
                  ) : (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-300 text-white">
                      ?
                    </div>
                  )}
                  <span className="font-medium leading-5">{strategy.name}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[#808080]">Allocation %</div>
                    <div className="mt-1 font-medium">{formatAllocationPercent(strategy.allocationPercent)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[#808080]">amount</div>
                    <div className="mt-1 font-medium">{strategy.allocationAmount}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.08em] text-[#808080]">APY</div>
                    <div className="mt-1 font-medium">{strategy.estimatedAPY} APY</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden items-center md:flex">
            <div className="flex w-8 justify-center">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
              )}
            </div>
            <div className="w-[calc(50%-2rem)] flex items-center gap-2">
              <div className="flex items-center">
                {strategy.tokenIconUri ? (
                  <img src={strategy.tokenIconUri} alt={strategy.tokenSymbol} className="h-6 w-6" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-white">?</div>
                )}
              </div>
              <span className="font-medium">{strategy.name}</span>
            </div>
            <div className="w-1/6 text-right">{formatAllocationPercent(strategy.allocationPercent)}</div>
            <div className="w-1/6 text-right">{strategy.allocationAmount}</div>
            <div className="w-1/6 text-right">{strategy.estimatedAPY} APY</div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-[#f5f5f5] bg-[#f5f5f5]/30 px-4 py-4 md:px-3">
            <div className="pl-[60px] md:pl-16">
              {hasDetailRows && (
                <div>
                  <dl className="divide-y divide-[#f0f0f0]">
                    {hasDataLink && (
                      <div className={detailRowClassName}>
                        <dt className={detailLabelClassName}>Data</dt>
                        <dd className="min-w-0 text-[13px]">
                          <Link
                            to="/vaults/$chainId/$vaultAddress"
                            params={{
                              chainId: strategy.details.chainId.toString(),
                              vaultAddress: strategy.details.vaultAddress
                            }}
                            className={detailLinkClassName}
                          >
                            <span className="break-all">{dataUrl}</span>
                          </Link>
                        </dd>
                      </div>
                    )}

                    {hasVaultLink && (
                      <div className={detailRowClassName}>
                        <dt className={detailLabelClassName}>Vault</dt>
                        <dd className="min-w-0 text-[13px]">
                          <a
                            href={yearnVaultUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={detailLinkClassName}
                          >
                            <span className="break-all">{yearnVaultUrl}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </dd>
                      </div>
                    )}

                    {compositionRows.map((row) => (
                      <div key={row.id} className={detailRowClassName}>
                        <dt className={detailLabelClassName}>{row.label}</dt>
                        <dd className="min-w-0 text-[13px]">
                          <CompositionValueDisplay row={row} normalizationContext={kongNormalizationContext} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)
