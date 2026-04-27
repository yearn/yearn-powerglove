import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { type AbiEvent, type Address, createPublicClient, http } from 'viem'
import { buildVaultActivitySeries, normalizeVaultActivityData } from '../src/lib/vault-activity'
import {
  annotateDebtReallocationEvents,
  calculateUnlockStateFromRaw,
  getVaultActivityOutputPath,
  mapDebtUpdatedEventToActivity,
  mapProfitMaxUnlockTimeEventToActivity,
  mapStrategyReportedEventToActivity,
  mapV2DebtRatioEventToActivity,
  mapV2StrategyReportedEventToActivity,
  type RawVaultActivityLog,
  type RawVaultUnlockReads,
  V2_STRATEGY_ADDED_EVENT,
  V2_STRATEGY_REPORTED_EVENT,
  V2_STRATEGY_REVOKED_EVENT,
  V2_STRATEGY_UPDATE_DEBT_RATIO_EVENT,
  V3_DEBT_UPDATED_EVENT,
  V3_STRATEGY_REPORTED_EVENT,
  V3_UPDATE_PROFIT_MAX_UNLOCK_TIME_EVENT,
  V3_VAULT_ACTIVITY_ABI
} from '../src/lib/vault-activity-backfill'
import type { VaultActivityEvent, VaultUnlockState } from '../src/types/vaultActivityTypes'

interface CliArgs {
  chainId: number
  vault: Address
  fromBlock?: bigint
  toBlock?: bigint
  chunkSize: bigint
}

type SupportedEventName =
  | 'v3StrategyReported'
  | 'v3DebtUpdated'
  | 'v3UpdateProfitMaxUnlockTime'
  | 'v2StrategyReported'
  | 'v2StrategyAdded'
  | 'v2StrategyRevoked'
  | 'v2StrategyUpdateDebtRatio'

interface DecodedActivityLog extends RawVaultActivityLog {
  eventName: SupportedEventName
}

const DEFAULT_CHUNK_SIZE = 100_000n
const DEFAULT_READ_CONCURRENCY = 8

function parseBigIntArg(value: string | undefined, name: string): bigint | undefined {
  if (!value) {
    return undefined
  }

  try {
    return BigInt(value)
  } catch {
    throw new Error(`${name} must be an integer block number.`)
  }
}

function readArgValue(args: string[], index: number): string | undefined {
  const value = args[index]
  if (!value || value.startsWith('--')) {
    return undefined
  }

  return value
}

function parseCliArgs(argv: string[]): CliArgs {
  const args = argv.slice(2)
  let chainId: number | undefined
  let vault: Address | undefined
  let fromBlock: bigint | undefined
  let toBlock: bigint | undefined
  let chunkSize = DEFAULT_CHUNK_SIZE

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const [flag, inlineValue] = arg.split('=', 2)
    const value = inlineValue ?? readArgValue(args, index + 1)
    if (inlineValue === undefined && value !== undefined) {
      index += 1
    }

    if (flag === '--chain-id') {
      chainId = Number(value)
    } else if (flag === '--vault') {
      vault = value as Address
    } else if (flag === '--from-block') {
      fromBlock = parseBigIntArg(value, '--from-block')
    } else if (flag === '--to-block') {
      toBlock = parseBigIntArg(value, '--to-block')
    } else if (flag === '--chunk-size') {
      chunkSize = parseBigIntArg(value, '--chunk-size') ?? DEFAULT_CHUNK_SIZE
    } else if (flag === '--help' || flag === '-h') {
      printUsage()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!Number.isSafeInteger(chainId)) {
    throw new Error('--chain-id is required.')
  }
  if (!vault || !/^0x[a-fA-F0-9]{40}$/.test(vault)) {
    throw new Error('--vault must be a valid EVM address.')
  }
  if (chunkSize <= 0n) {
    throw new Error('--chunk-size must be greater than 0.')
  }

  return {
    chainId,
    vault,
    fromBlock,
    toBlock,
    chunkSize
  }
}

function printUsage() {
  console.log(`Usage:
  bun scripts/fetch-vault-activity.ts --chain-id 1 --vault 0x... [--from-block 123] [--to-block 456]

Environment:
  ARCHIVE_RPC_URL or VITE_RPC_URI_FOR_<chainId> must point to an archive-capable RPC.`)
}

function getRpcUrl(chainId: number): string {
  const rpcUrl = process.env.ARCHIVE_RPC_URL?.trim() || process.env[`VITE_RPC_URI_FOR_${chainId}`]?.trim()
  if (!rpcUrl) {
    throw new Error(`Missing ARCHIVE_RPC_URL or VITE_RPC_URI_FOR_${chainId}.`)
  }

  return rpcUrl
}

async function getBlockTimestamp(client: ReturnType<typeof createPublicClient>, blockNumber: bigint): Promise<number> {
  const block = await client.getBlock({ blockNumber })
  return Number(block.timestamp)
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length)
  let nextIndex = 0

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex
        nextIndex += 1
        results[currentIndex] = await mapper(items[currentIndex], currentIndex)
      }
    })
  )

  return results
}

async function getLogsForEvent(
  client: ReturnType<typeof createPublicClient>,
  vault: Address,
  eventName: SupportedEventName,
  event: AbiEvent,
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint
): Promise<DecodedActivityLog[]> {
  const logs: DecodedActivityLog[] = []

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n
    const chunkLogs = await client.getLogs({
      address: vault,
      event,
      fromBlock: start,
      toBlock: end
    })
    const blockNumbers = [...new Set(chunkLogs.map((log) => log.blockNumber))]
    const blockTimestamps = await mapWithConcurrency(blockNumbers, DEFAULT_READ_CONCURRENCY, async (blockNumber) => [
      blockNumber.toString(),
      await getBlockTimestamp(client, blockNumber)
    ])
    const timestampByBlock = new Map<string, number>(blockTimestamps)

    for (const log of chunkLogs) {
      logs.push({
        eventName,
        chainId: client.chain?.id ?? 0,
        vaultAddress: vault,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        timestamp: timestampByBlock.get(log.blockNumber.toString()) ?? 0,
        args: (log.args ?? {}) as Record<string, unknown>
      })
    }
  }

  return logs
}

async function readContractValue(
  client: ReturnType<typeof createPublicClient>,
  vault: Address,
  functionName: string,
  blockNumber?: bigint,
  args?: readonly unknown[]
): Promise<string | null> {
  try {
    const value = await client.readContract({
      address: vault,
      abi: V3_VAULT_ACTIVITY_ABI,
      functionName,
      blockNumber,
      args
    })

    return value === null || value === undefined ? null : value.toString()
  } catch {
    return null
  }
}

async function readUnlockState(
  client: ReturnType<typeof createPublicClient>,
  chainId: number,
  vault: Address,
  blockNumber: bigint,
  timestamp: number,
  assetDecimals: number,
  shareDecimals: number
): Promise<VaultUnlockState> {
  const [
    unlockedShares,
    profitUnlockingRate,
    profitMaxUnlockTime,
    fullProfitUnlockDate,
    totalAssets,
    pricePerShare,
    totalSupply,
    lockedShares,
    lockedProfit,
    lockedProfitDegradation,
    lastReport
  ] = await Promise.all([
    readContractValue(client, vault, 'unlockedShares', blockNumber),
    readContractValue(client, vault, 'profitUnlockingRate', blockNumber),
    readContractValue(client, vault, 'profitMaxUnlockTime', blockNumber),
    readContractValue(client, vault, 'fullProfitUnlockDate', blockNumber),
    readContractValue(client, vault, 'totalAssets', blockNumber),
    readContractValue(client, vault, 'pricePerShare', blockNumber),
    readContractValue(client, vault, 'totalSupply', blockNumber),
    readContractValue(client, vault, 'balanceOf', blockNumber, [vault]),
    readContractValue(client, vault, 'lockedProfit', blockNumber),
    readContractValue(client, vault, 'lockedProfitDegradation', blockNumber),
    readContractValue(client, vault, 'lastReport', blockNumber)
  ])
  const raw: RawVaultUnlockReads = {
    unlockedShares,
    profitUnlockingRate,
    profitMaxUnlockTime,
    fullProfitUnlockDate,
    totalAssets,
    pricePerShare,
    totalSupply,
    lockedShares,
    lockedProfit,
    lockedProfitDegradation,
    lastReport
  }

  return calculateUnlockStateFromRaw(raw, {
    chainId,
    vaultAddress: vault,
    blockNumber,
    timestamp,
    assetDecimals,
    shareDecimals
  })
}

async function readVaultDecimals(client: ReturnType<typeof createPublicClient>, vault: Address): Promise<number> {
  const decimals = await readContractValue(client, vault, 'decimals')
  const numericDecimals = decimals ? Number(decimals) : Number.NaN
  return Number.isInteger(numericDecimals) && numericDecimals >= 0 ? numericDecimals : 18
}

function mapLogToActivity(
  log: DecodedActivityLog,
  unlockState: VaultUnlockState | null,
  assetDecimals: number,
  shareDecimals: number
): VaultActivityEvent {
  const context = {
    assetDecimals,
    shareDecimals,
    unlockState
  }

  if (log.eventName === 'v3StrategyReported') {
    return mapStrategyReportedEventToActivity(log, context)
  }
  if (log.eventName === 'v3DebtUpdated') {
    return mapDebtUpdatedEventToActivity(log, context)
  }
  if (log.eventName === 'v3UpdateProfitMaxUnlockTime') {
    return mapProfitMaxUnlockTimeEventToActivity(log, context)
  }
  if (log.eventName === 'v2StrategyReported') {
    return mapV2StrategyReportedEventToActivity(log, context)
  }
  if (log.eventName === 'v2StrategyAdded') {
    return mapV2DebtRatioEventToActivity(log, 'V2StrategyAdded', context)
  }
  if (log.eventName === 'v2StrategyRevoked') {
    return mapV2DebtRatioEventToActivity(log, 'V2StrategyRevoked', context)
  }
  if (log.eventName === 'v2StrategyUpdateDebtRatio') {
    return mapV2DebtRatioEventToActivity(log, 'V2StrategyUpdateDebtRatio', context)
  }

  return mapProfitMaxUnlockTimeEventToActivity(log, context)
}

async function main() {
  const args = parseCliArgs(process.argv)
  const rpcUrl = getRpcUrl(args.chainId)
  const client = createPublicClient({
    chain: {
      id: args.chainId,
      name: `Chain ${args.chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } }
    },
    transport: http(rpcUrl)
  })

  const latestBlock = await client.getBlockNumber()
  const fromBlock = args.fromBlock ?? 0n
  const toBlock = args.toBlock ?? latestBlock
  const shareDecimals = await readVaultDecimals(client, args.vault)
  const assetDecimals = shareDecimals

  const allLogs = (
    await Promise.all([
      getLogsForEvent(
        client,
        args.vault,
        'v3StrategyReported',
        V3_STRATEGY_REPORTED_EVENT,
        fromBlock,
        toBlock,
        args.chunkSize
      ),
      getLogsForEvent(client, args.vault, 'v3DebtUpdated', V3_DEBT_UPDATED_EVENT, fromBlock, toBlock, args.chunkSize),
      getLogsForEvent(
        client,
        args.vault,
        'v3UpdateProfitMaxUnlockTime',
        V3_UPDATE_PROFIT_MAX_UNLOCK_TIME_EVENT,
        fromBlock,
        toBlock,
        args.chunkSize
      ),
      getLogsForEvent(
        client,
        args.vault,
        'v2StrategyReported',
        V2_STRATEGY_REPORTED_EVENT,
        fromBlock,
        toBlock,
        args.chunkSize
      ),
      getLogsForEvent(
        client,
        args.vault,
        'v2StrategyAdded',
        V2_STRATEGY_ADDED_EVENT,
        fromBlock,
        toBlock,
        args.chunkSize
      ),
      getLogsForEvent(
        client,
        args.vault,
        'v2StrategyRevoked',
        V2_STRATEGY_REVOKED_EVENT,
        fromBlock,
        toBlock,
        args.chunkSize
      ),
      getLogsForEvent(
        client,
        args.vault,
        'v2StrategyUpdateDebtRatio',
        V2_STRATEGY_UPDATE_DEBT_RATIO_EVENT,
        fromBlock,
        toBlock,
        args.chunkSize
      )
    ])
  )
    .flat()
    .sort((a, b) => {
      const blockDelta = Number(BigInt(a.blockNumber) - BigInt(b.blockNumber))
      if (blockDelta !== 0) {
        return blockDelta
      }

      return Number(a.logIndex ?? 0) - Number(b.logIndex ?? 0)
    })

  const blockLogs = [...new Map(allLogs.map((log) => [BigInt(log.blockNumber).toString(), log] as const)).values()]
  const unlockStates = await mapWithConcurrency(blockLogs, DEFAULT_READ_CONCURRENCY, async (log) => [
    BigInt(log.blockNumber).toString(),
    await readUnlockState(
      client,
      args.chainId,
      args.vault,
      BigInt(log.blockNumber),
      Number(log.timestamp),
      assetDecimals,
      shareDecimals
    )
  ])
  const unlockStateByBlock = new Map<string, VaultUnlockState>(unlockStates)

  const events = annotateDebtReallocationEvents(
    allLogs.map((log) =>
      mapLogToActivity(
        log,
        unlockStateByBlock.get(BigInt(log.blockNumber).toString()) ?? null,
        assetDecimals,
        shareDecimals
      )
    )
  )
  const latestTimestamp = await getBlockTimestamp(client, toBlock)
  const currentUnlock = await readUnlockState(
    client,
    args.chainId,
    args.vault,
    toBlock,
    latestTimestamp,
    assetDecimals,
    shareDecimals
  )
  const normalized = normalizeVaultActivityData({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    chainId: args.chainId,
    vaultAddress: args.vault,
    currentUnlock,
    events,
    series: buildVaultActivitySeries(events, currentUnlock),
    meta: {
      source: 'archive-rpc',
      fromBlock: Number(fromBlock),
      toBlock: Number(toBlock),
      assetDecimals,
      shareDecimals
    }
  })
  const outputPath = getVaultActivityOutputPath(args.chainId, args.vault)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(`${outputPath}`, `${JSON.stringify(normalized, null, 2)}\n`)
  console.log(`Wrote ${events.length} activity events to ${outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
