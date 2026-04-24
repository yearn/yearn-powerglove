const EXPLAIN_VAULT_LINE_PATTERN = /^(.+)\s+\((\d+):\s*(0x[a-fA-F0-9]{40})\)/
const EXPLAIN_TVL_LINE_PATTERN = /^TVL:\s*(.+)$/im
const EXPLAIN_TVL_VALUE_PATTERN = /^\s*(\$)?\s*([\d,]+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9._-]*)?\s*$/
const FILTERED_NO_CHANGE_LINE_PATTERN = /^\s{2}(.+?):\s*(-?\d+(?:\.\d+)?)%\s*=>\s*no change \(filtered\)\s*$/i
const STRATEGY_APR_LINE_PATTERN = /^\s*\((-?\d+(?:\.\d+)?)%\)\s*\((-?\d+(?:\.\d+)?)%\s*=>\s*(-?\d+(?:\.\d+)?)%\)\s*$/

const TOTAL_BPS = 10000
const NORMALIZATION_TOLERANCE_BPS = 5

export interface ExplainMetadata {
  vaultLabel: string | null
  chainId: number | null
  chainName: string | null
  tvl: number | null
  tvlUnit: string | null
}

export interface ExplainNoChangeStrategy {
  name: string
  currentRatio: number
  targetRatio: number
  currentApr: number | null
  targetApr: number | null
}

function getChainName(chainId: number | null): string | null {
  if (chainId === null) return null
  const chains: Record<number, string> = {
    1: 'Mainnet',
    10: 'Optimism',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    250: 'Fantom'
  }
  return chains[chainId] ?? `Chain ${chainId}`
}

function inferVaultTokenSymbol(vaultLabel: string | null): string | null {
  if (!vaultLabel) return null
  const match = vaultLabel.match(/^([A-Z]+)/)
  return match?.[1] ?? null
}

function parseTvl(explain: string, vaultLabel: string | null): { tvl: number | null; tvlUnit: string | null } {
  const tvlLineMatch = explain.match(EXPLAIN_TVL_LINE_PATTERN)
  if (!tvlLineMatch?.[1]) return { tvl: null, tvlUnit: null }

  const tvlValueMatch = tvlLineMatch[1].trim().match(EXPLAIN_TVL_VALUE_PATTERN)
  if (!tvlValueMatch?.[2]) return { tvl: null, tvlUnit: null }

  const tvl = Number.parseFloat(tvlValueMatch[2].replace(/,/g, ''))
  if (!Number.isFinite(tvl)) return { tvl: null, tvlUnit: null }

  const hasDollarPrefix = Boolean(tvlValueMatch[1])
  const rawUnit = tvlValueMatch[3]?.trim() ?? null

  if (hasDollarPrefix || rawUnit?.toLowerCase() === 'usd') {
    return { tvl, tvlUnit: 'USD' }
  }
  if (rawUnit) {
    return { tvl, tvlUnit: rawUnit }
  }
  return { tvl, tvlUnit: inferVaultTokenSymbol(vaultLabel) }
}

export function parseExplainMetadata(explain: string): ExplainMetadata {
  const lines = explain.split('\n')
  const firstLine = lines.find((line) => EXPLAIN_VAULT_LINE_PATTERN.test(line)) ?? ''

  const vaultMatch = firstLine.match(EXPLAIN_VAULT_LINE_PATTERN)
  const chainId = vaultMatch?.[2] ? Number.parseInt(vaultMatch[2], 10) : null
  const vaultLabel = vaultMatch?.[1]?.trim() ?? null
  const { tvl, tvlUnit } = parseTvl(explain, vaultLabel)

  return {
    vaultLabel,
    chainId,
    chainName: getChainName(chainId),
    tvl,
    tvlUnit
  }
}

function percentToBps(percent: number): number {
  return Math.round(percent * 100)
}

export function parseFilteredNoChangeStrategies(explain: string): ExplainNoChangeStrategy[] {
  const lines = explain.split('\n')
  const strategies: ExplainNoChangeStrategy[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(FILTERED_NO_CHANGE_LINE_PATTERN)
    if (!match) continue

    const name = match[1]?.trim()
    const currentRatioPct = Number.parseFloat(match[2])
    if (!name || !Number.isFinite(currentRatioPct) || currentRatioPct <= 0) continue

    let currentApr: number | null = null
    let targetApr: number | null = null
    const aprLine = lines[index + 1]
    if (aprLine) {
      const aprMatch = aprLine.match(STRATEGY_APR_LINE_PATTERN)
      if (aprMatch) {
        const currentAprPct = Number.parseFloat(aprMatch[2])
        const targetAprPct = Number.parseFloat(aprMatch[3])
        if (Number.isFinite(currentAprPct) && currentAprPct >= 0) {
          currentApr = percentToBps(currentAprPct)
        }
        if (Number.isFinite(targetAprPct) && targetAprPct >= 0) {
          targetApr = percentToBps(targetAprPct)
        }
      }
    }

    strategies.push({
      name,
      currentRatio: percentToBps(currentRatioPct),
      targetRatio: percentToBps(currentRatioPct),
      currentApr,
      targetApr
    })
  }

  return strategies
}

function buildSyntheticStrategyAddress(vaultAddress: string, strategyName: string, index: number, salt = 0): string {
  const seed = `${vaultAddress.toLowerCase()}|${strategyName.toLowerCase()}|${index}|${salt}`
  const bytes = new Uint8Array(20)

  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    bytes[byteIndex] = (byteIndex * 29 + 17) & 0xff
  }

  for (let charIndex = 0; charIndex < seed.length; charIndex += 1) {
    const code = seed.charCodeAt(charIndex)
    const slot = charIndex % bytes.length
    const mixed = (bytes[slot] * 33 + code + ((charIndex * 13) & 0xff)) & 0xff
    bytes[slot] = mixed
  }

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

export interface RawStrategyDebtRatio {
  strategy: string
  name?: string
  targetRatio: number
  currentRatio: number
  currentApr?: number | null
  targetApr?: number | null
}

export interface AugmentResult {
  strategies: RawStrategyDebtRatio[]
  syntheticStrategyKeysByAddress: Map<string, string>
}

export function augmentStrategiesFromExplain(
  explain: string,
  vault: string,
  strategies: RawStrategyDebtRatio[],
  vaultStrategyLookup?: Map<string, string>
): AugmentResult {
  const dedupedInputStrategies: RawStrategyDebtRatio[] = []
  const seenInputAddresses = new Set<string>()
  for (const strategy of strategies) {
    const normalizedAddress = strategy.strategy.toLowerCase()
    if (seenInputAddresses.has(normalizedAddress)) continue
    seenInputAddresses.add(normalizedAddress)
    dedupedInputStrategies.push(strategy)
  }

  const currentSum = dedupedInputStrategies.reduce((sum, s) => sum + s.currentRatio, 0)
  const targetSum = dedupedInputStrategies.reduce((sum, s) => sum + s.targetRatio, 0)
  const hasAllocationGap =
    currentSum < TOTAL_BPS - NORMALIZATION_TOLERANCE_BPS || targetSum < TOTAL_BPS - NORMALIZATION_TOLERANCE_BPS

  if (!hasAllocationGap) {
    return { strategies: dedupedInputStrategies, syntheticStrategyKeysByAddress: new Map<string, string>() }
  }

  const filteredNoChangeStrategies = parseFilteredNoChangeStrategies(explain)
  if (filteredNoChangeStrategies.length === 0) {
    return { strategies: dedupedInputStrategies, syntheticStrategyKeysByAddress: new Map<string, string>() }
  }

  const existingNames = new Set(
    dedupedInputStrategies.map((s) => s.name?.trim().toLowerCase()).filter((name): name is string => Boolean(name))
  )

  const augmentedStrategies = [...dedupedInputStrategies]
  const syntheticStrategyKeysByAddress = new Map<string, string>()
  const usedStrategyAddresses = new Set(dedupedInputStrategies.map((s) => s.strategy.toLowerCase()))
  let syntheticIndex = 0

  for (const filteredStrategy of filteredNoChangeStrategies) {
    const normalizedName = filteredStrategy.name.trim().toLowerCase()
    if (normalizedName && existingNames.has(normalizedName)) continue

    if (normalizedName) existingNames.add(normalizedName)

    const realAddress = vaultStrategyLookup?.get(normalizedName)
    if (realAddress) {
      if (usedStrategyAddresses.has(realAddress)) continue
      usedStrategyAddresses.add(realAddress)
      augmentedStrategies.push({
        strategy: realAddress,
        name: filteredStrategy.name,
        currentRatio: filteredStrategy.currentRatio,
        targetRatio: filteredStrategy.targetRatio,
        currentApr: filteredStrategy.currentApr ?? undefined,
        targetApr: filteredStrategy.targetApr ?? filteredStrategy.currentApr ?? undefined
      })
      continue
    }

    syntheticIndex += 1
    let salt = 0
    let syntheticAddress = buildSyntheticStrategyAddress(vault, filteredStrategy.name, syntheticIndex, salt)
    while (usedStrategyAddresses.has(syntheticAddress.toLowerCase())) {
      salt += 1
      syntheticAddress = buildSyntheticStrategyAddress(vault, filteredStrategy.name, syntheticIndex, salt)
    }

    const normalizedSyntheticAddress = syntheticAddress.toLowerCase()
    usedStrategyAddresses.add(normalizedSyntheticAddress)
    syntheticStrategyKeysByAddress.set(
      normalizedSyntheticAddress,
      `synthetic:${vault.toLowerCase()}:${normalizedName}:${syntheticIndex}`
    )
    augmentedStrategies.push({
      strategy: syntheticAddress,
      name: filteredStrategy.name,
      currentRatio: filteredStrategy.currentRatio,
      targetRatio: filteredStrategy.targetRatio,
      currentApr: filteredStrategy.currentApr ?? undefined,
      targetApr: filteredStrategy.targetApr ?? filteredStrategy.currentApr ?? undefined
    })
  }

  return { strategies: augmentedStrategies, syntheticStrategyKeysByAddress }
}
