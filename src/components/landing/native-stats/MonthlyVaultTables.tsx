import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { type ReactNode, useContext, useId, useMemo, useState } from 'react'
import { DialogTrigger } from '@/components/ui/dialog'
import { useIsMobile } from '@/components/ui/use-mobile'
import { assertCanonicalFeeResponse } from '@/lib/fee-api-contract'
import { fetchKongVaultListRaw } from '@/lib/kong-vault-client'
import type { CanonicalVaultFee } from './canonical-fees'
import type { ChainFeeMetric } from './chain-fee-history'
import { FeeMetricToggle } from './FeeMetricToggle'
import { CHAIN_NAMES, powergloveVaultPath, resolveStatsApiBase, shortAddr, usePagination } from './hooks'
import { buildMonthlyVaultRows, completedFeeMonths, monthlyUsd, monthlyVaultKey } from './monthly-vault-data'
import { StatsTableColumnSelector } from './StatsChartOptions'
import { StatsContext } from './StatsContext'
import { StatsTableSkeleton } from './StatsLoadingSkeletons'
import { StatsTableModal } from './StatsTableModal'
import { StatsTableSearch } from './StatsTableSearch'
import { fetchVaultTypeFeeHistories } from './useVaultTypeFeeHistories'

const monthLabel = (period: string) =>
  new Date(`${period}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function MonthlyVaultTables({
  chainSelector,
  datasetId,
  onRetryDataset
}: {
  chainSelector: ReactNode
  datasetId: string | undefined
  onRetryDataset: () => void
}) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [metric, setMetric] = useState<ChainFeeMetric>('earnings')
  return (
    <MonthlyVaultTable
      datasetId={datasetId}
      onRetryDataset={onRetryDataset}
      metric={metric}
      metricControl={<FeeMetricToggle value={metric} onValueChange={setMetric} label="Monthly vault" />}
      chainSelector={chainSelector}
      typeFilter={typeFilter}
      onTypeChange={setTypeFilter}
    />
  )
}

function MonthlyVaultTable({
  datasetId,
  onRetryDataset,
  metric,
  metricControl,
  chainSelector,
  typeFilter,
  onTypeChange
}: {
  datasetId: string | undefined
  onRetryDataset: () => void
  metric: 'fees' | 'earnings'
  metricControl: ReactNode
  chainSelector?: ReactNode
  typeFilter: string
  onTypeChange?: (value: string) => void
}) {
  const { chainFilter } = useContext(StatsContext)
  const mobile = useIsMobile()
  const [mobileColumn, setMobileColumn] = useState('total')
  const [viewAll, setViewAll] = useState(false)
  const titleId = useId()
  const [months] = useState(() => completedFeeMonths(Math.floor(Date.now() / 1000)))
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ column: 'total' | number; descending: boolean }>({
    column: 'total',
    descending: true
  })
  const base = resolveStatsApiBase('fees') ?? ''
  const client = useQueryClient()
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
  const { start, end, setPage, pagination } = usePagination(rows.length, 10)
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
  const visibleMonths = months
    .map((month, index) => ({ ...month, index }))
    .filter((month) => !mobile || mobileColumn === String(month.index))
  const showTotal = !mobile || mobileColumn === 'total'
  const loading = !!datasetId && fees.isPending
  const selectedTitle = `${mobileColumn === 'total' ? 'Annual' : monthLabel(months[Number(mobileColumn)].period)} ${metric === 'earnings' ? 'Earnings' : 'Fees'} by Vault`
  const summaryRows = useMemo(
    () =>
      mobile
        ? (fees.data?.[metric] ?? [])
            .filter((row) => chainFilter === 'all' || String(row.vault.chainId) === chainFilter)
            .map((row) => ({ row, value: mobileColumn === 'total' ? row.total : row.months[Number(mobileColumn)] }))
            .sort((a, b) => (a.value === null ? (b.value === null ? 0 : 1) : b.value === null ? -1 : b.value - a.value))
            .slice(0, 5)
            .map(({ row }) => row)
        : [],
    [mobile, fees.data, metric, chainFilter, mobileColumn]
  )
  const renderTable = (compact: boolean) => (
    <section
      className={`monthly-vault-fees${compact ? ' stats-compact-table' : ''}`}
      aria-labelledby={`${titleId}-${compact ? 'summary' : 'full'}`}
      aria-busy={loading}
    >
      {mobile && !compact && (
        <h2 id={`${titleId}-full`} className="sr-only">
          {selectedTitle}
        </h2>
      )}
      <div className="monthly-fee-toolbar stats-monthly-toolbar">
        {(!mobile || compact) && (
          <div>
            <div className="fee-chart-title-row">
              <h2 id={`${titleId}-${compact ? 'summary' : 'full'}`}>
                {mobile ? selectedTitle : <>Monthly Vault {metric === 'earnings' ? 'Earnings' : 'Fees'}</>}
              </h2>
              {metricControl}
            </div>
            {!compact && (
              <p className="text-dim">
                {monthLabel(months[0].period)} – {monthLabel(months[11].period)} ·{' '}
                {metric === 'fees' ? 'Fees charged' : 'Gains minus losses'} (USD) · Completed months only
              </p>
            )}
          </div>
        )}
        {!compact && (
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
                {Array.from(new Set((fees.data?.[metric] ?? []).map((row) => row.vaultType)))
                  .sort()
                  .map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
              </select>
            )}
            <StatsTableSearch
              mobile={mobile}
              label={`Search vault ${metric}`}
              value={search}
              onChange={(value) => {
                setSearch(value)
                setPage(0)
              }}
            />
          </div>
        )}
      </div>
      <div className="stats-table-column-row">
        {mobile && !compact && metricControl}
        <StatsTableColumnSelector
          label="Monthly vault data column"
          value={mobileColumn}
          onChange={(value) => {
            setMobileColumn(value)
            setSort({ column: value === 'total' ? 'total' : Number(value), descending: true })
            setPage(0)
          }}
          columns={[
            { value: 'total', label: 'Annual total' },
            ...months.map((month, index) => ({ value: String(index), label: monthLabel(month.period) }))
          ]}
        />
      </div>
      {fees.isError || !datasetId ? (
        <div className="error-retry">
          <p>Monthly vault {metric} could not be loaded.</p>
          <button
            type="button"
            className="page-btn"
            onClick={() => {
              onRetryDataset()
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
          <StatsTableSkeleton monthly bodyOnly compact={compact} />
          <div
            aria-hidden="true"
            className={`monthly-fee-footer stats-skeleton-pagination stats-monthly-footer${compact ? ' hidden' : ''}`}
          >
            <div className="skeleton skeleton-line" style={{ width: '12rem' }} />
            <div className="skeleton" style={{ width: '12rem', height: 32 }} />
          </div>
        </>
      ) : (
        <>
          <section
            className={`monthly-fee-table-scroll${compact ? ' stats-compact-table-body' : ''}`}
            tabIndex={compact ? undefined : 0}
            aria-label={`Monthly vault ${metric} table`}
          >
            <table className="monthly-fee-table stats-mobile-two-column-table">
              <caption className="sr-only">
                Vault {metric} for the last 12 completed months in USD. Unavailable amounts are shown as a dash.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Vault</th>
                  {showTotal && (
                    <th
                      scope="col"
                      aria-sort={
                        compact
                          ? 'descending'
                          : sort.column === 'total'
                            ? sort.descending
                              ? 'descending'
                              : 'ascending'
                            : 'none'
                      }
                    >
                      {compact ? 'annual total' : sortButton('total', 'annual total')}
                    </th>
                  )}
                  {visibleMonths.map(({ period, index }) => (
                    <th
                      key={period}
                      scope="col"
                      aria-sort={
                        compact
                          ? 'descending'
                          : sort.column === index
                            ? sort.descending
                              ? 'descending'
                              : 'ascending'
                            : 'none'
                      }
                    >
                      {compact ? monthLabel(period) : sortButton(index, monthLabel(period))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!compact && (
                  <tr className="monthly-fee-total">
                    <th scope="row">
                      {search.trim() || chainFilter !== 'all' || typeFilter !== 'all'
                        ? 'Filtered vaults'
                        : 'All vaults'}
                    </th>
                    {showTotal && <td>{monthlyUsd(annualTotal)}</td>}
                    {visibleMonths.map(({ period, index }) => (
                      <td key={period}>{monthlyUsd(totals[index])}</td>
                    ))}
                  </tr>
                )}
                {(compact ? summaryRows : rows.slice(start, end)).map((row) => (
                  <tr key={monthlyVaultKey(row.vault)}>
                    <th scope="row">
                      <Link to={powergloveVaultPath(row.vault.chainId, row.vault.address)} title={row.vault.address}>
                        {row.vault.name ?? shortAddr(row.vault.address)}
                      </Link>
                      {!mobile && (
                        <span className="monthly-fee-address">
                          {shortAddr(row.vault.address)} ·{' '}
                          {CHAIN_NAMES[row.vault.chainId] ?? `Chain ${row.vault.chainId}`} · {row.vaultType}
                        </span>
                      )}
                    </th>
                    {showTotal && <td>{monthlyUsd(row.total)}</td>}
                    {visibleMonths.map(({ period, index }) => (
                      <td key={period}>{monthlyUsd(row.months[index])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!(compact ? summaryRows : rows).length && (
              <p className="monthly-fee-empty text-dim">No vaults match these filters.</p>
            )}
          </section>
          <div className="monthly-fee-footer">
            {compact ? (
              <DialogTrigger asChild>
                <button type="button" className="page-btn stats-view-all">
                  View all
                </button>
              </DialogTrigger>
            ) : (
              <>
                {(!mobile || !pagination) && (
                  <span className="text-dim">
                    {rows.length.toLocaleString()} vaults{!mobile && ' · Rounded to the nearest dollar'}
                  </span>
                )}
                {pagination}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )

  return mobile ? (
    <StatsTableModal title={selectedTitle} open={viewAll} onOpenChange={setViewAll} summary={renderTable(true)}>
      {renderTable(false)}
    </StatsTableModal>
  ) : (
    renderTable(false)
  )
}
