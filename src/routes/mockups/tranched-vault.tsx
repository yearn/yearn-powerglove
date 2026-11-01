import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { SimulatedTranchePage } from '@/components/vault-page/SimulatedTranchePage'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@/constants/featuredVaults'
import type { TrancheId } from '@/lib/tranche-simulation'
import simulationUrl from '@/mock-data/tranche-simulation.json?url'
import sourceUrl from '@/mock-data/tranche-source.json?url'

export function TranchedVaultMockup({ tranche = 'senior' }: { tranche?: TrancheId }) {
  const address = tranche === 'junior' ? YVUSD_LOCKED_ADDRESS : YVUSD_UNLOCKED_ADDRESS
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <details className="group fixed left-1/2 top-4 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 border border-border bg-white text-sm shadow-lg">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0657f9] [&::-webkit-details-marker]:hidden">
          Tranched vault - mockup
          <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="max-h-[70vh] w-80 max-w-full overflow-y-auto border-t border-border px-4 py-3">
          <p className="mb-3 text-muted-foreground">
            Simulated August 1–November 1, 2026 migration. Senior starts with unlocked TVL minus $1M; Junior with locked
            TVL plus $750K; Equity with $250K. Senior and Junior target 5%; excess splits 80% Junior / 20% Equity.
            Weekly settlement, seven-day excess-profit unlocking for Junior and Equity, inferred daily cash flows, and
            no added fees. TVL includes locked profits; share returns and APYs reflect unlocking. Live strategy
            references are separate from simulated returns. No tranche transactions were executed.
          </p>
          <div className="mb-3 flex flex-col gap-2">
            <a className="underline underline-offset-4" href={simulationUrl} download="yvusd-tranche-simulation.json">
              Download simulation dataset
            </a>
            <a className="underline underline-offset-4" href={sourceUrl} download="yvusd-tranche-source.json">
              Download historical inputs
            </a>
          </div>
          <Link
            to="/vaults/$chainId/$vaultAddress"
            params={{ chainId: String(YVUSD_CHAIN_ID), vaultAddress: address }}
            className="underline underline-offset-4 hover:text-muted-foreground"
          >
            View source vault
          </Link>
        </div>
      </details>
      <SimulatedTranchePage tranche={tranche} />
    </div>
  )
}

export const Route = createFileRoute('/mockups/tranched-vault')({
  component: () => <TranchedVaultMockup />
})
