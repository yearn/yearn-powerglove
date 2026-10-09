# Stats API preview

The `codex/stats-page` Vite dev/preview proxy defaults to the personal Vercel API:

`https://yearn-data-api-preview-aqh9st2lq-rossgalloways-projects.vercel.app`

Active stats routes (TVL, fees, analytics, comparison, curation and audit tree)
use this target. `VITE_YEARN_DATA_API_TARGET` can override it for backend work.
The historical unused legacy graph/overlap/list routes retain their existing targets.

The Vercel API preview requires authentication. Supply
`YEARN_DATA_API_PROTECTION_BYPASS` in ignored `.env.local` on the preview server.
It deliberately has **no VITE_ prefix**: the proxy sends it upstream, and browser
requests remain same-origin. Never put this credential into client environment
variables or browser request headers. The proxy sends the credential only to
Vercel application hosts.

The existing stats preview service now targets Vercel rather than VM port 3493.
Its systemd drop-in sets the non-secret target; the secret is read from `.env.local`.
Restart the preview process after changing either value.

This configures local Vite dev/preview serving. A separately hosted Powerglove
build still needs its existing public API URL configuration and an accessible API,
or an equivalent server-side proxy for a protected preview. No Powerglove hosting
deployment or production environment was changed by this update.

Validation: production build and six API-routing tests passed. Browser checks of
TVL, expanded Vault breakdown, Fees, Curation Products and Comparison observed
84 successful API responses, all carrying Vercel response IDs, with no JavaScript
errors. The server-only access token was confirmed absent from built assets.
