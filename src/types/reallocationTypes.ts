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

export interface ReallocationStateStrategy {
  strategyKey: string
  strategyAddress: string | null
  name: string
  isUnallocated: boolean
  allocationPct: number
  aprPct: number | null
}

export interface ReallocationState {
  id: string
  timestampUtc: string | null
  tvl: number | null
  tvlUnit: string | null
  vaultAprPct: number | null
  strategies: ReallocationStateStrategy[]
}

export interface ReallocationPanel {
  id: string
  beforeState: ReallocationState
  afterState: ReallocationState
  beforeTimestampUtc: string | null
  afterTimestampUtc: string | null
  kind: 'historical' | 'proposal' | 'current'
}

export interface ReallocationData {
  vault: string
  vaultLabel: string
  chainId: number | null
  chainName: string | null
  panels: ReallocationPanel[]
}
