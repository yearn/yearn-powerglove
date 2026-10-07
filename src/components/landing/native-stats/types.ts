export type VaultCategory = 'v1' | 'v2' | 'v3' | 'curation'

export interface RetiredVaultSummary {
  address: string
  chainId: number
  name: string | null
  category: VaultCategory
  tvlUsd: number
  isCrossChainOverlap: boolean
}

export interface TvlSummary {
  datasetId?: string
  asOfTimestamp?: number
  totalTvl: number | null
  activeVaultTvl: number | null
  retiredVaultTvl: number | null
  v1Tvl: number | null
  v2Tvl: number | null
  v3Tvl: number | null
  curationTvl: number | null
  overlapExcluded: number | null
  vaultBridgeExcluded: number | null
  crossChainOverlapByCategory: Record<VaultCategory, number | null>
  overlapByChain: Record<string, number | null>
  crossChainOverlapByChain: Record<string, number | null>
  tvlByChain: Record<string, number | null>
  tvlByCategory: Record<VaultCategory, number | null>
  retiredTvlByCategory: Record<VaultCategory, number | null>
  retiredVaults: RetiredVaultSummary[]
  vaultCount: {
    total: number
    v1: number
    v2: number
    v3: number
    curation: number
    active: number
    retired: number
  }
}

export interface TvlHistoryChartRow {
  timestamp: number
  [seriesName: string]: number
}

export interface TvlHistoryRun {
  id: number
  createdAt: string
  mode: string
  groupBy: string
  interval: string
  range: { from: number; to: number }
  maxVaults: number | null
  top: number | null
  pointCount: number
  query: Record<string, unknown>
  meta: Record<string, unknown>
  series: string[]
  points: Array<{ timestamp: number; series: string; tvlUsd: number }>
  chart: TvlHistoryChartRow[]
}

export interface ConstantPriceTvlPoint {
  timestamp: number
  series: string
  actualTvlUsd: number
  constantPriceTvlUsd: number | null
}

export interface ConstantPriceReference {
  vault: string
  timestamp: number
  priceUsd: number
  source: string
  depegCandidateSkipped: boolean
}

export interface ConstantPriceTvlHistory {
  runId: number
  createdAt: string
  schemaVersion: number
  methodology: string
  mode: 'raw' | 'external'
  groupBy: 'vault' | 'category' | 'chain' | 'type'
  chainId?: number | null
  range: { from: number; to: number }
  points: ConstantPriceTvlPoint[]
  actualChart: TvlHistoryChartRow[]
  constantPriceChart: TvlHistoryChartRow[]
  references: ConstantPriceReference[]
  meta: {
    rawPointCount?: number
    valuedVaults?: number
    skippedVaults?: number
    depegCandidatesSkipped?: number
    referenceWindowPoints?: number
    appendedCurrentActualSnapshot?: boolean
    currentActualSnapshot?: {
      timestamp: number
      pointCount: number
      adjustedTotalTvlUsd: number
    }
    constantPriceThrough?: number | null
  }
}

export interface GapComponent {
  label: string
  amount: number
  explanation: string
}

export interface DefillamaComparison {
  ourTotal: number
  defillamaTotal: number
  difference: number
  differencePercent: number
  retiredTvl: number
  overlapDeducted: number
  crossChainOverlap: number
  grossTvl: number
  gapComponents: GapComponent[]
  retiredTvlByChain: Record<string, number>
  notes: string[]
  byChain: Array<{
    chain: string
    ours: number
    defillama: number
    difference: number
  }>
  byCategory: Array<{
    category: string
    defillamaProtocol: string
    ours: number
    defillama: number
    difference: number
  }>
}

export interface FeeStackNode {
  vault: { address: string; chainId: number; name: string | null }
  perfFee: number
  mgmtFee: number
  capitalUsd: number
  children: FeeStackNode[]
}

export interface FeeStackChain {
  root: FeeStackNode
  maxDepth: number
  effectivePerfFee: number
  effectiveMgmtFee: number
}

export interface FeeStackSummary {
  chains: FeeStackChain[]
  maxDepth: number
  maxEffectivePerfFee: number
  avgEffectivePerfFee: number
  totalStackedCapital: number
}

export type CurationProductFamily = 'v3_allocator' | 'morpho_curated'

export interface CurationProductVault {
  address: string
  chainId: number
  name: string | null
  family: CurationProductFamily
  grossTvlUsd: number
  knownInternalOverlapTvlUsd: number
  netTvlUsd: number
}

export interface CurationProductFamilySummary {
  grossTvlUsd: number
  knownInternalOverlapTvlUsd: number
  netTvlUsd: number
  vaultCount: number
}

export interface CurationProductsSummary {
  methodologyVersion: string
  asOf: string | null
  definition: {
    headline: string
    includes: string[]
    excludes: string[]
    accounting: string
  }
  grossTvlUsd: number
  knownInternalOverlapTvlUsd: number
  totalTvlUsd: number
  vaultCount: number
  byFamily: Record<CurationProductFamily, CurationProductFamilySummary>
  byChain: Record<string, number>
  vaults: CurationProductVault[]
  potentialV2: {
    grossTvlUsd: number
    knownPassThroughTvlUsd: number
    incrementalTvlUsd: number
    vaultCount: number
    note: string
  }
  limitations: string[]
}
