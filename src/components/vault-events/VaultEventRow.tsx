import React, { useMemo } from 'react'
import { CHAIN_ID_TO_BLOCK_EXPLORER, CHAIN_ID_TO_NAME } from '@/constants/chains'
import type { VaultUserEvent } from '@/types/vaultEventTypes'

interface VaultEventRowProps {
  event: VaultUserEvent
  tokenSymbol?: string
  tokenDecimals?: number
}

function formatAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatUnits(value: string, decimals: number = 18): string {
  let bigValue: bigint
  try {
    bigValue = BigInt(value)
  } catch {
    return '0'
  }
  const divisor = 10n ** BigInt(decimals)
  const whole = bigValue / divisor
  const fraction = bigValue % divisor
  if (fraction === 0n) {
    return whole.toLocaleString()
  }
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  const fullValue = `${whole}.${fractionStr}`
  const num = Number(fullValue)
  if (!Number.isFinite(num)) return fullValue
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  })
}

function getRelativeTime(blockTimestamp: string | number): string {
  const ts = typeof blockTimestamp === 'string' ? Number(blockTimestamp) : blockTimestamp
  if (!Number.isFinite(ts) || ts <= 0) return ''

  let timestampSeconds: number
  if (ts > 1e17) timestampSeconds = Math.floor(ts / 1e9)
  else if (ts > 1e14) timestampSeconds = Math.floor(ts / 1e6)
  else if (ts > 1e11) timestampSeconds = Math.floor(ts / 1e3)
  else timestampSeconds = Math.floor(ts)

  const nowSeconds = Math.floor(Date.now() / 1000)
  const secondsAgo = nowSeconds - timestampSeconds

  if (secondsAgo <= 0 || secondsAgo < 60) return 'just now'
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`
  return `${Math.floor(secondsAgo / 86400)}d ago`
}

function getExplorerTxUrl(txHash: string, chainId: number): string | null {
  const base = CHAIN_ID_TO_BLOCK_EXPLORER[chainId as keyof typeof CHAIN_ID_TO_BLOCK_EXPLORER]
  if (!base) return null
  return `${base}/tx/${txHash}`
}

function getExplorerAddressUrl(address: string, chainId: number): string | null {
  const base = CHAIN_ID_TO_BLOCK_EXPLORER[chainId as keyof typeof CHAIN_ID_TO_BLOCK_EXPLORER]
  if (!base) return null
  return `${base}/address/${address}`
}

function getChainName(chainId: number): string {
  return CHAIN_ID_TO_NAME[chainId as keyof typeof CHAIN_ID_TO_NAME] ?? `Chain ${chainId}`
}

export const VaultEventRow: React.FC<VaultEventRowProps> = React.memo(
  ({ event, tokenSymbol = '', tokenDecimals = 18 }) => {
    const decimals = tokenDecimals

    const display = useMemo(() => {
      switch (event.type) {
        case 'deposit':
          return {
            icon: '\u2193',
            iconBg: 'bg-green-100',
            iconColor: 'text-green-700',
            label: 'Deposit',
            amount: event.assets ? `+${formatUnits(event.assets, decimals)}` : '+0',
            symbol: tokenSymbol
          }
        case 'withdraw':
          return {
            icon: '\u2191',
            iconBg: 'bg-red-100',
            iconColor: 'text-red-700',
            label: 'Withdraw',
            amount: event.assets ? `-${formatUnits(event.assets, decimals)}` : '-0',
            symbol: tokenSymbol
          }
        case 'transfer':
          return {
            icon: '\u2194',
            iconBg: 'bg-gray-100',
            iconColor: 'text-gray-700',
            label: 'Transfer',
            amount: event.value ? formatUnits(event.value, decimals) : '0',
            symbol: tokenSymbol
          }
        default:
          return {
            icon: '?',
            iconBg: 'bg-gray-100',
            iconColor: 'text-gray-500',
            label: 'Unknown',
            amount: '',
            symbol: ''
          }
      }
    }, [event.type, event.assets, event.value, decimals, tokenSymbol])

    const blockTimestamp = event.blockTimestamp
    const relativeTime = getRelativeTime(blockTimestamp)

    const chainId = event.chainId
    const chainName = getChainName(chainId)
    const txUrl = event.transactionHash ? getExplorerTxUrl(event.transactionHash, chainId) : null

    const ownerAddress = event.owner || event.sender || ''
    const receiverAddress = event.receiver || ''
    const ownerUrl = ownerAddress ? getExplorerAddressUrl(ownerAddress, chainId) : null
    const receiverUrl = receiverAddress ? getExplorerAddressUrl(receiverAddress, chainId) : null

    const amountClass =
      event.type === 'deposit' ? 'text-green-700' : event.type === 'withdraw' ? 'text-red-700' : 'text-gray-700'

    return (
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-start sm:items-center gap-2 sm:gap-4 py-3 px-4 border-b border-border last:border-b-0 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${display.iconBg}`}>
            <span className={`${display.iconColor} text-sm font-semibold`}>{display.icon}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-black">{display.label}</span>
              <span className="text-xs text-[#808080]">{relativeTime}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#808080] mt-0.5">
              {event.owner && (
                <>
                  <span>by</span>
                  {ownerUrl ? (
                    <a href={ownerUrl} target="_blank" rel="noreferrer" className="text-[#0657f9] hover:underline">
                      {formatAddress(event.owner)}
                    </a>
                  ) : (
                    <span>{formatAddress(event.owner)}</span>
                  )}
                </>
              )}
              {event.type === 'withdraw' && event.receiver && (
                <>
                  <span>to</span>
                  {receiverUrl ? (
                    <a href={receiverUrl} target="_blank" rel="noreferrer" className="text-[#0657f9] hover:underline">
                      {formatAddress(event.receiver)}
                    </a>
                  ) : (
                    <span>{formatAddress(event.receiver)}</span>
                  )}
                </>
              )}
              {event.type === 'transfer' && event.receiver && (
                <>
                  <span>to</span>
                  {receiverUrl ? (
                    <a href={receiverUrl} target="_blank" rel="noreferrer" className="text-[#0657f9] hover:underline">
                      {formatAddress(event.receiver)}
                    </a>
                  ) : (
                    <span>{formatAddress(event.receiver)}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right">
            <div className={`text-sm font-semibold font-numeric ${amountClass}`}>
              {display.amount} {display.symbol}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {txUrl && (
              <a href={txUrl} target="_blank" rel="noreferrer" className="text-[#0657f9] hover:underline text-xs">
                tx
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }
)
