import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { CHAIN_ID_TO_BLOCK_EXPLORER } from '@/constants/chains'
import { cn } from '@/lib/utils'
import type { VaultManagementReason } from '@/lib/vault-management-display'
import type { VaultActivityEvent } from '@/types/vaultEventTypes'

interface VaultEventRowProps {
  event: VaultActivityEvent
  assetSymbol?: string
  assetDecimals?: number
  shareSymbol?: string
  shareDecimals?: number
  strategyNamesByAddress?: Record<string, string>
  reason?: VaultManagementReason
  nested?: boolean
}

interface EventDetail {
  label: string
  value: string
  href?: string
}

interface EventDisplay {
  icon: string
  iconBg: string
  iconColor: string
  title: string
  subject?: string
  description?: string
  summary?: string
  summaryClassName?: string
  details: EventDetail[]
  expandable: boolean
}

interface EventDisplayContext {
  chainId: number
  assetSymbol: string
  assetDecimals: number
  shareSymbol: string
  shareDecimals: number
  strategyNamesByAddress: Record<string, string>
}

const STRATEGY_CHANGE_TYPES: Record<string, { label: string; description: string }> = {
  '1': {
    label: 'Added',
    description:
      'The vault activated this strategy. It can now receive debt, but this event alone does not allocate funds.'
  },
  '2': {
    label: 'Revoked',
    description:
      'The vault removed this strategy from its active set. It will not receive new debt after this, and it is removed from the default queue.'
  }
}

const V3_ROLE_DEFINITIONS = [
  { mask: 1n, label: 'Add Strategy Manager' },
  { mask: 2n, label: 'Revoke Strategy Manager' },
  { mask: 4n, label: 'Force Revoke Manager' },
  { mask: 8n, label: 'Accountant Manager' },
  { mask: 16n, label: 'Queue Manager' },
  { mask: 32n, label: 'Reporting Manager' },
  { mask: 64n, label: 'Debt Manager' },
  { mask: 128n, label: 'Max Debt Manager' },
  { mask: 256n, label: 'Deposit Limit Manager' },
  { mask: 512n, label: 'Withdraw Limit Manager' },
  { mask: 1024n, label: 'Minimum Idle Manager' },
  { mask: 2048n, label: 'Profit Unlock Manager' },
  { mask: 4096n, label: 'Debt Purchaser' },
  { mask: 8192n, label: 'Emergency Manager' }
] as const

function isUserEventType(eventType: VaultActivityEvent['type']): boolean {
  return eventType === 'deposit' || eventType === 'withdraw' || eventType === 'transfer'
}

function formatAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function isTimelockControllerText(value?: string): boolean {
  return value?.includes('TimelockController') ?? false
}

function normalizeAddress(address?: string): string | null {
  return address ? address.toLowerCase() : null
}

function getAddressLabel(address: string | undefined, strategyNamesByAddress: Record<string, string>): string | null {
  const normalizedAddress = normalizeAddress(address)
  if (!normalizedAddress) {
    return null
  }

  return strategyNamesByAddress[normalizedAddress] ?? null
}

function formatAddressOrName(address: string | undefined, strategyNamesByAddress: Record<string, string>): string {
  if (!address) {
    return ''
  }

  const resolvedName = getAddressLabel(address, strategyNamesByAddress)
  return resolvedName ?? formatAddress(address)
}

function formatAddressWithName(address: string, strategyNamesByAddress: Record<string, string>): string {
  const resolvedName = getAddressLabel(address, strategyNamesByAddress)
  return resolvedName ? `${resolvedName} (${formatAddress(address)})` : formatAddress(address)
}

function truncateValue(value: string, maxLength: number = 48): string {
  if (!value || value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 3)}...`
}

function toBigInt(value: string | undefined): bigint | null {
  if (!value) {
    return null
  }

  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function formatUnits(value: string, decimals: number = 18): string {
  const bigValue = toBigInt(value)
  if (bigValue === null) {
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

function formatRawNumber(value: string): string {
  const bigintValue = toBigInt(value)
  if (bigintValue !== null) {
    return bigintValue.toLocaleString()
  }

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return value
  }

  return numericValue.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  })
}

function formatBpsAsPercent(value?: string): string {
  if (!value) return ''

  const basisPoints = Number(value)
  if (!Number.isFinite(basisPoints)) {
    return value
  }

  const percent = basisPoints / 100
  return `${percent.toLocaleString('en-US', {
    minimumFractionDigits: percent % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}%`
}

function formatDurationSeconds(value?: string): string {
  if (!value) return ''

  const totalSeconds = Number(value)
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return value
  }

  if (totalSeconds < 60) return `${Math.floor(totalSeconds)}s`

  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.join(' ') || `${Math.floor(totalSeconds)}s`
}

function formatRelativeTime(blockTimestamp: string | number): string {
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
  if (secondsAgo < 86_400) return `${Math.floor(secondsAgo / 3_600)}h ago`
  return `${Math.floor(secondsAgo / 86_400)}d ago`
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

function pushDetail(details: EventDetail[], detail: EventDetail | null) {
  if (detail) {
    details.push(detail)
  }
}

function makeTextDetail(label: string, value?: string): EventDetail | null {
  if (!value) return null
  return { label, value }
}

function makeAddressDetail(
  label: string,
  address: string | undefined,
  chainId: number,
  strategyNamesByAddress: Record<string, string>
): EventDetail | null {
  if (!address) return null

  return {
    label,
    value: formatAddressWithName(address, strategyNamesByAddress),
    href: getExplorerAddressUrl(address, chainId) ?? undefined
  }
}

function makeAssetDetail(
  label: string,
  value: string | undefined,
  decimals: number,
  symbol?: string,
  allowZero: boolean = false
): EventDetail | null {
  if (!value || (!allowZero && value === '0')) return null

  return {
    label,
    value: `${formatUnits(value, decimals)}${symbol ? ` ${symbol}` : ''}`
  }
}

function makeRawDetail(label: string, value?: string): EventDetail | null {
  if (!value) return null

  return {
    label,
    value: formatRawNumber(value)
  }
}

function makePercentDetail(label: string, value?: string): EventDetail | null {
  const formatted = formatBpsAsPercent(value)
  if (!formatted) return null
  return { label, value: formatted }
}

function makeQueueDetails(
  addresses: string[] | undefined,
  chainId: number,
  strategyNamesByAddress: Record<string, string>
): EventDetail[] {
  if (!addresses?.length) {
    return []
  }

  return addresses.map((address, index) => ({
    label: `Queue ${index + 1}`,
    value: formatAddressWithName(address, strategyNamesByAddress),
    href: getExplorerAddressUrl(address, chainId) ?? undefined
  }))
}

function formatSignedAssetDelta(value: bigint, decimals: number, symbol?: string): string {
  const sign = value > 0n ? '+' : value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${formatUnits(absolute.toString(), decimals)}${symbol ? ` ${symbol}` : ''}`
}

function formatNetResult(gain?: string, loss?: string, decimals: number = 18, symbol?: string): string | undefined {
  const gainValue = toBigInt(gain) ?? 0n
  const lossValue = toBigInt(loss) ?? 0n
  const net = gainValue - lossValue

  if (net === 0n && gainValue === 0n && lossValue === 0n) {
    return undefined
  }

  return formatSignedAssetDelta(net, decimals, symbol)
}

function getStrategyChangeDisplay(changeType?: string): { title: string; summary: string; description: string } {
  const resolvedChange = changeType ? STRATEGY_CHANGE_TYPES[changeType] : undefined
  if (!resolvedChange) {
    return {
      title: 'Strategy Changed',
      summary: changeType ? `Type ${changeType}` : 'Changed',
      description: 'The vault changed this strategy status, but the change type was not decoded.'
    }
  }

  return {
    title: `Strategy ${resolvedChange.label}`,
    summary: resolvedChange.label,
    description: resolvedChange.description
  }
}

function decodeDebtUpdate(
  currentDebt?: string,
  newDebt?: string
): {
  title: string
  description: string
  summary?: string
} {
  const currentDebtValue = toBigInt(currentDebt) ?? 0n
  const newDebtValue = toBigInt(newDebt) ?? 0n

  if (currentDebtValue === 0n && newDebtValue > 0n) {
    return {
      title: 'Strategy Funded',
      description: 'The vault moved this strategy from zero debt to an active allocation.'
    }
  }

  if (currentDebtValue > 0n && newDebtValue === 0n) {
    return {
      title: 'Strategy Fully Deallocated',
      description:
        'The vault reduced this strategy debt to zero. That removes its active allocation, but does not by itself revoke the strategy.'
    }
  }

  if (newDebtValue > currentDebtValue) {
    return {
      title: 'Debt Increased',
      description: 'The vault increased capital allocated to this strategy.'
    }
  }

  if (newDebtValue < currentDebtValue) {
    return {
      title: 'Debt Decreased',
      description: 'The vault reduced capital allocated to this strategy.'
    }
  }

  return {
    title: 'Debt Updated',
    description:
      'The vault emitted a debt update for this strategy, but the current and new debt values are the same in the indexed payload.'
  }
}

function decodeRoles(roleMask?: string): string[] {
  const normalizedMask = toBigInt(roleMask)
  if (normalizedMask === null || normalizedMask === 0n) {
    return []
  }

  return V3_ROLE_DEFINITIONS.filter(
    (roleDefinition) => (normalizedMask & roleDefinition.mask) === roleDefinition.mask
  ).map((roleDefinition) => roleDefinition.label)
}

function buildUserEventDisplay(event: VaultActivityEvent, context: EventDisplayContext): EventDisplay {
  const details: EventDetail[] = []

  switch (event.type) {
    case 'deposit':
      pushDetail(details, makeAddressDetail('Owner', event.owner, context.chainId, context.strategyNamesByAddress))
      if (event.sender && event.sender !== event.owner) {
        pushDetail(details, makeAddressDetail('Sender', event.sender, context.chainId, context.strategyNamesByAddress))
      }
      pushDetail(details, makeAssetDetail('Shares', event.shares, context.shareDecimals, context.shareSymbol))

      return {
        icon: '\u2193',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-700',
        title: 'Deposit',
        summary: event.assets
          ? `+${formatUnits(event.assets, context.assetDecimals)}${context.assetSymbol ? ` ${context.assetSymbol}` : ''}`
          : '+0',
        summaryClassName: 'text-green-700',
        details,
        expandable: false
      }
    case 'withdraw':
      pushDetail(details, makeAddressDetail('Owner', event.owner, context.chainId, context.strategyNamesByAddress))
      pushDetail(
        details,
        makeAddressDetail('Receiver', event.receiver, context.chainId, context.strategyNamesByAddress)
      )
      if (event.sender && event.sender !== event.owner) {
        pushDetail(details, makeAddressDetail('Sender', event.sender, context.chainId, context.strategyNamesByAddress))
      }
      pushDetail(details, makeAssetDetail('Shares', event.shares, context.shareDecimals, context.shareSymbol))

      return {
        icon: '\u2191',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-700',
        title: 'Withdraw',
        summary: event.assets
          ? `-${formatUnits(event.assets, context.assetDecimals)}${context.assetSymbol ? ` ${context.assetSymbol}` : ''}`
          : '-0',
        summaryClassName: 'text-red-700',
        details,
        expandable: false
      }
    case 'transfer':
      pushDetail(details, makeAddressDetail('From', event.sender, context.chainId, context.strategyNamesByAddress))
      pushDetail(details, makeAddressDetail('To', event.receiver, context.chainId, context.strategyNamesByAddress))

      return {
        icon: '\u2194',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-700',
        title: 'Transfer',
        summary: event.value
          ? `${formatUnits(event.value, context.shareDecimals)}${context.shareSymbol ? ` ${context.shareSymbol}` : ''}`
          : '0',
        summaryClassName: 'text-gray-700',
        details,
        expandable: false
      }
    default:
      return {
        icon: '?',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-500',
        title: 'Unknown Event',
        details,
        expandable: false
      }
  }
}

function buildManagementEventDisplay(event: VaultActivityEvent, context: EventDisplayContext): EventDisplay {
  const details: EventDetail[] = []
  const actorDetail = makeAddressDetail('Actor', event.transactionFrom, context.chainId, context.strategyNamesByAddress)
  const strategySubject = formatAddressOrName(event.strategy, context.strategyNamesByAddress)

  switch (event.type) {
    case 'strategyChanged': {
      const decodedChange = getStrategyChangeDisplay(event.changeType)
      pushDetail(
        details,
        makeAddressDetail('Strategy', event.strategy, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(
        details,
        makeTextDetail('Change Type', event.changeType ? `${decodedChange.summary} (${event.changeType})` : undefined)
      )
      pushDetail(details, actorDetail)

      return {
        icon: decodedChange.summary === 'Revoked' ? '⚠' : '∆↑',
        iconBg: decodedChange.summary === 'Revoked' ? 'bg-red-100' : 'bg-blue-100',
        iconColor: decodedChange.summary === 'Revoked' ? 'text-red-700' : 'text-blue-700',
        title: decodedChange.title,
        subject: strategySubject,
        description: decodedChange.description,
        summary: decodedChange.summary,
        summaryClassName: decodedChange.summary === 'Revoked' ? 'text-red-700' : 'text-blue-700',
        details,
        expandable: true
      }
    }
    case 'debtUpdated': {
      const currentDebtValue = toBigInt(event.currentDebt) ?? 0n
      const newDebtValue = toBigInt(event.newDebt) ?? 0n
      const delta = newDebtValue - currentDebtValue
      const decodedDebtUpdate = decodeDebtUpdate(event.currentDebt, event.newDebt)

      pushDetail(
        details,
        makeAddressDetail('Strategy', event.strategy, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(
        details,
        makeAssetDetail('Previous Debt', event.currentDebt, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(details, makeAssetDetail('New Debt', event.newDebt, context.assetDecimals, context.assetSymbol, true))
      pushDetail(
        details,
        makeTextDetail('Delta', formatSignedAssetDelta(delta, context.assetDecimals, context.assetSymbol))
      )
      pushDetail(details, actorDetail)
      pushDetail(
        details,
        makeTextDetail(
          'Meaning',
          'DebtUpdated changes how much capital is allocated to a strategy. It does not by itself add or revoke the strategy.'
        )
      )

      return {
        icon: delta < 0n ? '∆↓' : delta > 0n ? '∆↑' : '∆',
        iconBg: delta < 0n ? 'bg-amber-100' : delta > 0n ? 'bg-green-100' : 'bg-slate-100',
        iconColor: delta < 0n ? 'text-amber-700' : delta > 0n ? 'text-green-700' : 'text-slate-700',
        title: decodedDebtUpdate.title,
        subject: strategySubject,
        description: decodedDebtUpdate.description,
        summary: formatSignedAssetDelta(delta, context.assetDecimals, context.assetSymbol),
        summaryClassName: delta < 0n ? 'text-[#7f1d1d]' : delta > 0n ? 'text-green-700' : 'text-slate-700',
        details,
        expandable: true
      }
    }
    case 'strategyReported': {
      const gainValue = toBigInt(event.gain) ?? 0n
      const lossValue = toBigInt(event.loss) ?? 0n
      const reportedNet = gainValue - lossValue

      pushDetail(
        details,
        makeAddressDetail('Strategy', event.strategy, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, makeAssetDetail('Gain', event.gain, context.assetDecimals, context.assetSymbol, true))
      pushDetail(details, makeAssetDetail('Loss', event.loss, context.assetDecimals, context.assetSymbol, true))
      pushDetail(
        details,
        makeAssetDetail('Current Debt', event.currentDebt, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(
        details,
        makeAssetDetail('Protocol Fees', event.protocolFees, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(
        details,
        makeAssetDetail('Total Fees', event.totalFees, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(
        details,
        makeAssetDetail('Refunds', event.totalRefunds, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(details, actorDetail)

      const description =
        gainValue > 0n && lossValue === 0n
          ? 'The strategy reported a gain to the vault.'
          : lossValue > 0n && gainValue === 0n
            ? 'The strategy reported a loss to the vault.'
            : gainValue > 0n && lossValue > 0n
              ? 'The strategy reported both gains and losses in the same update.'
              : 'The strategy reported to the vault with no material gain or loss in the indexed payload.'

      return {
        icon: '$',
        iconBg: reportedNet < 0n ? 'bg-red-100' : 'bg-blue-100',
        iconColor: reportedNet < 0n ? 'text-red-700' : 'text-blue-700',
        title: 'Strategy Reported',
        subject: strategySubject,
        description,
        summary: formatNetResult(event.gain, event.loss, context.assetDecimals, context.assetSymbol),
        summaryClassName: reportedNet < 0n ? 'text-red-700' : 'text-green-700',
        details,
        expandable: true
      }
    }
    case 'debtPurchased':
      pushDetail(
        details,
        makeAddressDetail('Strategy', event.strategy, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, makeAssetDetail('Amount', event.amount, context.assetDecimals, context.assetSymbol, true))
      pushDetail(details, actorDetail)
      pushDetail(
        details,
        makeTextDetail(
          'Meaning',
          'A debt purchaser bought debt associated with this strategy. This is typically used to handle bad debt.'
        )
      )

      return {
        icon: '\u24c5',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-700',
        title: 'Debt Purchased',
        subject: strategySubject,
        description: 'A designated debt purchaser bought debt associated with this strategy.',
        summary: event.amount
          ? `${formatUnits(event.amount, context.assetDecimals)}${context.assetSymbol ? ` ${context.assetSymbol}` : ''}`
          : undefined,
        summaryClassName: 'text-amber-700',
        details,
        expandable: true
      }
    case 'updatedMaxDebtForStrategy':
      pushDetail(
        details,
        makeAddressDetail('Strategy', event.strategy, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, makeAssetDetail('New Cap', event.newDebt, context.assetDecimals, context.assetSymbol, true))
      pushDetail(details, makeAddressDetail('Sender', event.sender, context.chainId, context.strategyNamesByAddress))
      pushDetail(details, actorDetail)
      pushDetail(
        details,
        makeTextDetail(
          'Meaning',
          'This changes the maximum debt cap the vault may allocate to the strategy. It does not change the current allocation by itself.'
        )
      )

      return {
        icon: '\u2191',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-700',
        title: 'Max Debt Cap Updated',
        subject: strategySubject,
        description:
          'The vault changed the maximum debt cap for this strategy. That changes the allocation ceiling, not the live allocation.',
        summary: event.newDebt
          ? `${formatUnits(event.newDebt, context.assetDecimals)}${context.assetSymbol ? ` ${context.assetSymbol}` : ''}`
          : undefined,
        summaryClassName: 'text-amber-700',
        details,
        expandable: true
      }
    case 'shutdown':
      pushDetail(details, actorDetail)

      return {
        icon: '!',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-700',
        title: 'Shutdown',
        description: 'The vault was shut down in an emergency context.',
        summary: 'Triggered',
        summaryClassName: 'text-red-700',
        details,
        expandable: true
      }
    case 'roleSet': {
      const decodedRoles = decodeRoles(event.role)
      pushDetail(details, makeAddressDetail('Account', event.account, context.chainId, context.strategyNamesByAddress))
      pushDetail(details, makeRawDetail('Role Mask', event.role))
      pushDetail(details, actorDetail)
      for (const roleName of decodedRoles) {
        pushDetail(details, makeTextDetail('Role', roleName))
      }

      return {
        icon: '\u2699',
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-700',
        title: 'Role Mask Updated',
        subject: event.account ? formatAddress(event.account) : undefined,
        description:
          decodedRoles.length > 0
            ? `The vault set this account's full permission mask to ${decodedRoles.length} role${decodedRoles.length === 1 ? '' : 's'}.`
            : 'The vault cleared all recorded roles for this account.',
        summary:
          decodedRoles.length === 0
            ? 'No roles'
            : decodedRoles.length === 1
              ? decodedRoles[0]
              : `${decodedRoles.length} roles`,
        summaryClassName: 'text-slate-700',
        details,
        expandable: true
      }
    }
    case 'updateAccountant':
      pushDetail(
        details,
        makeAddressDetail('Accountant', event.accountant, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2699',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Accountant Updated',
        subject: event.accountant ? formatAddressOrName(event.accountant, context.strategyNamesByAddress) : undefined,
        description: 'The vault updated the accountant contract that assesses protocol and strategy fees.',
        details,
        expandable: true
      }
    case 'updateAutoAllocate':
      pushDetail(details, actorDetail)
      pushDetail(
        details,
        makeTextDetail(
          'Auto Allocate',
          event.autoAllocate === undefined ? undefined : event.autoAllocate ? 'Enabled' : 'Disabled'
        )
      )

      return {
        icon: '\u25b6',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Auto Allocate Updated',
        description: 'This toggled whether the vault automatically allocates idle assets into strategies.',
        summary: event.autoAllocate === undefined ? undefined : event.autoAllocate ? 'Enabled' : 'Disabled',
        summaryClassName: event.autoAllocate ? 'text-green-700' : 'text-red-700',
        details,
        expandable: true
      }
    case 'updateDefaultQueue':
      pushDetail(details, actorDetail)
      for (const queueDetail of makeQueueDetails(
        event.newDefaultQueue,
        context.chainId,
        context.strategyNamesByAddress
      )) {
        details.push(queueDetail)
      }

      return {
        icon: '\u2630',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Default Queue Updated',
        description:
          'The vault changed the default withdrawal queue used when it needs to pull funds back from strategies.',
        summary: event.newDefaultQueue?.length ? `${event.newDefaultQueue.length} entries` : undefined,
        summaryClassName: 'text-blue-700',
        details,
        expandable: true
      }
    case 'updateDepositLimit':
      pushDetail(
        details,
        makeAssetDetail('Deposit Limit', event.depositLimit, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2191',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Deposit Limit Updated',
        description: 'The vault changed the maximum amount of assets that can be deposited.',
        summary: event.depositLimit
          ? `${formatUnits(event.depositLimit, context.assetDecimals)}${context.assetSymbol ? ` ${context.assetSymbol}` : ''}`
          : undefined,
        summaryClassName: 'text-blue-700',
        details,
        expandable: true
      }
    case 'updateDepositLimitModule':
      pushDetail(
        details,
        makeAddressDetail('Module', event.depositLimitModule, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2699',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Deposit Limit Module Updated',
        description: 'The vault changed the external module used to enforce deposit limits.',
        details,
        expandable: true
      }
    case 'updateFutureRoleManager':
      pushDetail(
        details,
        makeAddressDetail(
          'Future Role Manager',
          event.futureRoleManager,
          context.chainId,
          context.strategyNamesByAddress
        )
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2699',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Future Role Manager Updated',
        description: 'The vault nominated a new role manager address. That address still needs to accept the role.',
        details,
        expandable: true
      }
    case 'updateMinimumTotalIdle':
      pushDetail(
        details,
        makeAssetDetail('Minimum Idle', event.minimumTotalIdle, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u25cf',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Minimum Idle Updated',
        description:
          'The vault changed the minimum amount of idle assets it tries to keep on hand instead of allocating.',
        summary: event.minimumTotalIdle
          ? `${formatUnits(event.minimumTotalIdle, context.assetDecimals)}${context.assetSymbol ? ` ${context.assetSymbol}` : ''}`
          : undefined,
        summaryClassName: 'text-blue-700',
        details,
        expandable: true
      }
    case 'updateProfitMaxUnlockTime':
      pushDetail(details, makeTextDetail('Unlock Time', formatDurationSeconds(event.profitMaxUnlockTime)))
      pushDetail(details, actorDetail)

      return {
        icon: '\u23f1',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Profit Unlock Time Updated',
        description: 'The vault changed how long profit remains locked before it fully unlocks.',
        summary: formatDurationSeconds(event.profitMaxUnlockTime),
        summaryClassName: 'text-blue-700',
        details,
        expandable: true
      }
    case 'updateRoleManager':
      pushDetail(
        details,
        makeAddressDetail('Role Manager', event.roleManager, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2699',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Role Manager Accepted',
        description: 'The nominated role manager accepted control and became the active role manager.',
        details,
        expandable: true
      }
    case 'updateUseDefaultQueue':
      pushDetail(
        details,
        makeTextDetail(
          'Use Default Queue',
          event.useDefaultQueue === undefined ? undefined : event.useDefaultQueue ? 'Enabled' : 'Disabled'
        )
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2630',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Use Default Queue Updated',
        description:
          'This toggled whether the vault uses its default withdrawal queue when sourcing assets for withdrawals.',
        summary: event.useDefaultQueue === undefined ? undefined : event.useDefaultQueue ? 'Enabled' : 'Disabled',
        summaryClassName: event.useDefaultQueue ? 'text-green-700' : 'text-red-700',
        details,
        expandable: true
      }
    case 'updateWithdrawLimitModule':
      pushDetail(
        details,
        makeAddressDetail('Module', event.withdrawLimitModule, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2699',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'Withdraw Limit Module Updated',
        description: 'The vault changed the external module used to enforce withdraw limits.',
        details,
        expandable: true
      }
    case 'v2EmergencyShutdown':
      pushDetail(
        details,
        makeTextDetail(
          'Emergency Shutdown',
          event.active === undefined ? undefined : event.active ? 'Enabled' : 'Disabled'
        )
      )
      pushDetail(details, actorDetail)

      return {
        icon: '!',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-700',
        title: 'V2 Emergency Shutdown',
        description: 'The V2 vault emergency shutdown flag changed.',
        summary: event.active === undefined ? undefined : event.active ? 'Enabled' : 'Disabled',
        summaryClassName: event.active ? 'text-red-700' : 'text-gray-700',
        details,
        expandable: true
      }
    case 'v2StrategyAdded':
      pushDetail(
        details,
        makeAddressDetail('Strategy', event.strategy, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, makePercentDetail('Debt Ratio', event.debtRatio))
      pushDetail(
        details,
        makeAssetDetail('Min Debt / Harvest', event.minDebtPerHarvest, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(
        details,
        makeAssetDetail('Max Debt / Harvest', event.maxDebtPerHarvest, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(details, makePercentDetail('Performance Fee', event.performanceFee))
      pushDetail(details, actorDetail)

      return {
        icon: '∆↑',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-700',
        title: 'V2 Strategy Added',
        subject: strategySubject,
        description:
          'The V2 vault added this strategy to its active strategy set. This event sets parameters, but does not itself fund the strategy.',
        summary: formatBpsAsPercent(event.debtRatio),
        summaryClassName: 'text-green-700',
        details,
        expandable: true
      }
    case 'v2StrategyReported': {
      const netResult = formatNetResult(event.gain, event.loss, context.assetDecimals, context.assetSymbol)
      const gainValue = toBigInt(event.gain) ?? 0n
      const lossValue = toBigInt(event.loss) ?? 0n

      pushDetail(
        details,
        makeAddressDetail('Strategy', event.strategy, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, makePercentDetail('Debt Ratio', event.debtRatio))
      pushDetail(details, makeAssetDetail('Gain', event.gain, context.assetDecimals, context.assetSymbol, true))
      pushDetail(details, makeAssetDetail('Loss', event.loss, context.assetDecimals, context.assetSymbol, true))
      pushDetail(
        details,
        makeAssetDetail('Debt Added', event.debtAdded, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(
        details,
        makeAssetDetail('Debt Paid', event.debtPaid, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(
        details,
        makeAssetDetail('Total Debt', event.totalDebt, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(
        details,
        makeAssetDetail('Total Gain', event.totalGain, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(
        details,
        makeAssetDetail('Total Loss', event.totalLoss, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '$',
        iconBg: gainValue >= lossValue ? 'bg-green-100' : 'bg-red-100',
        iconColor: gainValue >= lossValue ? 'text-green-700' : 'text-red-700',
        title: 'V2 Strategy Reported',
        subject: strategySubject,
        description:
          gainValue > lossValue
            ? 'The V2 strategy reported a net gain.'
            : lossValue > gainValue
              ? 'The V2 strategy reported a net loss.'
              : 'The V2 strategy reported with flat net performance in the indexed payload.',
        summary: netResult,
        summaryClassName: gainValue >= lossValue ? 'text-green-700' : 'text-red-700',
        details,
        expandable: true
      }
    }
    case 'v2StrategyRevoked':
      pushDetail(
        details,
        makeAddressDetail('Strategy', event.strategy, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '⚠',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-700',
        title: 'V2 Strategy Revoked',
        subject: strategySubject,
        description: 'The V2 vault removed this strategy from its active strategy set.',
        summary: 'Revoked',
        summaryClassName: 'text-red-700',
        details,
        expandable: true
      }
    case 'v2UpdateDepositLimit':
      pushDetail(
        details,
        makeAssetDetail('Deposit Limit', event.depositLimit, context.assetDecimals, context.assetSymbol, true)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2191',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'V2 Deposit Limit Updated',
        description: 'The V2 vault changed the maximum amount of assets that can be deposited.',
        summary: event.depositLimit
          ? `${formatUnits(event.depositLimit, context.assetDecimals)}${context.assetSymbol ? ` ${context.assetSymbol}` : ''}`
          : undefined,
        summaryClassName: 'text-blue-700',
        details,
        expandable: true
      }
    case 'v2UpdateGovernance':
      pushDetail(
        details,
        makeAddressDetail('Governance', event.governance, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2699',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'V2 Governance Updated',
        description: 'The V2 vault changed its governance address.',
        details,
        expandable: true
      }
    case 'v2UpdateGuardian':
      pushDetail(
        details,
        makeAddressDetail('Guardian', event.guardian, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2699',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'V2 Guardian Updated',
        description: 'The V2 vault changed its guardian address.',
        details,
        expandable: true
      }
    case 'v2UpdateManagement':
      pushDetail(
        details,
        makeAddressDetail('Management', event.management, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, actorDetail)

      return {
        icon: '\u2699',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'V2 Management Updated',
        description: 'The V2 vault changed its management address.',
        details,
        expandable: true
      }
    case 'v2UpdateManagementFee':
      pushDetail(details, makePercentDetail('Management Fee', event.managementFee))
      pushDetail(details, actorDetail)

      return {
        icon: '\u0025',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'V2 Management Fee Updated',
        description: 'The V2 vault changed its management fee.',
        summary: formatBpsAsPercent(event.managementFee),
        summaryClassName: 'text-blue-700',
        details,
        expandable: true
      }
    case 'v2UpdatePerformanceFee':
      pushDetail(details, makePercentDetail('Performance Fee', event.performanceFee))
      pushDetail(details, actorDetail)

      return {
        icon: '\u0025',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-700',
        title: 'V2 Performance Fee Updated',
        description: 'The V2 vault changed its performance fee.',
        summary: formatBpsAsPercent(event.performanceFee),
        summaryClassName: 'text-blue-700',
        details,
        expandable: true
      }
    case 'timelockEvent':
      pushDetail(details, makeAddressDetail('Target', event.target, context.chainId, context.strategyNamesByAddress))
      pushDetail(
        details,
        makeAddressDetail('Timelock', event.timelockAddress, context.chainId, context.strategyNamesByAddress)
      )
      pushDetail(details, makeAddressDetail('Creator', event.creator, context.chainId, context.strategyNamesByAddress))
      pushDetail(details, makeTextDetail('Timelock Type', event.timelockType))
      pushDetail(details, makeTextDetail('Delay', formatDurationSeconds(event.delay)))
      pushDetail(details, makeRawDetail('Votes For', event.votesFor))
      pushDetail(details, makeRawDetail('Votes Against', event.votesAgainst))
      pushDetail(details, makeRawDetail('Value', event.timelockValue))
      pushDetail(details, makeTextDetail('Operation', truncateValue(event.operationId ?? '')))
      pushDetail(details, makeTextDetail('Metadata', truncateValue(event.metadata ?? '')))
      pushDetail(details, makeTextDetail('Signature', truncateValue(event.signature ?? '')))

      return {
        icon: '\u23f3',
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-700',
        title: event.eventName || 'Timelock Event',
        subject: event.target ? formatAddressOrName(event.target, context.strategyNamesByAddress) : undefined,
        description:
          'This is a timelock or governance event involving either the vault address itself or the timelock contract attached to it.',
        summary: event.timelockType,
        summaryClassName: 'text-violet-700',
        details,
        expandable: true
      }
    default:
      return {
        icon: '?',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-500',
        title: 'Unknown Management Event',
        details,
        expandable: true
      }
  }
}

function buildEventDisplay(event: VaultActivityEvent, context: EventDisplayContext): EventDisplay {
  if (isUserEventType(event.type)) {
    return buildUserEventDisplay(event, context)
  }

  return buildManagementEventDisplay(event, context)
}

export const VaultEventRow: React.FC<VaultEventRowProps> = React.memo(
  ({
    event,
    assetSymbol = '',
    assetDecimals = 18,
    shareSymbol = '',
    shareDecimals = 18,
    strategyNamesByAddress = {},
    reason,
    nested = false
  }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const chainId = event.chainId
    const txUrl = event.transactionHash ? getExplorerTxUrl(event.transactionHash, chainId) : null
    const isUserEvent = isUserEventType(event.type)

    const display = useMemo(
      () =>
        buildEventDisplay(event, {
          chainId,
          assetSymbol,
          assetDecimals,
          shareSymbol,
          shareDecimals,
          strategyNamesByAddress
        }),
      [event, chainId, assetSymbol, assetDecimals, shareSymbol, shareDecimals, strategyNamesByAddress]
    )

    const relativeTime = formatRelativeTime(event.blockTimestamp)
    const isExpandable = display.expandable && display.details.length > 0

    const handleToggle = (target: EventTarget | null) => {
      if (!isExpandable) {
        return
      }

      if (target instanceof HTMLElement && target.closest('a, button, [data-no-row-toggle]')) {
        return
      }

      setIsExpanded((expanded) => !expanded)
    }

    return (
      <div className={cn(!nested && 'border-b border-border last:border-b-0')}>
        <div
          role={isExpandable ? 'button' : undefined}
          tabIndex={isExpandable ? 0 : undefined}
          aria-expanded={isExpandable ? isExpanded : undefined}
          aria-label={isExpandable ? (isExpanded ? 'Collapse details' : 'Expand details') : undefined}
          className={cn(
            'grid grid-cols-1 items-start gap-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4',
            nested ? 'px-0 py-2 hover:bg-transparent' : 'px-4 py-3 hover:bg-gray-50',
            isExpandable && 'cursor-pointer'
          )}
          onClick={(event) => handleToggle(event.target)}
          onKeyDown={(event) => {
            if (!isExpandable) {
              return
            }

            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleToggle(event.target)
            }
          }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                isUserEvent ? display.iconBg : 'border border-border bg-white'
              }`}
            >
              <span className={`${isUserEvent ? display.iconColor : 'text-[#4f4f4f]'} text-sm`}>{display.icon}</span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    'text-sm font-medium text-black',
                    isTimelockControllerText(display.title) && 'text-primary'
                  )}
                >
                  {display.title}
                </span>
                {display.subject ? <span className="text-sm text-[#4f4f4f]">{display.subject}</span> : null}
                {relativeTime ? <span className="text-xs text-[#808080]">{relativeTime}</span> : null}
              </div>

              {display.description || reason ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {reason ? (
                    <span className="inline-flex items-center rounded-full border border-border bg-white px-2 py-1 text-[11px] font-medium text-[#4f4f4f]">
                      {reason.label}
                    </span>
                  ) : null}
                  {display.description ? (
                    <span className="text-xs leading-relaxed text-[#4f4f4f]">{display.description}</span>
                  ) : null}
                </div>
              ) : null}

              {!display.expandable && display.details.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {display.details.map((detail) =>
                    detail.href ? (
                      <a
                        key={`${event.id}-${detail.label}-${detail.value}`}
                        href={detail.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-[11px] text-[#4f4f4f] hover:text-[#0657f9]"
                      >
                        <span className="text-[#808080]">{detail.label}</span>
                        <span>{detail.value}</span>
                      </a>
                    ) : (
                      <span
                        key={`${event.id}-${detail.label}-${detail.value}`}
                        className="inline-flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-[11px] text-[#4f4f4f]"
                      >
                        <span className="text-[#808080]">{detail.label}</span>
                        <span>{detail.value}</span>
                      </span>
                    )
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-3 self-start">
            {display.summary || txUrl ? (
              <div className="text-right">
                {display.summary ? (
                  <div
                    className={cn(
                      'font-numeric text-sm text-foreground',
                      display.summaryClassName,
                      isTimelockControllerText(display.summary) && 'text-primary'
                    )}
                  >
                    {display.summary}
                  </div>
                ) : null}
                {txUrl ? (
                  <a
                    data-no-row-toggle
                    href={txUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-[11px] text-[#0657f9] hover:underline"
                  >
                    tx link
                  </a>
                ) : null}
              </div>
            ) : null}

            {isExpandable ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
              )
            ) : null}
          </div>
        </div>

        {isExpandable && isExpanded ? (
          <div className="border-t border-border bg-muted/20">
            <div className={nested ? 'pl-11 pb-2' : 'pl-20 pb-4'}>
              <div className="divide-y divide-border">
                {display.details.map((detail) =>
                  detail.href ? (
                    <a
                      key={`${event.id}-expanded-${detail.label}-${detail.value}`}
                      href={detail.href}
                      target="_blank"
                      rel="noreferrer"
                      className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-x-4 py-2 text-[11px] text-[#4f4f4f] hover:text-[#0657f9]"
                    >
                      <span className="shrink-0 text-[#808080]">{detail.label}</span>
                      <span className={cn('min-w-0', isTimelockControllerText(detail.value) && 'text-primary')}>
                        {detail.value}
                      </span>
                    </a>
                  ) : (
                    <div
                      key={`${event.id}-expanded-${detail.label}-${detail.value}`}
                      className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-x-4 py-2 text-[11px] text-[#4f4f4f]"
                    >
                      <span className="shrink-0 text-[#808080]">{detail.label}</span>
                      <span className={cn('min-w-0', isTimelockControllerText(detail.value) && 'text-primary')}>
                        {detail.value}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }
)
