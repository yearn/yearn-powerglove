import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findDepositSnapshotBlock, readDepositBalanceBatch, readDepositBalances } from './direct-deposit-balances'

const { getBlock, multicall } = vi.hoisted(() => ({ getBlock: vi.fn(), multicall: vi.fn() }))
vi.mock('@/lib/public-client', () => ({ getPublicClient: () => ({ getBlock, multicall }) }))
const vault = '0x1111111111111111111111111111111111111111'
const holders = ['0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333'] as const

beforeEach(() => {
  vi.resetAllMocks()
  getBlock.mockImplementation(async ({ blockNumber, blockTag }) => {
    const number = blockTag === 'finalized' ? 100n : blockNumber
    return { number, timestamp: number * 10n }
  })
})

describe('dated depositor reads', () => {
  it('bounds table batches and preserves successful batches when another request fails', async () => {
    multicall
      .mockResolvedValueOnce(
        Array.from({ length: 25 }, () => [
          { status: 'success', result: 100n },
          { status: 'success', result: 0n },
          { status: 'success', result: 5n }
        ]).flat()
      )
      .mockRejectedValueOnce(new Error('archive request failed'))
    const targets = Array.from({ length: 26 }, (_, index) => ({ id: String(index), address: vault, holders }) as const)
    const result = await readDepositBalanceBatch(1, targets, 55n)
    expect(multicall).toHaveBeenCalledTimes(2)
    expect(multicall.mock.calls[0][0]).toMatchObject({ blockNumber: 55n, allowFailure: true })
    expect(result.get('0')).toEqual({
      totalSupply: 100n,
      holders: [
        { address: holders[0], shares: 0n },
        { address: holders[1], shares: 5n }
      ]
    })
    expect(result.get('25')).toEqual({
      totalSupply: null,
      holders: holders.map((address) => ({ address, shares: null }))
    })
  })
  it('finds the last block at or before the snapshot, including exact boundaries', async () => {
    expect(await findDepositSnapshotBlock(1, 555)).toBe(55n)
    expect(await findDepositSnapshotBlock(1, 550)).toBe(55n)
    expect(getBlock).toHaveBeenCalledWith({ blockTag: 'finalized' })
    expect(getBlock).not.toHaveBeenCalledWith({ blockTag: 'latest' })
  })

  it('rejects dates newer than finalized state or older than chain genesis', async () => {
    await expect(findDepositSnapshotBlock(1, 1001)).rejects.toThrow('newer than finalized')
    getBlock
      .mockResolvedValueOnce({ number: 100n, timestamp: 1000n })
      .mockResolvedValueOnce({ number: 0n, timestamp: 600n })
    await expect(findDepositSnapshotBlock(1, 555)).rejects.toThrow('predates this chain')
    await expect(findDepositSnapshotBlock(1, Number.NaN)).rejects.toThrow('Invalid')
  })

  it('pins all balances and supply to the same block and preserves failed calls', async () => {
    multicall.mockResolvedValue([
      { status: 'success', result: 100n },
      { status: 'success', result: 0n },
      { status: 'failure', error: new Error('unavailable') }
    ])
    expect(await readDepositBalances(1, vault, holders, 55n)).toEqual({
      totalSupply: 100n,
      holders: [
        { address: holders[0], shares: 0n },
        { address: holders[1], shares: null }
      ]
    })
    expect(multicall).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 55n, allowFailure: true }))
    expect(
      multicall.mock.calls[0][0].contracts.map((call: { address: string; functionName: string }) => [
        call.address,
        call.functionName
      ])
    ).toEqual([
      [vault, 'totalSupply'],
      [vault, 'balanceOf'],
      [vault, 'balanceOf']
    ])
  })
})
