import { describe, expect, it } from 'vitest'
import {
  type ActivityFeedItem,
  type AssetPriceMap,
  aggregateActivityByDay,
  collectDistinctAssets,
  computeActivityVolume24h,
  eventUsd,
  type ProtocolActivityEvent,
  shapeActivityFeed,
  type VaultAssetLookup,
  vaultKey
} from '@/lib/protocol-activity'

const HOUR = 3600
const DAY = 86400

const lookup: VaultAssetLookup = new Map([
  [vaultKey(1, '0xVaULTa'), { assetAddress: '0xUSDC', decimals: 6, symbol: 'USDC' }],
  [vaultKey(8453, '0xVaultB'), { assetAddress: '0xWETH', decimals: 18, symbol: 'WETH' }]
])

const prices: AssetPriceMap = new Map([
  ['1:0xusdc', 1],
  ['8453:0xweth', 2000]
])

const ev = (partial: Partial<ProtocolActivityEvent>): ProtocolActivityEvent => ({
  chainId: 1,
  vaultAddress: '0xVaULTa',
  blockTimestamp: 1000,
  transactionHash: '0xhash',
  account: '0xowner',
  ...partial,
  type: partial.type ?? 'deposit',
  assets: partial.assets ?? '0'
})

describe('vaultKey', () => {
  it('lowercases the vault address', () => {
    expect(vaultKey(1, '0xABCDEF')).toBe('1:0xabcdef')
  })
})

describe('eventUsd', () => {
  it('converts raw assets to USD via decimals + price', () => {
    // 2,000,000 raw / 1e6 = 2 USDC * $1 = $2
    expect(eventUsd(ev({ assets: '2000000' }), lookup, prices)).toBe(2)
  })

  it('handles 18-decimal assets', () => {
    // 1e18 raw = 1 WETH * $2000 = $2000
    const e = ev({ assets: '1000000000000000000', chainId: 8453, vaultAddress: '0xVaultB' })
    expect(eventUsd(e, lookup, prices)).toBe(2000)
  })

  it('returns null for unknown vault / asset / price', () => {
    expect(eventUsd(ev({ assets: '1', vaultAddress: '0xunknown' }), lookup, prices)).toBeNull()
    expect(eventUsd(ev({ assets: '1', chainId: 137, vaultAddress: '0xNoPrice' }), new Map(), new Map())).toBeNull()
  })

  it('returns null for non-positive raw amounts', () => {
    expect(eventUsd(ev({ assets: '0' }), lookup, prices)).toBeNull()
    expect(eventUsd(ev({ assets: '-5' }), lookup, prices)).toBeNull()
  })
})

describe('aggregateActivityByDay', () => {
  it('buckets by UTC day and sums deposits/withdrawals and net', () => {
    const events = [
      ev({ type: 'deposit', assets: '2000000', blockTimestamp: 0 }), // $2 deposit
      ev({ type: 'deposit', assets: '3000000', blockTimestamp: HOUR }), // $3 deposit
      ev({ type: 'withdraw', assets: '1000000', blockTimestamp: DAY + HOUR }) // $1 withdraw next day
    ]
    const days = aggregateActivityByDay(events, lookup, prices)
    expect(days).toHaveLength(2)
    expect(days[0]).toMatchObject({ day: 0, depositsUsd: 5, withdrawalsUsd: 0, netUsd: 5 })
    expect(days[1]).toMatchObject({ day: DAY, depositsUsd: 0, withdrawalsUsd: 1, netUsd: -1 })
  })

  it('skips unpriceable events', () => {
    const events = [
      ev({ type: 'deposit', assets: '2000000', blockTimestamp: 0 }),
      ev({ type: 'deposit', assets: '2000000', blockTimestamp: 0, vaultAddress: '0xunknown' })
    ]
    const days = aggregateActivityByDay(events, lookup, prices)
    expect(days).toHaveLength(1)
    expect(days[0].depositsUsd).toBe(2)
  })
})

describe('computeActivityVolume24h', () => {
  it('sums only events in the trailing 24h', () => {
    const now = 10 * DAY
    const events = [
      ev({ type: 'deposit', assets: '2000000', blockTimestamp: now - 100 }), // in window
      ev({ type: 'withdraw', assets: '3000000', blockTimestamp: now - DAY - 100 }) // out
    ]
    expect(computeActivityVolume24h(events, lookup, prices, now)).toBe(2)
  })
})

describe('shapeActivityFeed', () => {
  it('returns newest-first with limit, raw amount + symbol always present', () => {
    const events = [
      ev({ type: 'deposit', assets: '2000000', blockTimestamp: 0 }),
      ev({ type: 'withdraw', assets: '1000000', blockTimestamp: 1000 }),
      ev({ type: 'deposit', assets: '5000000', blockTimestamp: 2000 })
    ]
    const feed = shapeActivityFeed(events, lookup, prices, 2) as ActivityFeedItem[]
    expect(feed).toHaveLength(2)
    expect(feed[0].blockTimestamp).toBe(2000)
    expect(feed[0].amountUsd).toBe(5)
    expect(feed[0].assetSymbol).toBe('USDC')
    // unknown vault -> null usd but symbol fallback + raw preserved
    const unpriced = shapeActivityFeed(
      [ev({ type: 'deposit', assets: '9', blockTimestamp: 5, vaultAddress: '0xunknown' })],
      lookup,
      prices,
      5
    )
    expect(unpriced[0].amountUsd).toBeNull()
    expect(unpriced[0].assetSymbol).toBe('—')
    expect(unpriced[0].amountRaw).toBe('9')
  })
})

describe('collectDistinctAssets', () => {
  it('dedupes (chainId, asset) pairs and skips unknown vaults', () => {
    const events = [
      ev({ type: 'deposit', assets: '1', chainId: 1, vaultAddress: '0xVaULTa' }),
      ev({ type: 'withdraw', assets: '1', chainId: 1, vaultAddress: '0xVaULTa' }),
      ev({ type: 'deposit', assets: '1', chainId: 8453, vaultAddress: '0xVaultB' }),
      ev({ type: 'deposit', assets: '1', chainId: 1, vaultAddress: '0xunknown' })
    ]
    const assets = collectDistinctAssets(events, lookup)
    expect(assets).toHaveLength(2)
    expect(assets).toContainEqual({ chainId: 1, address: '0xUSDC' })
    expect(assets).toContainEqual({ chainId: 8453, address: '0xWETH' })
  })
})
