import type { Address } from 'viem'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@/constants/featuredVaults'
import { YVUSD_STRATEGY_ADDRESSES } from '@/constants/yvUsdStrategies'
import { fetchKongVaultSnapshotRaw } from '@/lib/kong-vault-client'
import { getPublicClient } from '@/lib/public-client'

const MORPHO_API_URL = 'https://api.morpho.org/graphql'
export const YVUSD_MORPHO_VAULT_ADDRESS = '0xF9bdDd4A9b3A45f980e11fDDE96e16364dDBEc49'
const PENDLE_API_URL = 'https://api-v2.pendle.finance/core'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const PAWN_BROKER_ADDRESS = '0xe63a2abc24cd9538398d825a4bfe5778d25687df' as Address
const BASIS_POINTS = 10_000
const WAD = 1e18

const pawnBrokerAbi = [
  {
    type: 'function',
    name: 'rate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'pendingRateUpdate',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'value', type: 'uint256' },
      { name: 'effectiveTime', type: 'uint256' }
    ]
  }
] as const

const pawnLooperAbi = [
  {
    type: 'function',
    name: 'getCurrentLeverageRatio',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'getCurrentLTV',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'getLiquidateCollateralFactor',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  }
] as const

export type PawnLooperRates = {
  borrowApr: number
  pendingBorrowApr: number | null
  pendingBorrowEffectiveAtUtc: string | null
  leverage: number
  ltv: number
  lltv: number
  blockNumber: string
  observedAt: string
}

export async function fetchPawnLooperRates(): Promise<PawnLooperRates> {
  const strategyAddress = YVUSD_STRATEGY_ADDRESSES.pawn as Address
  const client = getPublicClient(1)
  const block = await client.getBlock()
  const [borrowRateBps, pendingRateUpdate, currentLeverageRatio, currentLtv, liquidationLtv] = await getPublicClient(
    1
  ).multicall({
    allowFailure: false,
    blockNumber: block.number,
    contracts: [
      { address: PAWN_BROKER_ADDRESS, abi: pawnBrokerAbi, functionName: 'rate' },
      { address: PAWN_BROKER_ADDRESS, abi: pawnBrokerAbi, functionName: 'pendingRateUpdate' },
      { address: strategyAddress, abi: pawnLooperAbi, functionName: 'getCurrentLeverageRatio' },
      { address: strategyAddress, abi: pawnLooperAbi, functionName: 'getCurrentLTV' },
      { address: strategyAddress, abi: pawnLooperAbi, functionName: 'getLiquidateCollateralFactor' }
    ]
  })

  const borrowApr = Number(borrowRateBps) / BASIS_POINTS
  const leverage = Number(currentLeverageRatio) / WAD
  const [pendingRateBps, pendingEffectiveTime] = pendingRateUpdate
  const hasPendingRate = pendingRateBps > 0n && pendingEffectiveTime > 0n

  return {
    blockNumber: block.number.toString(),
    observedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
    borrowApr,
    pendingBorrowApr: hasPendingRate ? Number(pendingRateBps) / BASIS_POINTS : null,
    pendingBorrowEffectiveAtUtc: hasPendingRate ? new Date(Number(pendingEffectiveTime) * 1000).toISOString() : null,
    leverage,
    ltv: Number(currentLtv) / WAD,
    lltv: Number(liquidationLtv) / WAD
  }
}

export type MorphoMarketAllocation = {
  marketId: string
  collateralSymbol: string
  collateralAddress: string
  loanSymbol: string
  allocationUsd: number
  allocationShare: number
  marketLiquidityUsd: number | null
  utilization: number
  supplyApy: number
  lltv: number
  supplyCapAssets: number
  withdrawQueueIndex: number | null
  supplyQueueIndex: number | null
  oracleAddress: string
  irmAddress: string
}

export type MorphoVaultLookthrough = {
  fetchedAt: string
  address: string
  name: string
  totalAssetsUsd: number
  owner: string
  curator: string
  guardian: string
  timelockSeconds: number
  fee: number
  feeRecipient: string
  markets: MorphoMarketAllocation[]
  zeroAllocationMarketCount: number
}

type MorphoApiResponse = {
  data?: {
    vaultByAddress?: {
      address: string
      name: string
      state: {
        totalAssetsUsd: number
        owner: string
        curator: string
        guardian: string
        timelock: number
        fee: number
        feeRecipient: string
        allocation: Array<{
          supplyAssetsUsd: number
          supplyCap: string
          supplyQueueIndex: number | null
          withdrawQueueIndex: number | null
          market: {
            marketId: string
            lltv: number
            irmAddress: string
            oracle: { address: string } | null
            loanAsset: { address: string; symbol: string; decimals: number }
            collateralAsset: { address: string; symbol: string; decimals: number } | null
            state: {
              liquidityAssetsUsd: number
              utilization: number
              supplyApy: number
            }
          }
        }>
      }
    } | null
  }
  errors?: Array<{ message: string }>
}

const MORPHO_LOOKTHROUGH_QUERY = `
  query StrategyMorphoLookthrough($address: String!) {
    vaultByAddress(address: $address, chainId: 1) {
      address
      name
      state {
        totalAssetsUsd
        owner
        curator
        guardian
        timelock
        fee
        feeRecipient
        allocation {
          supplyAssetsUsd
          supplyCap
          supplyQueueIndex
          withdrawQueueIndex
          market {
            marketId
            lltv
            irmAddress
            oracle { address }
            loanAsset { address symbol decimals }
            collateralAsset { address symbol decimals }
            state {
              liquidityAssetsUsd
              utilization
              supplyApy
            }
          }
        }
      }
    }
  }
`

export const normalizeMorphoLltv = (value: number): number => (value > 1 ? value / 1e18 : value)

export function calculateStrategyMarketAllocationUsd(
  strategyAssetsUsd: number | null | undefined,
  nestedAllocationShare: number
): number | null {
  if (
    strategyAssetsUsd === null ||
    strategyAssetsUsd === undefined ||
    !Number.isFinite(strategyAssetsUsd) ||
    strategyAssetsUsd < 0 ||
    !Number.isFinite(nestedAllocationShare) ||
    nestedAllocationShare < 0
  ) {
    return null
  }

  return strategyAssetsUsd * nestedAllocationShare
}

export async function fetchMorphoVaultLookthrough(
  morphoVaultAddress = YVUSD_MORPHO_VAULT_ADDRESS
): Promise<MorphoVaultLookthrough> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: MORPHO_LOOKTHROUGH_QUERY, variables: { address: morphoVaultAddress } })
  })

  if (!response.ok) {
    throw new Error(`Morpho API request failed (${response.status})`)
  }

  const payload = (await response.json()) as MorphoApiResponse
  const vault = payload.data?.vaultByAddress
  if (!vault) {
    throw new Error(payload.errors?.[0]?.message ?? 'Morpho vault data is unavailable')
  }

  if (
    vault.address.toLowerCase() !== morphoVaultAddress.toLowerCase() ||
    !vault.state ||
    !Array.isArray(vault.state.allocation)
  ) {
    throw new Error('Morpho returned incomplete or mismatched vault data')
  }
  const numeric = (value: unknown): number => {
    if (
      (typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && value.trim() === '') ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0
    ) {
      throw new Error('Morpho numeric data is unavailable')
    }
    return Number(value)
  }
  const totalAssetsUsd = numeric(vault.state.totalAssetsUsd)
  const allocations = vault.state.allocation
  const fundedAllocations = allocations.filter((allocation) => numeric(allocation.supplyAssetsUsd) > 0)
  if (fundedAllocations.length > 0 && totalAssetsUsd === 0)
    throw new Error('Morpho allocation denominator is unavailable')

  return {
    fetchedAt: new Date().toISOString(),
    address: vault.address,
    name: vault.name,
    totalAssetsUsd,
    owner: vault.state.owner,
    curator: vault.state.curator,
    guardian: vault.state.guardian,
    timelockSeconds: numeric(vault.state.timelock),
    fee: numeric(vault.state.fee),
    feeRecipient: vault.state.feeRecipient,
    zeroAllocationMarketCount: allocations.length - fundedAllocations.length,
    markets: fundedAllocations
      .map((allocation) => {
        const loanDecimals = numeric(allocation.market.loanAsset.decimals)
        const allocationUsd = numeric(allocation.supplyAssetsUsd)

        return {
          marketId: allocation.market.marketId,
          collateralSymbol: allocation.market.collateralAsset?.symbol ?? 'Idle USDC',
          collateralAddress: allocation.market.collateralAsset?.address ?? allocation.market.loanAsset.address,
          loanSymbol: allocation.market.loanAsset.symbol,
          allocationUsd,
          allocationShare: totalAssetsUsd > 0 ? allocationUsd / totalAssetsUsd : 0,
          marketLiquidityUsd: numeric(allocation.market.state.liquidityAssetsUsd),
          utilization: numeric(allocation.market.state.utilization),
          supplyApy: numeric(allocation.market.state.supplyApy),
          lltv: normalizeMorphoLltv(numeric(allocation.market.lltv)),
          supplyCapAssets: numeric(allocation.supplyCap) / 10 ** loanDecimals,
          withdrawQueueIndex: allocation.withdrawQueueIndex,
          supplyQueueIndex: allocation.supplyQueueIndex,
          oracleAddress: allocation.market.oracle?.address ?? '',
          irmAddress: allocation.market.irmAddress
        }
      })
      .sort((a, b) => b.allocationUsd - a.allocationUsd)
  }
}

export type LockedYvUsdSnapshot = {
  lockedUnderlyingYvUsd: number
  lockedWrapperSupply: number
  lockedTvlUsd: number | null
  unlockedTvlUsd: number | null
  unlockedYvUsdSupply: number
  lockedSupplyRatio: number
  timestampUtc: string | null
}

const asNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const asNullableNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const timestampFromSeconds = (value: number | string | null | undefined): string | null => {
  const seconds = asNumber(value)
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : null
}

export async function fetchLockedYvUsdSnapshot(): Promise<LockedYvUsdSnapshot> {
  const [unlocked, locked] = await Promise.all([
    fetchKongVaultSnapshotRaw(1, YVUSD_UNLOCKED_ADDRESS),
    fetchKongVaultSnapshotRaw(1, YVUSD_LOCKED_ADDRESS)
  ])

  if (!unlocked || !locked) {
    throw new Error('Kong yvUSD snapshots are unavailable')
  }

  const unlockedDecimals = asNumber(unlocked.decimals) || 6
  const lockedDecimals = asNumber(locked.decimals) || 6
  const lockedUnderlyingYvUsd = asNumber(locked.totalAssets) / 10 ** unlockedDecimals
  const unlockedYvUsdSupply = asNumber(unlocked.totalSupply) / 10 ** unlockedDecimals

  return {
    lockedUnderlyingYvUsd,
    lockedWrapperSupply: asNumber(locked.totalSupply) / 10 ** lockedDecimals,
    lockedTvlUsd: asNullableNumber(locked.tvl?.close),
    unlockedTvlUsd: asNullableNumber(unlocked.tvl?.close),
    unlockedYvUsdSupply,
    lockedSupplyRatio: unlockedYvUsdSupply > 0 ? lockedUnderlyingYvUsd / unlockedYvUsdSupply : 0,
    timestampUtc: timestampFromSeconds(locked.blockTime)
  }
}

export type PendlePositionKey = 'sUsdsPendle' | 'usd3Pendle'

export const PENDLE_POSITIONS: Record<
  PendlePositionKey,
  {
    strategyAddress: string
    label: string
    marketAddress: string
    ptAddress: string
  }
> = {
  sUsdsPendle: {
    strategyAddress: YVUSD_STRATEGY_ADDRESSES.sUsdsPendle,
    label: 'sUSDS PT',
    marketAddress: '0x9C560eBaF78e596cbcC27411d633a74D628dd7dC',
    ptAddress: '0xdC169AbE56461A2E0c034Da431Ac2a3ebf596094'
  },
  usd3Pendle: {
    strategyAddress: YVUSD_STRATEGY_ADDRESSES.usd3Pendle,
    label: 'USD3 PT',
    marketAddress: '0x4A5067C3fF1abb7449244025B0e37fEAF77D8E3e',
    ptAddress: '0x7f47c3e6b2c00fC4eB4d5Ae50d0Ab0Ab6888Eb4D'
  }
}

type PendleActiveMarketResponse = {
  markets?: Array<{
    address: string
    expiry: string
    details?: {
      liquidity?: number
      impliedApy?: number
      feeRate?: number
    }
  }>
}

type PendleConvertResponse = {
  routes?: Array<{
    outputs?: Array<{ token: string; amount: string }>
    data?: {
      aggregatorType?: string
      priceImpact?: number
      impliedApy?: { before?: number; after?: number }
      fee?: { usd?: number }
    }
  }>
}

export type PendlePositionLiquidity = {
  key: PendlePositionKey
  label: string
  marketAddress: string
  ptAddress: string
  ptAmount: number
  maturity: string
  marketLiquidityUsd: number | null
  impliedApy: number | null
  marketFeeRate: number | null
  quotedUsdcOut: number
  priceImpact: number | null
  quoteFeeUsd: number | null
  aggregator: string
  discountToRecordedDebt: number | null
  observedAt: string
  blockNumber: string
  quotedAtUtc: string
}

export async function fetchPendlePositionSnapshot(key: PendlePositionKey) {
  const position = PENDLE_POSITIONS[key]
  const client = getPublicClient(1)
  const block = await client.getBlock()
  const [balance, decimals, expiry] = await client.multicall({
    allowFailure: false,
    blockNumber: block.number,
    contracts: [
      {
        address: position.ptAddress as Address,
        abi: [
          {
            type: 'function',
            name: 'balanceOf',
            stateMutability: 'view',
            inputs: [{ name: 'owner', type: 'address' }],
            outputs: [{ type: 'uint256' }]
          }
        ],
        functionName: 'balanceOf',
        args: [position.strategyAddress as Address]
      },
      {
        address: position.ptAddress as Address,
        abi: [
          { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
        ],
        functionName: 'decimals'
      },
      {
        address: position.ptAddress as Address,
        abi: [
          { type: 'function', name: 'expiry', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
        ],
        functionName: 'expiry'
      }
    ]
  })
  const maturity = new Date(Number(expiry) * 1000).toISOString()
  return {
    ptBalanceRaw: balance.toString(),
    ptDecimals: decimals,
    maturity,
    blockNumber: block.number.toString(),
    observedAt: new Date(Number(block.timestamp) * 1000).toISOString()
  }
}

export async function fetchPendlePositionLiquidity(key: PendlePositionKey): Promise<PendlePositionLiquidity> {
  const position = PENDLE_POSITIONS[key]
  const snapshot = await fetchPendlePositionSnapshot(key)
  const balance = BigInt(snapshot.ptBalanceRaw)
  if (balance === 0n) throw new Error('No PT balance at the configured strategy address')
  const [marketsResponse, quoteResponse] = await Promise.all([
    fetch(`${PENDLE_API_URL}/v1/1/markets/active`),
    fetch(`${PENDLE_API_URL}/v3/sdk/1/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver: YVUSD_UNLOCKED_ADDRESS,
        slippage: 0.01,
        enableAggregator: true,
        inputs: [{ token: position.ptAddress, amount: balance.toString() }],
        outputs: [USDC_ADDRESS],
        additionalData: 'impliedApy'
      })
    })
  ])

  if (!marketsResponse.ok || !quoteResponse.ok) {
    throw new Error(`Pendle API request failed (${marketsResponse.status}/${quoteResponse.status})`)
  }

  const marketsPayload = (await marketsResponse.json()) as PendleActiveMarketResponse
  const quotePayload = (await quoteResponse.json()) as PendleConvertResponse
  const market = marketsPayload.markets?.find(
    (candidate) => candidate.address.toLowerCase() === position.marketAddress.toLowerCase()
  )
  const routes = quotePayload.routes ?? []
  const bestRoute = routes
    .map((route) => ({
      route,
      output: Number(route.outputs?.find((output) => output.token.toLowerCase() === USDC_ADDRESS.toLowerCase())?.amount)
    }))
    .filter(({ output }) => Number.isFinite(output) && output > 0)
    .sort((a, b) => b.output - a.output)[0]

  if (!market || !bestRoute) {
    throw new Error('Pendle market or quote data is unavailable')
  }

  const quotedUsdcOut = bestRoute.output / 1e6
  return {
    key,
    label: position.label,
    marketAddress: position.marketAddress,
    ptAddress: position.ptAddress,
    ptAmount: Number(balance) / 10 ** snapshot.ptDecimals,
    maturity: snapshot.maturity,
    observedAt: snapshot.observedAt,
    blockNumber: snapshot.blockNumber,
    marketLiquidityUsd: optionalNumber(market.details?.liquidity),
    impliedApy: optionalNumber(market.details?.impliedApy),
    marketFeeRate: optionalNumber(market.details?.feeRate),
    quotedUsdcOut,
    priceImpact: optionalNumber(bestRoute.route.data?.priceImpact),
    quoteFeeUsd: optionalNumber(bestRoute.route.data?.fee?.usd),
    aggregator: bestRoute.route.data?.aggregatorType ?? 'Pendle internal',
    discountToRecordedDebt: null,
    quotedAtUtc: new Date().toISOString()
  }
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
