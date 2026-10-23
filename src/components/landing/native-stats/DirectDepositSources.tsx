import { monthlyUsd } from './monthly-vault-data'
import { RegisteredDepositCard } from './RegisteredDepositCard'
import type { DirectDepositSourceState } from './useDirectDepositSources'

export function DirectDepositSources({
  sources,
  direct
}: {
  sources: DirectDepositSourceState
  direct: number | null
}) {
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
          .filter((group) => group.id !== 'treasury')
          .map((group) => (
            <RegisteredDepositCard key={group.id} group={group} />
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
            Unresolved amounts remain unavailable.
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
