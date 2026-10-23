# Registered direct deposit sources

The expanded **Adjusted TVL and Fees by Vault** rows partition direct capital
into Yearn treasury deposits, Alchemix deposits (where applicable), and Other direct
deposits. These are included sources, not upstream exclusions. They do not change
reported TVL, adjusted TVL, product membership, or effective fee rates.

Confirmed zero treasury deposits are hidden, including zero-value member positions
inside the expanded treasury list. Unavailable balances remain visible as unknown.
Each direct-deposit card connects to the selected vault; totals are labels only.

## Registry

`src/constants/direct-deposit-registry.ts` stores chain-scoped holder identities,
labels, evidence URLs, and optional target-vault restrictions. Add future holder
groups there. A holder must belong to only one group on a given chain.

Treasury's three Ethereum wallets are pinned to the `accounts` list and chain
scope in [the treasury registry at 5cbcb43](https://github.com/yearn/governance-apps/blob/5cbcb43e8d0d4da4f70dea63825d893cbc526452/docs/apps/treasury/registry.json):

| Wallet | Address |
| --- | --- |
| ychad.eth | `0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52` |
| treasury.ychad.eth | `0x93A62dA5a14C80f265DAbC077fCEE437B1a0Efde` |
| Robo Treasury | `0xEf77cc176c748d291EfB6CdC982c5744fC7211c8` |

Connector getters were read on-chain on 2026-10-23. The Ethereum connectors also
have verified `ERC4626Strategy` source and constructor arguments on Blockscout.
That source deposits shares to `address(this)`, so the connector is the holder;
the MYT contract itself must not be counted again.

| Chain | Connector / holder | `vault()` | `MYT()` |
| --- | --- | --- | --- |
| Ethereum | `0xdFDC17F784e16D7634AC270911D98755C68Ae220` | `0x696d02Db93291651ED510704c9b286841d506987` | `0x9B44efCa3e2a707B63Dc00CE79d646E5E5D24bA5` |
| Ethereum | `0x8AACC947c2f4E24D2Be4CBa4498f004079F35D87` | `0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0` | `0x29bcfeD246ce37319d94eBa107db90C453D4c43D` |
| Base | `0x81050315679972C403327A562ddd33be2346A656` | `0xe7D0DBE3493830e2Ab62619211A2BfF0Fc60dB42` | `0xb8BeFE5a6941ca4022a52042075ff269C3C67467` |

## Valuation and unavailable states

- Reads happen only for expanded rows with applicable registry entries. The
  existing configured RPC client must support archive reads and browser requests.
- Resolve the last finalized block at or before the canonical graph's
  `asOfTimestamp`, matching Yearn Data's dated observation convention. Cache this
  block by chain/date, and read all holder balances and total supply at that block.
- USD value is `balanceOf(holder) / totalSupply() * published gross vault TVL`.
  This uses the same dated prices as the capital diagram, rather than a live
  token price or an assumed stablecoin price.
- Combined products use only distinct member roots supplied by the canonical
  API. Sum actual holder share values across those members; internal product
  holdings do not become additional registered deposits.
- Subtract any already-published upstream deduction for the same holder and
  target, so registered sources do not repeat excluded Yearn ownership.
- The remainder is available only when all source amounts are known and fit
  within the published direct total. Failed reads, missing supply/prices, or
  reconciliation conflicts show a dash, preserve the total, and allow retry.
  A successful zero balance remains zero.

Fee and product accounting remains in Yearn Data. This registry describes holders,
not product membership or new address-specific accounting policies.
