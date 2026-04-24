import { ExternalLink } from 'lucide-react'
import * as React from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { CHAIN_ID_TO_BLOCK_EXPLORER, CHAIN_ID_TO_NAME, type ChainId } from '@/constants/chains'
import { getKongVaultSnapshotUrl } from '@/lib/kong-rest'
import { cn } from '@/lib/utils'
import type { KongVaultSnapshot } from '@/types/kong'

type StructuredValue = string | number | boolean | null | undefined | StructuredValue[] | StructuredRecord

type StructuredRecord = {
  [key: string]: StructuredValue
}

interface KongDataTabProps {
  snapshot: KongVaultSnapshot | null
}

interface RowDefinition {
  id: string
  label: string
  labelAddress?: string
  value: string | number | boolean | null | undefined
  path: string[]
  parent?: StructuredRecord
}

interface SectionDefinition {
  key: string
  label: string
  value: StructuredValue
}

type DisplayItem =
  | {
      kind: 'row'
      row: RowDefinition
    }
  | {
      kind: 'section'
      section: SectionDefinition
    }

interface DisplayModel {
  items: DisplayItem[]
}

export interface NormalizationContext {
  assetDecimals: number | null
  assetSymbol: string | null
  blockExplorerBaseUrl: string | null
  chainId: number | null
  strategyNameByAddress: Record<string, string>
  vaultDecimals: number | null
  vaultSymbol: string | null
}

export interface NormalizedScalarValue {
  value: string
}

const overviewKeys = ['chainId', 'address', 'name', 'symbol', 'apiVersion', 'inceptTime', 'totalAssets', 'totalDebt']
const overviewKeySet = new Set<string>(overviewKeys)
const CARET_OFFSET_PX = 24
const NESTED_INDENT_PX = 16

const orderedTopLevelKeys = [
  ...overviewKeys,
  'performance',
  'composition',
  'asset',
  'apy',
  'tvl',
  'fees',
  'meta',
  'debts',
  'strategies',
  'staking',
  'inclusion'
]

const sectionLabels: Record<string, string> = {
  asset: 'Asset',
  apy: 'APY',
  composition: 'Composition',
  debts: 'Debts',
  fees: 'Fees',
  inclusion: 'Inclusion',
  meta: 'Meta',
  performance: 'Performance',
  staking: 'Staking',
  strategies: 'Strategies',
  tvl: 'TVL'
}

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

const isRecord = (value: StructuredValue): value is StructuredRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isScalar = (value: StructuredValue): value is string | number | boolean | null | undefined => {
  return !Array.isArray(value) && !isRecord(value)
}

const isUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const isAddress = (value: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(value)

const isNumericString = (value: string): boolean => /^-?\d+(\.\d+)?$/.test(value)

const formatAddressDisplay = (value: string): string => {
  if (!isAddress(value)) {
    return value
  }

  return value
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

const normalizeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const normalizeAddressKey = (value: string): string => value.toLowerCase()

const getScalarFromRecord = (record: StructuredRecord | undefined, key: string): string | number | null => {
  const value = record?.[key]
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return null
}

const parseFiniteNumber = (value: string | number): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const parseIntegerValue = (value: string | number): bigint | null => {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      return null
    }

    return BigInt(value)
  }

  if (!/^-?\d+$/.test(value)) {
    return null
  }

  try {
    return BigInt(value)
  } catch {
    return null
  }
}

const MAX_UINT256 = (1n << 256n) - 1n
const MAX_SENTINEL_THRESHOLD = MAX_UINT256 / 2n

const isMaxSentinelValue = (value: string | number): boolean => {
  const integerValue = parseIntegerValue(value)
  return integerValue !== null && integerValue >= MAX_SENTINEL_THRESHOLD
}

const parseDecimals = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null
  }

  const numeric = parseFiniteNumber(value)
  if (numeric === null || !Number.isInteger(numeric) || numeric < 0 || numeric > 36) {
    return null
  }

  return numeric
}

const formatGroupedInteger = (value: string): string => {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatBaseUnitAmount = (
  value: string | number,
  decimals: number,
  symbol: string | null,
  suffix = ''
): string | null => {
  const integerValue = parseIntegerValue(value)
  if (integerValue === null) {
    return null
  }

  const isNegative = integerValue < 0n
  const absoluteValue = isNegative ? -integerValue : integerValue
  const divisor = 10n ** BigInt(decimals)
  const whole = absoluteValue / divisor
  const fraction = absoluteValue % divisor
  const sign = isNegative ? '-' : ''
  const symbolSuffix = symbol ? ` ${symbol}` : ''
  const fullSuffix = `${symbolSuffix}${suffix}`

  if (decimals === 0 || fraction === 0n) {
    return `${sign}${formatGroupedInteger(whole.toString())}${fullSuffix}`
  }

  const maxFractionDigits = 8
  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  const trimmedFraction = fractionText.slice(0, maxFractionDigits).replace(/0+$/, '')

  if (trimmedFraction.length === 0) {
    const lowerBound = `0.${'0'.repeat(maxFractionDigits - 1)}1`
    return `${sign}<${lowerBound}${fullSuffix}`
  }

  return `${sign}${formatGroupedInteger(whole.toString())}.${trimmedFraction}${fullSuffix}`
}

const formatScaledIntegerAmount = (
  value: string | number,
  scaleDecimals: number,
  symbol: string | null,
  suffix = ''
): string | null => {
  return formatBaseUnitAmount(value, scaleDecimals, symbol, suffix)
}

const formatPercentValue = (percent: number): string => {
  const abs = Math.abs(percent)
  const maximumFractionDigits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(percent)}%`
}

const formatUsdValue = (value: number): string => {
  const abs = Math.abs(value)
  const maximumFractionDigits = abs >= 1 ? 2 : 6
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)}`
}

const formatDurationSeconds = (value: string | number): string | null => {
  const numericValue = parseFiniteNumber(value)
  if (numericValue === null || numericValue < 0) {
    return null
  }

  const seconds = Math.floor(numericValue)
  const units = [
    { label: 'y', seconds: 31_556_952 },
    { label: 'd', seconds: 86_400 },
    { label: 'h', seconds: 3_600 },
    { label: 'm', seconds: 60 }
  ]
  const parts: string[] = []
  let remaining = seconds

  for (const unit of units) {
    const count = Math.floor(remaining / unit.seconds)
    if (count > 0) {
      parts.push(`${count}${unit.label}`)
      remaining -= count * unit.seconds
    }

    if (parts.length === 2) {
      break
    }
  }

  if (parts.length === 0 || (parts.length < 2 && remaining > 0)) {
    parts.push(`${remaining}s`)
  }

  return parts.join(' ')
}

const formatInlineReference = (value: string, raw: string | number): string => `${value} | ${String(raw)}`

const getChainName = (value: string | number): string | null => {
  const numericValue = parseFiniteNumber(value)
  if (numericValue === null || !Number.isInteger(numericValue)) {
    return null
  }

  return CHAIN_ID_TO_NAME[numericValue as ChainId] ?? `Chain ${numericValue}`
}

const formatChainIdValue = (value: string | number): string | null => {
  const chainName = getChainName(value)
  if (!chainName) {
    return null
  }

  return `${String(value)} | ${chainName}`
}

const getBlockExplorerBaseUrl = (chainId: number | null): string | null => {
  if (chainId === null) {
    return null
  }

  return CHAIN_ID_TO_BLOCK_EXPLORER[chainId as ChainId]?.replace(/\/+$/, '') ?? null
}

const getBlockExplorerAddressUrl = (address: string, context: NormalizationContext): string | null => {
  if (!context.blockExplorerBaseUrl) {
    return null
  }

  return `${context.blockExplorerBaseUrl}/address/${address}`
}

const vaultRoleDefinitions = [
  { bit: 1n, label: 'ADD_STRATEGY_MANAGER' },
  { bit: 2n, label: 'REVOKE_STRATEGY_MANAGER' },
  { bit: 4n, label: 'FORCE_REVOKE_MANAGER' },
  { bit: 8n, label: 'ACCOUNTANT_MANAGER' },
  { bit: 16n, label: 'QUEUE_MANAGER' },
  { bit: 32n, label: 'REPORTING_MANAGER' },
  { bit: 64n, label: 'DEBT_MANAGER' },
  { bit: 128n, label: 'MAX_DEBT_MANAGER' },
  { bit: 256n, label: 'DEPOSIT_LIMIT_MANAGER' },
  { bit: 512n, label: 'WITHDRAW_LIMIT_MANAGER' },
  { bit: 1024n, label: 'MINIMUM_IDLE_MANAGER' },
  { bit: 2048n, label: 'PROFIT_UNLOCK_MANAGER' },
  { bit: 4096n, label: 'DEBT_PURCHASER' },
  { bit: 8192n, label: 'EMERGENCY_MANAGER' }
] as const

const decodeVaultRoles = (value: string | number): string[] | null => {
  const roleMask = parseIntegerValue(value)
  if (roleMask === null || roleMask < 0n) {
    return null
  }

  return vaultRoleDefinitions.filter((role) => (roleMask & role.bit) === role.bit).map((role) => role.label)
}

const addStrategyName = (map: Record<string, string>, value: StructuredValue) => {
  if (!isRecord(value)) {
    return
  }

  const addressValue = [value.address, value.strategy].find(
    (entry): entry is string => typeof entry === 'string' && isAddress(entry)
  )
  if (!addressValue) {
    return
  }

  const nameValue = [value.displayName, value.name, value.label].find(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
  )

  if (nameValue) {
    map[normalizeAddressKey(addressValue)] = nameValue.trim()
  }
}

const buildStrategyNameMap = (snapshot: KongVaultSnapshot): Record<string, string> => {
  const map: Record<string, string> = {}
  const snapshotRecord = snapshot as StructuredRecord

  for (const value of Object.values(snapshotRecord)) {
    if (!Array.isArray(value)) {
      continue
    }

    for (const item of value) {
      addStrategyName(map, item)
    }
  }

  for (const key of ['composition', 'debts', 'strategies']) {
    const value = snapshotRecord[key]
    if (!isRecord(value)) {
      continue
    }

    for (const [address, entry] of Object.entries(value)) {
      if (!isAddress(address)) {
        continue
      }

      if (isRecord(entry)) {
        const nameValue = [entry.displayName, entry.name, entry.label].find(
          (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0
        )
        if (nameValue) {
          map[normalizeAddressKey(address)] = nameValue.trim()
        }
      }
    }
  }

  return map
}

const getNormalizationContext = (snapshot: KongVaultSnapshot): NormalizationContext => {
  const snapshotRecord = snapshot as StructuredRecord
  const assetRecord = isRecord(snapshotRecord.asset) ? snapshotRecord.asset : undefined
  const metaRecord = isRecord(snapshotRecord.meta) ? snapshotRecord.meta : undefined
  const tokenRecord = isRecord(metaRecord?.token) ? metaRecord.token : undefined
  const chainId = parseFiniteNumber(snapshot.chainId)
  const assetDecimals = parseDecimals(
    getScalarFromRecord(assetRecord, 'decimals') ?? getScalarFromRecord(tokenRecord, 'decimals')
  )
  const vaultDecimals = parseDecimals(getScalarFromRecord(snapshotRecord, 'decimals')) ?? assetDecimals

  return {
    assetDecimals,
    assetSymbol:
      String(getScalarFromRecord(assetRecord, 'symbol') ?? getScalarFromRecord(tokenRecord, 'symbol') ?? '').trim() ||
      null,
    blockExplorerBaseUrl: getBlockExplorerBaseUrl(chainId),
    chainId,
    strategyNameByAddress: buildStrategyNameMap(snapshot),
    vaultDecimals,
    vaultSymbol: String(getScalarFromRecord(snapshotRecord, 'symbol') ?? '').trim() || null
  }
}

const assetBaseUnitKeys = new Set([
  'availabledepositlimit',
  'creditavailable',
  'currentdebt',
  'debtoutstanding',
  'depositlimit',
  'expectedreturn',
  'lockedprofit',
  'maxtotaldebt',
  'maxdebt',
  'maxwithdraw',
  'minimumtotalidle',
  'newdebt',
  'totalassets',
  'totaldebt',
  'totalgain',
  'totalidle',
  'totalloss'
])
const shareBaseUnitKeys = new Set(['maxavailableshares', 'totalsupply', 'unlockshares', 'unlockedshares'])
const apyContainerRateKeys = new Set(['net', 'grossapr', 'weeklynet', 'monthlynet', 'inceptionnet', 'pricepershare'])
const explicitRateKeys = new Set(['fixedratekatanarewards', 'katananativeyield'])
const historicalRateKeys = new Set(['net', 'weeklynet', 'monthlynet', 'inceptionnet'])

const isRatePath = (normalizedPath: string[], normalizedKey: string): boolean => {
  if (explicitRateKeys.has(normalizedKey)) {
    return true
  }

  if (/(apr|apy)/.test(normalizedKey)) {
    return true
  }

  if (normalizedPath.includes('apy') && apyContainerRateKeys.has(normalizedKey)) {
    return normalizedKey !== 'pricepershare'
  }

  if (
    normalizedPath.includes('performance') &&
    normalizedPath.includes('historical') &&
    historicalRateKeys.has(normalizedKey)
  ) {
    return true
  }

  return false
}

const isDebtRatioPath = (normalizedKey: string): boolean => {
  return ['debtratio', 'targetdebtratio', 'maxdebtratio'].includes(normalizedKey)
}

const isFeePath = (normalizedKey: string): boolean => {
  return normalizedKey.endsWith('fee') || normalizedKey.endsWith('fees')
}

const isUsdPath = (normalizedPath: string[], normalizedKey: string): boolean => {
  return normalizedKey.endsWith('usd') || normalizedPath.join('.') === 'tvl.close'
}

const isRewardPath = (normalizedPath: string[]): boolean => {
  return normalizedPath.includes('staking') && normalizedPath.includes('rewards')
}

const isTimestampKey = (normalizedKey: string): boolean => {
  return [
    'activation',
    'blocktime',
    'finishedat',
    'fullprofitunlockdate',
    'incepttime',
    'lastprofitupdate',
    'lastreport',
    'reporttime'
  ].includes(normalizedKey)
}

const isDurationKey = (normalizedKey: string): boolean => {
  return ['profitmaxunlocktime', 'maxreportdelay', 'minreportdelay'].includes(normalizedKey)
}

const isRoleMaskPath = (normalizedPath: string[], normalizedKey: string): boolean => {
  return (
    normalizedKey === 'roles' ||
    normalizedKey === 'role' ||
    normalizedPath.includes('roles') ||
    normalizedPath[normalizedPath.length - 2] === 'roles'
  )
}

const isMaxSentinelKey = (normalizedKey: string): boolean => {
  return normalizedKey.startsWith('max') || normalizedKey.endsWith('limit')
}

export const getKongNormalizedScalarValue = ({
  path,
  value,
  parent,
  context
}: {
  path: string[]
  value: string | number
  parent?: StructuredRecord
  context: NormalizationContext
}): NormalizedScalarValue | null => {
  const normalizedPath = path.map(normalizeKey)
  const normalizedKey = normalizedPath[normalizedPath.length - 1] ?? ''

  if (normalizedKey === 'chainid') {
    const chainValue = formatChainIdValue(value)
    if (chainValue) {
      return {
        value: chainValue
      }
    }

    return null
  }

  if (normalizedKey === 'decimals') {
    return null
  }

  if (typeof value === 'string' && (isUrl(value) || isAddress(value))) {
    return null
  }

  const numericValue = parseFiniteNumber(value)

  if (isTimestampKey(normalizedKey)) {
    const timestamp = formatTimestampValue(value)
    if (timestamp) {
      return {
        value: formatInlineReference(timestamp, value)
      }
    }
  }

  if (isDurationKey(normalizedKey)) {
    const duration = formatDurationSeconds(value)
    if (duration) {
      return {
        value: formatInlineReference(duration, value)
      }
    }
  }

  if (isRoleMaskPath(normalizedPath, normalizedKey)) {
    const decodedRoles = decodeVaultRoles(value)
    if (decodedRoles) {
      return {
        value: formatInlineReference(decodedRoles.length > 0 ? decodedRoles.join(', ') : 'No roles', value)
      }
    }
  }

  if (normalizedKey === 'profitunlockingrate' && context.vaultDecimals !== null) {
    const normalized = formatScaledIntegerAmount(value, context.vaultDecimals + 12, context.vaultSymbol, '/sec')
    if (normalized) {
      return {
        value: formatInlineReference(normalized, value)
      }
    }
  }

  if (isMaxSentinelKey(normalizedKey) && isMaxSentinelValue(value)) {
    return {
      value: formatInlineReference('Max', value)
    }
  }

  if (numericValue !== null && isRatePath(normalizedPath, normalizedKey)) {
    return {
      value: formatInlineReference(formatPercentValue(numericValue * 100), value)
    }
  }

  if (numericValue !== null && isFeePath(normalizedKey)) {
    const feePercent = Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue / 100
    return {
      value: formatInlineReference(formatPercentValue(feePercent), value)
    }
  }

  if (numericValue !== null && isDebtRatioPath(normalizedKey)) {
    return {
      value: formatInlineReference(formatPercentValue(numericValue / 100), value)
    }
  }

  if (numericValue !== null && isUsdPath(normalizedPath, normalizedKey)) {
    return {
      value: formatInlineReference(formatUsdValue(numericValue), value)
    }
  }

  if (numericValue !== null && isRewardPath(normalizedPath) && normalizedKey === 'price') {
    return {
      value: formatInlineReference(formatUsdValue(numericValue), value)
    }
  }

  if (normalizedKey === 'perweek' && isRewardPath(normalizedPath)) {
    const rewardDecimals = parseDecimals(getScalarFromRecord(parent, 'decimals'))
    const rewardSymbol = String(getScalarFromRecord(parent, 'symbol') ?? '').trim() || null
    if (rewardDecimals !== null) {
      const normalized = formatBaseUnitAmount(value, rewardDecimals, rewardSymbol, '/week')
      if (normalized) {
        return {
          value: formatInlineReference(normalized, value)
        }
      }
    }
  }

  if (assetBaseUnitKeys.has(normalizedKey) && context.assetDecimals !== null) {
    const normalized = formatBaseUnitAmount(value, context.assetDecimals, context.assetSymbol)
    if (normalized) {
      return {
        value: formatInlineReference(normalized, value)
      }
    }
  }

  if (shareBaseUnitKeys.has(normalizedKey) && context.vaultDecimals !== null) {
    const normalized = formatBaseUnitAmount(value, context.vaultDecimals, context.vaultSymbol)
    if (normalized) {
      return {
        value: formatInlineReference(normalized, value)
      }
    }
  }

  if (normalizedKey === 'pricepershare' && context.vaultDecimals !== null) {
    const integerValue = parseIntegerValue(value)
    const absoluteValue = integerValue === null ? null : integerValue < 0n ? -integerValue : integerValue
    const scaledValueThreshold = 10n ** BigInt(Math.max(context.vaultDecimals - 2, 0))
    if (absoluteValue === null || absoluteValue < scaledValueThreshold) {
      return null
    }

    const normalized = formatBaseUnitAmount(value, context.vaultDecimals, context.assetSymbol ?? context.vaultSymbol)
    if (normalized && normalized !== formatNumberLike(value)) {
      return {
        value: formatInlineReference(normalized, value)
      }
    }
  }

  return null
}

const formatTimestampValue = (value: string | number): string | null => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getUTCFullYear()
  if (year < 2000 || year > 2100) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }).format(date)
}

const maybeFormatTimestamp = (path: string[], value: string | number): string | null => {
  const normalizedKey = normalizeKey(path[path.length - 1] ?? '')
  if (!isTimestampKey(normalizedKey)) {
    return null
  }

  return formatTimestampValue(value)
}

const shouldUseRawNumberDisplay = (path: string[]): boolean => {
  const lastKey = normalizeKey(path[path.length - 1] ?? '')
  return lastKey === 'chainid'
}

const summarizeValue = (value: StructuredValue): string => {
  if (Array.isArray(value)) {
    return value.length === 1 ? '1 entry' : `${value.length} entries`
  }

  if (isRecord(value)) {
    const count = Object.values(value).filter((entry) => entry !== undefined).length
    return count === 1 ? '1 field' : `${count} fields`
  }

  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'empty'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'string' && isAddress(value)) {
    return formatAddressDisplay(value)
  }

  return formatNumberLike(value)
}

const getDefinedEntries = (value: StructuredRecord): Array<[string, StructuredValue]> => {
  return Object.entries(value).filter(([, entry]) => entry !== undefined)
}

const getPromotedRow = (label: string, value: StructuredValue, path: string[], id: string): RowDefinition | null => {
  if (!isRecord(value)) {
    return null
  }

  const entries = getDefinedEntries(value)
  if (entries.length !== 1) {
    return null
  }

  const [innerKey, innerValue] = entries[0]
  if (!isScalar(innerValue)) {
    return null
  }

  return {
    id: `${id}.${innerKey}`,
    label: `${label} ${titleCase(innerKey)}`,
    value: innerValue,
    path: [...path, innerKey],
    parent: value
  }
}

const getAddressDisplayName = (address: string, context: NormalizationContext): string => {
  return context.strategyNameByAddress[normalizeAddressKey(address)] ?? formatAddressDisplay(address)
}

const getKeyLabel = (
  key: string,
  path: string[],
  context: NormalizationContext
): Pick<RowDefinition, 'label' | 'labelAddress'> => {
  if (isAddress(key)) {
    const isDebtKey = path.map(normalizeKey).includes('debts')
    return {
      label: isDebtKey ? getAddressDisplayName(key, context) : formatAddressDisplay(key),
      labelAddress: key
    }
  }

  return {
    label: titleCase(key)
  }
}

const getItemHeading = (
  label: string,
  value: StructuredValue,
  index: number,
  context: NormalizationContext
): string => {
  if (isRecord(value)) {
    const namedValue = [value.displayName, value.name, value.symbol, value.label].find(
      (entry): entry is string => typeof entry === 'string' && entry.length > 0
    )

    if (namedValue) {
      return namedValue
    }

    const addressValue = [value.address, value.strategy].find(
      (entry): entry is string => typeof entry === 'string' && entry.length > 0
    )

    if (addressValue) {
      return getAddressDisplayName(addressValue, context)
    }
  }

  const singular = label.endsWith('s') ? label.slice(0, -1) : label
  return `${titleCase(singular)} ${index + 1}`
}

const buildDisplayModel = (snapshot: KongVaultSnapshot): DisplayModel => {
  const snapshotRecord = snapshot as StructuredRecord
  const orderedKeys = Array.from(new Set([...orderedTopLevelKeys, ...Object.keys(snapshotRecord)]))
  const items: DisplayItem[] = []

  orderedKeys.forEach((key) => {
    const value = snapshotRecord[key]
    if (value === undefined) {
      return
    }

    const label = sectionLabels[key] ?? titleCase(key)

    if (overviewKeySet.has(key)) {
      if (isScalar(value)) {
        items.push({
          kind: 'row',
          row: {
            id: key,
            label: titleCase(key),
            value,
            path: [key],
            parent: snapshotRecord
          }
        })
      } else {
        items.push({
          kind: 'section',
          section: { key, label: titleCase(key), value }
        })
      }
      return
    }

    if (isScalar(value)) {
      items.push({
        kind: 'row',
        row: {
          id: key,
          label,
          value,
          path: [key],
          parent: snapshotRecord
        }
      })
      return
    }

    const promotedRow = getPromotedRow(label, value, [key], key)
    if (promotedRow) {
      items.push({
        kind: 'row',
        row: promotedRow
      })
      return
    }

    items.push({
      kind: 'section',
      section: {
        key,
        label,
        value
      }
    })
  })

  return { items }
}

const ValueChip = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-full border border-[hsl(var(--data-ledger-border))] px-2 py-0.5 text-[14px] font-medium text-[hsl(var(--data-ledger-muted))] tabular-nums">
      {children}
    </span>
  )
}

const AddressLink = ({
  address,
  children,
  className,
  normalizationContext
}: {
  address: string
  children?: React.ReactNode
  className?: string
  normalizationContext: NormalizationContext
}) => {
  const href = getBlockExplorerAddressUrl(address, normalizationContext)
  const content = children ?? formatAddressDisplay(address)

  if (!href) {
    return <span className={cn('break-all tabular-nums text-[hsl(var(--data-ledger-fg))]', className)}>{content}</span>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex min-w-0 items-center gap-1 text-[hsl(var(--data-ledger-muted))] underline decoration-[hsl(var(--data-ledger-border))] underline-offset-4 transition-colors hover:text-[hsl(var(--data-ledger-fg))]',
        className
      )}
    >
      <span className="break-all">{content}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
    </a>
  )
}

const NormalizedValue = ({ normalized, raw }: { normalized: NormalizedScalarValue; raw: string | number }) => {
  const [primaryValue, ...referenceParts] = normalized.value.split(' | ')
  const referenceValue = referenceParts.length > 0 ? referenceParts.join(' | ') : String(raw)

  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums">
      <span className="break-all font-medium text-[hsl(var(--data-ledger-fg))]">{primaryValue}</span>
      <span className="text-[hsl(var(--data-ledger-faint))]">|</span>
      <span className="break-all font-mono text-[13px] font-normal text-[hsl(var(--data-ledger-faint))]">
        {referenceValue}
      </span>
    </span>
  )
}

const ScalarValue = ({
  path,
  value,
  parent,
  normalizationContext
}: {
  path: string[]
  value: string | number | boolean | null | undefined
  parent?: StructuredRecord
  normalizationContext: NormalizationContext
}) => {
  if (value === undefined) {
    return <span className="text-[hsl(var(--data-ledger-faint))]">Not provided</span>
  }

  if (value === null) {
    return <span className="text-[hsl(var(--data-ledger-faint))]">null</span>
  }

  if (typeof value === 'boolean') {
    return <ValueChip>{value ? 'true' : 'false'}</ValueChip>
  }

  const timestamp = maybeFormatTimestamp(path, value)
  if (timestamp) {
    return <NormalizedValue normalized={{ value: timestamp }} raw={value} />
  }

  if (typeof value === 'string' && isUrl(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-medium text-[hsl(var(--data-ledger-muted))] underline decoration-[hsl(var(--data-ledger-border))] underline-offset-4 transition-colors hover:text-[hsl(var(--data-ledger-fg))]"
      >
        <span className="break-all">{value}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>
    )
  }

  if (typeof value === 'string' && isAddress(value)) {
    return <AddressLink address={value} normalizationContext={normalizationContext} className="font-medium" />
  }

  const normalized = getKongNormalizedScalarValue({
    path,
    value,
    parent,
    context: normalizationContext
  })

  if (normalized) {
    return <NormalizedValue normalized={normalized} raw={value} />
  }

  if (shouldUseRawNumberDisplay(path)) {
    return <span className="break-all font-medium tabular-nums text-[hsl(var(--data-ledger-fg))]">{String(value)}</span>
  }

  return (
    <span className="break-all font-medium tabular-nums text-[hsl(var(--data-ledger-fg))]">
      {formatNumberLike(value)}
    </span>
  )
}

const DataLabel = ({
  row,
  normalizationContext
}: {
  row: Pick<RowDefinition, 'label' | 'labelAddress'>
  normalizationContext: NormalizationContext
}) => {
  if (row.labelAddress) {
    return (
      <AddressLink
        address={row.labelAddress}
        normalizationContext={normalizationContext}
        className="max-w-full text-[13px] normal-case tracking-normal"
      >
        {row.label}
      </AddressLink>
    )
  }

  return <>{row.label}</>
}

const DataRow = ({
  row,
  normalizationContext,
  depth = 0
}: {
  row: RowDefinition
  normalizationContext: NormalizationContext
  depth?: number
}) => {
  return (
    <div
      className="grid gap-2 py-2.5 sm:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)] sm:gap-4"
      style={{ paddingLeft: `${CARET_OFFSET_PX + depth * NESTED_INDENT_PX}px` }}
    >
      <dt className="min-w-0 text-[13px] uppercase tracking-[0.12em] text-[hsl(var(--data-ledger-muted))]">
        <DataLabel row={row} normalizationContext={normalizationContext} />
      </dt>
      <dd className="min-w-0 text-[14px]">
        <ScalarValue
          path={row.path}
          value={row.value}
          parent={row.parent}
          normalizationContext={normalizationContext}
        />
      </dd>
    </div>
  )
}

const DataRows = ({
  rows,
  normalizationContext,
  depth = 0
}: {
  rows: RowDefinition[]
  normalizationContext: NormalizationContext
  depth?: number
}) => {
  return (
    <dl className="divide-y divide-[hsl(var(--data-ledger-border-subtle))]">
      {rows.map((row) => (
        <DataRow key={row.id} row={row} normalizationContext={normalizationContext} depth={depth} />
      ))}
    </dl>
  )
}

const SectionKeyLabel = ({
  entryKey,
  path,
  normalizationContext
}: {
  entryKey: string
  path: string[]
  normalizationContext: NormalizationContext
}) => {
  const keyLabel = getKeyLabel(entryKey, path, normalizationContext)
  if (keyLabel.labelAddress) {
    return (
      <AddressLink
        address={keyLabel.labelAddress}
        normalizationContext={normalizationContext}
        className="max-w-full text-[13px] normal-case tracking-normal"
      >
        {keyLabel.label}
      </AddressLink>
    )
  }

  return <>{keyLabel.label}</>
}

const DataArray = ({
  label,
  items,
  path,
  normalizationContext,
  depth = 0
}: {
  label: string
  items: StructuredValue[]
  path: string[]
  normalizationContext: NormalizationContext
  depth?: number
}) => {
  if (items.length === 0) {
    return (
      <div
        className="border border-dashed border-[hsl(var(--data-ledger-border))] px-3 py-4 text-[13px] text-[hsl(var(--data-ledger-faint))]"
        style={depth > 0 ? { marginLeft: `${depth * 16}px` } : undefined}
      >
        No entries
      </div>
    )
  }

  return (
    <div className="divide-y divide-[hsl(var(--data-ledger-border-subtle))]">
      {items.map((item, index) => {
        const itemPath = [...path, String(index)]
        const itemId = `${path.join('.')}-${index}`
        const itemHeading = getItemHeading(label, item, index, normalizationContext)

        if (isScalar(item)) {
          return (
            <div key={itemId} className="px-3">
              <DataRows
                rows={[
                  {
                    id: itemId,
                    label: itemHeading,
                    value: item,
                    path: itemPath
                  }
                ]}
                normalizationContext={normalizationContext}
                depth={depth}
              />
            </div>
          )
        }

        const promotedRow = getPromotedRow(itemHeading, item, itemPath, itemId)
        if (promotedRow) {
          return (
            <div key={itemId} className="px-3">
              <DataRows rows={[promotedRow]} normalizationContext={normalizationContext} depth={depth} />
            </div>
          )
        }

        return (
          <Accordion key={itemId} type="multiple" className="w-full">
            <AccordionItem value={itemId} className="border-0">
              <AccordionTrigger className="justify-start gap-2 py-2.5 text-left hover:no-underline [&>svg]:order-first [&>svg]:text-[hsl(var(--data-ledger-muted))]">
                <div
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-3"
                  style={depth > 0 ? { paddingLeft: `${depth * NESTED_INDENT_PX}px` } : undefined}
                >
                  <span className="truncate text-[14px] text-[hsl(var(--data-ledger-fg))]">{itemHeading}</span>
                  <span className="shrink-0 text-[13px] uppercase tracking-[0.1em] text-[hsl(var(--data-ledger-faint))] tabular-nums">
                    {summarizeValue(item)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="px-3 pb-2">
                  {Array.isArray(item) ? (
                    <DataArray
                      label={`${label}-${index + 1}`}
                      items={item}
                      path={itemPath}
                      normalizationContext={normalizationContext}
                      depth={depth + 1}
                    />
                  ) : isRecord(item) ? (
                    <DataRecord
                      value={item}
                      path={itemPath}
                      normalizationContext={normalizationContext}
                      depth={depth + 1}
                    />
                  ) : (
                    <div className={cn('py-1 text-[14px]', 'text-[hsl(var(--data-ledger-fg))]')}>
                      <ScalarValue path={itemPath} value={item} normalizationContext={normalizationContext} />
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )
      })}
    </div>
  )
}

const DataRecord = ({
  value,
  path,
  normalizationContext,
  depth = 0
}: {
  value: StructuredRecord
  path: string[]
  normalizationContext: NormalizationContext
  depth?: number
}) => {
  const rows: RowDefinition[] = []
  const complexEntries: Array<[string, StructuredValue]> = []

  getDefinedEntries(value).forEach(([key, entry]) => {
    const keyLabel = getKeyLabel(key, path, normalizationContext)
    if (isScalar(entry)) {
      rows.push({
        id: [...path, key].join('.'),
        label: keyLabel.label,
        labelAddress: keyLabel.labelAddress,
        value: entry,
        path: [...path, key],
        parent: value
      })
      return
    }

    const promotedRow = getPromotedRow(keyLabel.label, entry, [...path, key], [...path, key].join('.'))
    if (promotedRow && keyLabel.labelAddress) {
      promotedRow.labelAddress = keyLabel.labelAddress
    }
    if (promotedRow) {
      rows.push(promotedRow)
      return
    }

    complexEntries.push([key, entry])
  })

  return (
    <div className="space-y-2.5">
      {rows.length > 0 && <DataRows rows={rows} normalizationContext={normalizationContext} depth={depth} />}

      {complexEntries.length > 0 && (
        <div className="space-y-2.5">
          {complexEntries.map(([key, entry]) => (
            <section key={key} className="space-y-2 border-t border-[hsl(var(--data-ledger-border-subtle))] pt-2.5">
              <div className="flex items-center justify-between gap-3">
                <h4
                  className="min-w-0 text-[13px] uppercase tracking-[0.12em] text-[hsl(var(--data-ledger-muted))]"
                  style={{ paddingLeft: `${CARET_OFFSET_PX + depth * NESTED_INDENT_PX}px` }}
                >
                  <SectionKeyLabel entryKey={key} path={path} normalizationContext={normalizationContext} />
                </h4>
                <span className="shrink-0 text-[13px] uppercase tracking-[0.1em] text-[hsl(var(--data-ledger-faint))] tabular-nums">
                  {summarizeValue(entry)}
                </span>
              </div>

              {Array.isArray(entry) ? (
                <DataArray
                  label={key}
                  items={entry}
                  path={[...path, key]}
                  normalizationContext={normalizationContext}
                  depth={depth + 1}
                />
              ) : isRecord(entry) ? (
                <div className="py-0.5">
                  <DataRecord
                    value={entry}
                    path={[...path, key]}
                    normalizationContext={normalizationContext}
                    depth={depth + 1}
                  />
                </div>
              ) : (
                <div className="py-0.5 text-[14px]">
                  <ScalarValue
                    path={[...path, key]}
                    value={entry}
                    parent={value}
                    normalizationContext={normalizationContext}
                  />
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export const KongDataTab: React.FC<KongDataTabProps> = React.memo(({ snapshot }) => {
  const displayModel = React.useMemo(() => (snapshot ? buildDisplayModel(snapshot) : { items: [] }), [snapshot])
  const normalizationContext = React.useMemo(() => (snapshot ? getNormalizationContext(snapshot) : null), [snapshot])
  const endpointUrl = React.useMemo(
    () => (snapshot ? getKongVaultSnapshotUrl(snapshot.chainId, snapshot.address) : null),
    [snapshot]
  )
  const defaultOpenSections = React.useMemo(() => {
    return displayModel.items
      .filter((item): item is Extract<DisplayItem, { kind: 'section' }> => item.kind === 'section')
      .slice(0, 2)
      .map((item) => item.section.key)
  }, [displayModel.items])

  if (!snapshot) {
    return (
      <div className="min-h-[24rem] px-5 py-6 text-[hsl(var(--data-ledger-fg))] sm:px-6">
        <div className="max-w-3xl space-y-2">
          <p className="text-[13px] uppercase tracking-[0.12em] text-[hsl(var(--data-ledger-muted))]">Kong Data</p>
          <h3 className="text-[14px] font-medium">No snapshot returned for this vault</h3>
          <p className="max-w-2xl text-[13px] text-[hsl(var(--data-ledger-muted))]">
            The vault page is still using normalized data where available, but Kong did not return a raw snapshot to
            inspect here.
          </p>
        </div>
      </div>
    )
  }

  if (!normalizationContext) {
    return null
  }

  return (
    <div className="min-h-[24rem] bg-[hsl(var(--data-ledger-bg))] px-5 py-5 text-[hsl(var(--data-ledger-fg))] sm:px-6">
      <div className="border-b border-[hsl(var(--data-ledger-border))] pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="text-[13px] uppercase tracking-[0.12em] text-[hsl(var(--data-ledger-muted))]">
                Kong Snapshot
              </p>
            </div>
          </div>

          {endpointUrl && (
            <a
              href={endpointUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[hsl(var(--data-ledger-muted))] underline decoration-[hsl(var(--data-ledger-border))] underline-offset-4 transition-colors hover:text-[hsl(var(--data-ledger-fg))]"
            >
              <span>Query raw endpoint</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          )}
        </div>
      </div>

      {displayModel.items.length > 0 && (
        <div className="divide-y divide-[hsl(var(--data-ledger-border-subtle))]">
          {displayModel.items.map((item) => {
            if (item.kind === 'row') {
              return (
                <dl key={item.row.id}>
                  <DataRow row={item.row} normalizationContext={normalizationContext} />
                </dl>
              )
            }

            const { section } = item
            const isDefaultOpen = defaultOpenSections.includes(section.key)

            return (
              <Accordion
                key={section.key}
                type="multiple"
                defaultValue={isDefaultOpen ? [section.key] : []}
                className="w-full"
              >
                <AccordionItem value={section.key} className="border-0">
                  <AccordionTrigger className="justify-start gap-2 py-3 text-left hover:no-underline [&>svg]:order-first [&>svg]:text-[hsl(var(--data-ledger-muted))]">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-3">
                      <p className="text-[13px] uppercase tracking-[0.12em] text-[hsl(var(--data-ledger-muted))]">
                        {section.label}
                      </p>
                      <span className="shrink-0 text-[13px] uppercase tracking-[0.1em] text-[hsl(var(--data-ledger-faint))] tabular-nums">
                        {summarizeValue(section.value)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <div className="pb-2">
                      {Array.isArray(section.value) ? (
                        <DataArray
                          label={section.label}
                          items={section.value}
                          path={[section.key]}
                          normalizationContext={normalizationContext}
                          depth={1}
                        />
                      ) : isRecord(section.value) ? (
                        <DataRecord
                          value={section.value}
                          path={[section.key]}
                          normalizationContext={normalizationContext}
                          depth={1}
                        />
                      ) : (
                        <div className={cn('py-1 text-[14px]', 'text-[hsl(var(--data-ledger-fg))]')}>
                          <ScalarValue
                            path={[section.key]}
                            value={section.value}
                            normalizationContext={normalizationContext}
                          />
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )
          })}
        </div>
      )}
    </div>
  )
})

KongDataTab.displayName = 'KongDataTab'
