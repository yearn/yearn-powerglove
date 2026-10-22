import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { DirectDepositFeeRow } from './direct-deposit-fees'
import type { DownstreamCapitalNode } from './downstream-capital'
import { effectiveFeeCapital } from './effective-fee-capital'
import { FeeFlowCard, FlowVaultName } from './FeeFlowCard'
import { FeeFlowDiagram } from './FeeFlowDiagram'
import { bpsPct, CHAIN_NAMES, shortAddr } from './hooks'
import { monthlyUsd } from './monthly-vault-data'
import type { FeeStackNode } from './types'
import { useFeeFlowStrategyNames } from './useFeeFlowStrategyNames'
import { type OriginGraph, type OriginVault, originVaultId } from './vault-origin'

function LayerFees({ performance, management }: { performance: number | null; management: number | null }) {
  const perf = bpsPct(performance)
  const mgmt = bpsPct(management, 2)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="fee-flow-fees"
          aria-label={`Fees: performance ${perf}; annual management ${mgmt}`}
        >
          <span>Fees</span>
          <span>
            {perf} | {mgmt}
          </span>
          <Info size={12} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Performance fee | annual management fee. Performance fees apply to profit; management fees are an annual rate on
        managed assets. These are this layer’s own rates. A dash means unavailable.
      </TooltipContent>
    </Tooltip>
  )
}
function VaultMetadata({ vault }: { vault: FeeStackNode['vault'] }) {
  return (
    <span className="fee-flow-address">
      {CHAIN_NAMES[vault.chainId] ?? vault.chainId} · {shortAddr(vault.address)}
    </span>
  )
}
function DownstreamBranch({
  node,
  id,
  parent,
  member = false,
  navigable,
  strategyNames
}: {
  node: DownstreamCapitalNode
  id: string
  parent: string
  member?: boolean
  navigable: ReadonlySet<string>
  strategyNames: Readonly<Record<string, string>>
}) {
  const isContract = node.kind === 'vault' || node.kind === 'strategy'
  const vault = isContract
    ? {
        ...node.vault,
        name: strategyNames[originVaultId(node.vault.chainId, node.vault.address)] ?? node.vault.name
      }
    : node.vault
  return (
    <div className="fee-flow-branch">
      <FeeFlowCard
        flowId={id}
        parent={parent}
        label={`Downstream ${vault.name ?? vault.address}`}
        names={isContract ? [vault] : []}
        name={node.vault.name ?? undefined}
        amount={node.capitalUsd}
        amountLabel={node.kind === 'idle' ? 'Adjusted idle' : 'Adjusted allocation'}
        navigable={navigable}
      >
        {member && <span className="fee-flow-label">Product member</span>}
        {isContract && <VaultMetadata vault={node.vault} />}
        {node.note && <span className="fee-flow-address">{node.note}</span>}
        {isContract && <LayerFees performance={node.perfFee} management={node.mgmtFee} />}
      </FeeFlowCard>
      {node.children.length > 0 && (
        <div className="fee-flow-branches">
          {node.children.map((child, index) => (
            <DownstreamBranch
              key={`${child.vault.chainId}:${child.vault.address}:${index}`}
              node={child}
              id={`${id}-${index}`}
              parent={id}
              navigable={navigable}
              strategyNames={strategyNames}
            />
          ))}
        </div>
      )}
    </div>
  )
}
export function EffectiveFeeCapitalDetails({
  row,
  vaults,
  graph,
  datasetId,
  feeNodes,
  navigable
}: {
  row: DirectDepositFeeRow
  vaults: Map<string, OriginVault>
  graph: OriginGraph | null
  datasetId?: string
  feeNodes: Map<string, FeeStackNode>
  navigable: ReadonlySet<string>
}) {
  const capital = effectiveFeeCapital(row, vaults, graph, datasetId, feeNodes)
  const strategyNames = useFeeFlowStrategyNames(capital.downstreamRoots)
  const singleRoot = capital.downstreamRoots?.length === 1 ? capital.downstreamRoots[0] : null
  const branches = singleRoot ? singleRoot.children : capital.downstreamRoots
  const selectedPerformance = row.feeRateBasis === 'product' ? row.performanceFee : row.root.perfFee
  const selectedManagement = row.feeRateBasis === 'product' ? row.managementFee : row.root.mgmtFee
  return (
    <TooltipProvider delayDuration={200}>
      <FeeFlowDiagram label={`Capital and fee flows for ${row.vault.name ?? row.vault.address}`}>
        <section className="fee-flow-stage fee-flow-upstream" aria-label="Capital sources">
          <section aria-label="Direct deposits">
            <h3>Direct deposits</h3>
            <article className="fee-flow-card" data-flow-id="direct">
              <span>Direct (non-Yearn) deposits</span>
              <strong className="fee-flow-card-value">{monthlyUsd(capital.direct)}</strong>
            </article>
          </section>
          <section aria-label="Upstream excluded capital">
            <h3>Upstream · excluded</h3>
            <div className="fee-flow-branches">
              {capital.upstream === null ? (
                <div className="fee-flow-empty">Upstream TVL is unavailable for this publication.</div>
              ) : capital.upstream === 0 ? (
                <div className="fee-flow-empty">No upstream ownership deducted.</div>
              ) : (
                <>
                  {capital.positions.map((position, index) => (
                    <FeeFlowCard
                      key={`${position.via}:${index}`}
                      flowId={`upstream-${index}`}
                      next="selected"
                      label={`Excluded upstream ${position.sources.map((source) => source.name ?? source.address).join(', ') || 'Unknown source'}`}
                      names={position.sources}
                      name="Source vault unavailable"
                      amount={position.amount}
                      amountLabel="Excluded capital"
                      muted
                      navigable={navigable}
                    >
                      {position.sources.map((source) => {
                        const fees = feeNodes.get(originVaultId(source.chainId, source.address))
                        return (
                          <div key={originVaultId(source.chainId, source.address)}>
                            {position.sources.length > 1 && (
                              <span className="fee-flow-label">{source.name || shortAddr(source.address)}</span>
                            )}
                            <VaultMetadata vault={source} />
                            <LayerFees performance={fees?.perfFee ?? null} management={fees?.mgmtFee ?? null} />
                          </div>
                        )
                      })}
                      {position.via && (
                        <span className="fee-flow-address" title={position.via}>
                          via {shortAddr(position.via)}
                        </span>
                      )}
                    </FeeFlowCard>
                  ))}
                  {capital.unattributedUpstream !== null && capital.unattributedUpstream > 0.01 && (
                    <FeeFlowCard
                      flowId="upstream-other"
                      next="selected"
                      label="Other upstream ownership"
                      name="Other upstream ownership"
                      amount={capital.unattributedUpstream}
                      amountLabel="Excluded capital"
                      muted
                      navigable={navigable}
                    >
                      <span className="fee-flow-address">Source details unavailable</span>
                    </FeeFlowCard>
                  )}
                </>
              )}
            </div>
            <div className="fee-flow-total">
              <span>Total upstream excluded</span>
              <strong>{monthlyUsd(capital.upstream)}</strong>
            </div>
            {capital.excludedBridges !== null && capital.excludedBridges > 0 && (
              <div className="fee-flow-total fee-flow-muted">
                <span>Other exclusions · migrated bridge</span>
                <strong>{monthlyUsd(capital.excludedBridges)}</strong>
              </div>
            )}
          </section>
        </section>
        <section className="fee-flow-stage fee-flow-selected" aria-label="Selected vault">
          <article className="fee-flow-card fee-flow-selected-card" data-flow-id="selected" data-flow-parent="direct">
            <FlowVaultName vault={row.vault} navigable={navigable} />
            <VaultMetadata vault={row.vault} />
            <div className="fee-flow-selected-metrics">
              <div className="fee-flow-amount">
                <span>Reported TVL</span>
                <strong>{monthlyUsd(capital.reported)}</strong>
              </div>
              <div className="fee-flow-amount">
                <span>Adjusted TVL</span>
                <strong>{monthlyUsd(capital.adjusted)}</strong>
              </div>
            </div>
            <LayerFees performance={selectedPerformance} management={selectedManagement} />
          </article>
        </section>
        <section className="fee-flow-stage fee-flow-downstream" aria-label="Downstream included capital">
          <h3>Downstream · included</h3>
          {branches ? (
            branches.length ? (
              <div className="fee-flow-branches">
                {branches.map((node, index) => (
                  <DownstreamBranch
                    key={`${node.vault.chainId}:${node.vault.address}:${index}`}
                    node={node}
                    id={`downstream-${index}`}
                    parent="selected"
                    member={!singleRoot}
                    navigable={navigable}
                    strategyNames={strategyNames}
                  />
                ))}
              </div>
            ) : (
              <div className="fee-flow-empty">
                No funded strategy allocations.
                <br />
                Fees are charged at the selected vault.
              </div>
            )
          ) : (
            <div className="fee-flow-empty">Adjusted downstream allocations are unavailable for this publication.</div>
          )}
          <div className="fee-flow-total">
            <span>Total downstream</span>
            <strong>
              {monthlyUsd(branches ? branches.reduce((total, node) => total + (node.capitalUsd ?? 0), 0) : null)}
            </strong>
          </div>
        </section>
      </FeeFlowDiagram>
    </TooltipProvider>
  )
}
