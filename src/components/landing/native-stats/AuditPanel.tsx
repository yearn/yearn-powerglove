import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatsContext } from "./StatsContext";
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
} from "./hooks";

interface AuditStrategy {
  address: string;
  name: string | null;
  debtUsd: number;
  targetVaultAddress: string | null;
  targetVaultChainId: number | null;
  detectionMethod: "auto" | "registry" | null;
  label: string | null;
}

interface AuditVault {
  address: string;
  chainId: number;
  name: string | null;
  category: string;
  vaultType: number | null;
  tvlUsd: number;
  isRetired: boolean;
  strategies: AuditStrategy[];
}

interface AuditTreeResponse {
  summedTvl: number;
  overlapTvl: number;
  crossChainOverlap: number;
  vaultCount: number;
  vaults: AuditVault[];
  crossChainVaults: AuditCrossChainVault[];
}

interface AuditCrossChainVault {
  address: string;
  chainId: number;
  targetChainId: number;
  name: string | null;
  category: string;
  tvlUsd: number;
  label: string;
}

interface OverlapStrategyDetail {
  sourceVaultAddress: string;
  sourceVaultChainId: number;
  sourceVaultName: string | null;
  strategyAddress: string;
  strategyName: string | null;
  debtUsd: number;
  targetVaultAddress: string;
  targetVaultChainId: number;
  targetVaultName: string | null;
  detectionMethod: "auto" | "registry";
  label: string | null;
}

function categoryBadge(cat: string) {
  const cls =
    cat === "v2" ? "badge badge-v2" : cat === "v3" ? "badge badge-v3" : cat === "curation" ? "badge badge-curation" : "badge badge-v1";
  return <span className={cls}>{cat}</span>;
}

function typeBadge(vaultType: number | null) {
  if (vaultType === 1)
    return (
      <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", fontSize: "0.6rem" }}>
        allocator
      </span>
    );
  if (vaultType === 2)
    return (
      <span className="badge" style={{ background: "var(--blue-dim)", color: "var(--blue)", fontSize: "0.6rem" }}>
        strategy
      </span>
    );
  return null;
}

/** Compute the "counted TVL" for a vault: raw TVL minus overlap from its strategies */
function computeCountedTvl(vault: AuditVault): number {
  const overlapDeduction = vault.strategies.filter((s) => s.detectionMethod != null).reduce((sum, s) => sum + s.debtUsd, 0);
  return Math.max(0, vault.tvlUsd - overlapDeduction);
}

/** Recursive strategy tree node */
function StrategyNode({
  strategy,
  vaultMap,
  depth,
  visited,
  topLevelAddresses,
  isLast,
  parentChainId,
}: {
  strategy: AuditStrategy;
  vaultMap: Map<string, AuditVault>;
  depth: number;
  visited: Set<string>;
  topLevelAddresses: Set<string>;
  isLast: boolean;
  parentChainId: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const targetVault = strategy.targetVaultAddress
    ? vaultMap.get(`${strategy.targetVaultChainId}:${strategy.targetVaultAddress.toLowerCase()}`)
    : null;

  const hasTarget = targetVault != null;
  const targetKey = targetVault ? `${targetVault.chainId}:${targetVault.address.toLowerCase()}` : null;
  const isCycle = targetKey ? visited.has(targetKey) : false;
  const isTopLevelTarget = targetKey ? topLevelAddresses.has(targetKey) : false;

  const nextVisited = targetKey
    ? (() => {
        const s = new Set(visited);
        s.add(targetKey);
        return s;
      })()
    : visited;

  return (
    <div className="audit-strategy-node">
      {/* Strategy row */}
      <div
        className={`audit-row audit-strategy-row${strategy.detectionMethod ? " audit-strategy-deducted" : ""}`}
        style={{
          paddingLeft: `${depth * 1.5 + 1.5}rem`,
          background: `rgba(46, 230, 182, ${0.015 + depth * 0.015})`,
          cursor: hasTarget ? "pointer" : "default",
        }}
        onClick={() => hasTarget && setExpanded((e) => !e)}
      >
        <span className="text-dim" style={{ fontSize: "0.75rem", flexShrink: 0 }}>
          {isLast ? "\u2514\u2500" : "\u251C\u2500"}
        </span>
        <span style={{ color: "var(--accent)", fontSize: "0.65rem", flexShrink: 0, opacity: 0.6 }}>{"\u2192"}</span>
        {hasTarget && (
          <span className="audit-toggle" style={{ width: 14 }}>
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        )}
        <span className="audit-strategy-name" title={strategy.name || strategy.address}>
          {strategy.name || shortAddr(strategy.address)}
        </span>
        {strategy.debtUsd > 0 && (
          <span className={`audit-debt${!strategy.detectionMethod ? " audit-debt-prominent" : ""}`}>{fmt(strategy.debtUsd)}</span>
        )}
        {strategy.detectionMethod && (
          <span className={`audit-overlap-tag-prominent ${strategy.detectionMethod === "auto" ? "auto" : "registry"}`}>
            {strategy.detectionMethod === "auto" ? "overlap (auto)" : strategy.label || "overlap (registry)"}
          </span>
        )}
        {isCycle && <span className="audit-cycle-tag">cycle</span>}
      </div>

      {/* Target vault + its strategies (collapsed by default) */}
      {expanded && hasTarget && targetVault && (
        <>
          <div
            className={`audit-row audit-target-vault-row${strategy.detectionMethod ? " audit-strategy-deducted" : ""}`}
            style={{
              paddingLeft: `${(depth + 1) * 1.5 + 1.5}rem`,
              background: `rgba(46, 230, 182, ${0.015 + (depth + 1) * 0.015})`,
            }}
          >
            <span className="text-dim" style={{ fontSize: "0.75rem", flexShrink: 0 }}>
              {"\u2514\u2500"}
            </span>
            <span style={{ color: "var(--accent)", fontSize: "0.65rem", flexShrink: 0, opacity: 0.6 }}>{"\u2192"}</span>
            <span className="audit-vault-indicator">VAULT</span>
            <Link
              to={powergloveVaultPath(targetVault.chainId, targetVault.address)}
              className="audit-vault-name"
              title={targetVault.name || targetVault.address}
              onClick={(e) => e.stopPropagation()}
            >
              {targetVault.name || shortAddr(targetVault.address)}
            </Link>
            {categoryBadge(targetVault.category)}
            {typeBadge(targetVault.vaultType)}
            <span className="audit-tvl">{fmt(targetVault.tvlUsd)}</span>
            {targetVault.isRetired && (
              <span
                className="badge"
                style={{ background: "var(--red-dim)", color: "var(--red)", fontSize: "0.6rem", padding: "0.05rem 0.35rem" }}
              >
                retired
              </span>
            )}
          </div>
          {!isCycle &&
            !isTopLevelTarget &&
            targetVault.strategies.map((strat, i) => (
              <StrategyNode
                key={strat.address}
                strategy={strat}
                vaultMap={vaultMap}
                depth={depth + 2}
                visited={nextVisited}
                topLevelAddresses={topLevelAddresses}
                isLast={i === targetVault.strategies.length - 1}
                parentChainId={targetVault.chainId}
              />
            ))}
        </>
      )}
    </div>
  );
}

/** Top-level vault node */
function VaultNode({
  vault,
  vaultMap,
  topLevelAddresses,
}: {
  vault: AuditVault;
  vaultMap: Map<string, AuditVault>;
  topLevelAddresses: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasStrategies = vault.strategies.length > 0;
  const hasOverlap = vault.strategies.some((s) => s.targetVaultAddress != null);
  const overlapCount = vault.strategies.filter((s) => s.targetVaultAddress != null).length;

  const visited = new Set<string>();
  visited.add(`${vault.chainId}:${vault.address.toLowerCase()}`);

  const countedTvl = computeCountedTvl(vault);
  const hasDeduction = countedTvl < vault.tvlUsd - 1; // $1 tolerance for rounding

  return (
    <div className={`audit-vault-node${hasOverlap ? " has-overlap" : ""}`}>
      <div
        className="audit-row audit-vault-row"
        onClick={() => hasStrategies && setExpanded((e) => !e)}
        style={{ cursor: hasStrategies ? "pointer" : "default" }}
      >
        {hasStrategies && <span className="audit-toggle">{expanded ? "\u25BC" : "\u25B6"}</span>}
        {!hasStrategies && <span className="audit-toggle-placeholder" />}

        <Link
          to={powergloveVaultPath(vault.chainId, vault.address)}
          className="audit-vault-name"
          title={vault.name || vault.address}
          onClick={(e) => e.stopPropagation()}
        >
          {vault.name || shortAddr(vault.address)}
        </Link>

        <span className="text-dim" style={{ fontSize: "0.7rem" }}>
          {CHAIN_SHORT[vault.chainId] || CHAIN_NAMES[vault.chainId] || vault.chainId}
        </span>

        {categoryBadge(vault.category)}
        {typeBadge(vault.vaultType)}

        {vault.isRetired && (
          <span
            className="badge"
            style={{ background: "var(--red-dim)", color: "var(--red)", fontSize: "0.6rem", padding: "0.05rem 0.35rem" }}
          >
            retired
          </span>
        )}

        {/* ── Right-aligned columns: strats | TVL | overlaps | counted ── */}
        <span className="audit-cols">
          <span className="audit-col-strats">
            {hasStrategies ? `${vault.strategies.length} strat${vault.strategies.length > 1 ? "s" : ""}` : "\u2014"}
          </span>
          <span className="audit-col-tvl">{fmt(vault.tvlUsd)}</span>
          <span className="audit-col-overlaps">
            {overlapCount > 0 ? (
              <span className="audit-overlap-count">
                {overlapCount} overlap{overlapCount > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="audit-col-empty">{"\u2014"}</span>
            )}
          </span>
          <span className="audit-col-counted" title="TVL after deducting overlap from this vault's strategies">
            {hasDeduction ? fmt(countedTvl) : fmt(vault.tvlUsd)}
          </span>
        </span>
      </div>

      {expanded &&
        vault.strategies.map((strat, i) => (
          <StrategyNode
            key={strat.address}
            strategy={strat}
            vaultMap={vaultMap}
            depth={1}
            visited={visited}
            topLevelAddresses={topLevelAddresses}
            isLast={i === vault.strategies.length - 1}
            parentChainId={vault.chainId}
          />
        ))}
    </div>
  );
}

export function AuditPanel() {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext);
  const [search, setSearch] = useState("");
  const [showOverlapOnly, setShowOverlapOnly] = useState(false);
  const [includeRetired, setIncludeRetired] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [isStrategyOverlapOpen, setIsStrategyOverlapOpen] = useState(false);
  const [isCrossChainOverlapOpen, setIsCrossChainOverlapOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const url = `/api/audit/tree${chainFilter !== "all" ? `?chainId=${chainFilter}` : ""}`;
  const { data, loading, fetchedAt } = useFetch<AuditTreeResponse>(url);

  useEffect(() => {
    if (fetchedAt) setLastFetchedAt(fetchedAt);
  }, [fetchedAt, setLastFetchedAt]);

  // Build vault lookup map for recursive tree
  const vaultMap = useMemo(() => {
    if (!data) return new Map<string, AuditVault>();
    return new Map(data.vaults.map((v) => [`${v.chainId}:${v.address.toLowerCase()}`, v]));
  }, [data]);

  const overlapStrategyDetails = useMemo<OverlapStrategyDetail[]>(() => {
    if (!data) return [];
    return data.vaults
      .flatMap((vault) =>
        vault.strategies
          .filter(
            (strategy): strategy is AuditStrategy & { targetVaultAddress: string; targetVaultChainId: number; detectionMethod: "auto" | "registry" } =>
              strategy.targetVaultAddress != null && strategy.targetVaultChainId != null && strategy.detectionMethod != null,
          )
          .map((strategy) => {
            const targetVault = vaultMap.get(`${strategy.targetVaultChainId}:${strategy.targetVaultAddress.toLowerCase()}`);
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
              label: strategy.label,
            };
          }),
      )
      .sort((a, b) => b.debtUsd - a.debtUsd);
  }, [data, vaultMap]);

  const crossChainVaultDetails = useMemo(() => (data?.crossChainVaults ?? []).slice().sort((a, b) => b.tvlUsd - a.tvlUsd), [data]);

  const filteredVaults = useMemo(() => {
    if (!data) return [];
    const typeFilterFn = (v: AuditVault) =>
      typeFilter === "curation"
        ? v.category === "curation"
        : typeFilter === "allocator"
          ? v.vaultType === 1
          : typeFilter === "strategy"
            ? v.vaultType === 2
            : true;

    const searchFilterFn = debouncedSearch
      ? (
          (q) => (v: AuditVault) =>
            (v.name || "").toLowerCase().includes(q) || v.address.toLowerCase().includes(q)
        )(debouncedSearch.toLowerCase())
      : () => true;

    return data.vaults
      .filter((v) => includeRetired || !v.isRetired)
      .filter((v) => !showOverlapOnly || v.strategies.some((s) => s.targetVaultAddress != null))
      .filter(typeFilterFn)
      .filter(searchFilterFn);
  }, [data, debouncedSearch, showOverlapOnly, includeRetired, typeFilter]);

  // Set of top-level vault addresses for depth limiting
  const topLevelAddresses = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.vaults.map((v) => `${v.chainId}:${v.address.toLowerCase()}`));
  }, [data]);

  if (loading)
    return (
      <>
        <SkeletonCards count={3} />
        <SkeletonChart />
      </>
    );
  if (!data) return null;

  return (
    <>
      {/* ── Summary Metrics ── */}
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="metric metric-accent">
          <div className="label">Summed TVL (raw)</div>
          <div className="value">{fmt(data.summedTvl)}</div>
          <div className="sub">{data.vaultCount} vaults total</div>
        </div>
        <button
          type="button"
          className="metric metric-red"
          onClick={() => setIsStrategyOverlapOpen(true)}
          style={{ textAlign: "left", cursor: "pointer" }}
        >
          <div className="label">Strategy Overlap</div>
          <div className="value" style={{ color: "var(--red)" }}>
            -{fmt(data.overlapTvl)}
          </div>
          <div className="sub">{overlapStrategyDetails.length} vault-to-vault · click for details</div>
        </button>
        <button
          type="button"
          className="metric metric-red"
          onClick={() => setIsCrossChainOverlapOpen(true)}
          style={{ textAlign: "left", cursor: "pointer" }}
        >
          <div className="label">Cross-Chain Overlap</div>
          <div className="value" style={{ color: "var(--red)" }}>
            -{fmt(data.crossChainOverlap)}
          </div>
          <div className="sub">{crossChainVaultDetails.length} retired vaults · click for details</div>
        </button>
        <div className="metric metric-green">
          <div className="label">Net TVL</div>
          <div className="value" style={{ color: "var(--green)" }}>
            {fmt(data.summedTvl - data.overlapTvl - data.crossChainOverlap)}
          </div>
          <div className="sub">after all deductions</div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <label className={`filter-pill${showOverlapOnly ? " active" : ""}`} style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={showOverlapOnly} onChange={(e) => setShowOverlapOnly(e.target.checked)} />
          Overlap only
        </label>

        <label className={`filter-pill${includeRetired ? " active" : ""}`} style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={includeRetired} onChange={(e) => setIncludeRetired(e.target.checked)} />
          Include retired
        </label>

        <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="curation">Curation</option>
          <option value="allocator">Allocator</option>
          <option value="strategy">Strategy</option>
        </select>

        <input className="search-input" placeholder="Search vaults..." value={search} onChange={(e) => setSearch(e.target.value)} />

        <span className="text-dim" style={{ fontSize: "0.78rem", marginLeft: "auto" }}>
          {filteredVaults.length} vaults
        </span>
      </div>

      {/* ── Audit Tree ── */}
      <div className="card audit-tree">
        <div className="audit-tree-header">
          <span style={{ fontWeight: 600 }}>Vault</span>
          <span className="audit-cols audit-cols-header">
            <span className="audit-col-strats">Strats</span>
            <span className="audit-col-tvl">Vault TVL</span>
            <span className="audit-col-overlaps">Overlaps</span>
            <span className="audit-col-counted">Counted</span>
          </span>
        </div>

        {filteredVaults.map((vault) => (
          <VaultNode key={`${vault.chainId}:${vault.address}`} vault={vault} vaultMap={vaultMap} topLevelAddresses={topLevelAddresses} />
        ))}

        {filteredVaults.length === 0 && (
          <div className="text-dim" style={{ textAlign: "center", padding: "2rem" }}>
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
                        <span>{CHAIN_SHORT[item.sourceVaultChainId] || CHAIN_NAMES[item.sourceVaultChainId] || item.sourceVaultChainId}</span>
                        <span>•</span>
                        <span>via {item.strategyName || shortAddr(item.strategyAddress)}</span>
                      </div>
                      <div className="mt-1 grid gap-1 text-sm md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-3">
                        <Link to={powergloveVaultPath(item.sourceVaultChainId, item.sourceVaultAddress)} className="audit-vault-name min-w-0 truncate">
                          {item.sourceVaultName || shortAddr(item.sourceVaultAddress)}
                        </Link>
                        <div className="text-dim text-center text-xs">→</div>
                        <Link to={powergloveVaultPath(item.targetVaultChainId, item.targetVaultAddress)} className="audit-vault-name min-w-0 truncate md:text-right">
                          {item.targetVaultName || shortAddr(item.targetVaultAddress)}
                        </Link>
                      </div>
                    </div>
                    <div className="font-mono text-sm md:text-right" style={{ color: "var(--red)" }}>
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
              <div className="text-dim py-8 text-center">No cross-chain overlap vaults found for the current chain filter.</div>
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
                        <span>{CHAIN_SHORT[vault.targetChainId] || CHAIN_NAMES[vault.targetChainId] || vault.targetChainId}</span>
                      </div>
                      <div className="mt-1">
                        <Link to={powergloveVaultPath(vault.chainId, vault.address)} className="audit-vault-name min-w-0 truncate">
                          {vault.name || shortAddr(vault.address)}
                        </Link>
                      </div>
                    </div>
                    <div className="font-mono text-sm md:text-right" style={{ color: "var(--red)" }}>
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
  );
}
