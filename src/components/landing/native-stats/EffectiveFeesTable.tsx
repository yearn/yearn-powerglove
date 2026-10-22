import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { Fragment, type ReactNode, useContext, useMemo, useState } from 'react'
import { fetchKongVaultListRaw } from '@/lib/kong-vault-client'
import type { CanonicalVaultFee } from './canonical-fees'
import { directDepositFeeRows, directDepositTvl, externalTvlByVault, feeStackLayers } from './direct-deposit-fees'
import { EffectiveFeeCapitalDetails } from './EffectiveFeeCapitalDetails'
import { feeCapitalVaults, reportedDepositTvl } from './effective-fee-capital'
import { bpsPct, CHAIN_NAMES, powergloveVaultPath, shortAddr, useFetch, usePagination, useSort } from './hooks'
import { monthlyUsd, monthlyVaultType } from './monthly-vault-data'
import { StatsContext } from './StatsContext'
import type { FeeStackSummary } from './types'
import { type OriginAudit, type OriginGraph, originVaultId } from './vault-origin'

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
  } = useFetch<OriginGraph>(`/api/tvl/graph?includeRetired=true&datasetId=${encodeURIComponent(tvlDatasetId ?? '')}`, {
    enabled: !!tvlDatasetId
  })
  const audit = useFetch<OriginAudit>(`/api/audit/tree?datasetId=${encodeURIComponent(tvlDatasetId ?? '')}`, {
    enabled: !!tvlDatasetId
  })
  const capitalVaults = useMemo(() => feeCapitalVaults(audit.data, tvlDatasetId), [audit.data, tvlDatasetId])
  const feeNodes = useMemo(
    () =>
      new Map(
        [...feeStack.chains.map((chain) => chain.root), ...(feeStack.entries ?? []).flatMap((entry) => entry.roots)]
          .flatMap((root) => feeStackLayers(root))
          .map(({ node }) => [originVaultId(node.vault.chainId, node.vault.address), node])
      ),
    [feeStack]
  )
  const graphMatched = !!tvlDatasetId && feeGraph?.datasetId === tvlDatasetId
  const adjustedTvl = useMemo(() => externalTvlByVault(feeGraph, tvlDatasetId), [feeGraph, tvlDatasetId])
  const [expandedFees, setExpandedFees] = useState<Set<string>>(() => new Set())
  const stackSort = useSort('tvl')
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
  const navigableVaults = useMemo(
    () => new Set([...capitalVaults.keys(), ...feeNodes.keys(), ...metadataByVault.keys()]),
    [capitalVaults, feeNodes, metadataByVault]
  )
  const sortedStacks = useMemo(
    () =>
      sortStacks(
        directDepositFeeRows(feeStack.chains, feeStack.entries)
          .filter((row) => metadataByVault.get(originVaultId(row.vault.chainId, row.vault.address))?.isHidden !== true)
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
          tvl: (row) => directDepositTvl(row, adjustedTvl) ?? -1,
          reported: (row) => reportedDepositTvl(row, capitalVaults, graphMatched ? feeGraph : null, tvlDatasetId) ?? -1
        }
      ),
    [
      feeStack,
      chainFilter,
      stackSearch,
      stackTypeFilter,
      sortStacks,
      adjustedTvl,
      capitalVaults,
      feeGraph,
      graphMatched,
      tvlDatasetId,
      metadataByVault,
      vaults
    ]
  )
  const stackPagination = usePagination(sortedStacks.length, 10)
  const pagedStacks = sortedStacks.slice(stackPagination.start, stackPagination.end)

  return (
    <section className="monthly-vault-fees" aria-label="Adjusted TVL and Fees by Vault">
      <div className="monthly-fee-toolbar">
        <div>
          <h2>Adjusted TVL and Fees by Vault</h2>
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
      {(feeGraphError ||
        audit.error ||
        (feeGraph && !graphMatched) ||
        (audit.data && audit.data.datasetId !== tvlDatasetId)) && (
        <div className="error-retry">
          <p>TVL details could not be loaded for this publication.</p>
          <button
            type="button"
            className="page-btn"
            onClick={() => {
              retryFeeGraph()
              audit.retry()
            }}
          >
            Retry TVL details
          </button>
        </div>
      )}
      <div className="monthly-fee-table-scroll effective-fees-scroll">
        <table className="monthly-fee-table">
          <caption className="sr-only">Current effective fees for direct vault deposits</caption>
          <thead>
            <tr>
              <th {...stackSort.th('name', 'Vault')} />
              <th
                {...stackSort.th('tvl', 'Adjusted TVL', 'text-right')}
                title="External TVL after upstream vault ownership is deducted, matching TVL Flow."
              />
              <th
                {...stackSort.th('reported', 'Reported TVL', 'text-right')}
                title="Reported total assets, including idle funds. Product rows consolidate their published members and exclude internal ownership."
              />
              <th {...stackSort.th('effective', 'effective perf. fee', 'text-right')} />
              <th
                {...stackSort.th('management', 'effective mgmt fee', 'text-right')}
                title="Effective annual management fee."
              />
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
                    <td>{monthlyUsd(directDepositTvl(row, adjustedTvl))}</td>
                    <td>
                      {monthlyUsd(reportedDepositTvl(row, capitalVaults, graphMatched ? feeGraph : null, tvlDatasetId))}
                    </td>
                    <td
                      title={
                        row.feeRateBasis === 'stack'
                          ? 'Effective rate including underlying allocations'
                          : 'Own vault/product fee. Underlying fee rates are shown in the expanded breakdown.'
                      }
                    >
                      {bpsPct(row.performanceFee)}
                    </td>
                    <td>{bpsPct(row.managementFee, 2)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="fee-stack-detail">
                      <td colSpan={5}>
                        <EffectiveFeeCapitalDetails
                          row={row}
                          vaults={capitalVaults}
                          graph={graphMatched ? feeGraph : null}
                          datasetId={tvlDatasetId}
                          feeNodes={feeNodes}
                          navigable={navigableVaults}
                        />
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
      <div className="monthly-fee-footer effective-fee-pagination">
        {stackPagination.Pagination && <stackPagination.Pagination />}
      </div>
    </section>
  )
}
