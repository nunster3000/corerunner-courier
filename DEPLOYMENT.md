# Public portfolio deployment on Vercel

The website and API are packaged for **one Vercel project**. Neon Postgres connects through Vercel Marketplace for durable demo storage. There is no separate Render service. This is a public, low-traffic portfolio demonstration, not the production backend for a courier operator. No real AI, email, payments or GPS are enabled by the hosted entrypoint.

## What is ready and what is unverified

Local tests cover anonymous workspace creation, browser isolation, cold-instance restoration, persisted scripted chat, binary evidence restoration, workspace recovery, conflicting writes and storage failures. The frontend production build passes. The Vercel deployment and Neon schema initialization are verified. This remains a simulated portfolio app, not a commercially ready operator installation.

## Connect and deploy

1. Import `nunster3000/corerunner-courier` into Vercel. Use the repository root, Vite framework, Node.js **22.x**, `npm run build`, and `dist`. The committed `vercel.json` routes `/api/*` to the Node function in `api/index.js`; `server/index.js` remains the local-only entrypoint.
2. In that project's Storage/Marketplace section, connect **Neon Postgres**. Review the provider's plan before provisioning. Use a separate database or branch for preview/testing and for the public portfolio deployment. This adapter uses the Neon HTTP driver, not a generic PostgreSQL TCP connection.
3. Add the server environment variables below. Keep them out of Git, chat, and all `VITE_` variables. `APP_ORIGIN` must match the exact deployed HTTPS origin, such as `https://your-project.vercel.app`, without a trailing slash. Do not allow wildcard preview origins. Preview deployments need their own matching origin and database configuration.
4. The hosted API automatically creates its namespaced demo, account and account-session tables and their indexes on first startup. Initialization is serialized across cold instances and only creates missing objects; it never imports local users, bookings or images. The connected database role needs permission to create these objects. `npm run setup:hosted` remains available for optional manual setup against the intended demo database.
5. Deploy/redeploy the Vercel project after setting the environment variables. Keep Vercel Deployment Protection enabled for previews. Production visitors open the public demo without a password. Registered users sign in with their own password; guest role simulations remain browser-scoped.
6. Verify the checklist below before sharing the URL with reviewers.

| Variable | Required value |
| --- | --- |
| `APP_MODE` | `portfolio`; other modes refuse hosted startup |
| `DATABASE_URL` | Server-only Neon connection string from the connected integration |
| `APP_ORIGIN` | Exact HTTPS origin for this deployment |
| `DEMO_SESSION_SECRET` | A random server secret at least 32 characters long; used to anonymize rate-limit keys and never shared with visitors |

Generate the server secret using a password manager. `DEMO_ACCESS_PASSWORD` is no longer used; any existing value can remain inert in Vercel. `COREY_MODE` and `OPENAI_API_KEY` are not used by this hosted entrypoint: it always selects mock mode and a null AI provider.

## Live verification checklist

- A fresh browser opens the homepage without an access prompt. Account creation persists an email, profile, password hash and account-owned delivery snapshot. Verify logout and fresh-browser login.
- Workspace cookies are HttpOnly, Secure and SameSite=Strict.
- Start a guided everyday booking, enter dispatch, assign a courier during an eligible Eastern-time shift, and complete a PIN/signature handoff. Reload between steps to verify durable state.
- Run the grocery readiness scenario and a small sample delivery-photo upload. Never use a real receipt, address or personal photo.
- Use a second browser profile to confirm its bookings, dispatch queue and courier work are empty and separate. A first browser's tracking link must not expose its data in the second browser.
- Verify Corey continues a scripted conversation after reload, with no model-provider calls.
- Simulate unavailable storage in a separate test deployment. No write should report success when persistence fails.
- Check Vercel function logs and Neon usage. Enable suitable platform request controls before wider sharing; the app's workspace-creation and request limits supplement platform protections.

## How demo storage works

Each visitor gets a cryptographically random, HttpOnly workspace cookie. Only its hash is used as a Postgres key. A request loads that visitor's bounded snapshot into a new **in-memory** SQLite database, executes the existing booking/dispatch rules, and conditionally saves the new snapshot to Postgres. No local SQLite file or process memory is the durable store. Scripted Corey state is saved alongside the tables so it survives function restarts. Local desktop data is never uploaded automatically.

The response, including identity cookies and proof bytes, is held until persistence completes. The database revision acts as a compare-and-swap guard: conflicting writes return 409 rather than overwriting a newer workspace. The user can refresh and retry. Existing booking idempotency keys still apply. Storage failures return a generic 503 without exposing connection details.

This snapshot adapter deliberately reuses the tested local business rules for a small portfolio workload. It reads and writes the bounded workspace as a unit; **it is not a scalable relational Postgres migration or a commercial operator database**. A buyer's production installation needs normalized hosted tables, durable customer/staff identity, private object storage, migrations/backups and operational integrations before real use.

Limits and retention:

- Workspace expiry: two hours. Reload after expiry to start fresh.
- Snapshot size: 2 MiB per browser workspace, including base64 evidence. Prefer tiny synthetic sample images. This is a capacity limit, not a payment tier.
- Requests: 120 per workspace per minute; at most 10 new workspaces per platform-supplied client IP per two-hour bucket. Limits are stored centrally, across function instances.
- Request body: 3 MiB including JSON/base64 overhead; choose photos under 2 MB. Accumulated evidence may reach the smaller workspace limit first.
- Expired snapshots are immediately inaccessible and are physically deleted when another workspace is created. Expired limit records are also cleaned then. This is not an exact-time deletion guarantee; provider backups have separate retention.
- Recipient links work only inside the originating demo browser. They are not real shareable delivery tracking links in hosted mode.
- All roles inside a workspace are simulated. There is no site-wide password; customer and staff identities are still simulations.

## References

- [Vercel Marketplace storage](https://vercel.com/docs/marketplace-storage)
- [Why a local SQLite file is not persistent storage on Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel function limits](https://vercel.com/docs/functions/limitations)
- [Neon serverless driver](https://github.com/neondatabase/serverless)

## Startup troubleshooting

A successful Vercel build does not confirm that the API has its environment settings. Check Production values for `APP_MODE`, `APP_ORIGIN`, `DEMO_SESSION_SECRET` and `DATABASE_URL`, then redeploy. Missing/invalid setting names appear in server logs without values. Storage initialization failures return a separate code and retry on later requests. The server secret remains required even though visitors do not enter a password.

## Registered accounts

`corerunner_accounts` stores persistent profiles, scrypt hashes, a server-owned role (customer on public signup), and account-owned booking snapshots with optimistic concurrency. The account retention sweep deletes accounts after their 48-hour lifetime, independently of two-hour guest workspace cleanup. `corerunner_account_sessions` stores hashed random tokens capped at the account’s 48-hour deadline. Login rate limits are stored in Neon. No new environment variables are needed; schema creation is additive on startup. Passwords are never included in chats or snapshots. Duplicate-email registration cannot overwrite an existing account.

Customer sessions cannot enter guest staff/courier roles or passwordless guest identities. Sign out to use the separate public guided demo. A shared admin dashboard and staff provisioning across persistent accounts are not implemented yet. Registered account snapshots are bounded to 8 MiB; use sample data. The homepage remains public.

Email ownership verification, password recovery, account deletion UI, shared recipient tracking, and commercial relational storage remain follow-up work. Previously expired guest identities cannot be recovered as password accounts; users must create a new account. Existing guest names do not establish ownership of an email.

## Post-signup demo verification

Persistent accounts default to `email_verified=false`, including accounts created before the inbox was restored. They can log in, request a demo email, read their session-bound inbox, verify, or sign out; protected booking and dashboard APIs return `EMAIL_VERIFICATION_REQUIRED` until completion. Signup data stays saved if verification is interrupted. No existing account or booking is deleted by this migration.

The inbox is explicitly simulated and requires the authenticated account session. Challenges expire after ten minutes, are replaced on resend, and are consumed atomically when verified. Neon retains only the challenge hash, session hash, nonce and expiry; the displayed token is derived server-side. Verification status persists across browsers and future logins. This demonstrates the workflow and does not prove actual mailbox ownership.

## Automatic account deletion

`expires_at` is fixed at `created_at + 48 hours` for Neon accounts, including previously created accounts. It is indexed and enforced by account/session lookups as well as cleanup. Account rows contain profile, credentials, verification and booking data; deleting the row also cascades to its sessions. Cleanup also removes expired guest workspaces and rate-limit rows. There is no restore feature in the app.

`vercel.json` schedules `/api/maintenance/cleanup` daily at 06:00 UTC, compatible with Hobby. The endpoint takes no deletion criteria, returns no personal data, and only runs the same expired-record sweep that API requests already run. No new secret is required. Account access ends at 48 hours; on an idle site, database deletion waits for the next scheduled daily run. This is not a guarantee of deletion at exactly hour 48, and does not control Neon backups/PITR. Verify the cron is registered in the Vercel dashboard after deployment.
