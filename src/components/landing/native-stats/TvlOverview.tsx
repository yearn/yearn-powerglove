import { Link } from "@tanstack/react-router";
import { useContext, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NameType, Payload, ValueType } from "recharts/types/component/DefaultTooltipContent";
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

const TVL_HISTORY_TOP_SERIES_COUNT = 10;
const TVL_HISTORY_REMAINING_SERIES = "Remaining vaults";
const TVL_HISTORY_MIN_COMPLETE_SERIES_RATIO = 0.5;

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

function countSeriesValues(row: TvlHistoryRun["chart"][number]): number {
  return Object.entries(row).filter(([key, value]) => key !== "timestamp" && typeof value === "number" && Number.isFinite(value)).length;
}

function filterPartialTerminalRows(rows: TvlHistoryRun["chart"], seriesCount: number): TvlHistoryRun["chart"] {
  if (rows.length < 2 || seriesCount <= 0) return rows;

  const minCompleteSeriesCount = Math.max(1, Math.floor(seriesCount * TVL_HISTORY_MIN_COMPLETE_SERIES_RATIO));
  let endIndex = rows.length;

  while (endIndex > 1 && countSeriesValues(rows[endIndex - 1]) < minCompleteSeriesCount) {
    endIndex -= 1;
  }

  return rows.slice(0, endIndex);
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

function getLatestSeriesValue(rows: TvlHistoryRun["chart"], series: string): number {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = rows[index]?.[series];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return 0;
}

function buildTopTvlHistoryChart(
  rows: TvlHistoryRun["chart"],
  seriesKeys: string[],
): { rows: TvlHistoryRun["chart"]; series: string[] } {
  const rankedSeries = [...seriesKeys].sort((a, b) => getLatestSeriesValue(rows, b) - getLatestSeriesValue(rows, a));
  const topSeries = rankedSeries.slice(0, TVL_HISTORY_TOP_SERIES_COUNT);
  const otherSeries = rankedSeries.slice(TVL_HISTORY_TOP_SERIES_COUNT);
  const hasOtherSeries = otherSeries.length > 0;

  const chartRows = rows.map((row) => {
    const nextRow: TvlHistoryRun["chart"][number] = { timestamp: row.timestamp };

    for (const series of topSeries) {
      if (hasSeriesValue(row, series)) nextRow[series] = row[series];
    }

    if (hasOtherSeries) {
      const otherTvl = otherSeries.reduce((sum, series) => {
        const value = row[series];
        return typeof value === "number" && Number.isFinite(value) ? sum + value : sum;
      }, 0);

      if (otherTvl > 0) nextRow[TVL_HISTORY_REMAINING_SERIES] = otherTvl;
    }

    return nextRow;
  });

  return {
    rows: chartRows,
    series: hasOtherSeries ? [...topSeries, TVL_HISTORY_REMAINING_SERIES] : topSeries,
  };
}

function getStackRenderSeries(seriesKeys: string[]): string[] {
  const topSeries = seriesKeys.filter((series) => series !== TVL_HISTORY_REMAINING_SERIES);
  const hasRemainingVaults = seriesKeys.includes(TVL_HISTORY_REMAINING_SERIES);
  return [...(hasRemainingVaults ? [TVL_HISTORY_REMAINING_SERIES] : []), ...topSeries.slice().reverse()];
}

function getNumberRecordValue(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getCanonicalTotalByTimestamp(run: TvlHistoryRun | null): Record<number, number> {
  if (!run) return {};

  const currentSnapshot = run.meta.currentSnapshot;
  if (!currentSnapshot || typeof currentSnapshot !== "object") return {};

  const snapshotRecord = currentSnapshot as Record<string, unknown>;
  const timestamp = getNumberRecordValue(snapshotRecord, "timestamp");
  const adjustedTotal = getNumberRecordValue(snapshotRecord, "adjustedTotalTvlUsd") ?? getNumberRecordValue(run.meta, "adjustedTotalTvlUsd");

  return timestamp && adjustedTotal !== null ? { [timestamp]: adjustedTotal } : {};
}

function TvlHistoryTooltip({
  active,
  label,
  payload,
  canonicalTotalByTimestamp,
}: {
  active?: boolean;
  label?: number | string;
  payload?: Payload<ValueType, NameType>[];
  canonicalTotalByTimestamp: Record<number, number>;
}) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .filter((item) => typeof item.value === "number" && Number.isFinite(item.value))
    .map((item) => ({
      name: String(item.name ?? item.dataKey ?? ""),
      value: item.value as number,
      color: item.color,
    }))
    .filter((item) => item.value > 0);
  const summedTotal = rows.reduce((sum, item) => sum + item.value, 0);
  const timestamp = Number(label);
  const canonicalTotal = Number.isFinite(timestamp) ? canonicalTotalByTimestamp[timestamp] : undefined;
  const total = canonicalTotal ?? summedTotal;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.65rem 0.75rem", minWidth: 220 }}>
      <div className="mb-2 text-xs font-medium text-foreground">{label ? formatFullDate(label) : "TVL"}</div>
      <div className="mb-2 flex items-center justify-between gap-4 border-b border-border pb-2 text-xs">
        <span className="text-muted-foreground">Total TVL</span>
        <span className="font-semibold tabular-nums text-foreground">{fmt(total)}</span>
      </div>
      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {rows.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="legend-dot" style={{ background: item.color }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-foreground">{fmt(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TvlOverview() {
  const { chainFilter, setLastFetchedAt } = useContext(StatsContext);
  const isDark = useRootDarkMode();
  const { data: rawData, loading, error, fetchedAt, retry } = useFetch<LegacyTvlSummary>("/api/tvl");
  const {
    data: rawTvlHistory,
    loading: tvlHistoryLoading,
    error: tvlHistoryError,
    retry: retryTvlHistory,
  } = useFetch<TvlHistoryRun>("/api/tvl/history/runs/latest");
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
  const tvlHistoryChart = useMemo(() => {
    if (!rawTvlHistory) return { rows: [], series: [] };
    const completeRows = filterPartialTerminalRows(rawTvlHistory.chart, rawTvlHistory.series.length);
    const topTvlHistory = buildTopTvlHistoryChart(completeRows, rawTvlHistory.series);
    return {
      rows: addZeroStartPoints(topTvlHistory.rows, topTvlHistory.series),
      series: topTvlHistory.series,
    };
  }, [rawTvlHistory]);
  const tvlHistoryRows = tvlHistoryChart.rows;
  const tvlHistorySeries = tvlHistoryChart.series;
  const tvlHistoryStackSeries = useMemo(() => getStackRenderSeries(tvlHistorySeries), [tvlHistorySeries]);
  const tvlHistoryCanonicalTotalByTimestamp = useMemo(() => getCanonicalTotalByTimestamp(rawTvlHistory), [rawTvlHistory]);
  const tvlHistoryColorBySeries = useMemo(
    () =>
      Object.fromEntries(
        tvlHistorySeries.map((series, index) => [series, tvlHistoryColors[index % tvlHistoryColors.length]]),
      ),
    [tvlHistoryColors, tvlHistorySeries],
  );
  const hasTvlHistory = tvlHistoryRows.length > 0 && tvlHistorySeries.length > 0;
  const tvlHistoryRangeLabel = rawTvlHistory ? `${formatFullDate(rawTvlHistory.range.from)} - ${formatFullDate(rawTvlHistory.range.to)}` : "-";
  const warningCount = rawTvlHistory ? getWarningCount(rawTvlHistory.meta) : 0;

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
            <div className="sub">Saved run grouped by {rawTvlHistory?.groupBy ?? "series"}; top 10 by current TVL</div>
          </div>
          {rawTvlHistory && (
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Run #{rawTvlHistory.id}</span>
              <span>{rawTvlHistory.interval}</span>
              <span>{rawTvlHistory.pointCount.toLocaleString()} points</span>
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
                    content={<TvlHistoryTooltip canonicalTotalByTimestamp={tvlHistoryCanonicalTotalByTimestamp} />}
                    cursor={{ stroke: "rgba(17, 24, 39, 0.25)" }}
                  />
                  {tvlHistoryStackSeries.map((series) => (
                    <Area
                      key={series}
                      type="monotone"
                      dataKey={series}
                      stackId="tvl"
                      stroke={tvlHistoryColorBySeries[series]}
                      fill={tvlHistoryColorBySeries[series]}
                      fillOpacity={0.35}
                      strokeWidth={1.5}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              {tvlHistorySeries.map((series) => (
                <span key={series} className="inline-flex items-center gap-1.5">
                  <span className="legend-dot" style={{ background: tvlHistoryColorBySeries[series] }} />
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
