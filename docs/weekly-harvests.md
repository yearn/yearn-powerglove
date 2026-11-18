# Weekly harvests

The Vaults and Stats headline card requests `GET /api/harvests` through the
same-origin Yearn Data proxy. Deploy the Yearn Data endpoint before deploying
the frontend change. Local preview can use `VITE_YEARN_DATA_API_TARGET` to select
the updated local API; no database credentials are sent to the browser.

The API counts published contract report events in the half-open interval
`[publication cutoff - 7 days, publication cutoff)`. It includes V2 vault
`StrategyReported`, V3 allocator `StrategyReported`, and Tokenized Strategy
`Reported` events, including zero-profit, loss, zero-fee, and unvalued reports.
A report is identified by chain, transaction hash, and log index during
publication validation. Earnings rows are not added to fee/report rows because
they repeat allocator reports. Separate reports emitted by underlying strategies
and their allocators count separately; this is an activity count, not economic
yield or a unique-transaction count. Coverage is the selected financial dataset's
supported chains, returned as `chainIds`.

The response includes `reportCount`, `startTimestamp`, `endTimestamp`, `datasetId`,
`chainIds`, `byContractFamily`, and methodology `published-contract-reports-v1`.
Optional `chainId` and `datasetId` filters follow the selected publication's
validation and retirement rules. The window advances with publication rather
than browser time. The card tooltip states its actual UTC date range.

The client validates the response before caching it for five minutes. Missing,
invalid, or failed responses show a dash and a retry action; a valid zero shows
`0`. Harvest requests fail independently of TVL and active-vault requests.

## Verification baseline, November 6, 2026

Selected financial dataset:
`be014ef87662670f9f5bb91872768974043209791c353d5643110778efefcf41`.
The window is October 29, 2026 00:00 UTC through November 5, 2026 00:00 UTC,
exclusive. The endpoint returns 234: 127 V2, 102 V3 allocator, and 5 Tokenized
Strategy reports. A separate read-only query of original `fee_usd_events`
analysis outputs reconciled 234 rows to 234 distinct chain/transaction/log
identities. The count includes 119 zero-fee reports and 7 unvalued reports.
These are snapshot verification values, not hardcoded application inputs.
