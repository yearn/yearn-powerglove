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
  totalTvl: number
  activeVaultTvl: number
  retiredVaultTvl: number
  v1Tvl: number
  v2Tvl: number
  v3Tvl: number
  curationTvl: number
  overlapExcluded: number
  vaultBridgeExcluded: number
  crossChainOverlapByCategory: Record<VaultCategory, number>
  overlapByChain: Record<string, number>
  crossChainOverlapByChain: Record<string, number>
  tvlByChain: Record<string, number>
  tvlByCategory: Record<VaultCategory, number>
  retiredTvlByCategory: Record<VaultCategory, number>
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
