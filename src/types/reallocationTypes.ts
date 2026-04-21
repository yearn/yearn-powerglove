export interface ReallocationStrategy {
  strategyKey: string
  strategyAddress: string | null
  name: string
  isUnallocated: boolean

  currentRatioPct: number
  targetRatioPct: number
  allocationDeltaPct: number

  currentAprPct: number | null
  targetAprPct: number | null
  aprDeltaPct: number | null

  color: string
}

export interface ReallocationData {
  vault: string
  vaultLabel: string
  chainId: number | null
  chainName: string | null
  tvl: number | null
  tvlUnit: string | null

  strategies: ReallocationStrategy[]

  vaultAprCurrentPct: number
  vaultAprProposedPct: number
  vaultAprDeltaPct: number

  hasUnallocated: boolean
  unallocatedBps: number

  timestampUtc: string | null
  sourceKey: string
}
