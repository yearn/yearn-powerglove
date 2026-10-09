# Stats API preview

Core TVL, earnings, fees, analytics, comparison, curation, audit and TVL graph
requests use the same Powerglove origin. Hosted builds serve these read-only
routes through `api/yearn-data.ts`; local Vite builds use the equivalent proxy.
An explicit `VITE_PUBLIC_YEARN_DATA_API_URL` can select a public Yearn Data origin.
Supplementary legacy endpoints retain their separate API configuration.

The current upstream is:

`https://yearn-data-api-preview-5v92arw2b-rossgalloways-projects.vercel.app`

This API uses the read-only Neon role and the selected hosted publication. The
preview frontend has no database credentials. Verify `/api/publication` alongside
`/api/tvl/graph`: both must reference the same TVL dataset. The October 9 overlap
release selected dataset
`c09c5663cb62c7178b5d34764e764bcbb537e0ea98ecbf5b3adafece4e0e472c`.

## Hosted preview configuration

Configure `YEARN_DATA_API_URL` and `YEARN_DATA_API_PROTECTION_BYPASS` in the
Powerglove Vercel project's **Preview** environment. Neither name has a `VITE_`
prefix. Requests receive JSON only; the proxy never returns the credential or
follows upstream authentication redirects. Unsupported routes and write methods
are rejected. Dataset retirement responses retain their HTTP 410 status.

The Yearn project deploys PRs through `.github/workflows/vercel-deploy.yml` and
has no Vercel Git integration. Consequently its preview environment variables
are project-scoped, rather than branch-scoped. The new variables configure only
branches that implement this server proxy. Production environment variables are
separate and must be configured before merging this branch for production use.

Explicit rewrites map the supported API paths to the proxy and preserve their
filters. The SPA rewrite excludes `/api/`, allowing Vercel functions to handle
those requests. `git.deploymentEnabled=false` prevents duplicate native Git builds;
the existing GitHub Actions workflow still creates the PR preview.

Deployment protection remains enabled. Use a deployment-specific Vercel share
link for reviewers outside the team; never share the upstream automation token.

## Local previews

`VITE_YEARN_DATA_API_TARGET` overrides the Vite proxy target. Keep
`YEARN_DATA_API_PROTECTION_BYPASS` in ignored `.env.local` on the local server.
The token is forwarded only to Vercel application hosts. Restart the preview
process after changing either value.

Validate the production build, API-routing/proxy tests, and browser requests to
Stats and Strategies → TVL Flow. Inspect emitted browser assets to confirm the
server-only access token is absent.
