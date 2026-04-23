export type VaultUserEventType = 'deposit' | 'withdraw' | 'transfer'

export type VaultManagementEventType =
  | 'strategyChanged'
  | 'strategyReported'
  | 'debtUpdated'
  | 'debtPurchased'
  | 'updatedMaxDebtForStrategy'
  | 'shutdown'
  | 'roleSet'
  | 'updateAccountant'
  | 'updateAutoAllocate'
  | 'updateDefaultQueue'
  | 'updateDepositLimit'
  | 'updateDepositLimitModule'
  | 'updateFutureRoleManager'
  | 'updateMinimumTotalIdle'
  | 'updateProfitMaxUnlockTime'
  | 'updateRoleManager'
  | 'updateUseDefaultQueue'
  | 'updateWithdrawLimitModule'
  | 'v2EmergencyShutdown'
  | 'v2StrategyAdded'
  | 'v2StrategyReported'
  | 'v2StrategyRevoked'
  | 'v2UpdateDepositLimit'
  | 'v2UpdateGovernance'
  | 'v2UpdateGuardian'
  | 'v2UpdateManagement'
  | 'v2UpdateManagementFee'
  | 'v2UpdatePerformanceFee'
  | 'timelockEvent'

export type VaultEventType = VaultUserEventType | VaultManagementEventType

export interface VaultEventBase {
  id: string
  type: VaultEventType
  chainId: number
  blockNumber: string
  blockTimestamp: string
  transactionHash: string
  vaultAddress?: string
  blockHash?: string
  logIndex?: string
  transactionFrom?: string
}

export interface VaultActivityEvent extends VaultEventBase {
  sender?: string
  owner?: string
  receiver?: string
  assets?: string
  shares?: string
  value?: string
  strategy?: string
  account?: string
  role?: string
  changeType?: string
  currentDebt?: string
  newDebt?: string
  amount?: string
  gain?: string
  loss?: string
  protocolFees?: string
  totalFees?: string
  totalRefunds?: string
  autoAllocate?: boolean
  useDefaultQueue?: boolean
  newDefaultQueue?: string[]
  depositLimit?: string
  depositLimitModule?: string
  withdrawLimitModule?: string
  minimumTotalIdle?: string
  profitMaxUnlockTime?: string
  roleManager?: string
  futureRoleManager?: string
  accountant?: string
  governance?: string
  guardian?: string
  management?: string
  managementFee?: string
  performanceFee?: string
  debtRatio?: string
  debtAdded?: string
  debtPaid?: string
  totalDebt?: string
  totalGain?: string
  totalLoss?: string
  minDebtPerHarvest?: string
  maxDebtPerHarvest?: string
  active?: boolean
  target?: string
  timelockAddress?: string
  timelockType?: string
  eventName?: string
  creator?: string
  delay?: string
  data?: string
  metadata?: string
  operationId?: string
  predecessor?: string
  signature?: string
  votesFor?: string
  votesAgainst?: string
  timelockValue?: string
  index?: string
}

export interface VaultDepositEvent extends VaultActivityEvent {
  type: 'deposit'
  vaultAddress: string
}

export interface VaultWithdrawEvent extends VaultActivityEvent {
  type: 'withdraw'
  vaultAddress: string
}

export interface VaultTransferEvent extends VaultActivityEvent {
  type: 'transfer'
  vaultAddress: string
}

export interface VaultUserEvent extends VaultActivityEvent {
  type: VaultUserEventType
  vaultAddress: string
}

export interface VaultManagementEvent extends VaultActivityEvent {
  type: VaultManagementEventType
}

export interface VaultEventsData<T extends VaultActivityEvent = VaultActivityEvent> {
  events: T[]
  isLoading: boolean
  error: Error | null
}
