import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { Fragment, type ReactNode, useContext, useMemo, useState } from 'react'
import { fetchKongVaultListRaw } from '@/lib/kong-vault-client'
import type { CanonicalVaultFee } from './canonical-fees'
import {
  directDepositFeeRows,
  externalTvlByVault,
  type FeeAnalysisTvlGraph,
  feeStackLayers
} from './direct-deposit-fees'
import { bpsPct, CHAIN_NAMES, powergloveVaultPath, shortAddr, useFetch, usePagination, useSort } from './hooks'
import { monthlyUsd, monthlyVaultType } from './monthly-vault-data'
import { StatsContext } from './StatsContext'
import type { FeeStackSummary } from './types'

export function EffectiveFeesTable({
  feeStack,
  vaults,
  chainSelector
}: {
  feeStack: FeeStackSummary
  vaults: CanonicalVaultFee[]
  chainSelector: ReactNode
}) {
  const { chainFilter } = useContext(StatsContext)
  const tvlDatasetId = feeStack?.meta?.tvlDatasetId
  const {
    data: feeGraph,
    error: feeGraphError,
    retry: retryFeeGraph
  } = useFetch<FeeAnalysisTvlGraph>(
    `/api/tvl/graph?includeRetired=true&datasetId=${encodeURIComponent(tvlDatasetId ?? '')}`,
    { enabled: !!tvlDatasetId }
  )
  const adjustedTvl = useMemo(() => externalTvlByVault(feeGraph, tvlDatasetId), [feeGraph, tvlDatasetId])
  const [expandedFees, setExpandedFees] = useState<Set<string>>(() => new Set())
  const stackSort = useSort('effective')
  const { sorted: sortStacks } = stackSort
  const [stackSearch, setStackSearch] = useState('')
  const [stackTypeFilter, setStackTypeFilter] = useState('all')
  const { data: vaultMetadata } = useQuery({
    queryKey: ['fee-vault-type-catalog'],
    queryFn: fetchKongVaultListRaw,
    staleTime: 15 * 60 * 1000,
    retry: false
  })
  const metadataByVault = useMemo(
    () => new Map((vaultMetadata ?? []).map((vault) => [`${vault.chainId}:${vault.address.toLowerCase()}`, vault])),
    [vaultMetadata]
  )
  const sortedStacks = useMemo(
    () =>
      sortStacks(
        directDepositFeeRows(feeStack?.chains ?? [])
          .map((row) => ({
            ...row,
            vaultType: monthlyVaultType({
              ...vaults.find(
                (vault) =>
                  vault.chainId === row.vault.chainId && vault.address.toLowerCase() === row.vault.address.toLowerCase()
              ),
              ...metadataByVault.get(`${row.vault.chainId}:${row.vault.address.toLowerCase()}`),
              ...row.vault
            })
          }))
          .filter(
            (row) =>
              (chainFilter === 'all' || String(row.vault.chainId) === chainFilter) &&
              (stackTypeFilter === 'all' || row.vaultType === stackTypeFilter) &&
              `${row.vault.name ?? ''} ${row.vault.address}`.toLowerCase().includes(stackSearch.trim().toLowerCase())
          ),
        {
          name: (row) => row.vault.name || '',
          effective: (row) => row.performanceFee ?? -1,
          management: (row) => row.managementFee ?? -1,
          tvl: (row) => adjustedTvl.get(`${row.vault.chainId}:${row.vault.address.toLowerCase()}`) ?? -1
        }
      ),
    [feeStack, chainFilter, stackSearch, stackTypeFilter, sortStacks, adjustedTvl, metadataByVault, vaults]
  )
  const stackPagination = usePagination(sortedStacks.length, 10)
  const pagedStacks = sortedStacks.slice(stackPagination.start, stackPagination.end)

  return (
    <section className="monthly-vault-fees" aria-label="Effective Fees">
      <div className="monthly-fee-toolbar">
        <div>
          <h2>Effective Fees</h2>
          <p className="text-dim">
            Effective fees for a direct deposit, including underlying allocations. Latest published configuration and
            allocation snapshot.
          </p>
        </div>
        <div className="monthly-fee-filters">
          {chainSelector}
          <select
            className="filter-select"
            aria-label="Effective fees vault type"
            value={stackTypeFilter}
            onChange={(event) => {
              setStackTypeFilter(event.target.value)
              stackPagination.setPage(0)
            }}
          >
            <option value="all">All vault types</option>
            {['Allocator', 'Strategy', 'Factory', 'Legacy'].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            className="search-input"
            aria-label="Search effective fees"
            placeholder="Search vaults or addresses…"
            value={stackSearch}
            onChange={(event) => {
              setStackSearch(event.target.value)
              stackPagination.setPage(0)
            }}
          />
        </div>
      </div>
      {feeGraphError && (
        <div className="error-retry">
          <button type="button" className="page-btn" onClick={retryFeeGraph}>
            Retry adjusted TVL
          </button>
        </div>
      )}
      <div className="monthly-fee-table-scroll">
        <table className="monthly-fee-table">
          <caption className="sr-only">Current effective fees for direct vault deposits</caption>
          <thead>
            <tr>
              <th {...stackSort.th('name', 'Vault')} />
              <th
                {...stackSort.th('tvl', 'Adjusted TVL', 'text-right')}
                title="External TVL after upstream vault ownership is deducted, matching TVL Flow."
              />
              <th {...stackSort.th('effective', 'Effective performance fee', 'text-right')} />
              <th {...stackSort.th('management', 'Annual management fee', 'text-right')} />
            </tr>
          </thead>
          <tbody>
            {pagedStacks.map((row) => {
              const key = `${row.vault.chainId}:${row.vault.address.toLowerCase()}`
              const isOpen = expandedFees.has(key)
              const toggleExpanded = () =>
                setExpandedFees((previous) => {
                  const next = new Set(previous)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              return (
                <Fragment key={key}>
                  <tr
                    className={`fee-stack-row${isOpen ? ' is-expanded' : ''}`}
                    onClick={(event) => {
                      if (!(event.target as HTMLElement).closest('a, button')) toggleExpanded()
                    }}
                  >
                    <th scope="row">
                      <div className="fee-stack-vault">
                        <button
                          type="button"
                          className="monthly-fee-sort"
                          aria-label={`Fee breakdown for ${row.vault.name || row.vault.address}`}
                          aria-expanded={isOpen}
                          onClick={toggleExpanded}
                        >
                          <ChevronDown className="chain-stat-chevron" size={15} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                        <Link to={powergloveVaultPath(row.vault.chainId, row.vault.address)}>
                          {row.vault.name || shortAddr(row.vault.address)}
                        </Link>
                      </div>
                      <span className="monthly-fee-address">
                        {shortAddr(row.vault.address)} · {CHAIN_NAMES[row.vault.chainId] ?? row.vault.chainId} ·{' '}
                        {row.vaultType}
                      </span>
                    </th>
                    <td>{monthlyUsd(adjustedTvl.get(key) ?? null)}</td>
                    <td>{bpsPct(row.performanceFee)}</td>
                    <td>{bpsPct(row.managementFee, 2)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="fee-stack-detail">
                      <td colSpan={4}>
                        <p className="text-dim">
                          Fees at each layer below this deposit. Allocation amounts overlap across layers; performance
                          fees compound and are weighted by allocated capital.
                        </p>
                        <table className="monthly-fee-table">
                          <caption className="sr-only">Fee breakdown for {row.vault.name || row.vault.address}</caption>
                          <thead>
                            <tr>
                              <th>Vault / strategy</th>
                              <th>Allocated capital</th>
                              <th>Layer performance fee</th>
                              <th>Layer annual management fee</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feeStackLayers(row.root).map(({ node, depth }, index) => (
                              <tr key={`${node.vault.chainId}:${node.vault.address}:${index}`}>
                                <th scope="row" style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}>
                                  <Link to={powergloveVaultPath(node.vault.chainId, node.vault.address)}>
                                    {depth ? '↳ ' : ''}
                                    {node.vault.name || shortAddr(node.vault.address)}
                                  </Link>
                                  <span className="monthly-fee-address">
                                    {shortAddr(node.vault.address)} ·{' '}
                                    {CHAIN_NAMES[node.vault.chainId] ?? node.vault.chainId}
                                  </span>
                                </th>
                                <td>{monthlyUsd(node.capitalUsd)}</td>
                                <td>{bpsPct(node.perfFee)}</td>
                                <td>{bpsPct(node.mgmtFee, 2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!sortedStacks.length && <p className="monthly-fee-empty text-dim">No vaults match these filters.</p>}
      </div>
      <div className="monthly-fee-footer">
        <span className="text-dim">{sortedStacks.length.toLocaleString()} vaults</span>
        {stackPagination.Pagination && <stackPagination.Pagination />}
      </div>
    </section>
  )
}
