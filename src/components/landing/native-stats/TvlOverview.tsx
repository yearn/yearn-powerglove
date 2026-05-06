import { Link } from "@tanstack/react-router";
import { useContext, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRootDarkMode } from "@/hooks/useRootDarkMode";
import { buildBlueShadePalette } from "@/lib/theme-blue-palette";
import { StatsContext } from "./StatsContext";
import { CAT_COLORS, CHAIN_NAMES, CHAIN_SHORT, CHART_COLORS, exportCSV, fmt, powergloveVaultPath, SkeletonCards, useFetch } from "./hooks";
import type { TvlHistoryRun, TvlSummary } from "./types";

type LegacyTvlSummary = Omit<TvlSummary, "activeVaultTvl" | "retiredVaultTvl" | "overlapExcluded" | "vaultBridgeExcluded"> & {
  activeVaultTvl?: number;
  retiredVaultTvl?: number;
  overlapExcluded?: number;
  vaultBridgeExcluded?: number;
  activeTvl?: number;
  retiredTvl?: number;
  overlapAmount?: number;
  crossChainOverlap?: number;
};

function normalizeTvlSummary(data: LegacyTvlSummary): TvlSummary {
  return {
    ...data,
    activeVaultTvl: data.activeVaultTvl ?? data.activeTvl ?? 0,
    retiredVaultTvl: data.retiredVaultTvl ?? data.retiredTvl ?? 0,
    overlapExcluded: data.overlapExcluded ?? data.overlapAmount ?? 0,
    vaultBridgeExcluded: data.vaultBridgeExcluded ?? data.crossChainOverlap ?? 0,
  };
}

const TVL_HISTORY_RUN_ID = 4;

function formatDate(timestamp: number | string): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(timestamp: number | string): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getWarningCount(meta: Record<string, unknown>): number {
  const warnings = meta.warnings;
  if (Array.isArray(warnings)) return warnings.length;
  if (typeof warnings === "number" && Number.isFinite(warnings)) return warnings;
  if (typeof meta.warningCount === "number" && Number.isFinite(meta.warningCount)) return meta.warningCount;
  return 0;
}

function hasSeriesValue(row: Record<string, unknown>, series: string): boolean {
  const value = row[series];
  return typeof value === "number" && Number.isFinite(value);
}

function addZeroStartPoints(rows: TvlHistoryRun["chart"], seriesKeys: string[]): TvlHistoryRun["chart"] {
  const chartRows = rows.map((row) => ({ ...row }));

  for (const series of seriesKeys) {
    const firstValueIndex = chartRows.findIndex((row) => hasSeriesValue(row, series));
    if (firstValueIndex > 0 && !hasSeriesValue(chartRows[firstValueIndex - 1], series)) {
      chartRows[firstValueIndex - 1][series] = 0;
    }
  }

  return chartRows;
}

export function TvlOverview() {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext);
  const isDark = useRootDarkMode();
  const { data: rawData, loading, error, fetchedAt, retry } = useFetch<LegacyTvlSummary>("/api/tvl");
  const {
    data: tvlHistory,
    loading: tvlHistoryLoading,
    error: tvlHistoryError,
    retry: retryTvlHistory,
  } = useFetch<TvlHistoryRun>(`/api/tvl/history/runs/${TVL_HISTORY_RUN_ID}`);
  const [isRetiredVaultsOpen, setIsRetiredVaultsOpen] = useState(false);
  const [isTvlBreakdownOpen, setIsTvlBreakdownOpen] = useState(false);
  const data = useMemo(() => (rawData ? normalizeTvlSummary(rawData) : null), [rawData]);
  const tvlHistoryColors = useMemo(() => buildBlueShadePalette(isDark), [isDark]);

  useEffect(() => {
    if (fetchedAt) setLastFetchedAt(fetchedAt);
  }, [fetchedAt, setLastFetchedAt]);

  const chainData = useMemo(
    () =>
      data
        ? Object.entries(data.tvlByChain)
            .filter(([chain]) => chainFilter === "all" || chain === chainFilter)
            .map(([chain, rawTvl]) => {
              const overlap = (data.overlapByChain[chain] || 0) + (data.crossChainOverlapByChain[chain] || 0);
              return { chain, label: CHAIN_NAMES[Number(chain)] || CHAIN_SHORT[Number(chain)] || chain, tvl: rawTvl - overlap };
            })
            .filter((c) => c.tvl > 0)
            .sort((a, b) => b.tvl - a.tvl)
        : [],
    [data, chainFilter],
  );

  const categories = useMemo(
    () =>
      data
        ? [
            { key: "v1", name: "V1", tvl: data.v1Tvl, color: CAT_COLORS.v1 },
            { key: "v2", name: "V2", tvl: data.v2Tvl, color: CAT_COLORS.v2 },
            { key: "v3", name: "V3", tvl: data.v3Tvl, color: CAT_COLORS.v3 },
            { key: "curation", name: "Curation", tvl: data.curationTvl, color: CAT_COLORS.curation },
          ]
        : [],
    [data],
  );

  const activeCategories = useMemo(() => categories.filter((c) => c.tvl > 0), [categories]);

  const retiredVaults = useMemo(() => data?.retiredVaults ?? [], [data]);
  const retiredVaultCountIncluded = retiredVaults.length;
  const tvlHistorySeries = tvlHistory?.series ?? [];
  const tvlHistoryRows = useMemo(
    () => (tvlHistory ? addZeroStartPoints(tvlHistory.chart, tvlHistorySeries) : []),
    [tvlHistory, tvlHistorySeries],
  );
  const hasTvlHistory = tvlHistoryRows.length > 0 && tvlHistorySeries.length > 0;
  const tvlHistoryRangeLabel = tvlHistory ? `${formatFullDate(tvlHistory.range.from)} - ${formatFullDate(tvlHistory.range.to)}` : "-";
  const warningCount = tvlHistory ? getWarningCount(tvlHistory.meta) : 0;

  if (loading) return <SkeletonCards count={1} />;
  if (error)
    return (
      <div className="error-retry">
        <div className="error-message">Error: {error}</div>
        <button className="page-btn" onClick={retry}>
          Retry
        </button>
      </div>
    );
  if (!data) return null;

  const activeVaultCategoryTvl = data.v1Tvl + data.v2Tvl + data.v3Tvl + data.curationTvl || data.activeVaultTvl;
  const maxChainTvl = chainData.length > 0 ? chainData[0].tvl : 1;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">TVL</div>
          <div className="value">{fmt(data.totalTvl)}</div>
          <div className="sub">
            {data.vaultCount.active} active vaults across {Object.keys(data.tvlByChain).length} chains
          </div>
        </div>
        <button
          type="button"
          className="page-btn"
          onClick={() => setIsTvlBreakdownOpen(true)}
        >
          See breakdown
        </button>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2>TVL History</h2>
            <div className="sub">Saved run grouped by {tvlHistory?.groupBy ?? "series"}</div>
          </div>
          {tvlHistory && (
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Run #{tvlHistory.id}</span>
              <span>{tvlHistory.interval}</span>
              <span>{tvlHistory.pointCount.toLocaleString()} points</span>
              <span>{tvlHistoryRangeLabel}</span>
              <span>{warningCount} warnings</span>
            </div>
          )}
        </div>

        {tvlHistoryLoading && (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading TVL history...</div>
        )}

        {tvlHistoryError && (
          <div className="error-retry">
            <div className="error-message">Error loading TVL history: {tvlHistoryError}</div>
            <button className="page-btn" onClick={retryTvlHistory}>
              Retry
            </button>
          </div>
        )}

        {!tvlHistoryLoading && !tvlHistoryError && !hasTvlHistory && (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">No TVL history data for this saved run.</div>
        )}

        {!tvlHistoryLoading && !tvlHistoryError && hasTvlHistory && (
          <>
            <div className="chart-container" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tvlHistoryRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatDate}
                    tick={{ fill: "var(--text-3)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(tvlHistoryRows.length / 8) - 1)}
                    minTickGap={16}
                  />
                  <YAxis
                    tickFormatter={(value: number) => fmt(value, 0)}
                    tick={{ fill: "var(--text-3)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelFormatter={(value: number) => formatFullDate(value)}
                    formatter={(value: number, name: string) => [fmt(value), name]}
                    cursor={{ stroke: "rgba(17, 24, 39, 0.25)" }}
                  />
                  {tvlHistorySeries.map((series, index) => (
                    <Area
                      key={series}
                      type="monotone"
                      dataKey={series}
                      stackId="tvl"
                      stroke={tvlHistoryColors[index % tvlHistoryColors.length]}
                      fill={tvlHistoryColors[index % tvlHistoryColors.length]}
                      fillOpacity={0.35}
                      strokeWidth={1.5}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {tvlHistorySeries.map((series, index) => (
                <span key={series} className="inline-flex items-center gap-1.5">
                  <span className="legend-dot" style={{ background: tvlHistoryColors[index % tvlHistoryColors.length] }} />
                  {series}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── TVL Composition Bar ── */}
      <div className="card">
        <h2>TVL Composition</h2>
        <div
          className="composition-bar"
          role="img"
          aria-label={`TVL composition: ${activeCategories.map((c) => `${c.name} ${fmt(c.tvl)}`).join(", ")}`}
        >
          {activeCategories.map((c) => (
            <div
              key={c.key}
              style={{
                width: `${(c.tvl / activeVaultCategoryTvl) * 100}%`,
                background: c.color,
                borderRadius: 2,
              }}
              title={`${c.name}: ${fmt(c.tvl)}`}
            />
          ))}
        </div>
        <div className="composition-legend">
          {activeCategories.map((c) => (
            <span key={c.key}>
              <span className="legend-dot" style={{ background: c.color }} />
              {c.name} &mdash; {fmt(c.tvl)} ({((c.tvl / activeVaultCategoryTvl) * 100).toFixed(1)}%)
            </span>
          ))}
        </div>
      </div>

      {/* ── TVL by Chain ── */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>TVL by Chain</h2>
          <button
            className="btn-export"
            onClick={() =>
              exportCSV(
                "tvl-by-chain.csv",
                ["Chain", "TVL (USD)"],
                chainData.map((c) => [CHAIN_NAMES[Number(c.chain)] || c.chain, c.tvl]),
              )
            }
          >
            Export CSV
          </button>
        </div>
        <div style={{ marginTop: "0.25rem" }}>
          {chainData.map((c, i) => (
            <div className="stat-row" key={c.chain}>
              <span className="stat-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: 100, flexShrink: 0 }}>
                <span className="legend-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {c.label}
              </span>
              <span style={{ flex: 1, padding: "0 1rem" }}>
                <div className="inline-bar">
                  <div className="inline-bar-track">
                    <div
                      className="inline-bar-fill"
                      style={{
                        width: `${(c.tvl / maxChainTvl) * 100}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              </span>
              <span className="stat-value">{fmt(c.tvl)}</span>
            </div>
          ))}
          {chainData.length === 0 && (
            <div className="text-dim" style={{ textAlign: "center", padding: "1rem" }}>
              No data for selected chain
            </div>
          )}
        </div>
      </div>

      <Dialog open={isTvlBreakdownOpen} onOpenChange={setIsTvlBreakdownOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>TVL Breakdown</DialogTitle>
            <DialogDescription>Included and excluded TVL used to calculate the headline number.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Included TVL</h3>
              <div className="rounded-md border border-border">
                <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span>TVL in Active Vaults</span>
                  <span className="font-medium tabular-nums">{fmt(data.activeVaultTvl)}</span>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                  onClick={() => {
                    setIsTvlBreakdownOpen(false);
                    setIsRetiredVaultsOpen(true);
                  }}
                >
                  <span>TVL in Retired Vaults</span>
                  <span className="font-medium tabular-nums">{fmt(data.retiredVaultTvl)}</span>
                </button>
                <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-sm">
                  <span>Allocator Vault Overlap</span>
                  <span className="font-medium tabular-nums">-{fmt(data.overlapExcluded)}</span>
                </div>
                <div className="mx-3 border-t border-border" />
                <div className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold">
                  <span>Adjusted TVL</span>
                  <span className="tabular-nums">{fmt(data.totalTvl)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Excluded TVL</h3>
              <div className="divide-y divide-border rounded-md border border-border">
                <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <span>Vault Bridge TVL</span>
                  <span className="font-medium tabular-nums">{fmt(data.vaultBridgeExcluded)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRetiredVaultsOpen} onOpenChange={setIsRetiredVaultsOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Retired vaults included in Retired Vault TVL</DialogTitle>
            <DialogDescription>
              {fmt(data.retiredVaultTvl)} across {retiredVaultCountIncluded} retired vaults after excluding cross-chain migrated vaults.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1.6fr)_auto_auto] gap-3 border-b border-border px-0 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <span>Vault</span>
              <span>Type</span>
              <span className="text-right">TVL</span>
            </div>
            <div className="overflow-y-auto">
              {retiredVaults.map((vault) => (
                <div
                  key={`${vault.chainId}:${vault.address}`}
                  className="grid grid-cols-[minmax(0,1.6fr)_auto_auto] items-center gap-3 border-b border-border/70 px-0 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      to={powergloveVaultPath(vault.chainId, vault.address)}
                      className="block truncate font-medium text-foreground hover:text-[#0657f9]"
                    >
                      {vault.name ?? vault.address}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">
                      {CHAIN_NAMES[vault.chainId] ?? `Chain ${vault.chainId}`} · {vault.address}
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{vault.category}</div>
                  <div className="text-right font-medium tabular-nums">{fmt(vault.tvlUsd)}</div>
                </div>
              ))}
              {retiredVaults.length === 0 && <div className="py-6 text-sm text-muted-foreground">No retired vaults found.</div>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
