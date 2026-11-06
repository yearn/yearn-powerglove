import { type Address, type ContractFunctionParameters, erc20Abi } from 'viem'
import type { ChainId } from '@/constants/chains'
import { getPublicClient } from '@/lib/public-client'

/** Match Yearn Data's last finalized block at or before the dated TVL observation. */
export async function findDepositSnapshotBlock(chainId: ChainId, timestamp: number) {
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) throw new Error('Invalid deposit snapshot timestamp')
  const client = getPublicClient(chainId)
  const head = await client.getBlock({ blockTag: 'finalized' })
  const date = BigInt(timestamp)
  if (head.timestamp < date) throw new Error('Deposit snapshot is newer than finalized chain state')
  const genesis = await client.getBlock({ blockNumber: 0n })
  if (genesis.timestamp > date) throw new Error('Deposit snapshot predates this chain')
  let low = 0n
  let high = head.number
  while (low < high) {
    const mid = (low + high + 1n) / 2n
    const block = await client.getBlock({ blockNumber: mid })
    if (block.timestamp <= date) low = mid
    else high = mid - 1n
  }
  return low
}

export interface DepositBalances {
  totalSupply: bigint | null
  holders: { address: Address; shares: bigint | null }[]
}

export interface DepositBalanceTarget {
  id: string
  address: Address
  holders: readonly Address[]
}

/** Bound archive RPC requests when the table needs balances before sorting. */
export async function readDepositBalanceBatch(
  chainId: ChainId,
  targets: readonly DepositBalanceTarget[],
  blockNumber: bigint
): Promise<Map<string, DepositBalances>> {
  const client = getPublicClient(chainId)
  const balances = new Map<string, DepositBalances>()
  for (let offset = 0; offset < targets.length; offset += 25) {
    const batch = targets.slice(offset, offset + 25)
    const contracts = batch.flatMap(({ address, holders }) => [
      { address, abi: erc20Abi, functionName: 'totalSupply' as const },
      ...holders.map((holder) => ({
        address,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [holder] as const
      }))
    ])
    const results = await client
      .multicall({ blockNumber, allowFailure: true, batchSize: 32768, contracts })
      .catch(() => null)
    let index = 0
    for (const target of batch) {
      const supply = results?.[index++]
      balances.set(target.id, {
        totalSupply: supply?.status === 'success' && typeof supply.result === 'bigint' ? supply.result : null,
        holders: target.holders.map((address) => {
          const result = results?.[index++]
          return {
            address,
            shares: result?.status === 'success' && typeof result.result === 'bigint' ? result.result : null
          }
        })
      })
    }
  }
  return balances
}

/** Read shares and supply at one block; a failed call is unavailable, never zero. */
export async function readDepositBalances(
  chainId: ChainId,
  vault: Address,
  holders: readonly Address[],
  blockNumber: bigint
): Promise<DepositBalances> {
  const client = getPublicClient(chainId)
  const contracts: ContractFunctionParameters<typeof erc20Abi, 'view'>[] = [
    { address: vault, abi: erc20Abi, functionName: 'totalSupply' },
    ...holders.map((address) => ({
      address: vault,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address] as const
    }))
  ]
  const results = await client.multicall({
    blockNumber,
    allowFailure: true,
    contracts
  })
  const supply = results[0]
  return {
    totalSupply: supply.status === 'success' && typeof supply.result === 'bigint' ? supply.result : null,
    holders: holders.map((address, index) => {
      const result = results[index + 1]
      return {
        address,
        shares: result.status === 'success' && typeof result.result === 'bigint' ? result.result : null
      }
    })
  }
}
