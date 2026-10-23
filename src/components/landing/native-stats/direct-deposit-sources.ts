import { isAddress } from 'viem'
import {
  DIRECT_DEPOSIT_REGISTRY,
  type DirectDepositGroup,
  type RegisteredDepositor
} from '@/constants/direct-deposit-registry'
import type { DepositBalances } from '@/lib/direct-deposit-balances'
import type { DirectDepositFeeRow } from './direct-deposit-fees'
import type { OriginGraph, OriginVault } from './vault-origin'
import { originVaultId } from './vault-origin'

export function registeredDepositTargets(
  row: DirectDepositFeeRow,
  registry: readonly DirectDepositGroup[] = DIRECT_DEPOSIT_REGISTRY
) {
  const roots = [
    ...new Map(row.roots.map((root) => [originVaultId(root.vault.chainId, root.vault.address), root.vault])).values()
  ]
  return roots
    .filter((vault) => isAddress(vault.address, { strict: false }))
    .map((vault) => ({
      ...vault,
      id: originVaultId(vault.chainId, vault.address),
      groups: registry.flatMap((group) => {
        const depositors = group.depositors.filter(
          (depositor) =>
            depositor.chainId === vault.chainId &&
            (!depositor.vaultAddress || depositor.vaultAddress.toLowerCase() === vault.address.toLowerCase())
        )
        return depositors.length ? [{ ...group, depositors }] : []
      })
    }))
    .filter((target) => target.groups.length > 0)
}

export interface DepositSourcePosition {
  depositor: RegisteredDepositor
  vault: DirectDepositFeeRow['vault']
  amount: number | null
}
export interface DepositSourceGroup {
  id: string
  label: string
  amount: number | null
  positions: DepositSourcePosition[]
}

export function treasuryExclusions(row: DirectDepositFeeRow, groups: DepositSourceGroup[]) {
  const positions = groups.find((group) => group.id === 'treasury')?.positions ?? []
  return new Map(
    [...new Map(row.roots.map((root) => [originVaultId(root.vault.chainId, root.vault.address), root])).keys()].map(
      (id) =>
        [
          id,
          sumKnown(
            positions
              .filter((position) => originVaultId(position.vault.chainId, position.vault.address) === id)
              .map((position) => position.amount)
          )
        ] as const
    )
  )
}

const sumKnown = (values: (number | null)[]) =>
  values.every((value) => value !== null) ? values.reduce<number>((sum, value) => sum + value!, 0) : null

export function depositShareValue(shares: bigint | null, supply: bigint | null, tvl: number | null | undefined) {
  if (shares === null || shares < 0n) return null
  if (shares === 0n) return 0
  if (supply === null || supply <= 0n || shares > supply || typeof tvl !== 'number' || !Number.isFinite(tvl) || tvl < 0)
    return null
  const amount = (Number(shares) / Number(supply)) * tvl
  return Number.isFinite(amount) ? amount : null
}

/** Partition, rather than add to, published direct capital. Product roots come only from the API. */
export function directDepositSources(
  targets: ReturnType<typeof registeredDepositTargets>,
  vaults: Map<string, OriginVault>,
  graph: OriginGraph | null,
  balances: ReadonlyMap<string, DepositBalances>,
  direct: number | null
) {
  const groups = new Map<string, DepositSourceGroup>()
  for (const target of targets) {
    const read = balances.get(target.id)
    for (const group of target.groups) {
      const entry = groups.get(group.id) ?? { id: group.id, label: group.label, amount: null, positions: [] }
      for (const depositor of group.depositors) {
        const shares =
          read?.holders.find((holder) => holder.address.toLowerCase() === depositor.address.toLowerCase())?.shares ??
          null
        const gross = depositShareValue(shares, read?.totalSupply ?? null, vaults.get(target.id)?.tvlUsd)
        const excluded =
          graph?.edges
            .filter(
              (edge) =>
                edge.targetNodeId === target.id && edge.holderAddress.toLowerCase() === depositor.address.toLowerCase()
            )
            .reduce((sum, edge) => sum + (edge.deductedTvlUsd ?? 0), 0) ?? 0
        const bridgeExcluded =
          group.id === 'treasury' && graph?.bridgeExclusions?.some((bridge) => bridge.sourceNodeId === target.id)
        const amount = bridgeExcluded
          ? 0
          : gross !== null && excluded <= gross + 0.01
            ? Math.max(0, gross - excluded)
            : null
        entry.positions.push({ depositor, vault: target, amount })
      }
      groups.set(group.id, entry)
    }
  }
  for (const group of groups.values()) group.amount = sumKnown(group.positions.map((position) => position.amount))
  const knownTotal = [...groups.values()]
    .flatMap((group) => group.positions)
    .reduce((sum, position) => sum + (position.amount ?? 0), 0)
  const conflict = direct !== null && knownTotal > direct + 0.01
  if (conflict)
    for (const group of groups.values()) {
      group.amount = null
      for (const position of group.positions) position.amount = null
    }
  const total = sumKnown([...groups.values()].map((group) => group.amount))
  return {
    groups: [...groups.values()],
    other: direct !== null && total !== null && !conflict ? Math.max(0, direct - total) : null,
    conflict
  }
}
