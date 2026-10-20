# Dependabot review — October 20, 2026

The five open Dependabot PRs were retargeted to `ross/dependabot-development`, created from the repository's default branch, `master` (there is no `main`). Each update was tested independently against `956689c7915c10557f55892006e7736680100da6`, without earlier dependency updates included. Per the requested acceptance policy, only passing updates were integrated; blocked updates remain open.

## Results

| Candidate | Frozen install | Unit tests | Production build | Lint | Decision |
| --- | --- | --- | --- | --- | --- |
| Baseline `956689c` | Pass | 212/212, 43 suites | Pass | 3 existing errors | Reference |
| [#52: GraphQL 17.0.2](https://github.com/yearn/yearn-powerglove/pull/52) | Pass | 212/212, 43 suites | Pass | Same 3 errors | Hold: outside Apollo Client 3's declared peer range |
| [#53: React DOM 19.3.0](https://github.com/yearn/yearn-powerglove/pull/53) | Pass | 22 failed suites; 112 tests passed | Pass | Same 3 errors | Hold: React 18 / React DOM 19 runtime mismatch |
| [#54: jsdom 30.1.2](https://github.com/yearn/yearn-powerglove/pull/54) | Pass | 212/212, 43 suites | Pass | Same 3 errors | Include |
| [#55: Recharts 3.10.1](https://github.com/yearn/yearn-powerglove/pull/55) | Pass | 211 passed, 1 failed | Fail: chart TypeScript errors | Same 3 errors | Hold: Recharts 3 migration required |
| [#56: 16 routine updates](https://github.com/yearn/yearn-powerglove/pull/56) | Pass | 212/212, 43 suites | Fail: TanStack devtools import | 39 errors, 1 warning | Hold: build and lint regressions |
| Final accepted set (jsdom only) | Pass | 212/212, 43 suites | Pass | Same 3 errors | Ready for review with baseline lint limitation |

Only one PR passes the acceptance criteria, so the final integration run contains jsdom alone; there is no interaction test between multiple accepted updates. No application dependencies or application source files changed. The dependency PR contains the original jsdom commit and its lockfile changes.

## Blocked findings

### #52 — GraphQL 17 is outside the supported Apollo peer range (P2)

The update installs GraphQL 17.0.2 while `@apollo/client` remains 3.13.5. That installed package declares `graphql: ^15.0.0 || ^16.0.0`, which excludes version 17. The test suite and production build pass, but do not establish support for this combination. Apollo Client 3.14.1 also excludes GraphQL 17; the current Apollo 4 release declares support but requires a separate migration.

- Location: [package.json:54](https://github.com/yearn/yearn-powerglove/blob/7c3bab66deaaeb00c1c42e950f7af85985f4fe5c/package.json#L54).
- Done when: the selected Apollo Client officially supports the installed GraphQL version and the application's query, cache, test, and build checks pass.
- Provenance: `7c3bab6`.

### #53 — React DOM cannot initialize with the installed React version (P1)

React DOM is bumped to 19.3.0 while React stays at 18.3.1. Importing `react-dom/client` throws `TypeError: Cannot read properties of undefined (reading 'S')`; 22 test suites fail during module loading. The production build succeeds, so a build-only gate misses the failure. React DOM 19.3.0 declares `react: ^19.3.0`.

- Location: [package.json:59](https://github.com/yearn/yearn-powerglove/blob/115fcb8f8d89c00de2dfb7431951c877d90bc172/package.json#L59).
- Done when: React and React DOM have matching supported versions, client initialization succeeds, and all 43 test suites pass.
- Provenance: `115fcb8`.
- Reference: [React's version mismatch requirement](https://react.dev/errors/527).

### #55 — Recharts 3 breaks chart compilation and one chart test (P1)

The build fails on removed tooltip `payload` and `label` props, changed legend payload types, readonly tooltip payloads, and stricter formatter arguments. Affected files include the shared chart wrapper, yvUSD TVL, PPS, TVL, and strategy allocation charts. The stacked yvUSD TVL test also fails at `src/__tests__/charts.test.tsx:474` because the expected unlocked bar element is absent in the test render. This test failure alone does not establish how the chart renders in a real browser; the compilation failures independently block the update.

- Location: [package.json:62](https://github.com/yearn/yearn-powerglove/blob/315a5831e1332987e111d950886807c2dbc32af9/package.json#L62).
- Done when: the existing charts compile with the selected Recharts version, the test suite passes with equivalent bar/tooltip coverage, and chart interactions are verified in a browser.
- Provenance: `315a583`.

### #56 — Routine group cannot produce a production bundle (P1)

The new locked TanStack devtools package imports `getRouteSegments` from `@tanstack/router-core`, whose installed entry point does not export it. Rollup fails after TypeScript succeeds. The root route imports the devtools, so this blocks the production bundle even though the unit tests pass.

- Location: [package.json:74](https://github.com/yearn/yearn-powerglove/blob/19ee0f425d711cb36abdb105c4226dcad8c88d99/package.json#L74), plus the PR's `bun.lock`.
- Done when: the locked TanStack packages are compatible and `bun run build` completes.
- Provenance: `19ee0f4`.

### #56 — Biome upgrade introduces additional lint failures (P2)

Biome 2.5.15 reports 39 errors and one warning, compared with the baseline's three formatting errors. Findings include CSS parsing errors for Tailwind directives and additional checks on existing files. The configuration also produces a deprecation notice. The routine PR therefore cannot be described as passing lint relative to the baseline.

- Location: [package.json:72](https://github.com/yearn/yearn-powerglove/blob/19ee0f425d711cb36abdb105c4226dcad8c88d99/package.json#L72).
- Done when: the intended Biome configuration handles the repository's Tailwind syntax and the upgrade introduces no lint failures relative to the baseline.
- Provenance: `19ee0f4`.

## Validation and reproduction

Environment: Bun 1.3.11 and Node 22.23.1. jsdom 30.1.2 requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`; this environment satisfies the requirement. Other developer/CI Node versions must satisfy that requirement too.

For each PR, start with the baseline above and apply only the recorded PR head, then run:

```sh
bun install --frozen-lockfile
bun run test
bun run build
bun run lint
node -e "require('react-dom/client')"
```

A separate final runtime smoke check confirms matching React/React DOM versions, Apollo query execution through an in-memory link, normalized cache reads, and cache reuse without a second network request.

The existing lint failures are formatting errors in:

- `api/yvusd/aprs.ts`
- `src/components/reallocation-panel/ReallocationChart.tsx`
- `src/components/vault-events/VaultEventRow.tsx`

They are unchanged by the accepted update. The final lint result is a failure with the same three diagnostics, not a clean pass. Existing large-chunk and outdated Browserslist-data build warnings also remain.

The existing Playwright example only renders static markup, so it is not evidence that the app works. A separate live-app desktop/mobile smoke check is recorded below.

## Tested heads

- #52: `7c3bab66deaaeb00c1c42e950f7af85985f4fe5c`
- #53: `115fcb8f8d89c00de2dfb7431951c877d90bc172`
- #54: `be497c290705589b5e076344163415b38b60f2b3`
- #55: `315a5831e1332987e111d950886807c2dbc32af9`
- #56: `19ee0f425d711cb36abdb105c4226dcad8c88d99`

Machine-readable exit statuses are in `dependabot-review-2026-10-20-results.json`; exit status 0 means success.

## Live-app preview verification

- Production preview served successfully locally, with the configured host header, and through private HTTPS (HTTP 200). Preview URLs are intentionally kept out of the repository and GitHub.
- The same-origin `/api/yvusd/aprs` proxy returned HTTP 200 and a JSON object containing both vault entries.
- Chromium checks passed at 1440×1000 and 390×844 with live vault data. Search input worked on both layouts; the mobile filter dialog opened and closed.
- Both checks rendered vault links and recorded zero uncaught page errors, failed requests, or HTTP responses at or above 400 during the check. Screenshots were visually inspected. This covers the vault-list flow, not every vault detail screen.
