# Combined Dependabot validation — October 20, 2026

PR #57 now includes all five Dependabot updates and the compatibility fixes from #52, #53, #55, and #56. Their original commits are retained in `ross/dependabot-development`, which targets `master`. Each fixed PR was tested separately before this combined validation.

## Integrated updates

| PR | Included changes | Individual validation |
| --- | --- | --- |
| [#52](https://github.com/yearn/yearn-powerglove/pull/52) | GraphQL 17.0.2, Apollo Client 4.3.3, RxJS 7.8.2, and graphql-tag 2.12.7 | 215 tests, build, full lint, and browser checks pass |
| [#53](https://github.com/yearn/yearn-powerglove/pull/53) | React/React DOM 19.3.0, matching types, Vaul 1.1.2, and react-is 19.3.0 | 212 tests, build, full lint, and browser checks pass |
| [#54](https://github.com/yearn/yearn-powerglove/pull/54) | jsdom 30.1.2, already integrated | 212 tests and build pass; its original lint run retained three baseline formatting errors, now fixed |
| [#55](https://github.com/yearn/yearn-powerglove/pull/55) | Recharts 3.10.1 and migrated tooltip, legend, readonly payload, and formatter integrations | 212 tests, build, full lint, and browser checks pass |
| [#56](https://github.com/yearn/yearn-powerglove/pull/56) | All 16 routine updates, aligned TanStack Router/tooling, and Biome 2.5 compatibility | 212 tests, build, full lint, and browser checks pass |

## Combined result

- Frozen dependency installation passes.
- All **215 tests across 44 suites** pass, including real Apollo HTTP/cache/error/skip coverage and the existing chart rendering/interaction assertions.
- TypeScript and the production build pass.
- Full Biome lint passes with no errors or warnings. The three original baseline formatting errors are fixed.
- All **140 checked peer requirements** pass. The additional transitive graphql-tag check accepts GraphQL 17.0.2.
- React Router, router-plugin, and router-devtools-core all resolve router-core **1.171.30**.
- Desktop (1440×1000) and mobile (390×844) live vault-list checks pass: search filters to USDC, and the mobile filter dialog opens and closes. Neither check records an uncaught page error, failed request, or HTTP error response.
- The live yvUSD detail page renders APY curves and locked/unlocked share-growth curves. Its TVL tab renders both stacked bar series, and hovering displays the combined-value tooltip. Three live GraphQL requests return HTTP 200 with data and no GraphQL errors.
- The local preview, configured host header, private HTTPS route, and same-origin APR API return HTTP 200. The APR API returns both vault entries. Screenshots were visually inspected.

## Integration details

The merge conflicts were limited to `package.json` and `bun.lock`. Package changes were combined without dropping either compatibility override: `graphql-tag: 2.12.7` and `react-is: 19.3.0`. Bun regenerated the lockfile from the combined manifest. No additional application-source fixes were needed after merging the four repaired PRs.

Apollo uses an explicit HTTP link and its React entry point. Recharts uses the new content/payload types and guards unsupported formatter values without converting them to zero. The original locked/unlocked legend order and combined tooltip calculation are retained.

The routine group keeps devtools enabled, declares their existing router-core peer explicitly, migrates Biome's recommended preset, and enables its Tailwind parser. The placeholder-link lint exception is limited to the static design guide; application accessibility checks remain enabled. Most UI-file changes are mechanical export sorting and formatting.

## Reproduction and limits

Validated with Bun 1.3.11 and Node 22.23.1:

```sh
bun install --frozen-lockfile
bun run test
bun run build
bun run lint
git diff --check
```

jsdom 30.1.2 requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`. No new environment variables or endpoint changes are required. Existing large-bundle and outdated Browserslist-data build warnings remain.

Browser coverage includes the vault-list flow and selected yvUSD chart flows, not every vault, strategy, or external service. The existing Playwright example only renders static markup; the live-app checks above were run separately. No public deployment to `master` is part of this integration.

## Integrated heads

- #52: `b63b4cdbd2f8f84969b7af0ce1044244e2a60761`
- #53: `8000a04539d33c1bac239c02f9b8664f134ef973`
- #54: `be497c290705589b5e076344163415b38b60f2b3`
- #55: `426f21b8b4c4af59edd00182a8ad000aced85d5d`
- #56: `a9441930706df040597ec2bec88d060fe12fc912`

Combined application merge commit tested: `c1bc6ba0046e99718757e3970340cd00cc029bc2`. The following report update changes documentation only.

Machine-readable results and the original pre-fix run records are in `dependabot-review-2026-10-20-results.json`. Private preview addresses are kept out of the repository and GitHub.
