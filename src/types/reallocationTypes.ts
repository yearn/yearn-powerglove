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
  allocationAmount?: string
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

export type ReallocationFlowKind = 'idle_deployment' | 'idle_deallocation' | 'strategy_reallocation'

export type ReallocationExecutionAutomation = 'automatic' | 'manual' | 'mixed' | 'unknown'

export type ReallocationExecutionMechanism =
  | 'allocator_keeper'
  | 'direct_vault_role'
  | 'governance_safe'
  | 'governance'
  | 'role_manager'
  | 'mixed'
  | 'unknown'

export type ReallocationTargetStatus = 'matched' | 'overridden' | 'unavailable' | 'not_applicable' | 'mixed'

export interface ReallocationTransaction {
  transactionHash: string
  blockNumber: number
}

export type ReallocationExpectedAprImpact =
  | {
      status: 'available'
      source: 'doa'
      scope: 'proposal'
      policyId: string
      baselineAprPct: number
      proposedAprPct: number
      deltaAprPct: number
      publishedAt: string
      relationship: string
      applicationStatus: string
    }
  | {
      status: 'unavailable'
      reason: string
    }

export interface ReallocationExecution {
  automation: ReallocationExecutionAutomation
  mechanism: ReallocationExecutionMechanism
  targetStatus: ReallocationTargetStatus
  transactions?: ReallocationTransaction[]
}

export interface ReallocationIdleFlow {
  strategyKey: string
  allocationPct: number
}

export interface ReallocationIdleBridge {
  deallocations: ReallocationIdleFlow[]
  deployments: ReallocationIdleFlow[]
  eventCount: number
}

export type ReallocationLedgerBalanceNode =
  | { type: 'idle' }
  | { type: 'strategy'; address: string; name?: string | null }

export type ReallocationLedgerBoundaryNode = { type: 'external' } | { type: 'accounting' }

export type ReallocationLedgerNode = ReallocationLedgerBalanceNode | ReallocationLedgerBoundaryNode

export type ReallocationLedgerFlowKind =
  | 'deposit'
  | 'withdrawal'
  | 'idle_deployment'
  | 'idle_deallocation'
  | 'strategy_reallocation'
  | 'reported_gain'
  | 'reported_loss'
  | 'report_refund'
  | 'bad_debt_purchase'
  | 'unattributed_asset_change'

export type ReallocationLedgerAttribution = 'observed_event' | 'derived_from_debt_updates' | 'residual_balance'

export interface ReallocationLedgerFlow {
  source: ReallocationLedgerNode
  target: ReallocationLedgerNode
  amount: string
  kind: ReallocationLedgerFlowKind
  attribution: ReallocationLedgerAttribution
  evidence?: {
    eventCount: number
    transactionCount: number
  }
}

export interface ReallocationFlowLedger {
  intervalCount: number
  flows: ReallocationLedgerFlow[]
  balanceStatus: 'reconciled'
  attributionStatus: 'complete' | 'partial'
  unattributedAmount: string
}

export interface ReallocationPanel {
  id: string
  beforeState: ReallocationState
  afterState: ReallocationState
  beforeTimestampUtc: string | null
  afterTimestampUtc: string | null
  kind: 'historical' | 'proposal' | 'current' | 'executed'
  flowKind?: ReallocationFlowKind
  execution?: ReallocationExecution
  expectedAprImpact?: ReallocationExpectedAprImpact
  detailsHref?: string
  idleBridge?: ReallocationIdleBridge
  flowLedger?: ReallocationFlowLedger
}

export interface ReallocationData {
  vault: string
  vaultLabel: string
  chainId: number | null
  chainName: string | null
  panels: ReallocationPanel[]
}

export interface AllocationHistoryIssue {
  entryId: string
  reason: string
}
