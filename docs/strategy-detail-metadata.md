# Strategy detail metadata contract

> QTOV reference imported from codex/qtov-on-improved-fee-data at f1fc4bd.
> This describes the source branch's design and pilot. The tranche branch imports
> the registry, research records and reporting readers, not the complete pilot UI.


Strategy detail pages select a reusable presentation template from explicit metadata. Display names and protocol labels
are not reliable discriminators: names can change, and one protocol can support several materially different mechanics.

## Proposed CMS fields

Add these optional fields to each strategy metadata record:

```ts
type StrategyDetailsTemplate =
  | 'morpho-compounder'
  | 'pendle'
  | 'leverage-looper'
  | 'katana-yvusd-compounder'
  | 'depositor'
  | 'lender'
  | 'lender-borrower'

type StrategyDetailsMetadata = {
  detailsTemplate?: StrategyDetailsTemplate
  detailsConfig?: Record<string, string | number | boolean>
}
```

`detailsConfig` is validated by the selected template. Examples include a Morpho vault address, Pendle market and PT
addresses, supplied and borrowed assets, or a related allocator vault. Values that are not present remain unavailable;
the frontend must not reconstruct financial state from a display name.

The local registry in `src/components/strategy-details/strategyDetailRegistry.ts` is the adapter until these fields are
available from the CMS/Kong strategy payload.

## Current yvUSD coverage

| Strategy | Template | Required adapter |
| --- | --- | --- |
| Morpho Yearn OG USDC Compounder | `morpho-compounder` | Morpho GraphQL vault address |
| Katana yvUSDC Compounder | `katana-yvusd-compounder` | Related yvUSD vault and remote-vault evidence |
| stcUSD/USDC Pawn Broker Looper | `leverage-looper` | yvUSD APR service and Ethereum risk reads |
| USDC To sUSDS Depositor | `depositor` | Deposit path, yield source and liquidity dependency |
| sUSDS Pendle PT Maxi | `pendle` | Pendle position key and current quote adapter |
| USD3 Pendle PT Maxi | `pendle` | Pendle position key and current quote adapter |

All six current yvUSD strategies are classified. Lender and lender-borrower templates are available for later strategy
classification, but no live fields are shown until their protocol market metadata and data adapters are supplied.
