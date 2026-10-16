import { Link } from '@tanstack/react-router'
import { useContext, useEffect, useId, useMemo } from 'react'
import { CHAIN_NAMES, fmt, powergloveVaultPath, SkeletonCards, shortAddr, useFetch } from './hooks'
import { StatsContext } from './StatsContext'
import type {
  CurationProductFamily,
  CurationProductFamilySummary,
  CurationProductsSummary,
  CurationProductVault
} from './types'

const FAMILY_LABELS: Record<CurationProductFamily, string> = {
  v3_allocator: 'V3 allocators',
  morpho_curated: 'Morpho curated'
}

const FAMILY_SCOPE: Record<CurationProductFamily, string> = {
  v3_allocator: 'Allocates capital across Yearn strategies',
  morpho_curated: 'Allocates capital across Morpho markets'
}

function CurationVaultName({ vault }: { vault: CurationProductVault }) {
  const label = vault.name || shortAddr(vault.address)

  if (vault.family === 'v3_allocator') {
    return (
      <Link className="curation-vault-link" to={powergloveVaultPath(vault.chainId, vault.address)}>
        {label}
      </Link>
    )
  }

  return <span>{label}</span>
}

function FamilyRow({ family, summary }: { family: CurationProductFamily; summary: CurationProductFamilySummary }) {
  return (
    <div className="curation-family-row">
      <div>
        <div className="curation-family-name">{FAMILY_LABELS[family]}</div>
        <div className="sub">{FAMILY_SCOPE[family]}</div>
      </div>
      <div>
        <span className="curation-mobile-label">Gross</span>
        {fmt(summary.grossTvlUsd)}
      </div>
      <div>
        <span className="curation-mobile-label">Known nesting</span>
        {fmt(summary.knownInternalOverlapTvlUsd)}
      </div>
      <div className="curation-family-net">
        <span className="curation-mobile-label">Net TVL</span>
        {fmt(summary.netTvlUsd)}
      </div>
      <div>
        <span className="curation-mobile-label">Products</span>
        {summary.vaultCount.toLocaleString()}
      </div>
    </div>
  )
}

export function CurationProductsPanel() {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext)
  const idPrefix = useId().replace(/:/g, '')
  const titleId = `${idPrefix}-curation-products`
  const familyTitleId = `${idPrefix}-curation-families`
  const v2TitleId = `${idPrefix}-curation-v2`
  const productsTableTitleId = `${idPrefix}-curation-products-table`
  const requestUrl =
    chainFilter === 'all' ? '/api/tvl/curation-products' : `/api/tvl/curation-products?chainId=${chainFilter}`
  const { data, loading, error, fetchedAt, retry } = useFetch<CurationProductsSummary>(requestUrl)

  useEffect(() => {
    if (fetchedAt) setLastFetchedAt(fetchedAt)
  }, [fetchedAt, setLastFetchedAt])

  const familyRows = useMemo(
    () =>
      data
        ? (Object.entries(data.byFamily) as Array<[CurationProductFamily, CurationProductFamilySummary]>).filter(
            ([, summary]) => summary.vaultCount > 0
          )
        : [],
    [data]
  )

  if (loading) return <SkeletonCards count={1} />
  if (error) {
    return (
      <div className="error-retry">
        <div className="error-message">Error loading curation product TVL: {error}</div>
        <button className="page-btn" onClick={retry}>
          Retry
        </button>
      </div>
    )
  }
  if (!data) return null

  const hasProducts = data.vaultCount > 0
  const asOf = data.asOf
    ? new Date(data.asOf).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'Unavailable'

  return (
    <>
      <section className="curation-ledger" aria-labelledby={titleId}>
        <div className="curation-ledger-heading">
          <div>
            <div className="label">Curation product TVL</div>
            <h2 id={titleId}>{data.definition.headline}</h2>
          </div>
          <div className="curation-as-of">
            <span>Method v{data.methodologyVersion}</span>
            <span>Snapshot {asOf}</span>
          </div>
        </div>

        {hasProducts ? (
          <div className="curation-equation" aria-label="Curation product TVL accounting">
            <div className="curation-total">
              <span className="label">Net TVL</span>
              <strong>{fmt(data.totalTvlUsd)}</strong>
              <span>{data.vaultCount} active products</span>
            </div>
            <div className="curation-equation-term">
              <span>Gross product TVL</span>
              <strong>{fmt(data.grossTvlUsd)}</strong>
            </div>
            <div className="curation-equation-operator" aria-hidden="true">
              minus
            </div>
            <div className="curation-equation-term">
              <span>Known internal nesting</span>
              <strong>{fmt(data.knownInternalOverlapTvlUsd)}</strong>
            </div>
          </div>
        ) : (
          <div className="curation-empty">No included curation products have positive TVL on this chain.</div>
        )}
      </section>

      {hasProducts ? (
        <>
          <section className="curation-family-ledger" aria-labelledby={familyTitleId}>
            <div className="curation-section-heading">
              <div>
                <h2 id={familyTitleId}>Included product families</h2>
                <div className="sub">
                  The metric is based on allocation authority, not vault contract generation alone.
                </div>
              </div>
            </div>
            <div className="curation-family-header" aria-hidden="true">
              <span>Family</span>
              <span>Gross</span>
              <span>Known nesting</span>
              <span>Net TVL</span>
              <span>Products</span>
            </div>
            {familyRows.map(([family, summary]) => (
              <FamilyRow key={family} family={family} summary={summary} />
            ))}
          </section>

          <section className="curation-v2-counterfactual" aria-labelledby={v2TitleId}>
            <div>
              <div className="label">Potential extension</div>
              <h2 id={v2TitleId}>V2 allocator-style vaults</h2>
              <p>{data.potentialV2.note}</p>
            </div>
            <dl>
              <div>
                <dt>Incremental TVL</dt>
                <dd>{fmt(data.potentialV2.incrementalTvlUsd)}</dd>
              </div>
              <div>
                <dt>Gross V2 TVL</dt>
                <dd>{fmt(data.potentialV2.grossTvlUsd)}</dd>
              </div>
              <div>
                <dt>Known pass-through</dt>
                <dd>{fmt(data.potentialV2.knownPassThroughTvlUsd)}</dd>
              </div>
              <div>
                <dt>Vaults</dt>
                <dd>{data.potentialV2.vaultCount.toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <section className="card" aria-labelledby={productsTableTitleId}>
            <div className="curation-section-heading">
              <div>
                <h2 id={productsTableTitleId}>Included products</h2>
                <div className="sub">Net TVL assigns known nested capital to its upstream included product.</div>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Chain</th>
                    <th>Family</th>
                    <th className="text-right">Gross TVL</th>
                    <th className="text-right">Known nesting</th>
                    <th className="text-right">Net TVL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vaults.map((vault) => (
                    <tr key={`${vault.chainId}:${vault.address}`}>
                      <td>
                        <CurationVaultName vault={vault} />
                        <div className="curation-vault-address">{shortAddr(vault.address)}</div>
                      </td>
                      <td>{CHAIN_NAMES[vault.chainId] || `Chain ${vault.chainId}`}</td>
                      <td>{FAMILY_LABELS[vault.family]}</td>
                      <td className="text-right">{fmt(vault.grossTvlUsd)}</td>
                      <td className="text-right">{fmt(vault.knownInternalOverlapTvlUsd)}</td>
                      <td className="text-right curation-table-net">{fmt(vault.netTvlUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <details className="curation-methodology">
        <summary>Methodology and limits</summary>
        <div className="curation-methodology-grid">
          <div>
            <h3>Included</h3>
            <ul>
              {data.definition.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Excluded</h3>
            <ul>
              {data.definition.excludes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Accounting</h3>
            <p>{data.definition.accounting}</p>
            <ul>
              {data.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </>
  )
}
