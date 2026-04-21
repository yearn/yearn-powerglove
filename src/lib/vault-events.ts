import { queryEnvio } from '@/lib/envio-client'
import type { VaultDepositEvent, VaultTransferEvent, VaultUserEvent, VaultWithdrawEvent } from '@/types/vaultEventTypes'

const VAULT_EVENTS_QUERY = `
  query GetVaultUserEvents($vaultAddress: String!, $chainId: Int!, $limit: Int!) {
    deposits: Deposit(
      where: { vaultAddress: { _eq: $vaultAddress }, chainId: { _eq: $chainId } }
      order_by: { blockTimestamp: desc, blockNumber: desc, logIndex: desc }
      limit: $limit
    ) {
      id
      sender
      owner
      assets
      shares
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      transactionHash
    }
    withdrawals: Withdraw(
      where: { vaultAddress: { _eq: $vaultAddress }, chainId: { _eq: $chainId } }
      order_by: { blockTimestamp: desc, blockNumber: desc, logIndex: desc }
      limit: $limit
    ) {
      id
      sender
      receiver
      owner
      assets
      shares
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      transactionHash
    }
    transfers: Transfer(
      where: { vaultAddress: { _eq: $vaultAddress }, chainId: { _eq: $chainId } }
      order_by: { blockTimestamp: desc, blockNumber: desc, logIndex: desc }
      limit: $limit
    ) {
      id
      sender
      receiver
      value
      vaultAddress
      chainId
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`

interface VaultEventsResponse {
  deposits: VaultDepositEvent[]
  withdrawals: VaultWithdrawEvent[]
  transfers: VaultTransferEvent[]
}

export function sortEventsChronologically(events: VaultUserEvent[]): VaultUserEvent[] {
  return [...events].sort((a, b) => {
    const aTs = Number(a.blockTimestamp) || 0
    const bTs = Number(b.blockTimestamp) || 0
    if (aTs !== bTs) return bTs - aTs

    const aBlock = Number(a.blockNumber) || 0
    const bBlock = Number(b.blockNumber) || 0
    if (aBlock !== bBlock) return bBlock - aBlock

    const aParts = a.id.split('_')
    const bParts = b.id.split('_')
    const aLog = Number(aParts[aParts.length - 1]) || 0
    const bLog = Number(bParts[bParts.length - 1]) || 0
    return bLog - aLog
  })
}

function dedupEvents(events: VaultUserEvent[]): VaultUserEvent[] {
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

export async function fetchVaultUserEvents(
  vaultAddress: string,
  chainId: number,
  limit: number = 200
): Promise<VaultUserEvent[]> {
  const data = await queryEnvio<VaultEventsResponse>(VAULT_EVENTS_QUERY, {
    vaultAddress,
    chainId,
    limit
  })

  const events: VaultUserEvent[] = []

  for (const d of data.deposits) {
    events.push({ ...d, type: 'deposit' })
  }
  for (const w of data.withdrawals) {
    events.push({ ...w, type: 'withdraw' })
  }
  for (const t of data.transfers) {
    events.push({ ...t, type: 'transfer' })
  }

  const sorted = sortEventsChronologically(events)
  return dedupEvents(sorted)
}
