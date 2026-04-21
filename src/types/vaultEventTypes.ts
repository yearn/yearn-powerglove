export type VaultEventType = 'deposit' | 'withdraw' | 'transfer'

export interface VaultDepositEvent {
  id: string
  sender: string
  owner: string
  assets: string
  shares: string
  vaultAddress: string
  chainId: number
  blockNumber: string
  blockTimestamp: string
  transactionHash: string
}

export interface VaultWithdrawEvent {
  id: string
  sender: string
  receiver: string
  owner: string
  assets: string
  shares: string
  vaultAddress: string
  chainId: number
  blockNumber: string
  blockTimestamp: string
  transactionHash: string
}

export interface VaultTransferEvent {
  id: string
  sender: string
  receiver: string
  value: string
  vaultAddress: string
  chainId: number
  blockNumber: string
  blockTimestamp: string
  transactionHash: string
}

export interface VaultUserEvent {
  id: string
  type: VaultEventType
  sender?: string
  owner?: string
  receiver?: string
  assets?: string
  shares?: string
  value?: string
  vaultAddress: string
  chainId: number
  blockNumber: string
  blockTimestamp: string
  transactionHash: string
}

export interface VaultEventsData {
  events: VaultUserEvent[]
  isLoading: boolean
  error: Error | null
}
