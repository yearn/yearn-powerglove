import { queryEnvio } from '@/lib/envio-client'
import type {
  VaultActivityEvent,
  VaultEventType,
  VaultManagementEvent,
  VaultUserEvent,
  VaultUserEventType
} from '@/types/vaultEventTypes'

const ENVIO_PAGE_SIZE = 250
const ENVIO_TRANSACTION_HASH_CHUNK_SIZE = 100

const VAULT_ADDRESS_WHERE = '{ vaultAddress: { _eq: $vaultAddress }, chainId: { _eq: $chainId } }'
const VAULT_ADDRESS_AND_TRANSACTION_HASHES_WHERE = `{
  _and: [
    { vaultAddress: { _eq: $vaultAddress }, chainId: { _eq: $chainId } }
    { transactionHash: { _in: $transactionHashes } }
  ]
}`
const TIMELOCK_WHERE = `{
  _and: [
    { chainId: { _eq: $chainId } }
    { _or: [{ target: { _eq: $vaultAddress } }, { timelockAddress: { _eq: $vaultAddress } }] }
  ]
}`

type RawEventRecord = Record<string, unknown>

interface EnvioEventDefinition<T extends VaultActivityEvent> {
  type: T['type']
  label: string
  alias: string
  entity: string
  where: string
  fields: readonly string[]
  map: (row: RawEventRecord) => T
}

export interface VaultEventsPage<T extends VaultActivityEvent> {
  events: T[]
  hasMore: boolean
  nextOffset: number
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  return String(value)
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }
  return undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.map((entry) => String(entry))
}

function asNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

function mapBaseEvent<T extends VaultEventType>(
  type: T,
  row: RawEventRecord
): Omit<VaultActivityEvent, 'type'> & { type: T } {
  return {
    id: asString(row.id) ?? '',
    type,
    chainId: asNumber(row.chainId),
    blockNumber: asString(row.blockNumber) ?? '0',
    blockTimestamp: asString(row.blockTimestamp) ?? '0',
    transactionHash: asString(row.transactionHash) ?? '',
    vaultAddress: asString(row.vaultAddress),
    blockHash: asString(row.blockHash),
    logIndex: asString(row.logIndex),
    transactionFrom: asString(row.transactionFrom)
  }
}

const USER_EVENT_DEFINITIONS: readonly EnvioEventDefinition<VaultUserEvent>[] = [
  {
    type: 'deposit',
    label: 'Deposit',
    alias: 'deposits',
    entity: 'Deposit',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'sender',
      'owner',
      'assets',
      'shares',
      'vaultAddress',
      'chainId',
      'blockNumber',
      'blockTimestamp',
      'logIndex',
      'transactionHash'
    ],
    map: (row) => ({
      ...mapBaseEvent('deposit', row),
      vaultAddress: asString(row.vaultAddress) ?? '',
      sender: asString(row.sender),
      owner: asString(row.owner),
      assets: asString(row.assets),
      shares: asString(row.shares)
    })
  },
  {
    type: 'withdraw',
    label: 'Withdraw',
    alias: 'withdrawals',
    entity: 'Withdraw',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'sender',
      'receiver',
      'owner',
      'assets',
      'shares',
      'vaultAddress',
      'chainId',
      'blockNumber',
      'blockTimestamp',
      'logIndex',
      'transactionHash'
    ],
    map: (row) => ({
      ...mapBaseEvent('withdraw', row),
      vaultAddress: asString(row.vaultAddress) ?? '',
      sender: asString(row.sender),
      receiver: asString(row.receiver),
      owner: asString(row.owner),
      assets: asString(row.assets),
      shares: asString(row.shares)
    })
  },
  {
    type: 'transfer',
    label: 'Transfer',
    alias: 'transfers',
    entity: 'Transfer',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'sender',
      'receiver',
      'value',
      'vaultAddress',
      'chainId',
      'blockNumber',
      'blockTimestamp',
      'logIndex',
      'transactionHash'
    ],
    map: (row) => ({
      ...mapBaseEvent('transfer', row),
      vaultAddress: asString(row.vaultAddress) ?? '',
      sender: asString(row.sender),
      receiver: asString(row.receiver),
      value: asString(row.value)
    })
  }
] as const

const USER_EVENT_DEFINITIONS_BY_TYPE = new Map<VaultUserEventType, EnvioEventDefinition<VaultUserEvent>>(
  USER_EVENT_DEFINITIONS.map((definition) => [definition.type, definition])
)

const MANAGEMENT_CONTEXT_USER_EVENT_DEFINITIONS: readonly EnvioEventDefinition<VaultUserEvent>[] =
  USER_EVENT_DEFINITIONS.filter((definition) => definition.type === 'deposit' || definition.type === 'withdraw').map(
    (definition) => ({
      ...definition,
      where: VAULT_ADDRESS_AND_TRANSACTION_HASHES_WHERE
    })
  )

const MANAGEMENT_EVENT_DEFINITIONS: readonly EnvioEventDefinition<VaultManagementEvent>[] = [
  {
    type: 'strategyChanged',
    label: 'Strategy Changed',
    alias: 'strategyChanged',
    entity: 'StrategyChanged',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'change_type',
      'logIndex',
      'strategy',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('strategyChanged', row),
      strategy: asString(row.strategy),
      changeType: asString(row.change_type)
    })
  },
  {
    type: 'strategyReported',
    label: 'Strategy Reported',
    alias: 'strategyReported',
    entity: 'StrategyReported',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'current_debt',
      'gain',
      'loss',
      'protocol_fees',
      'total_fees',
      'total_refunds',
      'logIndex',
      'strategy',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('strategyReported', row),
      strategy: asString(row.strategy),
      currentDebt: asString(row.current_debt),
      gain: asString(row.gain),
      loss: asString(row.loss),
      protocolFees: asString(row.protocol_fees),
      totalFees: asString(row.total_fees),
      totalRefunds: asString(row.total_refunds)
    })
  },
  {
    type: 'debtUpdated',
    label: 'Debt Updated',
    alias: 'debtUpdated',
    entity: 'DebtUpdated',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'current_debt',
      'new_debt',
      'logIndex',
      'strategy',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('debtUpdated', row),
      strategy: asString(row.strategy),
      currentDebt: asString(row.current_debt),
      newDebt: asString(row.new_debt)
    })
  },
  {
    type: 'debtPurchased',
    label: 'Debt Purchased',
    alias: 'debtPurchased',
    entity: 'DebtPurchased',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'amount',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'strategy',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('debtPurchased', row),
      strategy: asString(row.strategy),
      amount: asString(row.amount)
    })
  },
  {
    type: 'updatedMaxDebtForStrategy',
    label: 'Max Debt Updated',
    alias: 'updatedMaxDebtForStrategy',
    entity: 'UpdatedMaxDebtForStrategy',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'new_debt',
      'sender',
      'strategy',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updatedMaxDebtForStrategy', row),
      sender: asString(row.sender),
      strategy: asString(row.strategy),
      newDebt: asString(row.new_debt)
    })
  },
  {
    type: 'shutdown',
    label: 'Shutdown',
    alias: 'shutdown',
    entity: 'Shutdown',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('shutdown', row)
    })
  },
  {
    type: 'roleSet',
    label: 'Role Set',
    alias: 'roleSet',
    entity: 'RoleSet',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'account',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'role',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('roleSet', row),
      account: asString(row.account),
      role: asString(row.role)
    })
  },
  {
    type: 'updateAccountant',
    label: 'Accountant Updated',
    alias: 'updateAccountant',
    entity: 'UpdateAccountant',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'accountant',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateAccountant', row),
      accountant: asString(row.accountant)
    })
  },
  {
    type: 'updateAutoAllocate',
    label: 'Auto Allocate Updated',
    alias: 'updateAutoAllocate',
    entity: 'UpdateAutoAllocate',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'auto_allocate',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateAutoAllocate', row),
      autoAllocate: asBoolean(row.auto_allocate)
    })
  },
  {
    type: 'updateDefaultQueue',
    label: 'Default Queue Updated',
    alias: 'updateDefaultQueue',
    entity: 'UpdateDefaultQueue',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'new_default_queue',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateDefaultQueue', row),
      newDefaultQueue: asStringArray(row.new_default_queue)
    })
  },
  {
    type: 'updateDepositLimit',
    label: 'Deposit Limit Updated',
    alias: 'updateDepositLimit',
    entity: 'UpdateDepositLimit',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'deposit_limit',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateDepositLimit', row),
      depositLimit: asString(row.deposit_limit)
    })
  },
  {
    type: 'updateDepositLimitModule',
    label: 'Deposit Limit Module Updated',
    alias: 'updateDepositLimitModule',
    entity: 'UpdateDepositLimitModule',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'deposit_limit_module',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateDepositLimitModule', row),
      depositLimitModule: asString(row.deposit_limit_module)
    })
  },
  {
    type: 'updateFutureRoleManager',
    label: 'Future Role Manager Updated',
    alias: 'updateFutureRoleManager',
    entity: 'UpdateFutureRoleManager',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'future_role_manager',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateFutureRoleManager', row),
      futureRoleManager: asString(row.future_role_manager)
    })
  },
  {
    type: 'updateMinimumTotalIdle',
    label: 'Minimum Total Idle Updated',
    alias: 'updateMinimumTotalIdle',
    entity: 'UpdateMinimumTotalIdle',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'minimum_total_idle',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateMinimumTotalIdle', row),
      minimumTotalIdle: asString(row.minimum_total_idle)
    })
  },
  {
    type: 'updateProfitMaxUnlockTime',
    label: 'Profit Max Unlock Time Updated',
    alias: 'updateProfitMaxUnlockTime',
    entity: 'UpdateProfitMaxUnlockTime',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'profit_max_unlock_time',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateProfitMaxUnlockTime', row),
      profitMaxUnlockTime: asString(row.profit_max_unlock_time)
    })
  },
  {
    type: 'updateRoleManager',
    label: 'Role Manager Updated',
    alias: 'updateRoleManager',
    entity: 'UpdateRoleManager',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'role_manager',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateRoleManager', row),
      roleManager: asString(row.role_manager)
    })
  },
  {
    type: 'updateUseDefaultQueue',
    label: 'Use Default Queue Updated',
    alias: 'updateUseDefaultQueue',
    entity: 'UpdateUseDefaultQueue',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'use_default_queue',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateUseDefaultQueue', row),
      useDefaultQueue: asBoolean(row.use_default_queue)
    })
  },
  {
    type: 'updateWithdrawLimitModule',
    label: 'Withdraw Limit Module Updated',
    alias: 'updateWithdrawLimitModule',
    entity: 'UpdateWithdrawLimitModule',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress',
      'withdraw_limit_module'
    ],
    map: (row) => ({
      ...mapBaseEvent('updateWithdrawLimitModule', row),
      withdrawLimitModule: asString(row.withdraw_limit_module)
    })
  },
  {
    type: 'v2EmergencyShutdown',
    label: 'V2 Emergency Shutdown',
    alias: 'v2EmergencyShutdown',
    entity: 'V2EmergencyShutdown',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'active',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2EmergencyShutdown', row),
      active: asBoolean(row.active)
    })
  },
  {
    type: 'v2StrategyAdded',
    label: 'V2 Strategy Added',
    alias: 'v2StrategyAdded',
    entity: 'V2StrategyAdded',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'debtRatio',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'maxDebtPerHarvest',
      'minDebtPerHarvest',
      'performanceFee',
      'strategy',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2StrategyAdded', row),
      debtRatio: asString(row.debtRatio),
      maxDebtPerHarvest: asString(row.maxDebtPerHarvest),
      minDebtPerHarvest: asString(row.minDebtPerHarvest),
      performanceFee: asString(row.performanceFee),
      strategy: asString(row.strategy)
    })
  },
  {
    type: 'v2StrategyReported',
    label: 'V2 Strategy Reported',
    alias: 'v2StrategyReported',
    entity: 'V2StrategyReported',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'debtAdded',
      'debtPaid',
      'debtRatio',
      'gain',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'loss',
      'logIndex',
      'strategy',
      'totalDebt',
      'totalGain',
      'totalLoss',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2StrategyReported', row),
      debtAdded: asString(row.debtAdded),
      debtPaid: asString(row.debtPaid),
      debtRatio: asString(row.debtRatio),
      gain: asString(row.gain),
      loss: asString(row.loss),
      strategy: asString(row.strategy),
      totalDebt: asString(row.totalDebt),
      totalGain: asString(row.totalGain),
      totalLoss: asString(row.totalLoss)
    })
  },
  {
    type: 'v2StrategyRevoked',
    label: 'V2 Strategy Revoked',
    alias: 'v2StrategyRevoked',
    entity: 'V2StrategyRevoked',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'strategy',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2StrategyRevoked', row),
      strategy: asString(row.strategy)
    })
  },
  {
    type: 'v2UpdateDepositLimit',
    label: 'V2 Deposit Limit Updated',
    alias: 'v2UpdateDepositLimit',
    entity: 'V2UpdateDepositLimit',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'depositLimit',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2UpdateDepositLimit', row),
      depositLimit: asString(row.depositLimit)
    })
  },
  {
    type: 'v2UpdateGovernance',
    label: 'V2 Governance Updated',
    alias: 'v2UpdateGovernance',
    entity: 'V2UpdateGovernance',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'governance',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2UpdateGovernance', row),
      governance: asString(row.governance)
    })
  },
  {
    type: 'v2UpdateGuardian',
    label: 'V2 Guardian Updated',
    alias: 'v2UpdateGuardian',
    entity: 'V2UpdateGuardian',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'guardian',
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2UpdateGuardian', row),
      guardian: asString(row.guardian)
    })
  },
  {
    type: 'v2UpdateManagement',
    label: 'V2 Management Updated',
    alias: 'v2UpdateManagement',
    entity: 'V2UpdateManagement',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'management',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2UpdateManagement', row),
      management: asString(row.management)
    })
  },
  {
    type: 'v2UpdateManagementFee',
    label: 'V2 Management Fee Updated',
    alias: 'v2UpdateManagementFee',
    entity: 'V2UpdateManagementFee',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'managementFee',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2UpdateManagementFee', row),
      managementFee: asString(row.managementFee)
    })
  },
  {
    type: 'v2UpdatePerformanceFee',
    label: 'V2 Performance Fee Updated',
    alias: 'v2UpdatePerformanceFee',
    entity: 'V2UpdatePerformanceFee',
    where: VAULT_ADDRESS_WHERE,
    fields: [
      'id',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'performanceFee',
      'transactionFrom',
      'transactionHash',
      'vaultAddress'
    ],
    map: (row) => ({
      ...mapBaseEvent('v2UpdatePerformanceFee', row),
      performanceFee: asString(row.performanceFee)
    })
  },
  {
    type: 'timelockEvent',
    label: 'Timelock Event',
    alias: 'timelockEvent',
    entity: 'TimelockEvent',
    where: TIMELOCK_WHERE,
    fields: [
      'creator',
      'data',
      'delay',
      'eventName',
      'id',
      'index',
      'blockHash',
      'blockNumber',
      'blockTimestamp',
      'chainId',
      'logIndex',
      'metadata',
      'operationId',
      'predecessor',
      'signature',
      'target',
      'timelockAddress',
      'timelockType',
      'transactionFrom',
      'transactionHash',
      'value',
      'votesAgainst',
      'votesFor'
    ],
    map: (row) => ({
      ...mapBaseEvent('timelockEvent', row),
      creator: asString(row.creator),
      data: asString(row.data),
      delay: asString(row.delay),
      eventName: asString(row.eventName),
      index: asString(row.index),
      metadata: asString(row.metadata),
      operationId: asString(row.operationId),
      predecessor: asString(row.predecessor),
      signature: asString(row.signature),
      target: asString(row.target),
      timelockAddress: asString(row.timelockAddress),
      timelockType: asString(row.timelockType),
      timelockValue: asString(row.value),
      votesAgainst: asString(row.votesAgainst),
      votesFor: asString(row.votesFor)
    })
  }
] as const

export const VAULT_EVENT_TYPE_LABELS: Record<VaultEventType, string> = {
  ...Object.fromEntries(USER_EVENT_DEFINITIONS.map((definition) => [definition.type, definition.label])),
  ...Object.fromEntries(MANAGEMENT_EVENT_DEFINITIONS.map((definition) => [definition.type, definition.label]))
} as Record<VaultEventType, string>

export const USER_EVENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All events' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdraw', label: 'Withdrawals' },
  { value: 'transfer', label: 'Transfers' }
] as const

export const MANAGEMENT_EVENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All events' },
  ...MANAGEMENT_EVENT_DEFINITIONS.map((definition) => ({
    value: definition.type,
    label: definition.label
  }))
] as const

function buildPaginatedEventQuery(
  queryName: string,
  definitions: readonly EnvioEventDefinition<VaultActivityEvent>[],
  extraVariables = ''
): string {
  const sections = definitions
    .map(
      (definition) => `
    ${definition.alias}: ${definition.entity}(
      where: ${definition.where}
      order_by: { blockTimestamp: desc, blockNumber: desc, logIndex: desc }
      limit: $limit
      offset: $offset
    ) {
      ${definition.fields.join('\n      ')}
    }`
    )
    .join('\n')

  return `
    query ${queryName}($vaultAddress: String!, $chainId: Int!, $limit: Int!, $offset: Int!${extraVariables}) {
      ${sections}
    }
  `
}

async function fetchEnvioEventsPage<T extends VaultActivityEvent>(
  queryName: string,
  definitions: readonly EnvioEventDefinition<T>[],
  vaultAddress: string,
  chainId: number,
  offset = 0,
  limit = ENVIO_PAGE_SIZE,
  extraVariables: Record<string, unknown> = {},
  extraQueryVariables = ''
): Promise<VaultEventsPage<T>> {
  const query = buildPaginatedEventQuery(
    queryName,
    definitions as readonly EnvioEventDefinition<VaultActivityEvent>[],
    extraQueryVariables
  )
  const events: T[] = []

  const data = await queryEnvio<Record<string, RawEventRecord[]>>(query, {
    vaultAddress,
    chainId,
    limit,
    offset,
    ...extraVariables
  })

  let hasMore = false

  for (const definition of definitions) {
    const rows = Array.isArray(data[definition.alias]) ? data[definition.alias] : []

    for (const row of rows) {
      events.push(definition.map(row))
    }

    if (rows.length >= limit) {
      hasMore = true
    }
  }

  return {
    events: sortEventsChronologically(events),
    hasMore,
    nextOffset: offset + limit
  }
}

async function fetchPaginatedEnvioEvents<T extends VaultActivityEvent>(
  queryName: string,
  definitions: readonly EnvioEventDefinition<T>[],
  vaultAddress: string,
  chainId: number
): Promise<T[]> {
  const events: T[] = []

  for (let offset = 0; ; ) {
    const page = await fetchEnvioEventsPage(queryName, definitions, vaultAddress, chainId, offset)
    events.push(...page.events)

    if (!page.hasMore) {
      break
    }

    offset = page.nextOffset
  }

  return sortEventsChronologically(events)
}

function getEventLogIndex(event: VaultActivityEvent): number {
  if (event.logIndex !== undefined) {
    const explicitLogIndex = Number(event.logIndex)
    if (Number.isFinite(explicitLogIndex)) {
      return explicitLogIndex
    }
  }

  const idParts = event.id.split('_')
  const inferredLogIndex = Number(idParts[idParts.length - 1])
  return Number.isFinite(inferredLogIndex) ? inferredLogIndex : 0
}

export function sortEventsChronologically<T extends VaultActivityEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const aTs = Number(a.blockTimestamp) || 0
    const bTs = Number(b.blockTimestamp) || 0
    if (aTs !== bTs) return bTs - aTs

    const aBlock = Number(a.blockNumber) || 0
    const bBlock = Number(b.blockNumber) || 0
    if (aBlock !== bBlock) return bBlock - aBlock

    return getEventLogIndex(b) - getEventLogIndex(a)
  })
}

export function dedupVaultUserEvents(events: VaultUserEvent[]): VaultUserEvent[] {
  const seen = new Map<string, { index: number; priority: number }>()
  const deduped: VaultUserEvent[] = []

  for (const event of events) {
    const txHash = event.transactionHash?.toLowerCase()
    if (!txHash) {
      deduped.push(event)
      continue
    }

    const priority = event.type === 'transfer' ? 0 : 1
    const existing = seen.get(txHash)

    if (!existing) {
      seen.set(txHash, { index: deduped.length, priority })
      deduped.push(event)
      continue
    }

    if (priority > existing.priority) {
      deduped[existing.index] = event
      seen.set(txHash, { index: existing.index, priority })
    }
  }

  return deduped
}

export async function fetchVaultUserEvents(vaultAddress: string, chainId: number): Promise<VaultUserEvent[]> {
  const events = await fetchPaginatedEnvioEvents('GetVaultUserEvents', USER_EVENT_DEFINITIONS, vaultAddress, chainId)
  return dedupVaultUserEvents(events)
}

export async function fetchVaultUserEventsPage(
  vaultAddress: string,
  chainId: number,
  offset = 0
): Promise<VaultEventsPage<VaultUserEvent>> {
  const page = await fetchEnvioEventsPage('GetVaultUserEvents', USER_EVENT_DEFINITIONS, vaultAddress, chainId, offset)
  return {
    ...page,
    events: dedupVaultUserEvents(page.events)
  }
}

export async function fetchVaultUserEventsPageByType(
  vaultAddress: string,
  chainId: number,
  eventType: VaultUserEventType,
  offset = 0
): Promise<VaultEventsPage<VaultUserEvent>> {
  const definition = USER_EVENT_DEFINITIONS_BY_TYPE.get(eventType)
  if (!definition) {
    throw new Error(`Unsupported vault user event type: ${eventType}`)
  }

  const page = await fetchEnvioEventsPage('GetVaultUserEventsByType', [definition], vaultAddress, chainId, offset)
  return {
    ...page,
    events: dedupVaultUserEvents(page.events)
  }
}

export async function fetchVaultUserEventsForTransactions(
  vaultAddress: string,
  chainId: number,
  transactionHashes: string[]
): Promise<VaultUserEvent[]> {
  const normalizedTransactionHashesByKey = new Map<string, string>()

  for (const transactionHash of transactionHashes) {
    if (!transactionHash) {
      continue
    }

    normalizedTransactionHashesByKey.set(transactionHash.toLowerCase(), transactionHash)
  }

  const normalizedTransactionHashes = [...normalizedTransactionHashesByKey.values()]
  if (normalizedTransactionHashes.length === 0) {
    return []
  }

  const events: VaultUserEvent[] = []

  for (
    let chunkStart = 0;
    chunkStart < normalizedTransactionHashes.length;
    chunkStart += ENVIO_TRANSACTION_HASH_CHUNK_SIZE
  ) {
    const transactionHashChunk = normalizedTransactionHashes.slice(
      chunkStart,
      chunkStart + ENVIO_TRANSACTION_HASH_CHUNK_SIZE
    )

    for (let offset = 0; ; ) {
      const page = await fetchEnvioEventsPage(
        'GetVaultUserEventsForTransactions',
        MANAGEMENT_CONTEXT_USER_EVENT_DEFINITIONS,
        vaultAddress,
        chainId,
        offset,
        ENVIO_PAGE_SIZE,
        { transactionHashes: transactionHashChunk },
        ', $transactionHashes: [String!]!'
      )

      events.push(...page.events)

      if (!page.hasMore) {
        break
      }

      offset = page.nextOffset
    }
  }

  return dedupVaultUserEvents(sortEventsChronologically(events))
}

export async function fetchVaultManagementEvents(
  vaultAddress: string,
  chainId: number
): Promise<VaultManagementEvent[]> {
  return fetchPaginatedEnvioEvents('GetVaultManagementEvents', MANAGEMENT_EVENT_DEFINITIONS, vaultAddress, chainId)
}

export function fetchVaultManagementEventsPage(
  vaultAddress: string,
  chainId: number,
  offset = 0
): Promise<VaultEventsPage<VaultManagementEvent>> {
  return fetchEnvioEventsPage('GetVaultManagementEvents', MANAGEMENT_EVENT_DEFINITIONS, vaultAddress, chainId, offset)
}

export const MANAGEMENT_EVENT_TYPES = MANAGEMENT_EVENT_DEFINITIONS.map((definition) => definition.type)

export const USER_EVENT_TYPES = USER_EVENT_DEFINITIONS.map((definition) => definition.type)
