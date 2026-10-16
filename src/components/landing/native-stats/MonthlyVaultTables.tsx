import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { type ReactNode, useContext, useId, useMemo, useState } from 'react'
import { assertCanonicalFeeResponse } from '@/lib/fee-api-contract'
import { fetchKongVaultListRaw } from '@/lib/kong-vault-client'
import type { CanonicalFeeSummary, CanonicalVaultFee } from './canonical-fees'
import { CHAIN_NAMES, powergloveVaultPath, resolveStatsApiBase, shortAddr, useFetch, usePagination } from './hooks'
import { buildMonthlyVaultRows, completedFeeMonths, monthlyUsd, monthlyVaultKey } from './monthly-vault-data'
import { StatsContext } from './StatsContext'
import { fetchVaultTypeFeeHistories } from './useVaultTypeFeeHistories'

const monthLabel = (period: string) =>
  new Date(`${period}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function MonthlyVaultTables({ chainSelector }: { chainSelector: ReactNode }) {
  const [typeFilter, setTypeFilter] = useState('all')
  return (
    <>
      <MonthlyVaultTable
        metric="earnings"
        chainSelector={chainSelector}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
      />
      <MonthlyVaultTable
        metric="fees"
        chainSelector={chainSelector}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
      />
    </>
  )
}

function MonthlyVaultTable({
  metric,
  chainSelector,
  typeFilter,
  onTypeChange
}: {
  metric: 'fees' | 'earnings'
  chainSelector?: ReactNode
  typeFilter: string
  onTypeChange?: (value: string) => void
}) {
  const { chainFilter } = useContext(StatsContext)
  const titleId = useId()
  const [months] = useState(() => completedFeeMonths(Math.floor(Date.now() / 1000)))
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ column: 'total' | number; descending: boolean }>({
    column: 'total',
    descending: true
  })
  const base = resolveStatsApiBase('fees') ?? ''
  const client = useQueryClient()
  const summary = useFetch<CanonicalFeeSummary>('/api/fees')
  const datasetId = summary.data?.datasetId
  const fees = useQuery({
    queryKey: ['monthly-vault-data', base, datasetId, months[0].period, 'product'],
    enabled: !!datasetId,
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }) => {
      const filters = new URLSearchParams({ datasetId: datasetId ?? '', scope: 'product' })
      const catalogResponse = await fetch(`${base}/api/fees/vaults?${filters}`, { signal })
      if (!catalogResponse.ok) throw new Error('Vault catalog could not be loaded')
      const catalog: { datasetId: string; vaults: CanonicalVaultFee[] } = await catalogResponse.json()
      assertCanonicalFeeResponse(catalog, 'product')
      if (catalog.datasetId !== datasetId || !Array.isArray(catalog.vaults))
        throw new Error('Vault catalog does not match the selected publication')
      const metadata = await client.fetchQuery({
        queryKey: ['fee-vault-type-catalog'],
        queryFn: fetchKongVaultListRaw,
        staleTime: 15 * 60 * 1000,
        retry: false
      })
      if (!metadata.length) throw new Error('Vault metadata is unavailable')
      const histories = await fetchVaultTypeFeeHistories(base, filters.toString(), months, signal)
      return {
        fees: buildMonthlyVaultRows(catalog.vaults, histories, metadata),
        earnings: buildMonthlyVaultRows(catalog.vaults, histories, metadata, 'earnings')
      }
    }
  })
  const rows = useMemo(() => {
    const text = search.trim().toLowerCase()
    const value = (row: NonNullable<typeof fees.data>[typeof metric][number]) =>
      typeof sort.column === 'number' ? row.months[sort.column] : row.total
    return (fees.data?.[metric] ?? [])
      .filter(
        (row) =>
          (typeFilter === 'all' || row.vaultType === typeFilter) &&
          (chainFilter === 'all' || String(row.vault.chainId) === chainFilter) &&
          `${row.vault.name ?? ''} ${row.vault.address} ${CHAIN_NAMES[row.vault.chainId] ?? row.vault.chainId}`
            .toLowerCase()
            .includes(text)
      )
      .sort((a, b) => {
        const av = value(a),
          bv = value(b)
        if (av === null && bv !== null) return 1
        if (bv === null && av !== null) return -1
        return (
          ((av ?? 0) - (bv ?? 0)) * (sort.descending ? -1 : 1) ||
          monthlyVaultKey(a.vault).localeCompare(monthlyVaultKey(b.vault))
        )
      })
  }, [fees.data, metric, chainFilter, typeFilter, search, sort])
  const totals = months.map((_, index) => {
    const values = rows.map((row) => row.months[index]).filter((value) => value !== null)
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null
  })
  const annualTotal = totals.some((value) => value === null)
    ? null
    : totals.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const { start, end, setPage, Pagination } = usePagination(rows.length, 10)
  const filtersKey = `${chainFilter}:${typeFilter}`
  const [paginationFiltersKey, setPaginationFiltersKey] = useState(filtersKey)
  if (paginationFiltersKey !== filtersKey) {
    setPaginationFiltersKey(filtersKey)
    setPage(0)
  }
  const sortButton = (column: 'total' | number, label: string) => (
    <button
      type="button"
      className="monthly-fee-sort"
      aria-label={`Sort by ${label}`}
      onClick={() => {
        setSort({ column, descending: column === sort.column ? !sort.descending : true })
        setPage(0)
      }}
    >
      {label}
      {sort.column === column &&
        (sort.descending ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />)}
    </button>
  )
  const loading = summary.loading || (!!datasetId && fees.isPending)
  return (
    <section className="monthly-vault-fees" aria-labelledby={titleId} aria-busy={loading}>
      <div className="monthly-fee-toolbar">
        <div>
          <h2 id={titleId}>Monthly vault {metric}</h2>
          <p className="text-dim">
            {monthLabel(months[0].period)} – {monthLabel(months[11].period)} ·{' '}
            {metric === 'fees' ? 'Fees charged' : 'Gains minus losses'} (USD) · Completed months only
          </p>
        </div>
        <div className="monthly-fee-filters">
          {chainSelector}
          {onTypeChange && (
            <select
              className="filter-select"
              aria-label="Vault type"
              value={typeFilter}
              onChange={(event) => onTypeChange(event.target.value)}
            >
              <option value="all">All vault types</option>
              {['Allocator', 'Strategy', 'Factory', 'Legacy'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          )}
          <input
            className="search-input"
            aria-label={`Search vault ${metric}`}
            placeholder="Search vaults or addresses…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
          />
        </div>
      </div>
      {summary.error || fees.isError || (!summary.loading && !datasetId) ? (
        <div className="error-retry">
          <p>Monthly vault {metric} could not be loaded.</p>
          <button
            type="button"
            className="page-btn"
            onClick={() => {
              summary.retry()
              if (datasetId) void fees.refetch()
            }}
          >
            Retry monthly {metric}
          </button>
        </div>
      ) : loading ? (
        <>
          <output className="sr-only" aria-live="polite">
            Loading monthly {metric} for all vaults…
          </output>
          <div className="monthly-fee-table-scroll" aria-hidden="true">
            <table className="monthly-fee-table monthly-fee-skeleton">
              <thead>
                <tr>
                  <th>Vault</th>
                  <th>annual total</th>
                  {months.map((month) => (
                    <th key={month.period}>{monthLabel(month.period)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }, (_, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Placeholder rows are static and never reordered.
                  <tr key={`loading-${index}`}>
                    <th>
                      <div className="skeleton skeleton-line" />
                      <div className="skeleton skeleton-line-sm" />
                    </th>
                    {['total', ...months.map((month) => month.period)].map((column) => (
                      <td key={column}>
                        <div className="skeleton skeleton-line" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the monthly columns. */}
          <section className="monthly-fee-table-scroll" tabIndex={0} aria-label={`Monthly vault ${metric} table`}>
            <table className="monthly-fee-table">
              <caption className="sr-only">
                Vault {metric} for the last 12 completed months in USD. Unavailable amounts are shown as a dash.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Vault</th>
                  <th
                    scope="col"
                    aria-sort={sort.column === 'total' ? (sort.descending ? 'descending' : 'ascending') : 'none'}
                  >
                    {sortButton('total', 'annual total')}
                  </th>
                  {months.map((month, index) => (
                    <th
                      key={month.period}
                      scope="col"
                      aria-sort={sort.column === index ? (sort.descending ? 'descending' : 'ascending') : 'none'}
                    >
                      {sortButton(index, monthLabel(month.period))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="monthly-fee-total">
                  <th scope="row">
                    {search.trim() || chainFilter !== 'all' || typeFilter !== 'all' ? 'Filtered vaults' : 'All vaults'}
                  </th>
                  <td>{monthlyUsd(annualTotal)}</td>
                  {totals.map((value, index) => (
                    <td key={months[index].period}>{monthlyUsd(value)}</td>
                  ))}
                </tr>
                {rows.slice(start, end).map((row) => (
                  <tr key={monthlyVaultKey(row.vault)}>
                    <th scope="row">
                      <Link to={powergloveVaultPath(row.vault.chainId, row.vault.address)} title={row.vault.address}>
                        {row.vault.name ?? shortAddr(row.vault.address)}
                      </Link>
                      <span className="monthly-fee-address">
                        {shortAddr(row.vault.address)} ·{' '}
                        {CHAIN_NAMES[row.vault.chainId] ?? `Chain ${row.vault.chainId}`} · {row.vaultType}
                      </span>
                    </th>
                    <td>{monthlyUsd(row.total)}</td>
                    {row.months.map((value, index) => (
                      <td key={months[index].period}>{monthlyUsd(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="monthly-fee-empty text-dim">No vaults match these filters.</p>}
          </section>
          <div className="monthly-fee-footer">
            <span className="text-dim">{rows.length.toLocaleString()} vaults · Rounded to the nearest dollar</span>
            {Pagination && <Pagination />}
          </div>
        </>
      )}
    </section>
  )
}
