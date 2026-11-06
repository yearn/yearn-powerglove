import { ExternalLink } from 'lucide-react'
import { CHAIN_ID_TO_BLOCK_EXPLORER, isSupportedChainId } from '@/constants/chains'
import type { DepositSourceGroup } from './direct-deposit-sources'
import { FeeFlowCard } from './FeeFlowCard'
import { CHAIN_NAMES, shortAddr } from './hooks'
import { monthlyUsd } from './monthly-vault-data'

export function RegisteredDepositCard({ group, excluded = false }: { group: DepositSourceGroup; excluded?: boolean }) {
  return (
    <FeeFlowCard
      flowId={`direct-${group.id}`}
      next="selected"
      label={group.label}
      name={group.label}
      amount={group.amount}
      amountLabel={excluded ? 'Excluded treasury capital' : 'Included direct deposits'}
      muted={excluded}
      navigable={new Set()}
    >
      {group.positions
        .filter((position) => group.id !== 'treasury' || position.amount !== 0)
        .map(({ depositor, vault, amount }) => {
          const explorer = isSupportedChainId(depositor.chainId)
            ? CHAIN_ID_TO_BLOCK_EXPLORER[depositor.chainId].replace(/\/$/, '')
            : null
          return (
            <div className="fee-flow-depositor" key={`${vault.chainId}:${vault.address}:${depositor.id}`}>
              <div className="fee-flow-depositor-value">
                {explorer ? (
                  <a
                    href={`${explorer}/address/${depositor.address}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {depositor.label}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : (
                  <span>{depositor.label}</span>
                )}
                <strong>{monthlyUsd(amount)}</strong>
              </div>
              <span className="fee-flow-address">
                {CHAIN_NAMES[vault.chainId] ?? vault.chainId} · {shortAddr(depositor.address)} ·{' '}
                {vault.name ?? shortAddr(vault.address)}
              </span>
            </div>
          )
        })}
    </FeeFlowCard>
  )
}
