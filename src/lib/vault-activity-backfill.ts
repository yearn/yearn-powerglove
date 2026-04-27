import { type AbiEvent, parseAbi, parseAbiItem } from 'viem'
import {
  formatBaseUnitToDisplayNumber,
  normalizeTimestampToSeconds,
  toIntegerString,
  toIsoUtc
} from '@/lib/vault-activity'
import type { VaultActivityEvent, VaultUnlockState } from '@/types/vaultActivityTypes'

export const V3_STRATEGY_REPORTED_EVENT = parseAbiItem(
  'event StrategyReported(address indexed strategy, uint256 gain, uint256 loss, uint256 current_debt, uint256 protocol_fees, uint256 total_fees, uint256 total_refunds)'
) as AbiEvent

export const V3_DEBT_UPDATED_EVENT = parseAbiItem(
  'event DebtUpdated(address indexed strategy, uint256 current_debt, uint256 new_debt)'
) as AbiEvent

export const V3_UPDATE_PROFIT_MAX_UNLOCK_TIME_EVENT = parseAbiItem(
  'event UpdateProfitMaxUnlockTime(uint256 profit_max_unlock_time)'
) as AbiEvent

export const V2_STRATEGY_REPORTED_EVENT = parseAbiItem(
  'event StrategyReported(address indexed strategy, uint256 gain, uint256 loss, uint256 debtPaid, uint256 totalGain, uint256 totalLoss, uint256 totalDebt, uint256 debtAdded, uint256 debtRatio)'
) as AbiEvent

export const V2_STRATEGY_ADDED_EVENT = parseAbiItem(
  'event StrategyAdded(address indexed strategy, uint256 debtRatio, uint256 minDebtPerHarvest, uint256 maxDebtPerHarvest, uint256 performanceFee)'
) as AbiEvent

export const V2_STRATEGY_REVOKED_EVENT = parseAbiItem('event StrategyRevoked(address indexed strategy)') as AbiEvent

export const V2_STRATEGY_UPDATE_DEBT_RATIO_EVENT = parseAbiItem(
  'event StrategyUpdateDebtRatio(address indexed strategy, uint256 debtRatio)'
) as AbiEvent

export const V3_VAULT_ACTIVITY_ABI = parseAbi([
  'event StrategyReported(address indexed strategy, uint256 gain, uint256 loss, uint256 current_debt, uint256 protocol_fees, uint256 total_fees, uint256 total_refunds)',
  'event DebtUpdated(address indexed strategy, uint256 current_debt, uint256 new_debt)',
  'event UpdateProfitMaxUnlockTime(uint256 profit_max_unlock_time)',
  'function unlockedShares() view returns (uint256)',
  'function profitUnlockingRate() view returns (uint256)',
  'function profitMaxUnlockTime() view returns (uint256)',
  'function fullProfitUnlockDate() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function pricePerShare() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function lockedProfit() view returns (uint256)',
  'function lockedProfitDegradation() view returns (uint256)',
  'function lastReport() view returns (uint256)',
  'function decimals() view returns (uint8)'
])

type RawEventArgs = Record<string, unknown>

export interface RawVaultActivityLog {
  chainId: number
  vaultAddress: string
  transactionHash: string
  blockNumber: number | bigint | string
  logIndex?: number | string | null
  timestamp: number | string
  args: RawEventArgs
}

export interface RawVaultUnlockReads {
  unlockedShares?: bigint | string | number | null
  profitUnlockingRate?: bigint | string | number | null
  profitMaxUnlockTime?: bigint | string | number | null
  fullProfitUnlockDate?: bigint | string | number | null
  totalAssets?: bigint | string | number | null
  pricePerShare?: bigint | string | number | null
  totalSupply?: bigint | string | number | null
  lockedShares?: bigint | string | number | null
  lockedProfit?: bigint | string | number | null
  lockedProfitDegradation?: bigint | string | number | null
  lastReport?: bigint | string | number | null
  totalAssetsUsd?: number | null
}

interface ActivityMappingContext {
  assetDecimals?: number | null
  shareDecimals?: number | null
  strategyNamesByAddress?: Record<string, string>
  unlockState?: VaultUnlockState | null
}

interface UnlockCalculationContext {
  chainId: number
  vaultAddress: string
  blockNumber?: number | bigint | string | null
  timestamp: number | string
  assetDecimals?: number | null
  shareDecimals?: number | null
}

const RATE_SCALE_DECIMALS = 12
const SECONDS_PER_DAY = 86_400n
const PERCENT_SCALE = 1_000_000n
const V2_LOCKED_PROFIT_DEGRADATION_COEFFICIENT = 1_000_000_000_000_000_000n

export function getVaultActivityOutputPath(chainId: number, vaultAddress: string): string {
  return `public/data/vault-activity/${chainId}/${vaultAddress.toLowerCase()}.json`
}

function getArg(args: RawEventArgs, names: string[]): unknown {
  for (const name of names) {
    if (args[name] !== undefined) {
      return args[name]
    }
  }

  return null
}

function getAddressArg(args: RawEventArgs, names: string[]): string | null {
  const value = getArg(args, names)
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : null
}

function getIntegerNumber(value: unknown): number | null {
  const integerString = toIntegerString(value)
  if (integerString === null) {
    return null
  }

  const numeric = Number(integerString)
  return Number.isSafeInteger(numeric) ? numeric : null
}

function normalizeBlockNumber(value: number | bigint | string): number {
  const numeric = typeof value === 'bigint' ? Number(value) : Number(value)
  if (!Number.isSafeInteger(numeric)) {
    throw new Error('Vault activity log has invalid blockNumber.')
  }

  return numeric
}

function normalizeLogIndex(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const numeric = Number(value)
  return Number.isSafeInteger(numeric) ? numeric : null
}

function getStrategyName(
  strategyAddress: string | null,
  strategyNamesByAddress?: Record<string, string>
): string | null {
  if (!strategyAddress) {
    return null
  }

  return strategyNamesByAddress?.[strategyAddress.toLowerCase()] ?? null
}

function getDebtDelta(currentDebt: string | null, newDebt: string | null): string | null {
  if (currentDebt === null || newDebt === null) {
    return null
  }

  try {
    return (BigInt(newDebt) - BigInt(currentDebt)).toString()
  } catch {
    return null
  }
}

function getDebtDeltaFromAddedPaid(debtAdded: string | null, debtPaid: string | null): string | null {
  if (debtAdded === null && debtPaid === null) {
    return null
  }

  try {
    return (BigInt(debtAdded ?? '0') - BigInt(debtPaid ?? '0')).toString()
  } catch {
    return null
  }
}

function getReallocationDirection(debtDelta: string | null): 'increase' | 'decrease' | 'flat' {
  if (debtDelta === null) {
    return 'flat'
  }

  const parsed = BigInt(debtDelta)
  if (parsed > 0n) {
    return 'increase'
  }
  if (parsed < 0n) {
    return 'decrease'
  }

  return 'flat'
}

function isNonZeroIntegerString(value: string | null): boolean {
  if (value === null) {
    return false
  }

  try {
    return BigInt(value) !== 0n
  } catch {
    return false
  }
}

function buildBaseActivity(log: RawVaultActivityLog) {
  const blockNumber = normalizeBlockNumber(log.blockNumber)
  const logIndex = normalizeLogIndex(log.logIndex)
  const timestamp = normalizeTimestampToSeconds(log.timestamp, 'log timestamp')
  const vaultAddress = log.vaultAddress.toLowerCase()

  return {
    chainId: log.chainId,
    vaultAddress,
    txHash: log.transactionHash,
    blockNumber,
    logIndex,
    timestamp,
    timestampIso: toIsoUtc(timestamp),
    id: `${log.chainId}:${vaultAddress}:${blockNumber}:${logIndex ?? 0}`
  }
}

export function mapStrategyReportedEventToActivity(
  log: RawVaultActivityLog,
  context: ActivityMappingContext = {}
): VaultActivityEvent {
  const base = buildBaseActivity(log)
  const strategyAddress = getAddressArg(log.args, ['strategy'])
  const gain = toIntegerString(getArg(log.args, ['gain']))
  const loss = toIntegerString(getArg(log.args, ['loss']))
  const currentDebt = toIntegerString(getArg(log.args, ['currentDebt', 'current_debt']))
  const realizedProfitOrLoss = isNonZeroIntegerString(gain) || isNonZeroIntegerString(loss)

  return {
    ...base,
    id: `${base.id}:strategy_reported`,
    eventType: realizedProfitOrLoss ? 'harvest' : 'strategy_reported',
    sourceEventType: 'StrategyReported',
    strategyAddress,
    strategyName: getStrategyName(strategyAddress, context.strategyNamesByAddress),
    label: realizedProfitOrLoss ? 'Harvest reported' : 'Strategy reported',
    description: realizedProfitOrLoss
      ? 'The strategy reported realized gain, loss, fees, and current debt to the vault.'
      : 'The strategy reported vault accounting state without realized gain or loss.',
    gain,
    gainDisplay: formatBaseUnitToDisplayNumber(gain, context.assetDecimals),
    loss,
    lossDisplay: formatBaseUnitToDisplayNumber(loss, context.assetDecimals),
    currentDebt,
    currentDebtDisplay: formatBaseUnitToDisplayNumber(currentDebt, context.assetDecimals),
    unlockedShares: context.unlockState?.unlockedShares ?? null,
    unlockedSharesDisplay: context.unlockState?.unlockedSharesDisplay ?? null,
    lockedShares: context.unlockState?.lockedShares ?? null,
    lockedSharesDisplay: context.unlockState?.lockedSharesDisplay ?? null,
    remainingLockedShares: context.unlockState?.remainingLockedShares ?? null,
    remainingLockedSharesDisplay: context.unlockState?.remainingLockedSharesDisplay ?? null,
    lockedProfit: context.unlockState?.lockedProfit ?? null,
    lockedProfitDisplay: context.unlockState?.lockedProfitDisplay ?? null,
    lockedProfitPercent: context.unlockState?.lockedProfitPercent ?? null,
    lockedProfitDegradation: context.unlockState?.lockedProfitDegradation ?? null,
    lastReport: context.unlockState?.lastReport ?? null,
    unlockPercent: context.unlockState?.unlockPercent ?? null,
    unlockRatePerDay: context.unlockState?.unlockRatePerDay ?? null,
    fullProfitUnlockDate: context.unlockState?.fullProfitUnlockDate ?? null,
    fullProfitUnlockDateIso: context.unlockState?.fullProfitUnlockDateIso ?? null,
    ppsAfter: context.unlockState?.pps ?? null,
    profitUnlockMode: context.unlockState?.profitUnlockMode ?? null
  }
}

export function mapDebtUpdatedEventToActivity(
  log: RawVaultActivityLog,
  context: ActivityMappingContext = {}
): VaultActivityEvent {
  const base = buildBaseActivity(log)
  const strategyAddress = getAddressArg(log.args, ['strategy'])
  const currentDebt = toIntegerString(getArg(log.args, ['currentDebt', 'current_debt']))
  const newDebt = toIntegerString(getArg(log.args, ['newDebt', 'new_debt']))
  const debtDelta = getDebtDelta(currentDebt, newDebt)
  const direction = getReallocationDirection(debtDelta)

  return {
    ...base,
    id: `${base.id}:debt_update`,
    eventType: 'debt_update',
    sourceEventType: 'DebtUpdated',
    strategyAddress,
    strategyName: getStrategyName(strategyAddress, context.strategyNamesByAddress),
    label: direction === 'increase' ? 'Debt increased' : direction === 'decrease' ? 'Debt decreased' : 'Debt unchanged',
    description: 'The vault updated strategy debt, changing how assets are allocated.',
    currentDebt,
    currentDebtDisplay: formatBaseUnitToDisplayNumber(currentDebt, context.assetDecimals),
    newDebt,
    newDebtDisplay: formatBaseUnitToDisplayNumber(newDebt, context.assetDecimals),
    debtDelta,
    debtDeltaDisplay: formatBaseUnitToDisplayNumber(debtDelta, context.assetDecimals),
    unlockedShares: context.unlockState?.unlockedShares ?? null,
    unlockedSharesDisplay: context.unlockState?.unlockedSharesDisplay ?? null,
    lockedShares: context.unlockState?.lockedShares ?? null,
    lockedSharesDisplay: context.unlockState?.lockedSharesDisplay ?? null,
    remainingLockedShares: context.unlockState?.remainingLockedShares ?? null,
    remainingLockedSharesDisplay: context.unlockState?.remainingLockedSharesDisplay ?? null,
    lockedProfit: context.unlockState?.lockedProfit ?? null,
    lockedProfitDisplay: context.unlockState?.lockedProfitDisplay ?? null,
    lockedProfitPercent: context.unlockState?.lockedProfitPercent ?? null,
    lockedProfitDegradation: context.unlockState?.lockedProfitDegradation ?? null,
    lastReport: context.unlockState?.lastReport ?? null,
    unlockPercent: context.unlockState?.unlockPercent ?? null,
    unlockRatePerDay: context.unlockState?.unlockRatePerDay ?? null,
    fullProfitUnlockDate: context.unlockState?.fullProfitUnlockDate ?? null,
    fullProfitUnlockDateIso: context.unlockState?.fullProfitUnlockDateIso ?? null,
    profitUnlockMode: context.unlockState?.profitUnlockMode ?? null,
    reallocation: {
      direction,
      pairedTransaction: false
    }
  }
}

export function mapProfitMaxUnlockTimeEventToActivity(
  log: RawVaultActivityLog,
  context: ActivityMappingContext = {}
): VaultActivityEvent {
  const base = buildBaseActivity(log)
  const profitMaxUnlockTime = getIntegerNumber(getArg(log.args, ['profitMaxUnlockTime', 'profit_max_unlock_time']))

  return {
    ...base,
    id: `${base.id}:unlock_update`,
    eventType: 'unlock_update',
    sourceEventType: 'UpdateProfitMaxUnlockTime',
    strategyAddress: null,
    label: 'Profit unlock window updated',
    description: 'The vault changed how long newly reported profit stays locked before it is fully released.',
    profitMaxUnlockTime,
    unlockedShares: context.unlockState?.unlockedShares ?? null,
    unlockedSharesDisplay: context.unlockState?.unlockedSharesDisplay ?? null,
    lockedShares: context.unlockState?.lockedShares ?? null,
    lockedSharesDisplay: context.unlockState?.lockedSharesDisplay ?? null,
    remainingLockedShares: context.unlockState?.remainingLockedShares ?? null,
    remainingLockedSharesDisplay: context.unlockState?.remainingLockedSharesDisplay ?? null,
    lockedProfit: context.unlockState?.lockedProfit ?? null,
    lockedProfitDisplay: context.unlockState?.lockedProfitDisplay ?? null,
    lockedProfitPercent: context.unlockState?.lockedProfitPercent ?? null,
    lockedProfitDegradation: context.unlockState?.lockedProfitDegradation ?? null,
    lastReport: context.unlockState?.lastReport ?? null,
    unlockPercent: context.unlockState?.unlockPercent ?? null,
    unlockRatePerDay: context.unlockState?.unlockRatePerDay ?? null,
    fullProfitUnlockDate: context.unlockState?.fullProfitUnlockDate ?? null,
    fullProfitUnlockDateIso: context.unlockState?.fullProfitUnlockDateIso ?? null,
    profitUnlockMode: context.unlockState?.profitUnlockMode ?? null
  }
}

export function mapV2StrategyReportedEventToActivity(
  log: RawVaultActivityLog,
  context: ActivityMappingContext = {}
): VaultActivityEvent {
  const base = buildBaseActivity(log)
  const strategyAddress = getAddressArg(log.args, ['strategy'])
  const gain = toIntegerString(getArg(log.args, ['gain']))
  const loss = toIntegerString(getArg(log.args, ['loss']))
  const debtPaid = toIntegerString(getArg(log.args, ['debtPaid', 'debt_paid']))
  const totalGain = toIntegerString(getArg(log.args, ['totalGain', 'total_gain']))
  const totalLoss = toIntegerString(getArg(log.args, ['totalLoss', 'total_loss']))
  const totalDebt = toIntegerString(getArg(log.args, ['totalDebt', 'total_debt']))
  const debtAdded = toIntegerString(getArg(log.args, ['debtAdded', 'debt_added']))
  const debtRatio = toIntegerString(getArg(log.args, ['debtRatio', 'debt_ratio']))
  const debtDelta = getDebtDeltaFromAddedPaid(debtAdded, debtPaid)
  const direction = getReallocationDirection(debtDelta)
  const realizedProfitOrLoss = isNonZeroIntegerString(gain) || isNonZeroIntegerString(loss)

  return {
    ...base,
    id: `${base.id}:v2_strategy_reported`,
    eventType: realizedProfitOrLoss ? 'harvest' : 'strategy_reported',
    sourceEventType: 'V2StrategyReported',
    strategyAddress,
    strategyName: getStrategyName(strategyAddress, context.strategyNamesByAddress),
    label: realizedProfitOrLoss ? 'Harvest reported' : 'Strategy reported',
    description: realizedProfitOrLoss
      ? 'The V2 strategy reported realized gain/loss and any debt added or paid during harvest.'
      : 'The V2 strategy reported debt/accounting state without realized gain or loss.',
    gain,
    gainDisplay: formatBaseUnitToDisplayNumber(gain, context.assetDecimals),
    loss,
    lossDisplay: formatBaseUnitToDisplayNumber(loss, context.assetDecimals),
    debtAdded,
    debtAddedDisplay: formatBaseUnitToDisplayNumber(debtAdded, context.assetDecimals),
    debtPaid,
    debtPaidDisplay: formatBaseUnitToDisplayNumber(debtPaid, context.assetDecimals),
    debtDelta,
    debtDeltaDisplay: formatBaseUnitToDisplayNumber(debtDelta, context.assetDecimals),
    totalDebt,
    totalDebtDisplay: formatBaseUnitToDisplayNumber(totalDebt, context.assetDecimals),
    currentDebt: totalDebt,
    currentDebtDisplay: formatBaseUnitToDisplayNumber(totalDebt, context.assetDecimals),
    totalGain,
    totalGainDisplay: formatBaseUnitToDisplayNumber(totalGain, context.assetDecimals),
    totalLoss,
    totalLossDisplay: formatBaseUnitToDisplayNumber(totalLoss, context.assetDecimals),
    debtRatio,
    unlockedShares: context.unlockState?.unlockedShares ?? null,
    unlockedSharesDisplay: context.unlockState?.unlockedSharesDisplay ?? null,
    lockedShares: context.unlockState?.lockedShares ?? null,
    lockedSharesDisplay: context.unlockState?.lockedSharesDisplay ?? null,
    remainingLockedShares: context.unlockState?.remainingLockedShares ?? null,
    remainingLockedSharesDisplay: context.unlockState?.remainingLockedSharesDisplay ?? null,
    lockedProfit: context.unlockState?.lockedProfit ?? null,
    lockedProfitDisplay: context.unlockState?.lockedProfitDisplay ?? null,
    lockedProfitPercent: context.unlockState?.lockedProfitPercent ?? null,
    lockedProfitDegradation: context.unlockState?.lockedProfitDegradation ?? null,
    lastReport: context.unlockState?.lastReport ?? null,
    unlockPercent: context.unlockState?.unlockPercent ?? null,
    unlockRatePerDay: context.unlockState?.unlockRatePerDay ?? null,
    fullProfitUnlockDate: context.unlockState?.fullProfitUnlockDate ?? null,
    fullProfitUnlockDateIso: context.unlockState?.fullProfitUnlockDateIso ?? null,
    ppsAfter: context.unlockState?.pps ?? null,
    profitUnlockMode: context.unlockState?.profitUnlockMode ?? null,
    reallocation: {
      direction,
      pairedTransaction: false
    }
  }
}

export function mapV2DebtRatioEventToActivity(
  log: RawVaultActivityLog,
  sourceEventType: 'V2StrategyAdded' | 'V2StrategyRevoked' | 'V2StrategyUpdateDebtRatio',
  context: ActivityMappingContext = {}
): VaultActivityEvent {
  const base = buildBaseActivity(log)
  const strategyAddress = getAddressArg(log.args, ['strategy'])
  const rawDebtRatio = toIntegerString(getArg(log.args, ['debtRatio', 'debt_ratio']))
  const debtRatio = sourceEventType === 'V2StrategyRevoked' ? '0' : rawDebtRatio
  const direction =
    sourceEventType === 'V2StrategyAdded' && debtRatio !== null && debtRatio !== '0'
      ? 'increase'
      : sourceEventType === 'V2StrategyRevoked'
        ? 'decrease'
        : 'flat'
  const labelBySource = {
    V2StrategyAdded: 'Strategy added',
    V2StrategyRevoked: 'Strategy revoked',
    V2StrategyUpdateDebtRatio: 'Strategy debt ratio updated'
  }

  return {
    ...base,
    id: `${base.id}:${sourceEventType}`,
    eventType: 'debt_update',
    sourceEventType,
    strategyAddress,
    strategyName: getStrategyName(strategyAddress, context.strategyNamesByAddress),
    label: labelBySource[sourceEventType],
    description: 'The V2 vault changed this strategy allocation target through its debt ratio.',
    debtRatio,
    unlockedShares: context.unlockState?.unlockedShares ?? null,
    unlockedSharesDisplay: context.unlockState?.unlockedSharesDisplay ?? null,
    lockedShares: context.unlockState?.lockedShares ?? null,
    lockedSharesDisplay: context.unlockState?.lockedSharesDisplay ?? null,
    remainingLockedShares: context.unlockState?.remainingLockedShares ?? null,
    remainingLockedSharesDisplay: context.unlockState?.remainingLockedSharesDisplay ?? null,
    lockedProfit: context.unlockState?.lockedProfit ?? null,
    lockedProfitDisplay: context.unlockState?.lockedProfitDisplay ?? null,
    lockedProfitPercent: context.unlockState?.lockedProfitPercent ?? null,
    lockedProfitDegradation: context.unlockState?.lockedProfitDegradation ?? null,
    lastReport: context.unlockState?.lastReport ?? null,
    unlockPercent: context.unlockState?.unlockPercent ?? null,
    unlockRatePerDay: context.unlockState?.unlockRatePerDay ?? null,
    fullProfitUnlockDate: context.unlockState?.fullProfitUnlockDate ?? null,
    fullProfitUnlockDateIso: context.unlockState?.fullProfitUnlockDateIso ?? null,
    profitUnlockMode: context.unlockState?.profitUnlockMode ?? null,
    reallocation: {
      direction,
      pairedTransaction: false
    }
  }
}

function bigIntOrNull(value: bigint | string | number | null | undefined): bigint | null {
  const integerString = toIntegerString(value)
  if (integerString === null) {
    return null
  }

  try {
    return BigInt(integerString)
  } catch {
    return null
  }
}

function percentFromRatio(numerator: bigint | null, denominator: bigint | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0n) {
    return null
  }

  const scaled = (numerator * 100n * PERCENT_SCALE) / denominator
  return Number(scaled) / Number(PERCENT_SCALE)
}

function unlockRatePercentPerDay(profitUnlockingRate: bigint | null, totalSupply: bigint | null): number | null {
  if (profitUnlockingRate === null || totalSupply === null || totalSupply <= 0n) {
    return null
  }

  const denominator = totalSupply * 10n ** BigInt(RATE_SCALE_DECIMALS)
  const scaled = (profitUnlockingRate * SECONDS_PER_DAY * 100n * PERCENT_SCALE) / denominator
  return Number(scaled) / Number(PERCENT_SCALE)
}

function calculateV2UnlockDurationSeconds(lockedProfitDegradation: bigint | null): number | null {
  if (lockedProfitDegradation === null || lockedProfitDegradation <= 0n) {
    return null
  }

  const duration = (V2_LOCKED_PROFIT_DEGRADATION_COEFFICIENT + lockedProfitDegradation - 1n) / lockedProfitDegradation
  const numericDuration = Number(duration)
  return Number.isSafeInteger(numericDuration) ? numericDuration : null
}

function calculateV2LockedProfitRemaining(
  rawLockedProfit: bigint | null,
  lockedProfitDegradation: bigint | null,
  lastReport: number | null,
  timestamp: number
): bigint | null {
  if (rawLockedProfit === null || lockedProfitDegradation === null || lastReport === null) {
    return null
  }

  const elapsed = BigInt(Math.max(0, timestamp - lastReport))
  const degradedRatio = elapsed * lockedProfitDegradation
  if (degradedRatio >= V2_LOCKED_PROFIT_DEGRADATION_COEFFICIENT) {
    return 0n
  }

  return (
    (rawLockedProfit * (V2_LOCKED_PROFIT_DEGRADATION_COEFFICIENT - degradedRatio)) /
    V2_LOCKED_PROFIT_DEGRADATION_COEFFICIENT
  )
}

function calculateV3RemainingLockedShares(lockedShares: bigint | null, unlockedShares: bigint | null): bigint | null {
  if (lockedShares === null || unlockedShares === null) {
    return null
  }

  return lockedShares > unlockedShares ? lockedShares - unlockedShares : 0n
}

export function calculateUnlockStateFromRaw(
  raw: RawVaultUnlockReads,
  context: UnlockCalculationContext
): VaultUnlockState {
  const timestamp = normalizeTimestampToSeconds(context.timestamp, 'unlock timestamp')
  const shareDecimals = context.shareDecimals ?? context.assetDecimals ?? 18
  const assetDecimals = context.assetDecimals ?? shareDecimals
  const unlockedShares = toIntegerString(raw.unlockedShares)
  const profitUnlockingRate = toIntegerString(raw.profitUnlockingRate)
  const profitMaxUnlockTime = getIntegerNumber(raw.profitMaxUnlockTime)
  const fullProfitUnlockDate = getIntegerNumber(raw.fullProfitUnlockDate)
  const totalAssets = toIntegerString(raw.totalAssets)
  const pricePerShare = toIntegerString(raw.pricePerShare)
  const totalSupply = toIntegerString(raw.totalSupply)
  const lockedShares = toIntegerString(raw.lockedShares)
  const rawLockedProfit = bigIntOrNull(raw.lockedProfit)
  const lockedProfitDegradation = bigIntOrNull(raw.lockedProfitDegradation)
  const lastReport = getIntegerNumber(raw.lastReport)
  const v2LockedProfitRemaining = calculateV2LockedProfitRemaining(
    rawLockedProfit,
    lockedProfitDegradation,
    lastReport,
    timestamp
  )
  const lockedProfit = v2LockedProfitRemaining?.toString() ?? null
  const v2UnlockDuration = calculateV2UnlockDurationSeconds(lockedProfitDegradation)
  const v2FullUnlockTimestamp = lastReport !== null && v2UnlockDuration !== null ? lastReport + v2UnlockDuration : null
  const v2LockedProfitPercent = percentFromRatio(v2LockedProfitRemaining, bigIntOrNull(totalAssets))
  const v2DaysToUnlock =
    v2FullUnlockTimestamp !== null ? Math.max(0, (v2FullUnlockTimestamp - timestamp) / 86_400) : null
  const v2UnlockRatePerDay =
    v2LockedProfitPercent !== null && v2DaysToUnlock !== null && v2DaysToUnlock > 0
      ? v2LockedProfitPercent / v2DaysToUnlock
      : v2LockedProfitPercent === 0
        ? 0
        : null
  const unlockedSharesBigInt = bigIntOrNull(unlockedShares)
  const lockedSharesBigInt = bigIntOrNull(lockedShares)
  const totalSupplyBigInt = bigIntOrNull(totalSupply)
  const v3RemainingLockedShares = calculateV3RemainingLockedShares(lockedSharesBigInt, unlockedSharesBigInt)
  const v3UnlockPercent = percentFromRatio(unlockedSharesBigInt, totalSupplyBigInt)
  const v3LockedProfitPercent = percentFromRatio(v3RemainingLockedShares, totalSupplyBigInt)
  const v3UnlockRatePerDay = unlockRatePercentPerDay(bigIntOrNull(profitUnlockingRate), totalSupplyBigInt)
  const isV2UnlockState = rawLockedProfit !== null || lockedProfitDegradation !== null || lastReport !== null
  const remainingLockedShares = isV2UnlockState ? null : (v3RemainingLockedShares?.toString() ?? null)
  const unlockPercent = isV2UnlockState ? v2LockedProfitPercent : v3UnlockPercent
  const lockedProfitPercent = isV2UnlockState ? v2LockedProfitPercent : v3LockedProfitPercent
  const unlockRatePerDay = isV2UnlockState ? v2UnlockRatePerDay : v3UnlockRatePerDay
  const fullUnlockTimestamp = isV2UnlockState
    ? v2FullUnlockTimestamp
    : fullProfitUnlockDate !== null && fullProfitUnlockDate > 0
      ? fullProfitUnlockDate
      : null

  return {
    chainId: context.chainId,
    vaultAddress: context.vaultAddress.toLowerCase(),
    blockNumber:
      context.blockNumber === null || context.blockNumber === undefined
        ? null
        : normalizeBlockNumber(context.blockNumber),
    updatedAt: timestamp,
    updatedAtIso: toIsoUtc(timestamp),
    unlockedShares,
    unlockedSharesDisplay: formatBaseUnitToDisplayNumber(unlockedShares, shareDecimals),
    lockedShares,
    lockedSharesDisplay: formatBaseUnitToDisplayNumber(lockedShares, shareDecimals),
    remainingLockedShares,
    remainingLockedSharesDisplay: formatBaseUnitToDisplayNumber(remainingLockedShares, shareDecimals),
    lockedProfit,
    lockedProfitDisplay: formatBaseUnitToDisplayNumber(lockedProfit, assetDecimals),
    lockedProfitPercent,
    lockedProfitDegradation: toIntegerString(raw.lockedProfitDegradation),
    lastReport,
    totalSupply,
    totalSupplyDisplay: formatBaseUnitToDisplayNumber(totalSupply, shareDecimals),
    profitUnlockingRate,
    profitUnlockingRateDisplay: formatBaseUnitToDisplayNumber(profitUnlockingRate, shareDecimals + RATE_SCALE_DECIMALS),
    profitMaxUnlockTime,
    fullProfitUnlockDate: fullUnlockTimestamp,
    fullProfitUnlockDateIso: fullUnlockTimestamp ? toIsoUtc(fullUnlockTimestamp) : null,
    totalAssets,
    totalAssetsDisplay: formatBaseUnitToDisplayNumber(totalAssets, assetDecimals),
    pricePerShare,
    pricePerShareDisplay: formatBaseUnitToDisplayNumber(pricePerShare, shareDecimals),
    pps: formatBaseUnitToDisplayNumber(pricePerShare, shareDecimals),
    totalAssetsUsd: raw.totalAssetsUsd ?? null,
    unlockPercent,
    unlockRatePerDay,
    estimatedDaysToUnlock: fullUnlockTimestamp ? Math.max(0, (fullUnlockTimestamp - timestamp) / 86_400) : null,
    profitUnlockMode:
      isV2UnlockState || v2LockedProfitPercent !== null
        ? 'v2_locked_profit'
        : v3UnlockPercent !== null || v3LockedProfitPercent !== null
          ? 'v3_shares'
          : null
  }
}

export function annotateDebtReallocationEvents(events: VaultActivityEvent[]): VaultActivityEvent[] {
  const debtEventsByTransaction = new Map<string, VaultActivityEvent[]>()

  for (const event of events) {
    if (event.eventType !== 'debt_update') {
      continue
    }

    const txKey = event.txHash.toLowerCase()
    debtEventsByTransaction.set(txKey, [...(debtEventsByTransaction.get(txKey) ?? []), event])
  }

  const pairedTransactions = new Set<string>()
  for (const [txKey, txEvents] of debtEventsByTransaction) {
    const hasIncrease = txEvents.some((event) => event.reallocation?.direction === 'increase')
    const hasDecrease = txEvents.some((event) => event.reallocation?.direction === 'decrease')
    if (hasIncrease && hasDecrease) {
      pairedTransactions.add(txKey)
    }
  }

  return events.map((event) => {
    if (event.eventType !== 'debt_update') {
      return event
    }

    const txKey = event.txHash.toLowerCase()
    return {
      ...event,
      label: pairedTransactions.has(txKey) ? 'Debt reallocated' : event.label,
      reallocation: event.reallocation
        ? {
            ...event.reallocation,
            pairedTransaction: pairedTransactions.has(txKey)
          }
        : null
    }
  })
}
