# Protected portfolio deployment on Vercel

The website and API are packaged for **one Vercel project**. Neon Postgres connects through Vercel Marketplace for durable demo storage. There is no separate Render service. This is a protected, low-traffic portfolio demonstration, not the production backend for a courier operator. No real AI, email, payments or GPS are enabled by the hosted entrypoint.

## What is ready and what is unverified

Local tests cover the hosted request handler with an injected store, browser isolation, cold-instance restoration, persisted scripted chat, binary evidence restoration, access expiry, conflicting writes and storage failures. The frontend production build passes. **A live Neon connection, Vercel build/routing and deployed end-to-end flow still need verification after account setup.** Do not present these as already deployed or commercially ready.

## Connect and deploy

1. Import `nunster3000/corerunner-courier` into Vercel. Use the repository root, Vite framework, Node.js **22.x**, `npm run build`, and `dist`. The committed `vercel.json` routes `/api/*` to the Node function in `api/index.js`; `server/index.js` remains the local-only entrypoint.
2. In that project's Storage/Marketplace section, connect **Neon Postgres**. Review the provider's plan before provisioning. Use a separate database or branch for preview/testing and for the public portfolio deployment. This adapter uses the Neon HTTP driver, not a generic PostgreSQL TCP connection.
3. Add the server environment variables below. Keep them out of Git, chat, and all `VITE_` variables. `APP_ORIGIN` must match the exact deployed HTTPS origin, such as `https://your-project.vercel.app`, without a trailing slash. Do not allow wildcard preview origins. Preview deployments need their own matching origin and database configuration.
4. The hosted API automatically creates its two namespaced demo tables and expiry index on first startup. Initialization is serialized across cold instances and only creates missing objects; it never imports local users, bookings or images. The connected database role needs permission to create these objects. `npm run setup:hosted` remains available for optional manual setup against the intended demo database.
5. Deploy/redeploy the Vercel project after setting the environment variables. Keep Vercel Deployment Protection enabled for previews. The app also requires a demo access password before exposing any demo account or role tools.
6. Verify the checklist below before sharing the URL and access password with reviewers.

| Variable | Required value |
| --- | --- |
| `APP_MODE` | `portfolio`; other modes refuse hosted startup |
| `DATABASE_URL` | Server-only Neon connection string from the connected integration |
| `APP_ORIGIN` | Exact HTTPS origin for this deployment |
| `DEMO_ACCESS_PASSWORD` | A random password at least 16 characters long, shared only with invited demo reviewers |
| `DEMO_SESSION_SECRET` | A separate random signing secret at least 32 characters long; never share with reviewers |

Generate the password and signing secret separately with a password manager. Do not reuse an account password. Rotating the signing secret invalidates existing access cookies. `COREY_MODE` and `OPENAI_API_KEY` are not used by this hosted entrypoint: it always selects mock mode and a null AI provider.

## Live verification checklist

- Without the access password, the site shows the access screen and account/dispatch/tracking API requests return 401.
- The correct password opens the configured company homepage. All cookies are HttpOnly, Secure and SameSite=Strict.
- Start a guided everyday booking, enter dispatch, assign a courier during an eligible Eastern-time shift, and complete a PIN/signature handoff. Reload between steps to verify durable state.
- Run the grocery readiness scenario and a small sample delivery-photo upload. Never use a real receipt, address or personal photo.
- Use a second browser profile to confirm its bookings, dispatch queue and courier work are empty and separate. A first browser's tracking link must not expose its data in the second browser.
- Verify Corey continues a scripted conversation after reload, with no model-provider calls.
- Simulate unavailable storage in a separate test deployment. No write should report success when persistence fails.
- Check Vercel function logs and Neon usage. Enable suitable platform request controls before wider sharing; the app's password-attempt and per-workspace limits supplement platform protections.

## How demo storage works

Each authenticated visitor gets a cryptographically random, HttpOnly workspace cookie. Only its hash is used as a Postgres key. A request loads that visitor's bounded snapshot into a new **in-memory** SQLite database, executes the existing booking/dispatch rules, and conditionally saves the new snapshot to Postgres. No local SQLite file or process memory is the durable store. Scripted Corey state is saved alongside the tables so it survives function restarts. Local desktop data is never uploaded automatically.

The response, including identity cookies and proof bytes, is held until persistence completes. The database revision acts as a compare-and-swap guard: conflicting writes return 409 rather than overwriting a newer workspace. The user can refresh and retry. Existing booking idempotency keys still apply. Storage failures return a generic 503 without exposing connection details.

This snapshot adapter deliberately reuses the tested local business rules for a small portfolio workload. It reads and writes the bounded workspace as a unit; **it is not a scalable relational Postgres migration or a commercial operator database**. A buyer's production installation needs normalized hosted tables, durable customer/staff identity, private object storage, migrations/backups and operational integrations before real use.

Limits and retention:

- Access and workspace expiry: two hours. Reload after expiry and re-enter the demo password to start fresh.
- Snapshot size: 2 MiB per browser workspace, including base64 evidence. Prefer tiny synthetic sample images. This is a capacity limit, not a payment tier.
- Requests: 120 per workspace per minute; at most 10 new workspaces per platform-supplied client IP per two-hour bucket. Access-password attempts: 10 per platform-supplied client IP per 15-minute bucket. Limits are stored centrally, across function instances.
- Request body: 3 MiB including JSON/base64 overhead; choose photos under 2 MB. Accumulated evidence may reach the smaller workspace limit first.
- Expired snapshots are immediately inaccessible and are physically deleted when another workspace is created. Expired limit records are also cleaned then. This is not an exact-time deletion guarantee; provider backups have separate retention.
- Recipient links work only inside the originating demo browser. They are not real shareable delivery tracking links in hosted mode.
- All roles inside a workspace are simulated. The shared access password is a portfolio gate, not customer/staff authentication.

## References

- [Vercel Marketplace storage](https://vercel.com/docs/marketplace-storage)
- [Why a local SQLite file is not persistent storage on Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel function limits](https://vercel.com/docs/functions/limitations)
- [Neon serverless driver](https://github.com/neondatabase/serverless)

## Startup troubleshooting

A successful Vercel build does not confirm that the API has its environment settings. Check Production values for `APP_MODE`, `APP_ORIGIN`, `DEMO_ACCESS_PASSWORD`, `DEMO_SESSION_SECRET` and `DATABASE_URL`, then redeploy. Missing/invalid setting names appear in server logs without values. Storage initialization failures return a separate code and retry on later requests. Do not disable the access gate to work around missing secrets.
