import { ExternalLink } from 'lucide-react'
import { CHAIN_ID_TO_BLOCK_EXPLORER, isSupportedChainId } from '@/constants/chains'
import type { DirectDepositFeeRow } from './direct-deposit-fees'
import { FeeFlowCard } from './FeeFlowCard'
import { CHAIN_NAMES, shortAddr } from './hooks'
import { monthlyUsd } from './monthly-vault-data'
import { useDirectDepositSources } from './useDirectDepositSources'
import type { OriginGraph, OriginVault } from './vault-origin'

export function DirectDepositSources({
  row,
  vaults,
  graph,
  datasetId,
  direct
}: {
  row: DirectDepositFeeRow
  vaults: Map<string, OriginVault>
  graph: OriginGraph | null
  datasetId?: string
  direct: number | null
}) {
  const sources = useDirectDepositSources(row, vaults, graph, datasetId, direct)
  if (!sources.groups.length)
    return (
      <article className="fee-flow-card" data-flow-id="direct" data-flow-next="selected">
        <span>Direct (non-Yearn) deposits</span>
        <strong className="fee-flow-card-value">{monthlyUsd(direct)}</strong>
      </article>
    )
  return (
    <>
      <div className="fee-flow-branches">
        {sources.groups
          .filter((group) => group.id !== 'treasury' || group.amount !== 0)
          .map((group) => (
            <FeeFlowCard
              key={group.id}
              flowId={`direct-${group.id}`}
              next="selected"
              label={group.label}
              name={group.label}
              amount={group.amount}
              amountLabel="Included direct deposits"
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
          ))}
        <article className="fee-flow-card fee-flow-direct-other" data-flow-id="direct-other" data-flow-next="selected">
          <span>Other direct deposits</span>
          <strong className="fee-flow-card-value">{monthlyUsd(sources.other)}</strong>
        </article>
      </div>
      {sources.loading && <output className="fee-flow-address">Loading depositor balances at the TVL snapshot…</output>}
      {sources.unavailable && (
        <output className="fee-flow-source-status">
          <span className="fee-flow-address">
            {sources.conflict
              ? 'Depositor balances could not be reconciled with direct deposits.'
              : 'Some depositor balances are unavailable for this snapshot.'}{' '}
            The total below is unchanged.
          </span>
          {sources.canRetry && (
            <button type="button" className="page-btn" onClick={sources.retry}>
              Retry depositor balances
            </button>
          )}
        </output>
      )}
      <div className="fee-flow-total">
        <span>Total direct deposits</span>
        <strong>{monthlyUsd(direct)}</strong>
      </div>
    </>
  )
}
