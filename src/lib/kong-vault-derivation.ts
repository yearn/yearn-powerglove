import { getAddress, isAddress } from 'viem'
import type { ChainId } from '@/constants/chains'
import type {
  KongNullableNumberish,
  KongVaultListItem,
  KongVaultPerformance,
  KongVaultSnapshot,
  KongVaultSnapshotComposition,
  KongVaultSnapshotDebt
} from '@/types/kong'
import type {
  EstimatedApySource,
  Vault,
  VaultDebt,
  VaultDerivedStrategy,
  VaultExtended,
  VaultStrategyStatus
} from '@/types/vaultTypes'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60

const toNumber = (value: KongNullableNumberish, fallback = 0): number => {
  if (value === null || value === undefined) {
    return fallback
  }
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const toNumberOrNull = (...values: KongNullableNumberish[]): number | null => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const numeric = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(numeric)) {
      continue
    }
    return numeric
  }
  return null
}

const toBigIntValue = (value: KongNullableNumberish): bigint => {
  if (value === null || value === undefined) {
    return 0n
  }
  try {
    return BigInt(String(value))
  } catch {
    return 0n
  }
}

const toBigIntString = (value: KongNullableNumberish, fallback = '0'): string => {
  if (value === null || value === undefined) {
    return fallback
  }
  try {
    return BigInt(String(value)).toString()
  } catch {
    return fallback
  }
}

const pickNonZeroBigNumberish = (values: KongNullableNumberish[], fallback = '0'): string => {
  let firstValid: string | null = null
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const asString = toBigIntString(value, '')
    if (!asString) {
      continue
    }
    if (!firstValid) {
      firstValid = asString
    }
    if (toBigIntValue(value) > 0n) {
      return asString
    }
  }
  return firstValid ?? fallback
}

const pickNonZeroNumber = (values: KongNullableNumberish[], fallback = 0): number => {
  let firstValid: number | null = null
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const numeric = toNumber(value, Number.NaN)
    if (!Number.isFinite(numeric)) {
      continue
    }
    if (firstValid === null) {
      firstValid = numeric
    }
    if (numeric > 0) {
      return numeric
    }
  }
  return firstValid ?? fallback
}

const resolveDecimals = (...values: KongNullableNumberish[]): number => {
  for (const value of values) {
    const numeric = toNumber(value, Number.NaN)
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric
    }
  }
  return 18
}

const normalizeAddress = (address?: string | null): string => {
  if (!address) {
    return ZERO_ADDRESS
  }
  try {
    return getAddress(address)
  } catch {
    return isAddress(address, { strict: false }) ? address.toLowerCase() : ZERO_ADDRESS
  }
}

const normalizeFeeToBps = (value: KongNullableNumberish, fallback = 0): number => {
  const numeric = toNumber(value, fallback)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  // Preserve bps inputs and convert decimal inputs into bps.
  return numeric <= 1 ? numeric * 10_000 : numeric
}

const isV3Vault = (apiVersion?: string | null, explicitV3?: boolean): boolean => {
  if (explicitV3) {
    return true
  }
  const version = apiVersion ?? ''
  return version.startsWith('3') || version.startsWith('~3')
}

const deriveVaultType = ({
  kind,
  type,
  name,
  apiVersion,
  v3
}: {
  kind?: string | null
  type?: string | null
  name?: string | null
  apiVersion?: string | null
  v3?: boolean
}): string | undefined => {
  const normalizedKind = kind?.toLowerCase() ?? ''
  if (normalizedKind.includes('multi')) {
    return '1'
  }
  if (normalizedKind.includes('single')) {
    return '2'
  }

  const normalizedType = type?.toLowerCase() ?? ''
  if (normalizedType.includes('allocator') || normalizedType.includes('multi')) {
    return '1'
  }
  if (normalizedType.includes('strategy') || normalizedType.includes('single')) {
    return '2'
  }

  const normalizedName = name?.toLowerCase() ?? ''
  if (normalizedName.includes('factory')) {
    return 'Factory Vault'
  }
  if ((apiVersion ?? '').startsWith('0')) {
    return 'Legacy Vault'
  }
  if (v3) {
    return '1'
  }
  return undefined
}

const ESTIMATED_APY_SOURCE_BY_TYPE: Record<string, EstimatedApySource> = {
  crv: 'est-crv',
  aero: 'est-aero',
  velo: 'est-velo',
  'katana-estimated-apr': 'est-katana',
  'yvusd-estimated-apr': 'est-yvusd'
}

export const resolveEstimatedApy = (
  performance?: KongVaultPerformance | null
): { value: number | null; source: EstimatedApySource | null } => {
  const estimatedApy = toNumberOrNull(performance?.estimated?.apy)
  if (estimatedApy !== null) {
    const estimatedType = performance?.estimated?.type?.toLowerCase() ?? ''
    return {
      value: estimatedApy,
      source: ESTIMATED_APY_SOURCE_BY_TYPE[estimatedType] ?? 'unknown'
    }
  }

  const oracleApy = toNumberOrNull(performance?.oracle?.apy)
  if (oracleApy !== null) {
    return { value: oracleApy, source: 'oracle' }
  }

  return { value: null, source: null }
}

const resolveYearnFlag = (inclusion?: Record<string, boolean>, explicitYearn?: boolean, fallback = true): boolean => {
  if (typeof inclusion?.isYearn === 'boolean') {
    return inclusion.isYearn
  }
  if (typeof explicitYearn === 'boolean') {
    return explicitYearn
  }
  return fallback
}

const computeDebtRatio = (debtValue: KongNullableNumberish, totalValue: KongNullableNumberish): number => {
  const debt = toBigIntValue(debtValue)
  const total = toBigIntValue(totalValue)
  if (debt <= 0n || total <= 0n) {
    return 0
  }
  return Number((debt * 10000n) / total)
}

const normalizeCompositionStatus = (
  status: KongVaultSnapshotComposition['status'],
  hasAllocation: boolean
): VaultStrategyStatus => {
  if (typeof status === 'string') {
    const normalized = status.toLowerCase().replace(/[\s-]+/g, '_')
    if (['active', 'enabled', 'live'].includes(normalized)) {
      return 'active'
    }
    if (['inactive', 'not_active', 'disabled', 'deprecated', 'retired', 'paused'].includes(normalized)) {
      return 'not_active'
    }
    if (['unallocated', 'idle', 'unfunded', 'no_debt'].includes(normalized)) {
      return 'unallocated'
    }
  }

  if (typeof status === 'number') {
    if (status === 1) {
      return 'active'
    }
    if (status <= 0) {
      return hasAllocation ? 'active' : 'unallocated'
    }
    return 'not_active'
  }

  return hasAllocation ? 'active' : 'unallocated'
}

const getTotalDebtForRatios = (snapshot: KongVaultSnapshot): string => {
  const snapshotTotalDebt = toBigIntValue(snapshot.totalDebt)
  if (snapshotTotalDebt > 0n) {
    return snapshotTotalDebt.toString()
  }

  let summed = 0n
  for (const composition of snapshot.composition ?? []) {
    const value = toBigIntValue(pickNonZeroBigNumberish([composition.totalDebt, composition.currentDebt]))
    if (value > 0n) {
      summed += value
    }
  }

  for (const debt of snapshot.debts ?? []) {
    const value = toBigIntValue(pickNonZeroBigNumberish([debt.currentDebt, debt.totalDebt]))
    if (value > 0n) {
      summed += value
    }
  }

  if (summed > 0n) {
    return summed.toString()
  }

  const snapshotAssets = toBigIntValue(snapshot.totalAssets)
  if (snapshotAssets > 0n) {
    return snapshotAssets.toString()
  }

  return '0'
}

const getTotalAssetsForRatios = (snapshot: KongVaultSnapshot, totalDebtForRatios: string): bigint => {
  const snapshotAssets = toBigIntValue(snapshot.totalAssets)
  if (snapshotAssets > 0n) {
    return snapshotAssets
  }

  const totalDebt = toBigIntValue(totalDebtForRatios)
  if (totalDebt > 0n) {
    return totalDebt
  }

  return 0n
}

const mapCompositionToStrategies = (
  composition: KongVaultSnapshotComposition[],
  totalAssetsForRatios: bigint
): VaultDerivedStrategy[] => {
  const strategies: VaultDerivedStrategy[] = []
  const nowSeconds = Math.floor(Date.now() / 1000)

  composition.forEach((entry, index) => {
    const address = normalizeAddress(entry.address ?? entry.strategy)
    if (address === ZERO_ADDRESS) {
      return
    }

    const totalDebt = pickNonZeroBigNumberish([entry.totalDebt, entry.currentDebt])
    const currentDebt = pickNonZeroBigNumberish([entry.currentDebt, totalDebt], totalDebt)
    const computedDebtRatio = computeDebtRatio(totalDebt, totalAssetsForRatios.toString())
    const debtRatio = pickNonZeroNumber([entry.debtRatio, computedDebtRatio], computedDebtRatio)
    const hasAllocation = toBigIntValue(totalDebt) > 0n || debtRatio > 0
    const lastReport = toNumber(entry.lastReport, 0)
    const reportSeconds = lastReport > 1_000_000_000_000 ? Math.floor(lastReport / 1000) : lastReport
    const shouldUseLatestReportApr =
      hasAllocation && reportSeconds > 0 && nowSeconds - reportSeconds <= ONE_WEEK_IN_SECONDS

    const estimatedApy = toNumberOrNull(entry.performance?.oracle?.apy, entry.performance?.estimated?.apy)
    const netApr = hasAllocation
      ? toNumberOrNull(entry.performance?.historical?.net, shouldUseLatestReportApr ? entry.latestReportApr : undefined)
      : null

    strategies.push({
      address,
      name: entry.name?.trim() || `Strategy ${index + 1}`,
      status: normalizeCompositionStatus(entry.status, hasAllocation),
      debtRatio,
      currentDebt,
      currentDebtUsd: toNumber(entry.currentDebtUsd, toNumber(entry.totalDebtUsd, 0)),
      maxDebt: pickNonZeroBigNumberish([entry.maxDebt], '0'),
      maxDebtUsd: toNumber(entry.maxDebtUsd, 0),
      targetDebtRatio: toBigIntString(entry.targetDebtRatio, '0'),
      maxDebtRatio: toBigIntString(entry.maxDebtRatio, '0'),
      totalDebt,
      totalDebtUsd: toNumber(entry.totalDebtUsd, toNumber(entry.currentDebtUsd, 0)),
      totalGain: toNumber(entry.totalGain, 0),
      totalGainUsd: toNumber(entry.totalGainUsd, 0),
      totalLoss: toNumber(entry.totalLoss, 0),
      totalLossUsd: toNumber(entry.totalLossUsd, 0),
      performanceFee: normalizeFeeToBps(entry.performanceFee, 0),
      managementFee: 0,
      lastReport,
      netApr,
      estimatedApy
    })
  })

  return strategies
}

const mapDebtsToStrategies = (debts: KongVaultSnapshotDebt[], totalDebtForRatios: string): VaultDerivedStrategy[] => {
  return debts.map((debt, index) => {
    const totalDebt = pickNonZeroBigNumberish([debt.totalDebt, debt.currentDebt])
    const currentDebt = pickNonZeroBigNumberish([debt.currentDebt, debt.totalDebt], totalDebt)
    const computedDebtRatio = computeDebtRatio(currentDebt, totalDebtForRatios)
    const debtRatio = pickNonZeroNumber([debt.debtRatio, computedDebtRatio], computedDebtRatio)
    const hasAllocation = toBigIntValue(totalDebt) > 0n || debtRatio > 0

    return {
      address: normalizeAddress(debt.strategy),
      name: `Strategy ${index + 1}`,
      status: hasAllocation ? 'active' : 'unallocated',
      debtRatio,
      currentDebt,
      currentDebtUsd: toNumber(debt.currentDebtUsd, toNumber(debt.totalDebtUsd, 0)),
      maxDebt: pickNonZeroBigNumberish([debt.maxDebt], '0'),
      maxDebtUsd: toNumber(debt.maxDebtUsd, 0),
      targetDebtRatio: toBigIntString(debt.targetDebtRatio, '0'),
      maxDebtRatio: toBigIntString(debt.maxDebtRatio, '0'),
      totalDebt,
      totalDebtUsd: toNumber(debt.totalDebtUsd, toNumber(debt.currentDebtUsd, 0)),
      totalGain: toNumber(debt.totalGain, 0),
      totalGainUsd: toNumber(debt.totalGainUsd, 0),
      totalLoss: toNumber(debt.totalLoss, 0),
      totalLossUsd: toNumber(debt.totalLossUsd, 0),
      performanceFee: normalizeFeeToBps(debt.performanceFee, 0),
      managementFee: 0,
      lastReport: toNumber(debt.lastReport, 0),
      netApr: null,
      estimatedApy: null
    }
  })
}

export const deriveKongSnapshotStrategies = (snapshot: KongVaultSnapshot): VaultDerivedStrategy[] => {
  const totalDebtForRatios = getTotalDebtForRatios(snapshot)
  const totalAssetsForRatios = getTotalAssetsForRatios(snapshot, totalDebtForRatios)

  if ((snapshot.composition?.length ?? 0) > 0) {
    return mapCompositionToStrategies(snapshot.composition ?? [], totalAssetsForRatios)
  }

  if ((snapshot.debts?.length ?? 0) > 0) {
    return mapDebtsToStrategies(snapshot.debts ?? [], totalDebtForRatios)
  }

  return []
}

const mapDerivedStrategiesToDebts = (strategies: VaultDerivedStrategy[]): VaultDebt[] => {
  return strategies.map((strategy) => ({
    strategy: strategy.address,
    currentDebt: strategy.currentDebt,
    currentDebtUsd: strategy.currentDebtUsd,
    maxDebt: strategy.maxDebt,
    maxDebtUsd: strategy.maxDebtUsd,
    targetDebtRatio: strategy.targetDebtRatio,
    maxDebtRatio: strategy.maxDebtRatio,
    debtRatio: strategy.debtRatio,
    totalDebt: toNumber(strategy.totalDebt, 0),
    totalDebtUsd: strategy.totalDebtUsd,
    totalGain: strategy.totalGain,
    totalGainUsd: strategy.totalGainUsd,
    totalLoss: strategy.totalLoss,
    totalLossUsd: strategy.totalLossUsd
  }))
}

export const mapKongListItemToVault = (item: KongVaultListItem): Vault => {
  const v3 = isV3Vault(item.apiVersion, item.v3)
  const performance = item.performance
  const historical = performance?.historical
  const managementFee = normalizeFeeToBps(item.fees?.managementFee)
  const performanceFee = normalizeFeeToBps(item.fees?.performanceFee)
  const estimatedApy = resolveEstimatedApy(performance)

  return {
    address: normalizeAddress(item.address),
    symbol: item.symbol ?? item.asset?.symbol ?? '',
    name: item.name,
    chainId: Number(item.chainId) as ChainId,
    inceptTime: String(toNumber(item.inceptTime, 0)),
    kind: item.kind ?? undefined,
    asset: {
      name: item.asset?.name ?? item.name,
      symbol: item.asset?.symbol ?? item.symbol ?? '',
      decimals: resolveDecimals(item.asset?.decimals, item.decimals),
      address: normalizeAddress(item.asset?.address)
    },
    apiVersion: item.apiVersion ?? (v3 ? '3' : ''),
    pricePerShare: 0,
    apy: {
      grossApr: toNumber(performance?.oracle?.apr, 0),
      net: toNumber(historical?.net, 0),
      weeklyNet: toNumber(historical?.weeklyNet, 0),
      monthlyNet: toNumber(historical?.monthlyNet, 0),
      inceptionNet: toNumber(historical?.inceptionNet, 0)
    },
    tvl: {
      close: toNumber(item.tvl, 0)
    },
    vaultType: deriveVaultType({
      kind: item.kind,
      type: item.type,
      name: item.name,
      apiVersion: item.apiVersion,
      v3
    }),
    yearn: resolveYearnFlag(item.inclusion, item.yearn, true),
    v3,
    erc4626: v3,
    fees: {
      managementFee,
      performanceFee
    },
    managementFee,
    performanceFee,
    forwardApyNet: estimatedApy.value,
    estimatedApySource: estimatedApy.source,
    historicalWeeklyApy: toNumberOrNull(historical?.weeklyNet),
    historicalMonthlyApy: toNumberOrNull(historical?.monthlyNet),
    strategyForwardAprs: {}
  }
}

export const mapKongSnapshotToVaultExtended = (
  snapshot: KongVaultSnapshot,
  baseVault?: VaultExtended | null
): VaultExtended => {
  const v3 = isV3Vault(snapshot.apiVersion, baseVault?.v3)
  const performance = snapshot.performance
  const historical = snapshot.performance?.historical
  const managementFee = normalizeFeeToBps(snapshot.fees?.managementFee, baseVault?.fees?.managementFee ?? 0)
  const performanceFee = normalizeFeeToBps(snapshot.fees?.performanceFee, baseVault?.fees?.performanceFee ?? 0)

  const strategyDetails = deriveKongSnapshotStrategies(snapshot).map((strategy) => ({
    ...strategy,
    managementFee
  }))

  const strategyForwardAprs = strategyDetails.reduce<Record<string, number | null>>((acc, strategy) => {
    acc[strategy.address.toLowerCase()] = strategy.estimatedApy
    return acc
  }, {})

  const estimatedApy = resolveEstimatedApy(performance)
  const hasSnapshotPerformance = performance !== null && performance !== undefined
  const forwardApyNet = hasSnapshotPerformance ? estimatedApy.value : (baseVault?.forwardApyNet ?? null)
  const estimatedApySource = hasSnapshotPerformance ? estimatedApy.source : (baseVault?.estimatedApySource ?? null)
  const historicalWeeklyApy =
    toNumberOrNull(snapshot.apy?.weeklyNet, historical?.weeklyNet) ?? baseVault?.historicalWeeklyApy ?? null
  const historicalMonthlyApy =
    toNumberOrNull(snapshot.apy?.monthlyNet, historical?.monthlyNet) ?? baseVault?.historicalMonthlyApy ?? null

  return {
    address: normalizeAddress(snapshot.address || baseVault?.address),
    symbol:
      snapshot.symbol || snapshot.meta?.displaySymbol || snapshot.meta?.token?.displaySymbol || baseVault?.symbol || '',
    name: snapshot.name || snapshot.meta?.name || snapshot.meta?.displayName || baseVault?.name || '',
    chainId: Number(snapshot.chainId || baseVault?.chainId || 1) as ChainId,
    inceptTime: String(toNumber(snapshot.inceptTime, Number(baseVault?.inceptTime ?? 0))),
    kind: snapshot.meta?.kind || baseVault?.kind,
    asset: {
      name: snapshot.asset?.name || snapshot.meta?.token?.name || baseVault?.asset?.name || '',
      symbol: snapshot.asset?.symbol || snapshot.meta?.token?.symbol || baseVault?.asset?.symbol || '',
      decimals: resolveDecimals(snapshot.asset?.decimals, snapshot.meta?.token?.decimals, baseVault?.asset?.decimals),
      address: normalizeAddress(snapshot.asset?.address || snapshot.meta?.token?.address || baseVault?.asset?.address)
    },
    apiVersion: snapshot.apiVersion ?? baseVault?.apiVersion,
    pricePerShare: toNumber(snapshot.apy?.pricePerShare, baseVault?.pricePerShare ?? 0),
    apy: {
      grossApr: toNumber(snapshot.apy?.grossApr, toNumber(performance?.oracle?.apr, baseVault?.apy?.grossApr ?? 0)),
      net: toNumber(snapshot.apy?.net, toNumber(historical?.net, baseVault?.apy?.net ?? 0)),
      weeklyNet: toNumber(snapshot.apy?.weeklyNet, toNumber(historical?.weeklyNet, baseVault?.apy?.weeklyNet ?? 0)),
      monthlyNet: toNumber(snapshot.apy?.monthlyNet, toNumber(historical?.monthlyNet, baseVault?.apy?.monthlyNet ?? 0)),
      inceptionNet: toNumber(
        snapshot.apy?.inceptionNet,
        toNumber(historical?.inceptionNet, baseVault?.apy?.inceptionNet ?? 0)
      )
    },
    tvl: {
      close: toNumber(snapshot.tvl?.close, baseVault?.tvl?.close ?? 0)
    },
    vaultType: deriveVaultType({
      kind: snapshot.meta?.kind || baseVault?.kind,
      type: snapshot.meta?.type,
      name: snapshot.name || snapshot.meta?.name || baseVault?.name,
      apiVersion: snapshot.apiVersion ?? baseVault?.apiVersion,
      v3
    }),
    yearn: resolveYearnFlag(snapshot.inclusion, baseVault?.yearn, true),
    v3,
    erc4626: v3,
    fees: {
      managementFee,
      performanceFee
    },
    managementFee,
    performanceFee,
    forwardApyNet,
    estimatedApySource,
    historicalWeeklyApy,
    historicalMonthlyApy,
    strategyForwardAprs,
    strategies: strategyDetails.map((strategy) => strategy.address),
    debts: mapDerivedStrategiesToDebts(strategyDetails),
    decimals: resolveDecimals(snapshot.decimals, baseVault?.asset?.decimals, snapshot.asset?.decimals),
    meta: {
      description: snapshot.meta?.description ?? baseVault?.meta?.description ?? '',
      displayName: snapshot.meta?.displayName ?? baseVault?.meta?.displayName ?? '',
      displaySymbol: snapshot.meta?.displaySymbol ?? baseVault?.meta?.displaySymbol ?? '',
      protocols: snapshot.meta?.protocols ?? baseVault?.meta?.protocols ?? [],
      token: {
        category: snapshot.meta?.token?.category ?? baseVault?.meta?.token?.category ?? '',
        description: snapshot.meta?.token?.description ?? baseVault?.meta?.token?.description ?? '',
        displayName: snapshot.meta?.token?.displayName ?? baseVault?.meta?.token?.displayName ?? '',
        displaySymbol: snapshot.meta?.token?.displaySymbol ?? baseVault?.meta?.token?.displaySymbol ?? '',
        icon: snapshot.meta?.token?.icon ?? baseVault?.meta?.token?.icon ?? '',
        type: snapshot.meta?.token?.type ?? baseVault?.meta?.token?.type ?? ''
      }
    },
    strategyDetails
  }
}
