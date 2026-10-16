import { Link } from '@tanstack/react-router'
import { CHAIN_NAMES, fmt, powergloveVaultPath, useFetch } from './hooks'

interface ScopeDifference {
  chainId: number
  vaultAddress: string
  name?: string | null
  oursUsd: number | null
  defillamaUsd: number | null
  reason: string
}
interface OverlapCheck {
  parentChainId: number
  parentAddress: string
  parentName: string | null
  childChainId: number
  childAddress: string
  childName: string | null
  strategyAddress: string
  ourDeductionUsd: number
  reason: string
}
interface CategoryDetails {
  protocol: string
  oursOnly: ScopeDifference[]
  theirsOnly: ScopeDifference[]
  missedOverlaps: OverlapCheck[]
  handledOverlaps: OverlapCheck[]
  unresolvedVaults: ScopeDifference[]
  unverifiedOverlaps: OverlapCheck[]
}
interface MembershipComparison {
  publicationId: string
  reconciliation?: {
    state: string
    reason?: string
    asOfTimestamp: number
    categories: CategoryDetails[]
    sources: { sha: string }
    coverage: { finance: string; curation: string }
  }
}

function valueLabel(value: number | null): string {
  if (value !== null && value > 0 && value < 0.01) return '<$0.01'
  if (value !== null && value > 0 && value < 1) return `$${value.toFixed(2)}`
  return fmt(value)
}

function VaultName({ chain, address, name }: { chain: number; address: string; name?: string | null }) {
  return (
    <>
      <Link to={powergloveVaultPath(chain, address)}>{name || 'Unnamed vault'}</Link>
      <div className="text-dim" title={address} style={{ fontSize: '0.7rem' }}>
        {CHAIN_NAMES[chain] || chain} · {address.slice(0, 8)}…{address.slice(-6)}
      </div>
    </>
  )
}

function ScopeTable({ rows, label }: { rows: ScopeDifference[]; label: string }) {
  return (
    <div className="table-scroll">
      <table aria-label={label} style={{ minWidth: 650 }}>
        <thead>
          <tr>
            <th>Vault</th>
            <th className="text-right">Our net TVL</th>
            <th className="text-right">DefiLlama replay</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((vault) => (
            <tr key={`${vault.chainId}:${vault.vaultAddress}`}>
              <td>
                <VaultName chain={vault.chainId} address={vault.vaultAddress} name={vault.name} />
              </td>
              <td className="text-right">{vault.oursUsd === null ? 'Unpriced' : valueLabel(vault.oursUsd)}</td>
              <td className="text-right">
                {vault.defillamaUsd === 0 ? 'Outside scope' : valueLabel(vault.defillamaUsd)}
              </td>
              <td>{vault.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OverlapTable({ rows, label }: { rows: OverlapCheck[]; label: string }) {
  return (
    <div className="table-scroll">
      <table aria-label={label} style={{ minWidth: 850 }}>
        <thead>
          <tr>
            <th>Investing vault</th>
            <th>Underlying vault</th>
            <th className="text-right">Our deduction</th>
            <th>Adapter treatment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((overlap) => (
            <tr
              key={`${overlap.parentChainId}:${overlap.parentAddress}:${overlap.strategyAddress}:${overlap.childAddress}`}
            >
              <td>
                <VaultName chain={overlap.parentChainId} address={overlap.parentAddress} name={overlap.parentName} />
              </td>
              <td>
                <VaultName chain={overlap.childChainId} address={overlap.childAddress} name={overlap.childName} />
              </td>
              <td className="text-right">{valueLabel(overlap.ourDeductionUsd)}</td>
              <td>{overlap.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CategoryDiscrepancies({
  category,
  protocol,
  publicationId
}: {
  category: string
  protocol: string
  publicationId?: string
}) {
  const { data, loading, error, retry } = useFetch<MembershipComparison>(
    `/api/comparison/defillama-comparable?publicationId=${encodeURIComponent(publicationId ?? '')}`,
    { enabled: Boolean(publicationId) }
  )
  if (!publicationId) return <p>Vault comparison is unavailable for this saved comparison.</p>
  if (loading) return <output>Loading vault discrepancies…</output>
  if (error)
    return (
      <div role="alert">
        <p>Could not load vault discrepancies.</p>
        <button className="page-btn" onClick={retry}>
          Retry vault comparison
        </button>
      </div>
    )
  if (!data) return null
  if (data.publicationId !== publicationId) return <p>Vault evidence does not match this saved comparison.</p>
  const report = data.reconciliation
  const details = report?.categories?.find((item) => item.protocol === protocol)
  if (!report || report.state === 'unavailable' || !details)
    return <p>Bidirectional vault evidence is not available for this saved comparison.</p>
  return (
    <section
      aria-label={`${category} vault discrepancies`}
      style={{ padding: '1rem', whiteSpace: 'normal', maxWidth: 'calc(100vw - 8rem)' }}
    >
      <h3>We count; DefiLlama excludes ({details.oursOnly.length})</h3>
      {details.oursOnly.length ? (
        <ScopeTable rows={details.oursOnly} label={`${category}: only in ours`} />
      ) : (
        <p>No confirmed exclusions in the checked scope.</p>
      )}
      <h3 style={{ marginTop: '1.5rem' }}>
        DefiLlama counts; missing from our valued TVL ({details.theirsOnly.length})
      </h3>
      {details.theirsOnly.length ? (
        <ScopeTable rows={details.theirsOnly} label={`${category}: only in DefiLlama`} />
      ) : (
        <p>No confirmed valued contributions missing from ours in the checked scope.</p>
      )}
      <h3 style={{ marginTop: '1.5rem' }}>Overlaps their adapter does not deduct ({details.missedOverlaps.length})</h3>
      {details.missedOverlaps.length ? (
        <OverlapTable rows={details.missedOverlaps} label={`${category}: missed overlaps`} />
      ) : (
        <p>No missed overlap deductions verified in this category.</p>
      )}
    </section>
  )
}
