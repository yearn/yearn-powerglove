import type {
  VaultActivityData,
  VaultActivityEvent,
  VaultActivityEventType,
  VaultActivityFixtureMeta,
  VaultActivitySeriesPoint,
  VaultProfitUnlockMode,
  VaultUnlockState
} from '@/types/vaultActivityTypes'

type JsonRecord = Record<string, unknown>

const ACTIVITY_EVENT_TYPES = new Set<VaultActivityEventType>([
  'harvest',
  'strategy_reported',
  'unlock_update',
  'debt_update'
])

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIntegerString(value: string): boolean {
  return /^-?\d+$/.test(value)
}

function normalizeAddress(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Vault activity fixture is missing ${fieldName}.`)
  }

  return value.trim().toLowerCase()
}

function getOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getOptionalAddress(value: unknown): string | null {
  return getOptionalString(value)?.toLowerCase() ?? null
}

function getFiniteNumber(value: unknown, fieldName: string): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(numeric)) {
    throw new Error(`Vault activity fixture has invalid ${fieldName}.`)
  }

  return numeric
}

function getOptionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(numeric) ? numeric : null
}

function getOptionalIntegerNumber(value: unknown): number | null {
  const numeric = getOptionalFiniteNumber(value)
  if (numeric === null || !Number.isInteger(numeric)) {
    return null
  }

  return numeric
}

export function toIntegerString(value: unknown): string | null {
  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? String(value) : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return isIntegerString(trimmed) ? trimmed : null
}

function bigintFromIntegerLike(value: unknown): bigint | null {
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

function roundNumber(value: number, decimals = 6): number {
  if (!Number.isFinite(value)) {
    return value
  }

  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

export function formatBaseUnitToDisplayNumber(value: unknown, decimals?: number | null): number | null {
  const integerValue = bigintFromIntegerLike(value)
  if (integerValue === null || decimals === null || decimals === undefined || decimals < 0 || decimals > 36) {
    return null
  }

  const isNegative = integerValue < 0n
  const absoluteValue = isNegative ? -integerValue : integerValue
  const divisor = 10n ** BigInt(decimals)
  const whole = absoluteValue / divisor
  const fraction = absoluteValue % divisor
  const fractionText = decimals > 0 ? fraction.toString().padStart(decimals, '0').replace(/0+$/, '') : ''
  const decimalText = fractionText ? `${whole.toString()}.${fractionText}` : whole.toString()
  const numeric = Number(`${isNegative ? '-' : ''}${decimalText}`)

  return Number.isFinite(numeric) ? numeric : null
}

export function normalizeTimestampToSeconds(value: unknown, fieldName = 'timestamp'): number {
  if (value instanceof Date) {
    const millis = value.getTime()
    if (Number.isNaN(millis)) {
      throw new Error(`Vault activity fixture has invalid ${fieldName}.`)
    }

    return Math.floor(millis / 1000)
  }

  if (typeof value === 'string' && !/^-?\d+(\.\d+)?$/.test(value.trim())) {
    const millis = Date.parse(value)
    if (!Number.isNaN(millis)) {
      return Math.floor(millis / 1000)
    }
  }

  const numeric = getFiniteNumber(value, fieldName)
  if (numeric > 1e17) {
    return Math.floor(numeric / 1e9)
  }
  if (numeric > 1e14) {
    return Math.floor(numeric / 1e6)
  }
  if (numeric > 1e11) {
    return Math.floor(numeric / 1e3)
  }

  return Math.floor(numeric)
}

export function toIsoUtc(timestampSeconds: number): string {
  const millis = timestampSeconds * 1000
  const date = new Date(millis)
  if (!Number.isFinite(millis) || Number.isNaN(date.getTime())) {
    throw new Error('Vault activity fixture has invalid timestamp.')
  }

  return date.toISOString()
}

function normalizeGeneratedAt(value: unknown): string {
  const timestamp =
    value === undefined || value === null ? Math.floor(Date.now() / 1000) : normalizeTimestampToSeconds(value)
  return toIsoUtc(timestamp)
}

function normalizeMeta(value: unknown): VaultActivityFixtureMeta {
  if (!isRecord(value)) {
    return {}
  }

  return {
    source: getOptionalString(value.source) ?? undefined,
    fromBlock: getOptionalIntegerNumber(value.fromBlock),
    toBlock: getOptionalIntegerNumber(value.toBlock),
    assetSymbol: getOptionalString(value.assetSymbol),
    assetDecimals: getOptionalIntegerNumber(value.assetDecimals),
    shareSymbol: getOptionalString(value.shareSymbol),
    shareDecimals: getOptionalIntegerNumber(value.shareDecimals)
  }
}

function getDecimals(meta: VaultActivityFixtureMeta): { assetDecimals: number | null; shareDecimals: number | null } {
  const assetDecimals = meta.assetDecimals ?? null
  return {
    assetDecimals,
    shareDecimals: meta.shareDecimals ?? assetDecimals
  }
}

function normalizeEventType(value: unknown): VaultActivityEventType {
  if (typeof value !== 'string' || !ACTIVITY_EVENT_TYPES.has(value as VaultActivityEventType)) {
    throw new Error('Vault activity fixture has invalid eventType.')
  }

  return value as VaultActivityEventType
}

function getEventTimestamp(record: JsonRecord): number {
  if (record.timestamp !== undefined && record.timestamp !== null) {
    return normalizeTimestampToSeconds(record.timestamp, 'event timestamp')
  }

  if (record.timestampIso !== undefined && record.timestampIso !== null) {
    return normalizeTimestampToSeconds(record.timestampIso, 'event timestampIso')
  }

  if (record.blockTimestamp !== undefined && record.blockTimestamp !== null) {
    return normalizeTimestampToSeconds(record.blockTimestamp, 'event blockTimestamp')
  }

  throw new Error('Vault activity fixture event is missing timestamp.')
}

function resolveEventLabel(eventType: VaultActivityEventType, record: JsonRecord): string {
  const explicitLabel = getOptionalString(record.label)
  if (explicitLabel) {
    return explicitLabel
  }

  if (eventType === 'strategy_reported' || eventType === 'harvest') {
    return 'Harvest reported'
  }
  if (eventType === 'unlock_update') {
    return 'Unlock state updated'
  }

  return 'Debt updated'
}

function resolveEventDescription(eventType: VaultActivityEventType, record: JsonRecord): string {
  const explicitDescription = getOptionalString(record.description)
  if (explicitDescription) {
    return explicitDescription
  }

  if (eventType === 'strategy_reported' || eventType === 'harvest') {
    return 'The strategy reported realized gain, loss, and accounting changes.'
  }
  if (eventType === 'unlock_update') {
    return 'The vault profit unlock schedule changed.'
  }

  return 'Strategy debt changed for this vault.'
}

function normalizeReallocation(value: unknown): VaultActivityEvent['reallocation'] {
  if (!isRecord(value)) {
    return null
  }

  const direction = value.direction
  if (direction !== 'increase' && direction !== 'decrease' && direction !== 'flat') {
    return null
  }

  return {
    direction,
    pairedTransaction: value.pairedTransaction === true
  }
}

function normalizeProfitUnlockMode(value: unknown): VaultProfitUnlockMode | null {
  if (value === 'v3_shares' || value === 'v2_locked_profit') {
    return value
  }

  return null
}

function normalizeActivityEvent(
  value: unknown,
  context: {
    chainId: number
    vaultAddress: string
    assetDecimals: number | null
    shareDecimals: number | null
  }
): VaultActivityEvent {
  if (!isRecord(value)) {
    throw new Error('Vault activity fixture event must be an object.')
  }

  const eventType = normalizeEventType(value.eventType)
  const timestamp = getEventTimestamp(value)
  const txHash = getOptionalString(value.txHash) ?? getOptionalString(value.transactionHash)
  const blockNumber = getOptionalIntegerNumber(value.blockNumber)
  const logIndex = getOptionalIntegerNumber(value.logIndex)

  if (!txHash) {
    throw new Error('Vault activity fixture event is missing txHash.')
  }
  if (blockNumber === null) {
    throw new Error('Vault activity fixture event is missing blockNumber.')
  }

  const assetsDelta = toIntegerString(value.assetsDelta)
  const sharesDelta = toIntegerString(value.sharesDelta)
  const gain = toIntegerString(value.gain)
  const loss = toIntegerString(value.loss)
  const currentDebt = toIntegerString(value.currentDebt)
  const newDebt = toIntegerString(value.newDebt)
  const debtDelta = toIntegerString(value.debtDelta)
  const debtAdded = toIntegerString(value.debtAdded)
  const debtPaid = toIntegerString(value.debtPaid)
  const totalDebt = toIntegerString(value.totalDebt)
  const totalGain = toIntegerString(value.totalGain)
  const totalLoss = toIntegerString(value.totalLoss)
  const unlockedShares = toIntegerString(value.unlockedShares)
  const lockedShares = toIntegerString(value.lockedShares)
  const remainingLockedShares = toIntegerString(value.remainingLockedShares)
  const lockedProfit = toIntegerString(value.lockedProfit)
  const fullProfitUnlockDate = getOptionalIntegerNumber(value.fullProfitUnlockDate)

  return {
    id:
      getOptionalString(value.id) ??
      `${context.chainId}:${context.vaultAddress}:${blockNumber}:${logIndex ?? 0}:${eventType}`,
    eventType,
    sourceEventType: getOptionalString(value.sourceEventType),
    chainId: context.chainId,
    vaultAddress: getOptionalAddress(value.vaultAddress) ?? context.vaultAddress,
    strategyAddress: getOptionalAddress(value.strategyAddress),
    strategyName: getOptionalString(value.strategyName),
    txHash,
    blockNumber,
    logIndex,
    timestamp,
    timestampIso: toIsoUtc(timestamp),
    label: resolveEventLabel(eventType, value),
    description: resolveEventDescription(eventType, value),
    valueUsd: getOptionalFiniteNumber(value.valueUsd),
    assetsDelta,
    assetsDeltaDisplay:
      getOptionalFiniteNumber(value.assetsDeltaDisplay) ??
      formatBaseUnitToDisplayNumber(assetsDelta, context.assetDecimals),
    sharesDelta,
    sharesDeltaDisplay:
      getOptionalFiniteNumber(value.sharesDeltaDisplay) ??
      formatBaseUnitToDisplayNumber(sharesDelta, context.shareDecimals),
    gain,
    gainDisplay:
      getOptionalFiniteNumber(value.gainDisplay) ?? formatBaseUnitToDisplayNumber(gain, context.assetDecimals),
    loss,
    lossDisplay:
      getOptionalFiniteNumber(value.lossDisplay) ?? formatBaseUnitToDisplayNumber(loss, context.assetDecimals),
    currentDebt,
    currentDebtDisplay:
      getOptionalFiniteNumber(value.currentDebtDisplay) ??
      formatBaseUnitToDisplayNumber(currentDebt, context.assetDecimals),
    newDebt,
    newDebtDisplay:
      getOptionalFiniteNumber(value.newDebtDisplay) ?? formatBaseUnitToDisplayNumber(newDebt, context.assetDecimals),
    debtDelta,
    debtDeltaDisplay:
      getOptionalFiniteNumber(value.debtDeltaDisplay) ??
      formatBaseUnitToDisplayNumber(debtDelta, context.assetDecimals),
    debtAdded,
    debtAddedDisplay:
      getOptionalFiniteNumber(value.debtAddedDisplay) ??
      formatBaseUnitToDisplayNumber(debtAdded, context.assetDecimals),
    debtPaid,
    debtPaidDisplay:
      getOptionalFiniteNumber(value.debtPaidDisplay) ?? formatBaseUnitToDisplayNumber(debtPaid, context.assetDecimals),
    totalDebt,
    totalDebtDisplay:
      getOptionalFiniteNumber(value.totalDebtDisplay) ??
      formatBaseUnitToDisplayNumber(totalDebt, context.assetDecimals),
    totalGain,
    totalGainDisplay:
      getOptionalFiniteNumber(value.totalGainDisplay) ??
      formatBaseUnitToDisplayNumber(totalGain, context.assetDecimals),
    totalLoss,
    totalLossDisplay:
      getOptionalFiniteNumber(value.totalLossDisplay) ??
      formatBaseUnitToDisplayNumber(totalLoss, context.assetDecimals),
    debtRatio: toIntegerString(value.debtRatio),
    unlockedShares,
    unlockedSharesDisplay:
      getOptionalFiniteNumber(value.unlockedSharesDisplay) ??
      formatBaseUnitToDisplayNumber(unlockedShares, context.shareDecimals),
    lockedShares,
    lockedSharesDisplay:
      getOptionalFiniteNumber(value.lockedSharesDisplay) ??
      formatBaseUnitToDisplayNumber(lockedShares, context.shareDecimals),
    remainingLockedShares,
    remainingLockedSharesDisplay:
      getOptionalFiniteNumber(value.remainingLockedSharesDisplay) ??
      formatBaseUnitToDisplayNumber(remainingLockedShares, context.shareDecimals),
    lockedProfit,
    lockedProfitDisplay:
      getOptionalFiniteNumber(value.lockedProfitDisplay) ??
      formatBaseUnitToDisplayNumber(lockedProfit, context.assetDecimals),
    lockedProfitPercent: getOptionalFiniteNumber(value.lockedProfitPercent),
    lockedProfitDegradation: toIntegerString(value.lockedProfitDegradation),
    lastReport: getOptionalIntegerNumber(value.lastReport),
    unlockPercent: getOptionalFiniteNumber(value.unlockPercent),
    unlockRatePerDay: getOptionalFiniteNumber(value.unlockRatePerDay),
    profitMaxUnlockTime: getOptionalIntegerNumber(value.profitMaxUnlockTime),
    fullProfitUnlockDate,
    fullProfitUnlockDateIso: fullProfitUnlockDate !== null ? toIsoUtc(fullProfitUnlockDate) : null,
    ppsBefore: getOptionalFiniteNumber(value.ppsBefore),
    ppsAfter: getOptionalFiniteNumber(value.ppsAfter),
    profitUnlockMode: normalizeProfitUnlockMode(value.profitUnlockMode),
    reallocation: normalizeReallocation(value.reallocation)
  }
}

function normalizeUnlockState(
  value: unknown,
  context: {
    chainId: number
    vaultAddress: string
    generatedAt: string
    assetDecimals: number | null
    shareDecimals: number | null
  }
): VaultUnlockState | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!isRecord(value)) {
    throw new Error('Vault activity currentUnlock must be an object or null.')
  }

  const updatedAt = normalizeTimestampToSeconds(
    value.updatedAt ?? value.updatedAtIso ?? context.generatedAt,
    'unlock updatedAt'
  )
  const fullProfitUnlockDate = getOptionalIntegerNumber(value.fullProfitUnlockDate)
  const unlockedShares = toIntegerString(value.unlockedShares)
  const lockedShares = toIntegerString(value.lockedShares)
  const remainingLockedShares = toIntegerString(value.remainingLockedShares)
  const lockedProfit = toIntegerString(value.lockedProfit)
  const totalSupply = toIntegerString(value.totalSupply)
  const profitUnlockingRate = toIntegerString(value.profitUnlockingRate)
  const totalAssets = toIntegerString(value.totalAssets)
  const pricePerShare = toIntegerString(value.pricePerShare)
  const pricePerShareDisplay =
    getOptionalFiniteNumber(value.pricePerShareDisplay) ??
    getOptionalFiniteNumber(value.pps) ??
    formatBaseUnitToDisplayNumber(pricePerShare, context.shareDecimals)

  return {
    chainId: context.chainId,
    vaultAddress: getOptionalAddress(value.vaultAddress) ?? context.vaultAddress,
    blockNumber: getOptionalIntegerNumber(value.blockNumber),
    updatedAt,
    updatedAtIso: toIsoUtc(updatedAt),
    unlockedShares,
    unlockedSharesDisplay:
      getOptionalFiniteNumber(value.unlockedSharesDisplay) ??
      formatBaseUnitToDisplayNumber(unlockedShares, context.shareDecimals),
    lockedShares,
    lockedSharesDisplay:
      getOptionalFiniteNumber(value.lockedSharesDisplay) ??
      formatBaseUnitToDisplayNumber(lockedShares, context.shareDecimals),
    remainingLockedShares,
    remainingLockedSharesDisplay:
      getOptionalFiniteNumber(value.remainingLockedSharesDisplay) ??
      formatBaseUnitToDisplayNumber(remainingLockedShares, context.shareDecimals),
    lockedProfit,
    lockedProfitDisplay:
      getOptionalFiniteNumber(value.lockedProfitDisplay) ??
      formatBaseUnitToDisplayNumber(lockedProfit, context.assetDecimals),
    lockedProfitPercent: getOptionalFiniteNumber(value.lockedProfitPercent),
    lockedProfitDegradation: toIntegerString(value.lockedProfitDegradation),
    lastReport: getOptionalIntegerNumber(value.lastReport),
    totalSupply,
    totalSupplyDisplay:
      getOptionalFiniteNumber(value.totalSupplyDisplay) ??
      formatBaseUnitToDisplayNumber(totalSupply, context.shareDecimals),
    profitUnlockingRate,
    profitUnlockingRateDisplay:
      getOptionalFiniteNumber(value.profitUnlockingRateDisplay) ??
      formatBaseUnitToDisplayNumber(
        profitUnlockingRate,
        context.shareDecimals === null ? null : context.shareDecimals + 12
      ),
    profitMaxUnlockTime: getOptionalIntegerNumber(value.profitMaxUnlockTime),
    fullProfitUnlockDate,
    fullProfitUnlockDateIso: fullProfitUnlockDate ? toIsoUtc(fullProfitUnlockDate) : null,
    totalAssets,
    totalAssetsDisplay:
      getOptionalFiniteNumber(value.totalAssetsDisplay) ??
      formatBaseUnitToDisplayNumber(totalAssets, context.assetDecimals),
    pricePerShare,
    pricePerShareDisplay,
    pps: getOptionalFiniteNumber(value.pps) ?? pricePerShareDisplay,
    totalAssetsUsd: getOptionalFiniteNumber(value.totalAssetsUsd),
    unlockPercent: getOptionalFiniteNumber(value.unlockPercent),
    unlockRatePerDay: getOptionalFiniteNumber(value.unlockRatePerDay),
    estimatedDaysToUnlock: getOptionalFiniteNumber(value.estimatedDaysToUnlock),
    profitUnlockMode: normalizeProfitUnlockMode(value.profitUnlockMode)
  }
}

function normalizeSeriesPoint(value: unknown): VaultActivitySeriesPoint {
  if (!isRecord(value)) {
    throw new Error('Vault activity series point must be an object.')
  }

  const timestamp = normalizeTimestampToSeconds(value.timestamp ?? value.date, 'series timestamp')
  const date = getOptionalString(value.date) ?? toIsoUtc(timestamp).slice(0, 10)

  return {
    date: date.slice(0, 10),
    timestamp,
    harvestCount: getOptionalIntegerNumber(value.harvestCount) ?? 0,
    harvestValueUsd: getOptionalFiniteNumber(value.harvestValueUsd),
    harvestGainDisplay: getOptionalFiniteNumber(value.harvestGainDisplay),
    remainingLockedSharesDisplay: getOptionalFiniteNumber(value.remainingLockedSharesDisplay),
    lockedProfitPercent: getOptionalFiniteNumber(value.lockedProfitPercent),
    unlockPercent: getOptionalFiniteNumber(value.unlockPercent),
    unlockRatePerDay: getOptionalFiniteNumber(value.unlockRatePerDay),
    pps: getOptionalFiniteNumber(value.pps),
    totalAssetsDisplay: getOptionalFiniteNumber(value.totalAssetsDisplay)
  }
}

export function hasRealizedGainOrLoss(event: VaultActivityEvent): boolean {
  if (event.gainDisplay !== null && event.gainDisplay !== undefined && event.gainDisplay !== 0) {
    return true
  }
  if (event.lossDisplay !== null && event.lossDisplay !== undefined && event.lossDisplay !== 0) {
    return true
  }

  return event.gain !== '0' && event.gain !== null && event.gain !== undefined
}

export function isHarvestLikeEvent(event: VaultActivityEvent): boolean {
  return event.eventType === 'harvest' || (event.eventType === 'strategy_reported' && hasRealizedGainOrLoss(event))
}

function sortSeriesPoints(points: VaultActivitySeriesPoint[]): VaultActivitySeriesPoint[] {
  return [...points].sort((a, b) => a.timestamp - b.timestamp)
}

function makeSeriesPoint(
  timestamp: number,
  values: Partial<Omit<VaultActivitySeriesPoint, 'date' | 'timestamp'>>
): VaultActivitySeriesPoint {
  return {
    date: toIsoUtc(timestamp).slice(0, 10),
    timestamp,
    harvestCount: values.harvestCount ?? 0,
    harvestValueUsd: values.harvestValueUsd ?? null,
    harvestGainDisplay: values.harvestGainDisplay ?? null,
    remainingLockedSharesDisplay: values.remainingLockedSharesDisplay ?? null,
    lockedProfitPercent: values.lockedProfitPercent ?? null,
    unlockPercent: values.unlockPercent ?? null,
    unlockRatePerDay: values.unlockRatePerDay ?? null,
    pps: values.pps ?? null,
    totalAssetsDisplay: values.totalAssetsDisplay ?? null
  }
}

function getV2FullUnlockPoint(event: VaultActivityEvent): VaultActivitySeriesPoint | null {
  if (
    event.profitUnlockMode !== 'v2_locked_profit' ||
    !event.fullProfitUnlockDate ||
    event.unlockPercent === null ||
    event.unlockPercent === undefined ||
    event.unlockPercent <= 0
  ) {
    return null
  }

  return makeSeriesPoint(event.fullProfitUnlockDate, {
    harvestCount: 0,
    lockedProfitPercent: 0,
    unlockPercent: 0,
    unlockRatePerDay: 0,
    pps: event.ppsAfter ?? null
  })
}

function withCarriedUnlockValues(points: VaultActivitySeriesPoint[]): VaultActivitySeriesPoint[] {
  let remainingLockedSharesDisplay: number | null = null
  let lockedProfitPercent: number | null = null
  let unlockPercent: number | null = null
  let unlockRatePerDay: number | null = null
  let pps: number | null = null
  let totalAssetsDisplay: number | null = null

  return sortSeriesPoints(points).map((point) => {
    remainingLockedSharesDisplay = point.remainingLockedSharesDisplay ?? remainingLockedSharesDisplay
    lockedProfitPercent = point.lockedProfitPercent ?? lockedProfitPercent
    unlockPercent = point.unlockPercent ?? unlockPercent
    unlockRatePerDay = point.unlockRatePerDay ?? unlockRatePerDay
    pps = point.pps ?? pps
    totalAssetsDisplay = point.totalAssetsDisplay ?? totalAssetsDisplay

    return {
      ...point,
      remainingLockedSharesDisplay,
      lockedProfitPercent,
      unlockPercent,
      unlockRatePerDay,
      pps,
      totalAssetsDisplay
    }
  })
}

export function buildVaultActivitySeries(
  events: VaultActivityEvent[],
  currentUnlock: VaultUnlockState | null
): VaultActivitySeriesPoint[] {
  const pointsByDate = new Map<string, VaultActivitySeriesPoint>()

  const getPoint = (timestamp: number): VaultActivitySeriesPoint => {
    const date = toIsoUtc(timestamp).slice(0, 10)
    const existingPoint = pointsByDate.get(date)
    if (existingPoint) {
      return existingPoint
    }

    const point: VaultActivitySeriesPoint = {
      date,
      timestamp,
      harvestCount: 0,
      harvestValueUsd: null,
      harvestGainDisplay: null,
      remainingLockedSharesDisplay: null,
      lockedProfitPercent: null,
      unlockPercent: null,
      unlockRatePerDay: null,
      pps: null,
      totalAssetsDisplay: null
    }
    pointsByDate.set(date, point)
    return point
  }

  for (const event of events) {
    const point = getPoint(event.timestamp)
    point.timestamp = Math.min(point.timestamp, event.timestamp)

    if (isHarvestLikeEvent(event)) {
      point.harvestCount += 1
      if (event.valueUsd !== null && event.valueUsd !== undefined) {
        point.harvestValueUsd = roundNumber((point.harvestValueUsd ?? 0) + event.valueUsd, 2)
      }
      if (event.gainDisplay !== null && event.gainDisplay !== undefined) {
        point.harvestGainDisplay = roundNumber((point.harvestGainDisplay ?? 0) + event.gainDisplay, 6)
      }
    }

    point.remainingLockedSharesDisplay = event.remainingLockedSharesDisplay ?? point.remainingLockedSharesDisplay
    point.lockedProfitPercent = event.lockedProfitPercent ?? point.lockedProfitPercent
    point.unlockPercent = event.unlockPercent ?? point.unlockPercent
    point.unlockRatePerDay = event.unlockRatePerDay ?? point.unlockRatePerDay
    point.pps = event.ppsAfter ?? point.pps

    const v2FullUnlockPoint = getV2FullUnlockPoint(event)
    if (v2FullUnlockPoint) {
      const existingPoint = pointsByDate.get(v2FullUnlockPoint.date)
      if (existingPoint && existingPoint.timestamp === v2FullUnlockPoint.timestamp) {
        existingPoint.unlockPercent = v2FullUnlockPoint.unlockPercent
        existingPoint.lockedProfitPercent = v2FullUnlockPoint.lockedProfitPercent
        existingPoint.unlockRatePerDay = v2FullUnlockPoint.unlockRatePerDay
        existingPoint.pps = existingPoint.pps ?? v2FullUnlockPoint.pps
      } else {
        pointsByDate.set(`${v2FullUnlockPoint.date}:${v2FullUnlockPoint.timestamp}`, v2FullUnlockPoint)
      }
    }
  }

  if (currentUnlock) {
    const point = getPoint(currentUnlock.updatedAt)
    point.unlockPercent = currentUnlock.unlockPercent ?? point.unlockPercent
    point.remainingLockedSharesDisplay =
      currentUnlock.remainingLockedSharesDisplay ?? point.remainingLockedSharesDisplay
    point.lockedProfitPercent = currentUnlock.lockedProfitPercent ?? point.lockedProfitPercent
    point.unlockRatePerDay = currentUnlock.unlockRatePerDay ?? point.unlockRatePerDay
    point.pps = currentUnlock.pps ?? point.pps
    point.totalAssetsDisplay = currentUnlock.totalAssetsDisplay ?? point.totalAssetsDisplay
  }

  return withCarriedUnlockValues([...pointsByDate.values()])
}

interface V2UnlockChartSample {
  timestamp: number
  unlockPercent: number
  unlockRatePerDay: number | null
  fullProfitUnlockDate: number | null
  harvestCount: number
  harvestValueUsd: number | null
  harvestGainDisplay: number | null
  pps: number | null
  totalAssetsDisplay: number | null
}

function getFiniteChartNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getV2EventChartSample(event: VaultActivityEvent): V2UnlockChartSample | null {
  const unlockPercent = getFiniteChartNumber(event.unlockPercent)
  if (event.profitUnlockMode !== 'v2_locked_profit' || unlockPercent === null) {
    return null
  }

  return {
    timestamp: event.timestamp,
    unlockPercent,
    unlockRatePerDay: getFiniteChartNumber(event.unlockRatePerDay),
    fullProfitUnlockDate: getFiniteChartNumber(event.fullProfitUnlockDate),
    harvestCount: isHarvestLikeEvent(event) ? 1 : 0,
    harvestValueUsd: getFiniteChartNumber(event.valueUsd),
    harvestGainDisplay: getFiniteChartNumber(event.gainDisplay),
    pps: getFiniteChartNumber(event.ppsAfter),
    totalAssetsDisplay: null
  }
}

function getV2CurrentUnlockChartSample(currentUnlock: VaultUnlockState | null): V2UnlockChartSample | null {
  const unlockPercent = getFiniteChartNumber(currentUnlock?.unlockPercent)
  if (currentUnlock?.profitUnlockMode !== 'v2_locked_profit' || unlockPercent === null) {
    return null
  }

  return {
    timestamp: currentUnlock.updatedAt,
    unlockPercent,
    unlockRatePerDay: getFiniteChartNumber(currentUnlock.unlockRatePerDay),
    fullProfitUnlockDate: getFiniteChartNumber(currentUnlock.fullProfitUnlockDate),
    harvestCount: 0,
    harvestValueUsd: null,
    harvestGainDisplay: null,
    pps: getFiniteChartNumber(currentUnlock.pps),
    totalAssetsDisplay: getFiniteChartNumber(currentUnlock.totalAssetsDisplay)
  }
}

function getV2SampleFullUnlockTimestamp(sample: V2UnlockChartSample): number | null {
  return sample.fullProfitUnlockDate !== null && sample.fullProfitUnlockDate > sample.timestamp
    ? sample.fullProfitUnlockDate
    : null
}

function projectV2LockedProfitPercent(sample: V2UnlockChartSample, timestamp: number): number {
  const fullUnlockTimestamp = getV2SampleFullUnlockTimestamp(sample)
  if (fullUnlockTimestamp === null) {
    return timestamp <= sample.timestamp ? roundNumber(sample.unlockPercent) : 0
  }

  if (timestamp <= sample.timestamp) {
    return roundNumber(sample.unlockPercent)
  }

  if (timestamp >= fullUnlockTimestamp) {
    return 0
  }

  const remainingRatio = (fullUnlockTimestamp - timestamp) / (fullUnlockTimestamp - sample.timestamp)
  return roundNumber(sample.unlockPercent * remainingRatio)
}

function projectV2UnlockRatePerDay(sample: V2UnlockChartSample, timestamp: number): number | null {
  const rate = sample.unlockRatePerDay
  if (rate === null) {
    return null
  }

  const fullUnlockTimestamp = getV2SampleFullUnlockTimestamp(sample)
  return fullUnlockTimestamp !== null && timestamp >= fullUnlockTimestamp ? 0 : roundNumber(rate)
}

function makeProjectedV2Point(sample: V2UnlockChartSample, timestamp: number): VaultActivitySeriesPoint {
  return makeSeriesPoint(timestamp, {
    unlockPercent: projectV2LockedProfitPercent(sample, timestamp),
    unlockRatePerDay: projectV2UnlockRatePerDay(sample, timestamp),
    pps: sample.pps,
    totalAssetsDisplay: sample.totalAssetsDisplay
  })
}

function makeV2SamplePoint(sample: V2UnlockChartSample): VaultActivitySeriesPoint {
  return makeSeriesPoint(sample.timestamp, {
    harvestCount: sample.harvestCount,
    harvestValueUsd: sample.harvestValueUsd,
    harvestGainDisplay: sample.harvestGainDisplay,
    unlockPercent: roundNumber(sample.unlockPercent),
    unlockRatePerDay: sample.unlockRatePerDay === null ? null : roundNumber(sample.unlockRatePerDay),
    pps: sample.pps,
    totalAssetsDisplay: sample.totalAssetsDisplay
  })
}

function pointsHaveSameChartValues(a: VaultActivitySeriesPoint, b: VaultActivitySeriesPoint): boolean {
  return (
    a.timestamp === b.timestamp &&
    a.harvestCount === b.harvestCount &&
    a.remainingLockedSharesDisplay === b.remainingLockedSharesDisplay &&
    a.lockedProfitPercent === b.lockedProfitPercent &&
    a.unlockPercent === b.unlockPercent &&
    a.unlockRatePerDay === b.unlockRatePerDay &&
    a.pps === b.pps &&
    a.totalAssetsDisplay === b.totalAssetsDisplay
  )
}

function pushChartPoint(points: VaultActivitySeriesPoint[], point: VaultActivitySeriesPoint) {
  const previous = points[points.length - 1]
  if (!previous || !pointsHaveSameChartValues(previous, point)) {
    points.push(point)
  }
}

function pushV2DecaySegment(points: VaultActivitySeriesPoint[], sample: V2UnlockChartSample, endTimestamp: number) {
  if (endTimestamp <= sample.timestamp) {
    return
  }

  const fullUnlockTimestamp = getV2SampleFullUnlockTimestamp(sample)
  if (fullUnlockTimestamp === null || endTimestamp < fullUnlockTimestamp) {
    pushChartPoint(points, makeProjectedV2Point(sample, endTimestamp))
    return
  }

  const finalActiveTimestamp = Math.max(sample.timestamp, fullUnlockTimestamp - 1)
  if (finalActiveTimestamp > sample.timestamp) {
    pushChartPoint(points, makeProjectedV2Point(sample, finalActiveTimestamp))
  }

  pushChartPoint(points, makeProjectedV2Point(sample, fullUnlockTimestamp))

  if (endTimestamp > fullUnlockTimestamp) {
    pushChartPoint(points, makeProjectedV2Point(sample, endTimestamp))
  }
}

function buildV2LockedProfitChartSeries(
  events: VaultActivityEvent[],
  currentUnlock: VaultUnlockState | null
): VaultActivitySeriesPoint[] | null {
  const samples = events.map(getV2EventChartSample).filter((sample): sample is V2UnlockChartSample => sample !== null)

  const currentUnlockSample = getV2CurrentUnlockChartSample(currentUnlock)
  if (currentUnlockSample) {
    samples.push(currentUnlockSample)
  }

  if (samples.length === 0) {
    return null
  }

  const sortedSamples = samples.sort((a, b) => a.timestamp - b.timestamp)
  const points: VaultActivitySeriesPoint[] = []
  let activeSample: V2UnlockChartSample | null = null

  for (const sample of sortedSamples) {
    if (activeSample) {
      pushV2DecaySegment(points, activeSample, sample.timestamp)
    }

    pushChartPoint(points, makeV2SamplePoint(sample))
    activeSample = sample
  }

  if (activeSample) {
    const fullUnlockTimestamp = getV2SampleFullUnlockTimestamp(activeSample)
    if (fullUnlockTimestamp !== null) {
      pushV2DecaySegment(points, activeSample, fullUnlockTimestamp)
    }
  }

  return points
}

export function buildVaultActivityChartSeries({
  events,
  series,
  currentUnlock
}: Pick<VaultActivityData, 'events' | 'series' | 'currentUnlock'>): VaultActivitySeriesPoint[] {
  return buildV2LockedProfitChartSeries(events, currentUnlock) ?? series
}

interface LockedProfitChartSample {
  timestamp: number
  lockedProfitPercent: number
  unlockRatePerDay: number | null
  fullProfitUnlockDate: number | null
  harvestCount: number
  harvestValueUsd: number | null
  harvestGainDisplay: number | null
  pps: number | null
  totalAssetsDisplay: number | null
}

function getLockedProfitPercentForChart(
  value: Pick<VaultActivityEvent | VaultUnlockState, 'lockedProfitPercent' | 'profitUnlockMode' | 'unlockPercent'>
): number | null {
  const lockedProfitPercent = getFiniteChartNumber(value.lockedProfitPercent)
  if (lockedProfitPercent !== null) {
    return lockedProfitPercent
  }

  return value.profitUnlockMode === 'v2_locked_profit' ? getFiniteChartNumber(value.unlockPercent) : null
}

function getLockedProfitEventChartSample(event: VaultActivityEvent): LockedProfitChartSample | null {
  const lockedProfitPercent = getLockedProfitPercentForChart(event)
  if (lockedProfitPercent === null) {
    return null
  }

  return {
    timestamp: event.timestamp,
    lockedProfitPercent,
    unlockRatePerDay: getFiniteChartNumber(event.unlockRatePerDay),
    fullProfitUnlockDate: getFiniteChartNumber(event.fullProfitUnlockDate),
    harvestCount: isHarvestLikeEvent(event) ? 1 : 0,
    harvestValueUsd: getFiniteChartNumber(event.valueUsd),
    harvestGainDisplay: getFiniteChartNumber(event.gainDisplay),
    pps: getFiniteChartNumber(event.ppsAfter),
    totalAssetsDisplay: null
  }
}

function getLockedProfitCurrentUnlockChartSample(
  currentUnlock: VaultUnlockState | null
): LockedProfitChartSample | null {
  if (!currentUnlock) {
    return null
  }

  const lockedProfitPercent = getLockedProfitPercentForChart(currentUnlock)
  if (lockedProfitPercent === null) {
    return null
  }

  return {
    timestamp: currentUnlock.updatedAt,
    lockedProfitPercent,
    unlockRatePerDay: getFiniteChartNumber(currentUnlock.unlockRatePerDay),
    fullProfitUnlockDate: getFiniteChartNumber(currentUnlock.fullProfitUnlockDate),
    harvestCount: 0,
    harvestValueUsd: null,
    harvestGainDisplay: null,
    pps: getFiniteChartNumber(currentUnlock.pps),
    totalAssetsDisplay: getFiniteChartNumber(currentUnlock.totalAssetsDisplay)
  }
}

function getLockedProfitSampleFullUnlockTimestamp(sample: LockedProfitChartSample): number | null {
  return sample.fullProfitUnlockDate !== null && sample.fullProfitUnlockDate > sample.timestamp
    ? sample.fullProfitUnlockDate
    : null
}

function projectLockedProfitPercent(sample: LockedProfitChartSample, timestamp: number): number {
  const fullUnlockTimestamp = getLockedProfitSampleFullUnlockTimestamp(sample)
  if (fullUnlockTimestamp === null) {
    return timestamp <= sample.timestamp ? roundNumber(sample.lockedProfitPercent) : 0
  }

  if (timestamp <= sample.timestamp) {
    return roundNumber(sample.lockedProfitPercent)
  }

  if (timestamp >= fullUnlockTimestamp) {
    return 0
  }

  const remainingRatio = (fullUnlockTimestamp - timestamp) / (fullUnlockTimestamp - sample.timestamp)
  return roundNumber(sample.lockedProfitPercent * remainingRatio)
}

function projectLockedProfitUnlockRatePerDay(sample: LockedProfitChartSample, timestamp: number): number | null {
  const rate = sample.unlockRatePerDay
  if (rate === null) {
    return null
  }

  const fullUnlockTimestamp = getLockedProfitSampleFullUnlockTimestamp(sample)
  return fullUnlockTimestamp !== null && timestamp >= fullUnlockTimestamp ? 0 : roundNumber(rate)
}

function makeProjectedLockedProfitPoint(sample: LockedProfitChartSample, timestamp: number): VaultActivitySeriesPoint {
  return makeSeriesPoint(timestamp, {
    lockedProfitPercent: projectLockedProfitPercent(sample, timestamp),
    unlockRatePerDay: projectLockedProfitUnlockRatePerDay(sample, timestamp),
    pps: sample.pps,
    totalAssetsDisplay: sample.totalAssetsDisplay
  })
}

function makeLockedProfitSamplePoint(sample: LockedProfitChartSample): VaultActivitySeriesPoint {
  return makeSeriesPoint(sample.timestamp, {
    harvestCount: sample.harvestCount,
    harvestValueUsd: sample.harvestValueUsd,
    harvestGainDisplay: sample.harvestGainDisplay,
    lockedProfitPercent: roundNumber(sample.lockedProfitPercent),
    unlockRatePerDay: sample.unlockRatePerDay === null ? null : roundNumber(sample.unlockRatePerDay),
    pps: sample.pps,
    totalAssetsDisplay: sample.totalAssetsDisplay
  })
}

function pushLockedProfitDecaySegment(
  points: VaultActivitySeriesPoint[],
  sample: LockedProfitChartSample,
  endTimestamp: number
) {
  if (endTimestamp <= sample.timestamp) {
    return
  }

  const fullUnlockTimestamp = getLockedProfitSampleFullUnlockTimestamp(sample)
  if (fullUnlockTimestamp === null || endTimestamp < fullUnlockTimestamp) {
    pushChartPoint(points, makeProjectedLockedProfitPoint(sample, endTimestamp))
    return
  }

  const finalActiveTimestamp = Math.max(sample.timestamp, fullUnlockTimestamp - 1)
  if (finalActiveTimestamp > sample.timestamp) {
    pushChartPoint(points, makeProjectedLockedProfitPoint(sample, finalActiveTimestamp))
  }

  pushChartPoint(points, makeProjectedLockedProfitPoint(sample, fullUnlockTimestamp))

  if (endTimestamp > fullUnlockTimestamp) {
    pushChartPoint(points, makeProjectedLockedProfitPoint(sample, endTimestamp))
  }
}

export function buildVaultLockedProfitChartSeries({
  events,
  currentUnlock
}: Pick<VaultActivityData, 'events' | 'series' | 'currentUnlock'>): VaultActivitySeriesPoint[] {
  const samples = events
    .map(getLockedProfitEventChartSample)
    .filter((sample): sample is LockedProfitChartSample => sample !== null)

  const currentUnlockSample = getLockedProfitCurrentUnlockChartSample(currentUnlock)
  if (currentUnlockSample) {
    samples.push(currentUnlockSample)
  }

  if (samples.length === 0) {
    return []
  }

  const sortedSamples = samples.sort((a, b) => a.timestamp - b.timestamp)
  const points: VaultActivitySeriesPoint[] = []
  let activeSample: LockedProfitChartSample | null = null

  for (const sample of sortedSamples) {
    if (activeSample) {
      pushLockedProfitDecaySegment(points, activeSample, sample.timestamp)
    }

    pushChartPoint(points, makeLockedProfitSamplePoint(sample))
    activeSample = sample
  }

  if (activeSample) {
    const fullUnlockTimestamp = getLockedProfitSampleFullUnlockTimestamp(activeSample)
    if (fullUnlockTimestamp !== null) {
      pushLockedProfitDecaySegment(points, activeSample, fullUnlockTimestamp)
    }
  }

  return points
}

interface LockedSharesChartSample {
  timestamp: number
  remainingLockedSharesDisplay: number
  fullProfitUnlockDate: number | null
  harvestCount: number
  harvestValueUsd: number | null
  harvestGainDisplay: number | null
  pps: number | null
  totalAssetsDisplay: number | null
}

function getRemainingLockedSharesForChart(
  value: Pick<
    VaultActivityEvent | VaultUnlockState,
    'remainingLockedSharesDisplay' | 'lockedSharesDisplay' | 'unlockedSharesDisplay' | 'profitUnlockMode'
  >
): number | null {
  const remainingLockedSharesDisplay = getFiniteChartNumber(value.remainingLockedSharesDisplay)
  if (remainingLockedSharesDisplay !== null) {
    return remainingLockedSharesDisplay
  }

  if (value.profitUnlockMode !== 'v3_shares') {
    return null
  }

  const lockedSharesDisplay = getFiniteChartNumber(value.lockedSharesDisplay)
  const unlockedSharesDisplay = getFiniteChartNumber(value.unlockedSharesDisplay)
  if (lockedSharesDisplay === null || unlockedSharesDisplay === null) {
    return null
  }

  return Math.max(lockedSharesDisplay - unlockedSharesDisplay, 0)
}

function getLockedSharesEventChartSample(event: VaultActivityEvent): LockedSharesChartSample | null {
  const remainingLockedSharesDisplay = getRemainingLockedSharesForChart(event)
  if (remainingLockedSharesDisplay === null) {
    return null
  }

  return {
    timestamp: event.timestamp,
    remainingLockedSharesDisplay,
    fullProfitUnlockDate: getFiniteChartNumber(event.fullProfitUnlockDate),
    harvestCount: isHarvestLikeEvent(event) ? 1 : 0,
    harvestValueUsd: getFiniteChartNumber(event.valueUsd),
    harvestGainDisplay: getFiniteChartNumber(event.gainDisplay),
    pps: getFiniteChartNumber(event.ppsAfter),
    totalAssetsDisplay: null
  }
}

function getLockedSharesCurrentUnlockChartSample(
  currentUnlock: VaultUnlockState | null
): LockedSharesChartSample | null {
  if (!currentUnlock) {
    return null
  }

  const remainingLockedSharesDisplay = getRemainingLockedSharesForChart(currentUnlock)
  if (remainingLockedSharesDisplay === null) {
    return null
  }

  return {
    timestamp: currentUnlock.updatedAt,
    remainingLockedSharesDisplay,
    fullProfitUnlockDate: getFiniteChartNumber(currentUnlock.fullProfitUnlockDate),
    harvestCount: 0,
    harvestValueUsd: null,
    harvestGainDisplay: null,
    pps: getFiniteChartNumber(currentUnlock.pps),
    totalAssetsDisplay: getFiniteChartNumber(currentUnlock.totalAssetsDisplay)
  }
}

function getLockedSharesSampleFullUnlockTimestamp(sample: LockedSharesChartSample): number | null {
  return sample.fullProfitUnlockDate !== null && sample.fullProfitUnlockDate > sample.timestamp
    ? sample.fullProfitUnlockDate
    : null
}

function projectRemainingLockedShares(sample: LockedSharesChartSample, timestamp: number): number {
  const fullUnlockTimestamp = getLockedSharesSampleFullUnlockTimestamp(sample)
  if (fullUnlockTimestamp === null) {
    return timestamp <= sample.timestamp ? roundNumber(sample.remainingLockedSharesDisplay) : 0
  }

  if (timestamp <= sample.timestamp) {
    return roundNumber(sample.remainingLockedSharesDisplay)
  }

  if (timestamp >= fullUnlockTimestamp) {
    return 0
  }

  const remainingRatio = (fullUnlockTimestamp - timestamp) / (fullUnlockTimestamp - sample.timestamp)
  return roundNumber(sample.remainingLockedSharesDisplay * remainingRatio)
}

function makeProjectedLockedSharesPoint(sample: LockedSharesChartSample, timestamp: number): VaultActivitySeriesPoint {
  return makeSeriesPoint(timestamp, {
    remainingLockedSharesDisplay: projectRemainingLockedShares(sample, timestamp),
    pps: sample.pps,
    totalAssetsDisplay: sample.totalAssetsDisplay
  })
}

function makeLockedSharesSamplePoint(sample: LockedSharesChartSample): VaultActivitySeriesPoint {
  return makeSeriesPoint(sample.timestamp, {
    harvestCount: sample.harvestCount,
    harvestValueUsd: sample.harvestValueUsd,
    harvestGainDisplay: sample.harvestGainDisplay,
    remainingLockedSharesDisplay: roundNumber(sample.remainingLockedSharesDisplay),
    pps: sample.pps,
    totalAssetsDisplay: sample.totalAssetsDisplay
  })
}

function pushLockedSharesDecaySegment(
  points: VaultActivitySeriesPoint[],
  sample: LockedSharesChartSample,
  endTimestamp: number
) {
  if (endTimestamp <= sample.timestamp) {
    return
  }

  const fullUnlockTimestamp = getLockedSharesSampleFullUnlockTimestamp(sample)
  if (fullUnlockTimestamp === null || endTimestamp < fullUnlockTimestamp) {
    pushChartPoint(points, makeProjectedLockedSharesPoint(sample, endTimestamp))
    return
  }

  const finalActiveTimestamp = Math.max(sample.timestamp, fullUnlockTimestamp - 1)
  if (finalActiveTimestamp > sample.timestamp) {
    pushChartPoint(points, makeProjectedLockedSharesPoint(sample, finalActiveTimestamp))
  }

  pushChartPoint(points, makeProjectedLockedSharesPoint(sample, fullUnlockTimestamp))

  if (endTimestamp > fullUnlockTimestamp) {
    pushChartPoint(points, makeProjectedLockedSharesPoint(sample, endTimestamp))
  }
}

export function buildVaultLockedSharesChartSeries({
  events,
  currentUnlock
}: Pick<VaultActivityData, 'events' | 'series' | 'currentUnlock'>): VaultActivitySeriesPoint[] {
  const samples = events
    .map(getLockedSharesEventChartSample)
    .filter((sample): sample is LockedSharesChartSample => sample !== null)

  const currentUnlockSample = getLockedSharesCurrentUnlockChartSample(currentUnlock)
  if (currentUnlockSample) {
    samples.push(currentUnlockSample)
  }

  if (samples.length === 0) {
    return []
  }

  const sortedSamples = samples.sort((a, b) => a.timestamp - b.timestamp)
  const points: VaultActivitySeriesPoint[] = []
  let activeSample: LockedSharesChartSample | null = null

  for (const sample of sortedSamples) {
    if (activeSample) {
      pushLockedSharesDecaySegment(points, activeSample, sample.timestamp)
    }

    pushChartPoint(points, makeLockedSharesSamplePoint(sample))
    activeSample = sample
  }

  if (activeSample) {
    const fullUnlockTimestamp = getLockedSharesSampleFullUnlockTimestamp(activeSample)
    if (fullUnlockTimestamp !== null) {
      pushLockedSharesDecaySegment(points, activeSample, fullUnlockTimestamp)
    }
  }

  return points
}

export function normalizeVaultActivityData(raw: unknown): VaultActivityData {
  if (!isRecord(raw)) {
    throw new Error('Vault activity fixture must be a JSON object.')
  }

  const schemaVersion = raw.schemaVersion === undefined ? 1 : getFiniteNumber(raw.schemaVersion, 'schemaVersion')
  if (schemaVersion !== 1) {
    throw new Error(`Unsupported vault activity fixture schemaVersion ${schemaVersion}.`)
  }

  const generatedAt = normalizeGeneratedAt(raw.generatedAt)
  const chainId = getFiniteNumber(raw.chainId, 'chainId')
  const vaultAddress = normalizeAddress(raw.vaultAddress, 'vaultAddress')
  const meta = normalizeMeta(raw.meta)
  const { assetDecimals, shareDecimals } = getDecimals(meta)
  const context = { chainId, vaultAddress, assetDecimals, shareDecimals }
  const events = Array.isArray(raw.events)
    ? raw.events
        .map((event) => normalizeActivityEvent(event, context))
        .sort((a, b) => {
          if (a.timestamp !== b.timestamp) {
            return a.timestamp - b.timestamp
          }
          if (a.blockNumber !== b.blockNumber) {
            return a.blockNumber - b.blockNumber
          }
          return (a.logIndex ?? 0) - (b.logIndex ?? 0)
        })
    : []
  const currentUnlock = normalizeUnlockState(raw.currentUnlock, {
    chainId,
    vaultAddress,
    generatedAt,
    assetDecimals,
    shareDecimals
  })
  const fixtureSeries = Array.isArray(raw.series) ? raw.series.map(normalizeSeriesPoint) : []
  const series =
    fixtureSeries.length > 0 ? withCarriedUnlockValues(fixtureSeries) : buildVaultActivitySeries(events, currentUnlock)

  return {
    schemaVersion: 1,
    generatedAt,
    chainId,
    vaultAddress,
    currentUnlock,
    events,
    series,
    meta
  }
}
