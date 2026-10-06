import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { type CSSProperties, useContext, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  CHAIN_NAMES,
  CHAIN_SHORT,
  fmt,
  powergloveVaultPath,
  SkeletonCards,
  SkeletonChart,
  shortAddr,
  useDebouncedValue,
  useFetch,
  useSort
} from './hooks'
import { StatsContext } from './StatsContext'

interface AuditStrategy {
  address: string
  name: string | null
  debtUsd: number
  targetVaultAddress: string | null
  targetVaultChainId: number | null
  detectionMethod: 'auto' | 'registry' | null
  label: string | null
}

interface AuditVault {
  address: string
  chainId: number
  name: string | null
  category: string
  vaultType: number | null
  tvlUsd: number
  isRetired: boolean
  isHidden: boolean
  strategies: AuditStrategy[]
}

interface AuditTreeResponse {
  summedTvl: number
  overlapTvl: number
  crossChainOverlap: number
  vaultCount: number
  vaults: AuditVault[]
  crossChainVaults: AuditCrossChainVault[]
}

interface AuditCrossChainVault {
  address: string
  chainId: number
  targetChainId: number
  name: string | null
  category: string
  tvlUsd: number
  label: string
}

interface DefillamaMissingVault {
  chainId: number
  chainName: string
  vaultAddress: string
  name?: string
  category?: string
  tvlUsd?: number
  countedTvlUsd?: number
}

interface DefillamaComparableComparison {
  diff: {
    missingFromDefillama: DefillamaMissingVault[]
  }
}

type AuditTypeFilter = 'all' | 'v3-allocator' | 'v3-strategy' | 'curation' | 'v2' | 'v1'

interface OverlapStrategyDetail {
  sourceVaultAddress: string
  sourceVaultChainId: number
  sourceVaultName: string | null
  strategyAddress: string
  strategyName: string | null
  debtUsd: number
  targetVaultAddress: string
  targetVaultChainId: number
  targetVaultName: string | null
  detectionMethod: 'auto' | 'registry'
  label: string | null
}

function categoryBadge(cat: string) {
  const cls =
    cat === 'v2'
      ? 'badge badge-v2'
      : cat === 'v3'
        ? 'badge badge-v3'
        : cat === 'curation'
          ? 'badge badge-curation'
          : 'badge badge-v1'
  return <span className={cls}>{cat}</span>
}

function typeBadge(vaultType: number | null) {
  if (vaultType === 1)
    return (
      <span className="badge" style={{ background: 'var(--green-dim)', color: 'var(--green)', fontSize: '0.6rem' }}>
        allocator
      </span>
    )
  if (vaultType === 2)
    return (
      <span className="badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', fontSize: '0.6rem' }}>
        strategy
      </span>
    )
  return null
}

/** Compute the "counted TVL" for a vault: raw TVL minus overlap from its strategies */
function computeCountedTvl(vault: AuditVault): number {
  const overlapDeduction = vault.strategies
    .filter((s) => s.detectionMethod != null)
    .reduce((sum, s) => sum + s.debtUsd, 0)
  return Math.max(0, vault.tvlUsd - overlapDeduction)
}

function computeStrategyCountedTvl(strategy: AuditStrategy): number {
  return strategy.detectionMethod ? 0 : strategy.debtUsd
}

function vaultKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`
}

function visibleStrategies(strategies: AuditStrategy[]): AuditStrategy[] {
  return strategies.filter((strategy) => strategy.debtUsd > 0)
}

function getRegistryOverlapLabel(strategy: AuditStrategy, targetVault: AuditVault | null): string {
  if (targetVault?.name) return `\u2192 ${targetVault.name}`
  if (strategy.label) return `\u2192 ${strategy.label}`
  if (strategy.targetVaultAddress) return `\u2192 ${shortAddr(strategy.targetVaultAddress)}`
  return 'overlap (registry)'
}

/** Recursive strategy tree node */
function StrategyNode({
  strategy,
  vaultMap,
  depth,
  visited,
  topLevelAddresses,
  isLast
}: {
  strategy: AuditStrategy
  vaultMap: Map<string, AuditVault>
  depth: number
  visited: Set<string>
  topLevelAddresses: Set<string>
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const targetVault = strategy.targetVaultAddress
    ? vaultMap.get(`${strategy.targetVaultChainId}:${strategy.targetVaultAddress.toLowerCase()}`)
    : null
  const resolvedTargetVault = targetVault ?? null

  const targetKey = resolvedTargetVault
    ? `${resolvedTargetVault.chainId}:${resolvedTargetVault.address.toLowerCase()}`
    : null
  const isCycle = targetKey ? visited.has(targetKey) : false
  const isTopLevelTarget = targetKey ? topLevelAddresses.has(targetKey) : false
  const strategyCountedTvl = computeStrategyCountedTvl(strategy)
  const shouldDisplayTargetVault = strategy.detectionMethod === 'auto' && resolvedTargetVault != null
  const overlapLabel =
    strategy.detectionMethod === 'registry' ? getRegistryOverlapLabel(strategy, resolvedTargetVault) : 'overlap (auto)'
  const targetVisibleStrategies = resolvedTargetVault ? visibleStrategies(resolvedTargetVault.strategies) : []
  const canExpandTarget =
    resolvedTargetVault != null && !isCycle && !isTopLevelTarget && targetVisibleStrategies.length > 0

  const strategyRowStyle = {
    '--audit-strategy-indent': `${depth * 1.5 + 1.5}rem`,
    background: depth > 0 ? 'var(--surface-2)' : 'var(--surface)',
    cursor: canExpandTarget ? 'pointer' : 'default'
  } as CSSProperties

  const nextVisited = targetKey
    ? (() => {
        const s = new Set(visited)
        s.add(targetKey)
        return s
      })()
    : visited

  return (
    <div className="audit-strategy-node">
      {/* Strategy row */}
      <div
        className={`audit-row audit-strategy-row${strategy.detectionMethod ? ' audit-strategy-deducted' : ''}`}
        style={strategyRowStyle}
        onClick={() => canExpandTarget && setExpanded((e) => !e)}
      >
        <span className="text-dim" style={{ fontSize: '0.75rem', flexShrink: 0 }}>
          {isLast ? '\u2514\u2500' : '\u251C\u2500'}
        </span>
        <span style={{ color: 'var(--accent)', fontSize: '0.65rem', flexShrink: 0, opacity: 0.6 }}>{'\u2192'}</span>
        {canExpandTarget && (
          <span className="audit-toggle">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
            )}
          </span>
        )}
        {!canExpandTarget && <span className="audit-toggle-placeholder" />}
        {shouldDisplayTargetVault ? (
          <>
            <Link
              to={powergloveVaultPath(resolvedTargetVault.chainId, resolvedTargetVault.address)}
              className="audit-vault-name"
              title={resolvedTargetVault.name || resolvedTargetVault.address}
              onClick={(e) => e.stopPropagation()}
            >
              {resolvedTargetVault.name || shortAddr(resolvedTargetVault.address)}
            </Link>
            {categoryBadge(resolvedTargetVault.category)}
            {typeBadge(resolvedTargetVault.vaultType)}
            {resolvedTargetVault.isRetired && (
              <span
                className="badge"
                style={{
                  background: 'var(--red-dim)',
                  color: 'var(--red)',
                  fontSize: '0.6rem',
                  padding: '0.05rem 0.35rem'
                }}
              >
                retired
              </span>
            )}
            {resolvedTargetVault.isHidden && (
              <span
                className="badge"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-2)',
                  fontSize: '0.6rem',
                  padding: '0.05rem 0.35rem'
                }}
              >
                hidden
              </span>
            )}
          </>
        ) : (
          <span className="audit-strategy-name" title={strategy.name || strategy.address}>
            {strategy.name || shortAddr(strategy.address)}
          </span>
        )}
        {isCycle && <span className="audit-cycle-tag">cycle</span>}

        <span className="audit-cols">
          <span className="audit-col-strats">
            {targetVisibleStrategies.length > 0 ? (
              `${targetVisibleStrategies.length} strat${targetVisibleStrategies.length > 1 ? 's' : ''}`
            ) : (
              <span className="audit-col-empty">{'\u2014'}</span>
            )}
          </span>
          <span className="audit-col-tvl" title="Debt allocated from the parent vault to this strategy">
            {fmt(strategy.debtUsd)}
          </span>
          <span className="audit-col-overlaps">
            {strategy.detectionMethod ? (
              <span
                className={`audit-overlap-tag ${strategy.detectionMethod === 'auto' ? 'auto' : 'registry'}`}
                title={overlapLabel}
              >
                {overlapLabel}
              </span>
            ) : (
              <span className="audit-col-empty">{'\u2014'}</span>
            )}
          </span>
          <span className="audit-col-counted" title="Value counted from this strategy after overlap deductions">
            {fmt(strategyCountedTvl)}
          </span>
        </span>
      </div>

      {expanded &&
        canExpandTarget &&
        targetVisibleStrategies.map((strat, i) => (
          <StrategyNode
            key={strat.address}
            strategy={strat}
            vaultMap={vaultMap}
            depth={depth + 1}
            visited={nextVisited}
            topLevelAddresses={topLevelAddresses}
            isLast={i === targetVisibleStrategies.length - 1}
          />
        ))}
    </div>
  )
}

/** Top-level vault node */
function VaultNode({
  vault,
  vaultMap,
  topLevelAddresses,
  missingFromDefillama
}: {
  vault: AuditVault
  vaultMap: Map<string, AuditVault>
  topLevelAddresses: Set<string>
  missingFromDefillama: DefillamaMissingVault | undefined
}) {
  const [expanded, setExpanded] = useState(false)
  const vaultVisibleStrategies = visibleStrategies(vault.strategies)
  const hasStrategies = vaultVisibleStrategies.length > 0
  const hasOverlap = vaultVisibleStrategies.some((s) => s.targetVaultAddress != null)
  const overlapCount = vaultVisibleStrategies.filter((s) => s.targetVaultAddress != null).length

  const visited = new Set<string>()
  visited.add(`${vault.chainId}:${vault.address.toLowerCase()}`)

  const countedTvl = computeCountedTvl(vault)
  const defillamaTitle = missingFromDefillama
    ? `Counted locally but missing from DefiLlama comparable TVL (${fmt(missingFromDefillama.countedTvlUsd ?? countedTvl)})`
    : 'Included in the DefiLlama comparable vault set'

  return (
    <div className={`audit-vault-node${hasOverlap ? ' has-overlap' : ''}`}>
      <div
        className="audit-row audit-vault-row"
        onClick={() => hasStrategies && setExpanded((e) => !e)}
        style={{ cursor: hasStrategies ? 'pointer' : 'default' }}
      >
        {hasStrategies && (
          <span className="audit-toggle">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-[#4f4f4f]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#4f4f4f]" />
            )}
          </span>
        )}
        {!hasStrategies && <span className="audit-toggle-placeholder" />}

        <Link
          to={powergloveVaultPath(vault.chainId, vault.address)}
          className="audit-vault-name"
          title={vault.name || vault.address}
          onClick={(e) => e.stopPropagation()}
        >
          {vault.name || shortAddr(vault.address)}
        </Link>

        <span className="text-dim" style={{ fontSize: '0.7rem' }}>
          {CHAIN_SHORT[vault.chainId] || CHAIN_NAMES[vault.chainId] || vault.chainId}
        </span>

        {categoryBadge(vault.category)}
        {typeBadge(vault.vaultType)}

        {vault.isRetired && (
          <span
            className="badge"
            style={{
              background: 'var(--red-dim)',
              color: 'var(--red)',
              fontSize: '0.6rem',
              padding: '0.05rem 0.35rem'
            }}
          >
            retired
          </span>
        )}

        {vault.isHidden && (
          <span
            className="badge"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              fontSize: '0.6rem',
              padding: '0.05rem 0.35rem'
            }}
          >
            hidden
          </span>
        )}

        {/* ── Right-aligned columns: strats | TVL | overlaps | counted ── */}
        <span className="audit-cols">
          <span className="audit-col-strats">
            {hasStrategies
              ? `${vaultVisibleStrategies.length} strat${vaultVisibleStrategies.length > 1 ? 's' : ''}`
              : '\u2014'}
          </span>
          <span className="audit-col-tvl">{fmt(vault.tvlUsd)}</span>
          <span className="audit-col-overlaps">
            {overlapCount > 0 ? (
              <span className="audit-overlap-count">
                {overlapCount} overlap{overlapCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="audit-col-empty">{'\u2014'}</span>
            )}
          </span>
          <span className="audit-col-defillama" title={defillamaTitle}>
            {missingFromDefillama ? (
              <span className="audit-dl-missing-tag">local only</span>
            ) : (
              <span className="audit-dl-counted-tag">DL</span>
            )}
          </span>
          <span className="audit-col-counted" title="TVL after deducting overlap from this vault's strategies">
            {fmt(countedTvl)}
          </span>
        </span>
      </div>

      {expanded &&
        vaultVisibleStrategies.map((strat, i) => (
          <StrategyNode
            key={strat.address}
            strategy={strat}
            vaultMap={vaultMap}
            depth={1}
            visited={visited}
            topLevelAddresses={topLevelAddresses}
            isLast={i === vaultVisibleStrategies.length - 1}
          />
        ))}
    </div>
  )
}

export function AuditPanel() {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AuditTypeFilter>('all')
  const [isStrategyOverlapOpen, setIsStrategyOverlapOpen] = useState(false)
  const [isCrossChainOverlapOpen, setIsCrossChainOverlapOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search)
  const vaultSort = useSort('debt')
  const { sorted: sortVaults } = vaultSort

  const url = `/api/audit/tree${chainFilter !== 'all' ? `?chainId=${chainFilter}` : ''}`
  const { data, loading, fetchedAt } = useFetch<AuditTreeResponse>(url)
  const { data: defillamaComparison } = useFetch<DefillamaComparableComparison>(
    '/api/comparison/defillama-comparable?includeVaultBreakdown=false'
  )

  useEffect(() => {
    if (fetchedAt) setLastFetchedAt(fetchedAt)
  }, [fetchedAt, setLastFetchedAt])

  // Build vault lookup map for recursive tree
  const vaultMap = useMemo(() => {
    if (!data) return new Map<string, AuditVault>()
    return new Map(data.vaults.map((v) => [`${v.chainId}:${v.address.toLowerCase()}`, v]))
  }, [data])

  const overlapStrategyDetails = useMemo<OverlapStrategyDetail[]>(() => {
    if (!data) return []
    return data.vaults
      .flatMap((vault) =>
        vault.strategies
          .filter(
            (
              strategy
            ): strategy is AuditStrategy & {
              targetVaultAddress: string
              targetVaultChainId: number
              detectionMethod: 'auto' | 'registry'
            } =>
              strategy.debtUsd > 0 &&
              strategy.targetVaultAddress != null &&
              strategy.targetVaultChainId != null &&
              strategy.detectionMethod != null
          )
          .map((strategy) => {
            const targetVault = vaultMap.get(
              `${strategy.targetVaultChainId}:${strategy.targetVaultAddress.toLowerCase()}`
            )
            return {
              sourceVaultAddress: vault.address,
              sourceVaultChainId: vault.chainId,
              sourceVaultName: vault.name,
              strategyAddress: strategy.address,
              strategyName: strategy.name,
              debtUsd: strategy.debtUsd,
              targetVaultAddress: strategy.targetVaultAddress,
              targetVaultChainId: strategy.targetVaultChainId,
              targetVaultName: targetVault?.name || null,
              detectionMethod: strategy.detectionMethod,
              label: strategy.label
            }
          })
      )
      .sort((a, b) => b.debtUsd - a.debtUsd)
  }, [data, vaultMap])

  const crossChainVaultDetails = useMemo(
    () => (data?.crossChainVaults ?? []).slice().sort((a, b) => b.tvlUsd - a.tvlUsd),
    [data]
  )

  const missingFromDefillamaByVault = useMemo(() => {
    if (!defillamaComparison) return new Map<string, DefillamaMissingVault>()
    return new Map(
      defillamaComparison.diff.missingFromDefillama.map((vault) => [vaultKey(vault.chainId, vault.vaultAddress), vault])
    )
  }, [defillamaComparison])

  const filteredVaults = useMemo(() => {
    if (!data) return []
    const typeFilterFn = (v: AuditVault) =>
      typeFilter === 'v3-allocator'
        ? v.category === 'v3' && v.vaultType === 1
        : typeFilter === 'v3-strategy'
          ? v.category === 'v3' && v.vaultType === 2
          : typeFilter === 'curation'
            ? v.category === 'curation'
            : typeFilter === 'v2'
              ? v.category === 'v2'
              : typeFilter === 'v1'
                ? v.category === 'v1'
                : true

    const searchFilterFn = debouncedSearch
      ? (
          (q) => (v: AuditVault) =>
            (v.name || '').toLowerCase().includes(q) || v.address.toLowerCase().includes(q)
        )(debouncedSearch.toLowerCase())
      : () => true

    return data.vaults.filter(typeFilterFn).filter(searchFilterFn)
  }, [data, debouncedSearch, typeFilter])

  const filteredMissingFromDefillama = useMemo(
    () =>
      filteredVaults
        .map((vault) => missingFromDefillamaByVault.get(vaultKey(vault.chainId, vault.address)))
        .filter((vault): vault is DefillamaMissingVault => vault != null),
    [filteredVaults, missingFromDefillamaByVault]
  )

  const missingFromDefillamaTvl = useMemo(
    () => filteredMissingFromDefillama.reduce((sum, vault) => sum + (vault.countedTvlUsd ?? 0), 0),
    [filteredMissingFromDefillama]
  )

  const sortedVaults = useMemo(
    () =>
      sortVaults(filteredVaults, {
        debt: (vault) => vault.tvlUsd,
        counted: (vault) => computeCountedTvl(vault),
        defillama: (vault) => (missingFromDefillamaByVault.has(vaultKey(vault.chainId, vault.address)) ? 1 : 0)
      }),
    [filteredVaults, missingFromDefillamaByVault, sortVaults]
  )

  // Set of top-level vault addresses for depth limiting
  const topLevelAddresses = useMemo(() => {
    if (!data) return new Set<string>()
    return new Set(data.vaults.map((v) => `${v.chainId}:${v.address.toLowerCase()}`))
  }, [data])

  if (loading)
    return (
      <>
        <SkeletonCards count={3} />
        <SkeletonChart />
      </>
    )
  if (!data) return null

  return (
    <>
      {/* ── Summary Metrics ── */}
      <div className="metric-grid audit-summary-grid">
        <div className="metric metric-accent">
          <div className="label">Summed TVL (raw)</div>
          <div className="value">{fmt(data.summedTvl)}</div>
          <div className="sub">{data.vaultCount} vaults total</div>
        </div>
        <button
          type="button"
          className="metric metric-red"
          onClick={() => setIsStrategyOverlapOpen(true)}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="label">Strategy Overlap</div>
          <div className="value" style={{ color: 'var(--red)' }}>
            -{fmt(data.overlapTvl)}
          </div>
          <div className="sub">{overlapStrategyDetails.length} vault-to-vault · click for details</div>
        </button>
        <button
          type="button"
          className="metric metric-red"
          onClick={() => setIsCrossChainOverlapOpen(true)}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="label">Cross-Chain Overlap</div>
          <div className="value" style={{ color: 'var(--red)' }}>
            -{fmt(data.crossChainOverlap)}
          </div>
          <div className="sub">{crossChainVaultDetails.length} retired vaults · click for details</div>
        </button>
        <div className="metric metric-green">
          <div className="label">Net TVL</div>
          <div className="value" style={{ color: 'var(--green)' }}>
            {fmt(data.summedTvl - data.overlapTvl - data.crossChainOverlap)}
          </div>
          <div className="sub">after all deductions</div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <select
          className="filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AuditTypeFilter)}
        >
          <option value="all">All types</option>
          <option value="v3-allocator">v3 allocator</option>
          <option value="v3-strategy">v3 strategy</option>
          <option value="curation">Curation</option>
          <option value="v2">v2</option>
          <option value="v1">v1</option>
        </select>

        <input
          className="search-input"
          placeholder="Search vaults..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <span className="text-dim audit-filter-summary">
          {filteredVaults.length} vaults · {filteredMissingFromDefillama.length} local-only ·{' '}
          {fmt(missingFromDefillamaTvl)}
        </span>
      </div>

      {/* ── Audit Tree ── */}
      <div className="card audit-tree">
        <div className="audit-tree-header">
          <span style={{ fontWeight: 600 }}>Vault</span>
          <span className="audit-cols audit-cols-header">
            <span className="audit-col-strats">Strats</span>
            <span {...vaultSort.th('debt', 'Debt', 'audit-col-tvl')} />
            <span className="audit-col-overlaps">Overlaps</span>
            <span {...vaultSort.th('defillama', 'DL', 'audit-col-defillama')} />
            <span {...vaultSort.th('counted', 'Counted', 'audit-col-counted')} />
          </span>
        </div>

        {sortedVaults.map((vault) => (
          <VaultNode
            key={`${vault.chainId}:${vault.address}`}
            vault={vault}
            vaultMap={vaultMap}
            topLevelAddresses={topLevelAddresses}
            missingFromDefillama={missingFromDefillamaByVault.get(vaultKey(vault.chainId, vault.address))}
          />
        ))}

        {filteredVaults.length === 0 && (
          <div className="text-dim" style={{ textAlign: 'center', padding: '2rem' }}>
            No vaults match the current filters
          </div>
        )}
      </div>

      <Dialog open={isStrategyOverlapOpen} onOpenChange={setIsStrategyOverlapOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col overflow-hidden rounded-none border border-border bg-background p-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Strategy overlap details</DialogTitle>
            <DialogDescription>
              All strategy rows whose debt is deducted because they route capital into another vault.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {overlapStrategyDetails.length === 0 ? (
              <div className="text-dim py-8 text-center">No strategy overlaps found for the current chain filter.</div>
            ) : (
              <div className="border-t border-border">
                {overlapStrategyDetails.map((item) => (
                  <div
                    key={`${item.sourceVaultChainId}:${item.sourceVaultAddress}:${item.strategyAddress}`}
                    className="grid grid-cols-1 items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-gray-50 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#808080]">
                        <span>
                          {CHAIN_SHORT[item.sourceVaultChainId] ||
                            CHAIN_NAMES[item.sourceVaultChainId] ||
                            item.sourceVaultChainId}
                        </span>
                        <span>•</span>
                        <span>via {item.strategyName || shortAddr(item.strategyAddress)}</span>
                      </div>
                      <div className="mt-1 grid gap-1 text-sm md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-3">
                        <Link
                          to={powergloveVaultPath(item.sourceVaultChainId, item.sourceVaultAddress)}
                          className="audit-vault-name min-w-0 truncate"
                        >
                          {item.sourceVaultName || shortAddr(item.sourceVaultAddress)}
                        </Link>
                        <div className="text-dim text-center text-xs">→</div>
                        <Link
                          to={powergloveVaultPath(item.targetVaultChainId, item.targetVaultAddress)}
                          className="audit-vault-name min-w-0 truncate md:text-right"
                        >
                          {item.targetVaultName || shortAddr(item.targetVaultAddress)}
                        </Link>
                      </div>
                    </div>
                    <div className="font-mono text-sm md:text-right" style={{ color: 'var(--red)' }}>
                      -{fmt(item.debtUsd)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCrossChainOverlapOpen} onOpenChange={setIsCrossChainOverlapOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden rounded-none border border-border bg-background p-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Cross-chain overlap details</DialogTitle>
            <DialogDescription>
              Retired vaults whose capital is already counted on another chain and is deducted from net TVL.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {crossChainVaultDetails.length === 0 ? (
              <div className="text-dim py-8 text-center">
                No cross-chain overlap vaults found for the current chain filter.
              </div>
            ) : (
              <div className="border-t border-border">
                {crossChainVaultDetails.map((vault) => (
                  <div
                    key={`${vault.chainId}:${vault.address}`}
                    className="grid grid-cols-1 items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-gray-50 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#808080]">
                        <span>{CHAIN_SHORT[vault.chainId] || CHAIN_NAMES[vault.chainId] || vault.chainId}</span>
                        <span>→</span>
                        <span>
                          {CHAIN_SHORT[vault.targetChainId] || CHAIN_NAMES[vault.targetChainId] || vault.targetChainId}
                        </span>
                      </div>
                      <div className="mt-1">
                        <Link
                          to={powergloveVaultPath(vault.chainId, vault.address)}
                          className="audit-vault-name min-w-0 truncate"
                        >
                          {vault.name || shortAddr(vault.address)}
                        </Link>
                      </div>
                    </div>
                    <div className="font-mono text-sm md:text-right" style={{ color: 'var(--red)' }}>
                      -{fmt(vault.tvlUsd)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
