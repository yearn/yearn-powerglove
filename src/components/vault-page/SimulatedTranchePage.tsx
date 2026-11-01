import { lazy, Suspense } from 'react'
import { StrategiesPanel } from '@/components/strategies-panel'
import { VaultActivityPanel } from '@/components/vault-events'
import { CHAIN_ID_TO_ICON } from '@/constants/chains'
import { YVUSD_UNLOCKED_ADDRESS } from '@/constants/featuredVaults'
import { useVaultPageData } from '@/hooks/useVaultPageData'
import { buildSingleApyDisplay } from '@/lib/apy-display'
import { formatCurrency, formatTvlDisplay } from '@/lib/formatters'
import { getTrancheMockData, lastSimulationPoint, trancheSimulation } from '@/lib/tranche-mock-data'
import { TRANCHE_IDS, type TrancheId } from '@/lib/tranche-simulation'
import type { MainInfoPanelProps } from '@/types/dataTypes'
import { StandardVaultPage } from './StandardVaultPage'
import { VaultPageLayout } from './VaultPageLayout'

const ChartsPanel = lazy(() =>
  import('@/components/charts/charts-panel').then((module) => ({ default: module.ChartsPanel }))
)

function OriginalVaultPanel({ section }: { section: 'strategies' | 'activity' }) {
  const { vaultDetails, isInitialLoading, hasErrors } = useVaultPageData({
    vaultAddress: YVUSD_UNLOCKED_ADDRESS,
    vaultChainId: 1
  })
  if (hasErrors) {
    return (
      <p className="px-6 py-4">
        Live {section === 'strategies' ? 'strategy reference' : 'vault activity'} is unavailable. The frozen simulation
        is still available.
      </p>
    )
  }
  if (isInitialLoading || !vaultDetails) {
    return <p className="px-6 py-4">Loading original vault {section}…</p>
  }
  return section === 'activity' ? (
    <VaultActivityPanel
      vaultChainId={1}
      vaultDetails={vaultDetails}
      maxHeight="max(0px, calc(100dvh - var(--vault-header-height, 60px) - 25rem))"
      snapToRows
    />
  ) : (
    <StrategiesPanel vaultChainId={1} vaultDetails={vaultDetails} reallocationData={null} />
  )
}

function SimulationSummary() {
  return (
    <div className="border-x border-t border-border bg-white px-4 py-6 sm:px-6">
      <h2 className="text-lg font-semibold">Simulated migration · August 1 – November 1, 2026</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        92 daily intervals with inferred end-of-day net deposits and withdrawals. Earnings exclude cash flows; returns
        are cash-flow-neutral and cumulative, not annualized.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-right text-sm tabular-nums">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Tranche</th>
              <th className="px-3">Starting TVL</th>
              <th className="px-3">Net cash flow</th>
              <th className="px-3">Ending TVL</th>
              <th className="px-3">Earnings</th>
              <th className="pl-3">Return</th>
            </tr>
          </thead>
          <tbody>
            {TRANCHE_IDS.map((id) => {
              const result = lastSimulationPoint.tranches[id]
              return (
                <tr key={id} className="border-b border-border last:border-0">
                  <th scope="row" className="py-3 text-left capitalize">
                    {id}
                  </th>
                  <td className="whitespace-nowrap px-3">{formatCurrency(trancheSimulation.initial[id])}</td>
                  <td className="whitespace-nowrap px-3">{formatCurrency(result.cumulativeNetFlowUsd)}</td>
                  <td className="whitespace-nowrap px-3">{formatCurrency(result.nav)}</td>
                  <td className="whitespace-nowrap px-3">{formatCurrency(result.earningsUsd)}</td>
                  <td className="pl-3">{(result.cumulativeReturn * 100).toFixed(2)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SimulatedTranchePage({ tranche }: { tranche: TrancheId }) {
  const { summary, aprApyData, tvlData, ppsData } = getTrancheMockData(tranche)
  const name = { senior: 'Senior yvUSD', junior: 'Junior yvUSD', equity: 'Equity yvUSD' }[tranche]
  const mainInfo: MainInfoPanelProps = {
    vaultId: `${name} · simulated`,
    vaultName: name,
    deploymentDate: 'August 1, 2026',
    deploymentLabel: 'Simulated since',
    apiVersion: 'Counterfactual',
    description:
      'Simulated migration of August 1 yvUSD balances. Senior targets 5% annually; Junior targets 5% plus 80% of excess, and Equity receives 20% of excess and absorbs losses first.\n\nDaily settlement and immediate excess realization, no added tranche fees, inferred end-of-day cash flows from original vault TVL/PPS, and USDC valued at $1. Underlying fees are already reflected in source share prices. Results end November 1, 2026 and are not live vault performance.',
    vaultToken: {
      icon: 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48/logo-32.png',
      name: 'USDC'
    },
    network: { icon: CHAIN_ID_TO_ICON[1], name: 'Ethereum' },
    totalSupply: formatCurrency(summary.nav),
    compactTotalSupply: formatTvlDisplay(summary.nav),
    tvlLabel: 'TVL (simulated)',
    oneDayAPY: buildSingleApyDisplay(summary.oneDayApy),
    expectedApyLabel: 'Last-day APY (sim.)',
    sevenDayAPY: buildSingleApyDisplay(summary.sevenDayApy),
    thirtyDayAPY: buildSingleApyDisplay(summary.thirtyDayApy),
    managementFee: '0% extra',
    performanceFee: '0% extra',
    vaultAddress: YVUSD_UNLOCKED_ADDRESS,
    vaultAddressLabel: 'Underlying vault',
    blockExplorerLink: `https://etherscan.io/address/${YVUSD_UNLOCKED_ADDRESS}`
  }
  return (
    <VaultPageLayout isLoading={false} hasErrors={false}>
      <StandardVaultPage
        mainInfo={mainInfo}
        showAction={false}
        charts={
          <Suspense fallback={<p className="p-6">Loading simulated charts…</p>}>
            <ChartsPanel
              aprApyData={aprApyData}
              tvlData={tvlData}
              ppsData={ppsData}
              isV3Vault
              migrationDate="2026-08-01"
            />
          </Suspense>
        }
        strategies={<OriginalVaultPanel section="strategies" />}
        vaultActivity={<OriginalVaultPanel section="activity" />}
      />
      <SimulationSummary />
    </VaultPageLayout>
  )
}
