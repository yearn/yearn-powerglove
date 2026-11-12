import { ChevronRight, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { powergloveVaultPath, shortAddr } from './hooks'
import { monthlyUsd } from './monthly-vault-data'
import type { FeeStackNode } from './types'
import { originVaultId } from './vault-origin'

type FlowVault = FeeStackNode['vault']

export function FlowVaultName({ vault, navigable }: { vault: FlowVault; navigable: ReadonlySet<string> }) {
  const name =
    !vault.name || vault.name.toLowerCase() === vault.address.toLowerCase() ? shortAddr(vault.address) : vault.name
  return (
    <span className="fee-flow-name">
      <span title={vault.address}>{name}</span>
      {navigable.has(originVaultId(vault.chainId, vault.address)) && (
        <a
          className="fee-flow-open"
          href={powergloveVaultPath(vault.chainId, vault.address)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${name} Powerglove page`}
          onClick={(event) => event.stopPropagation()}
        >
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      )}
    </span>
  )
}

export function FeeFlowCard({
  flowId,
  parent,
  next,
  label,
  names = [],
  name,
  amount,
  amountLabel,
  muted = false,
  navigable,
  children
}: {
  flowId: string
  parent?: string
  next?: string
  label: string
  names?: FlowVault[]
  name?: string
  amount: number | null
  amountLabel: string
  muted?: boolean
  navigable: ReadonlySet<string>
  children: ReactNode
}) {
  return (
    <details
      className={`fee-flow-card fee-flow-collapsible${muted ? ' fee-flow-muted' : ''}`}
      data-flow-id={flowId}
      data-flow-parent={parent}
      data-flow-next={next}
      aria-label={label}
    >
      <summary>
        <span className="fee-flow-card-heading">
          <ChevronRight size={13} className="fee-flow-caret" aria-hidden="true" />
          <span className="fee-flow-names">
            {names.length ? (
              names.map((vault) => (
                <FlowVaultName key={originVaultId(vault.chainId, vault.address)} vault={vault} navigable={navigable} />
              ))
            ) : (
              <span>{name}</span>
            )}
          </span>
        </span>
        <strong className="fee-flow-card-value" title={amountLabel}>
          {monthlyUsd(amount)}
        </strong>
      </summary>
      <div className="fee-flow-card-details">{children}</div>
    </details>
  )
}
