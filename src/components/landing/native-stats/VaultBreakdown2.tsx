import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useContext, useMemo, useState } from 'react'
import { CHAIN_NAMES, fmt, powergloveVaultPath, SkeletonChart, shortAddr, useFetch, usePagination } from './hooks'
import { StatsContext } from './StatsContext'
import {
  buildVaultOriginRows,
  type OriginAudit,
  type OriginFlow,
  type OriginGraph,
  type VaultOriginRow
} from './vault-origin'

const columns = [
  {
    key: 'listed',
    title: 'Listed TVL',
    description: 'Reported total assets, including idle funds and assets allocated to strategies.'
  },
  {
    key: 'fromYearn',
    title: 'From Yearn vaults',
    description: 'Known published capital supplied by other Yearn V1, V2, or V3 vaults, directly or through routers.'
  },
  {
    key: 'nonYearn',
    title: 'Non-Yearn-originated TVL',
    description: 'Listed TVL minus known incoming Yearn deposits. Outgoing allocations are not subtracted again.'
  },
  {
    key: 'toYearn',
    title: 'To Yearn vaults',
    description:
      'Known published allocations into other Yearn vaults. This is a separate view of outgoing flow, not an additional deduction.'
  },
  {
    key: 'yearnShare',
    title: 'Yearn-originated %',
    description: 'Known incoming Yearn deposits divided by Listed TVL.'
  }
] as const
const exactUsd = (value: number | null) =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function FlowList({
  flows,
  rows,
  direction
}: {
  flows: OriginFlow[]
  rows: Map<string, VaultOriginRow>
  direction: 'incoming' | 'outgoing'
}) {
  return (
    <div>
      <h3>{direction === 'incoming' ? 'From Yearn vaults' : 'To Yearn vaults'}</h3>
      {!flows.length ? (
        <p className="text-dim">No known published flows.</p>
      ) : (
        <ul className="vault-origin-flows">
          {flows.map((flow) => (
            <li key={`${flow.vaultIds.join(',')}:${flow.via}`}>
              <div>
                {flow.vaultIds.map((id) => {
                  const row = rows.get(id)
                  return row ? (
                    <Link key={id} to={powergloveVaultPath(row.vault.chainId, row.vault.address)}>
                      {row.vault.name ?? shortAddr(row.vault.address)} ·{' '}
                      {CHAIN_NAMES[row.vault.chainId] ?? row.vault.chainId}
                    </Link>
                  ) : (
                    <span key={id}>{id}</span>
                  )
                })}
                {flow.via && (
                  <span className="text-dim" title={flow.via}>
                    via {shortAddr(flow.via)}
                  </span>
                )}
                {flow.amount === null && <span className="text-dim">Per-vault flow valuation unavailable</span>}
              </div>
              <span title={exactUsd(flow.amount)}>{fmt(flow.amount, 2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function VaultBreakdown2() {
  const { chainFilter } = useContext(StatsContext)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [sort, setSort] = useState<{ key: (typeof columns)[number]['key']; descending: boolean }>({
    key: 'listed',
    descending: true
  })
  // Load all chains before filtering rows so cross-chain upstream context is preserved.
  const audit = useFetch<OriginAudit>('/api/audit/tree')
  const datasetId = audit.data?.datasetId
  const graph = useFetch<OriginGraph>(
    `/api/tvl/graph?includeRetired=true&datasetId=${encodeURIComponent(datasetId ?? '')}`,
    { enabled: !!datasetId }
  )
  const matched = !!datasetId && graph.data?.datasetId === datasetId
  const allRows = useMemo(
    () => (audit.data && graph.data && matched ? buildVaultOriginRows(audit.data, graph.data) : []),
    [audit.data, graph.data, matched]
  )
  const byId = useMemo(() => new Map(allRows.map((row) => [row.id, row])), [allRows])
  const query = search.trim().toLowerCase()
  const rows = allRows
    .filter(
      ({ vault }) =>
        (chainFilter === 'all' || String(vault.chainId) === chainFilter) &&
        (category === 'all' || vault.category === category) &&
        `${vault.name ?? ''} ${vault.address} ${CHAIN_NAMES[vault.chainId] ?? vault.chainId}`
          .toLowerCase()
          .includes(query)
    )
    .sort((a, b) => {
      const left = a[sort.key],
        right = b[sort.key]
      if (left === null) return right === null ? 0 : 1
      if (right === null) return -1
      return (left - right) * (sort.descending ? -1 : 1)
    })
  const { start, end, setPage, pagination } = usePagination(rows.length, 25)
  const loading = audit.loading || (!!datasetId && graph.loading)
  const error =
    audit.error ||
    graph.error ||
    (audit.data && !datasetId ? 'The vault publication identifier is unavailable.' : null) ||
    (!loading && audit.data && graph.data && !matched ? 'Vault breakdown publications do not match.' : null)
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section aria-label="Vault Breakdown 2 data" aria-busy={loading} className="vault-origin-panel">
      <p className="text-dim">
        Non-Yearn-originated TVL = Listed TVL − From Yearn vaults. Outgoing allocations are shown separately and are not
        subtracted again.
      </p>
      {error ? (
        <div className="error-retry" role="alert">
          <p>Vault origins could not be loaded. {error}</p>
          <button
            type="button"
            className="page-btn"
            onClick={() => {
              audit.retry()
              graph.retry()
            }}
          >
            Retry vault origins
          </button>
        </div>
      ) : loading ? (
        <SkeletonChart />
      ) : matched ? (
        <>
          <p className="text-dim">
            Snapshot:{' '}
            {new Date(graph.data!.asOfTimestamp * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC'
            })}{' '}
            (UTC).{' '}
            {graph.data?.diagnostics?.status !== 'complete'
              ? 'Coverage is incomplete; amounts reflect known published positions. '
              : ''}
            — means unavailable. Curation products are a separate layer.
          </p>
          <div className="filter-bar">
            <input
              className="search-input"
              aria-label="Search vault origins"
              placeholder="Search name, address, or chain…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
            />
            <select
              className="filter-select"
              aria-label="Vault origin type"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(0)
              }}
            >
              <option value="all">All vault types</option>
              <option value="v3">V3</option>
              <option value="v2">V2</option>
              <option value="v1">V1</option>
            </select>
            <span className="text-dim">{rows.length} vaults · Expand a row to see flows</span>
          </div>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: The horizontally scrollable table needs keyboard access. */}
          <section className="monthly-fee-table-scroll" tabIndex={0} aria-label="Vault origins table">
            <table className="monthly-fee-table vault-origin-table">
              <thead>
                <tr>
                  <th scope="col">Vault</th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={sort.key === column.key ? (sort.descending ? 'descending' : 'ascending') : 'none'}
                    >
                      <button
                        className="monthly-fee-sort"
                        type="button"
                        title={column.description}
                        onClick={() => {
                          setSort({ key: column.key, descending: sort.key === column.key ? !sort.descending : true })
                          setPage(0)
                        }}
                      >
                        {column.title}
                        {sort.key === column.key ? (sort.descending ? ' ↓' : ' ↑') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(start, end).map((row) => (
                  <Fragment key={row.id}>
                    <tr>
                      <th scope="row">
                        <div className="vault-origin-name">
                          <button
                            type="button"
                            aria-label={`Show flows for ${row.vault.name ?? row.vault.address} ${shortAddr(row.vault.address)}`}
                            aria-expanded={expanded.has(row.id)}
                            onClick={() => toggle(row.id)}
                          >
                            {expanded.has(row.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <Link
                            to={powergloveVaultPath(row.vault.chainId, row.vault.address)}
                            title={row.vault.address}
                          >
                            {row.vault.name ?? shortAddr(row.vault.address)}
                          </Link>
                        </div>
                        <span className="monthly-fee-address">
                          {shortAddr(row.vault.address)} · {CHAIN_NAMES[row.vault.chainId] ?? row.vault.chainId} ·{' '}
                          {row.vault.category.toUpperCase()}
                          {row.vault.isRetired ? ' · Retired' : ''}
                        </span>
                      </th>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          title={column.key === 'yearnShare' ? undefined : exactUsd(row[column.key])}
                        >
                          {column.key === 'yearnShare'
                            ? row.yearnShare === null
                              ? '—'
                              : `${(row.yearnShare * 100).toFixed(1)}%`
                            : fmt(row[column.key], 2)}
                        </td>
                      ))}
                    </tr>
                    {expanded.has(row.id) && (
                      <tr className="vault-origin-detail-row">
                        <td colSpan={6}>
                          <div className="vault-origin-detail">
                            <FlowList flows={row.incoming} rows={byId} direction="incoming" />
                            <FlowList flows={row.outgoing} rows={byId} direction="outgoing" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="monthly-fee-empty text-dim">No vaults match these filters.</p>}
          </section>
          {pagination}
        </>
      ) : null}
    </section>
  )
}
