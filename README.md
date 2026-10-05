# CoreRunner Courier

A local full-stack portfolio application for a fictional Atlanta courier service. React provides customer, dispatch, and courier experiences; an Express API and SQLite own accounts, quotes, bookings, assignments, handoff proof, status events, and simulated payment records. Open this folder in VS Code. Agreed product requirements remain in [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md).

## Vercel portfolio deployment

A public hosted-demo entrypoint and visitor-isolated storage adapter are now prepared. The frontend and API run in one Vercel project, with Neon connected through Vercel Marketplace. Visitors enter without a password and receive separate temporary workspaces. See [DEPLOYMENT.md](DEPLOYMENT.md) for configuration, limits, the demo snapshot architecture and required live verification. Vercel deployment and hosted schema initialization have been verified. The local workflow below is unchanged.

## Operator handoff direction

The intended deliverable is a reusable application for **one courier company at a time**, with a polished mock mode for demonstrations and optional real service integrations supplied by a future owner. Today this is a runnable local portfolio demo, not a production-ready plug-and-play courier business. A buyer can run the demo without AI, maps, email or payment credentials. The local database initializes automatically on startup.

Before a commercial launch, complete the remaining operational configuration and production customer/staff/courier identity, hosted database and private image storage, deployment settings, and the buyer’s chosen email, payment and routing/tracking adapters. Finish operational exception/refund workflows and validate the operator’s policies. Multi-company tenancy is outside this single-operator architecture. The hosted entrypoint supports only isolated portfolio workspaces. A real operator deployment must disable demo-role entry and generated scenarios; the local server still deliberately refuses production startup.

From a clean, committed Git checkout, `npm run package:handoff` exports `artifacts/CoreRunner-source.zip`. It includes committed source, tests, setup instructions and `.env.example`, with a `corerunner-courier/` root folder. It excludes ignored local credentials, databases, proof uploads, installed dependencies, build output and Git history. A guard rejects tracked local-data/credential-file paths; this is not a substitute for reviewing source before release. Unzip, install Node.js 22.x (22.13 or newer within that release line), run `npm ci`, then `npm run dev` to try the demo. A source archive is not a hosted deployment or an operating-service license.

## Configure a courier company

Edit **`config/operator.json`** in VS Code, save, and restart `npm run dev`. This file ships in the source handoff package. There is no settings dashboard or public settings-write endpoint. Keep credentials out of this file: it contains public business configuration and is committed to Git.

| Setting | What changes |
| --- | --- |
| `brand.name`, `shortName`, `descriptor` | Full company name, logo text, page title, demo overview and booking notifications |
| `brand.primaryColor`, `accentColor` | Main buttons, coverage panel, logo/van accents, focus indicators and browser theme; use six-digit hex colors |
| `coverage.headline`, `primaryCity` | Homepage service-region text and main city; the main city must be listed in zones |
| `coverage.zones` | Arrays of city name, latitude and longitude; controls displayed coverage, backend address eligibility and Corey's coverage reply |
| `pricing.version` | Rate label saved with each new quote; change it whenever rates change |
| `pricing.baseCents`, `perMileCents`, `perMinuteCents`, `expeditedCents` | Backend quote calculation in USD cents; for example `700` means $7.00 |

Invalid names, duplicate zones, coordinates, colors or negative/fractional rates stop backend startup with an `Invalid operator settings` error. `/api/operator` returns only allowlisted public settings; the website waits for that response before showing booking controls. Test your chosen palette for readable contrast, including white button text. Supporting illustration colors and neutral/status colors retain their existing design.

New quotes use the new rates. Existing quotes retain their saved price until their normal 15-minute expiry, and existing bookings retain their accepted price and return charge. Coverage changes are rechecked at booking confirmation; avoid removing cities with active deliveries, since simulated routing still needs their coordinates. Configure a new buyer's company with a fresh database instead of reusing another operator's records.

Coverage still uses city-name matching and approximate city-center fixtures, not real address validation or road routing. Guided scenarios use the primary city and first other configured zone; choose nearby demo cities so routes fit a shift. The 50 lb limit, package categories, handoff/return/cancellation policies, USD currency, America/New_York timezone and delivery windows remain fixed. Courier shift dates/hours use the existing dispatch planner. Corey remains the agent's name and runs in mock mode. Broader policy, timezone, roster and agent-name customization is future work; this configuration is one step toward a reusable operator installation.

## Guided portfolio walkthrough

Open **Explore the guided demo** on the homepage, **Guided demo** in the footer, or `/?demo=1`. Choose an everyday delivery, grocery review, or failed-handoff return scenario. Starting a scenario uses your signed-in demo account or creates a sample account through the existing simulated verification flow. It creates a sample quote and booking through the same backend rules; it does not auto-assign a courier, bypass proof, or make real payments.

A guide above the workspace suggests the next role and action using the current backend status. Tracking opens separately. Scenario creation is retry-safe, and existing scenarios can be resumed from the overview. Current Eastern-time shift hours and roster availability still apply; outside operating hours, samples can be created and inspected but assignment may wait for an eligible shift. Corey remains scripted.

Reset requires an explicit checkbox and removes only backend-tagged scenario bookings for the **current account and browser cookie**. It removes their linked quotes, payments, events, notifications, proof images, grocery evidence and tracking links, releasing any associated courier reservation. It preserves ordinary bookings (including ordinary bookings on the same account), other browsers’ scenarios, accounts, shifts and other local work. Scenario deletion is for walkthrough data only; it is never the business cancellation flow. All scenario/reset endpoints require demo mode; hosted access adds a private workspace boundary. Hosted portfolio workspaces add a separate visitor boundary; see DEPLOYMENT.md.

## Run in VS Code

Use Node.js 22.x (22.13 or newer within that release line). From the project terminal:

```sh
npm install
npm run dev
```

This starts the API at `http://127.0.0.1:3001` and Vite at `http://127.0.0.1:5173`. Vite proxies `/api` so session cookies work on the same origin. Both processes stop when you press Ctrl+C. React edits hot-reload; restart this command after changing backend code. The VS Code tasks use the same commands.

```sh
npm run build        # build React
npm run preview      # view build; run npm run api in another terminal
npm run test:server  # isolated backend checks
npm test             # browser tests on isolated ports and an in-memory database
npm run format       # format project source
```

SQLite is built into Node and is still marked experimental in Node 22. The database is `data/corerunner.sqlite`, with possible WAL sidecar files. This directory is ignored by Git; do not delete it if you want to preserve demo accounts and deliveries. Shut down the API before making a file backup. `DB_PATH` and `API_PORT` are configurable environment variables. No hosted database, Twilio, email credentials, or payment keys are needed.

Browser tests use installed Google Chrome on macOS when available, otherwise Playwright Chromium. Run `npx playwright install chromium` if needed. `CHROME_PATH` supports another installed Chrome executable. Tests build the frontend and run it without hot reload on ports 5175/3005, with an in-memory API database. They do not touch your working database.

## Try the complete implemented flow

1. Choose Book a delivery. Enter sample account details and a pickup address naming a supported demo city. Open Demo inbox and simulate verification. Registration and returning sign-in both establish a server session.
2. Enter a destination and recipient email. For this version, one package and one destination are supported. Pick a weight up to 50 pounds, handoff preference, and service.
3. Review the server-generated demo quote, original total, and possible return fee. Accept the quote and policy, then confirm the demo booking. You can also simulate a declined authorization; no booking or payment event is created on decline.
4. Open My deliveries to see your saved booking and simulated email inbox. Refresh the browser; the session and records remain available.
5. Open Demo dispatch in the footer and explicitly enter the local demo staff role. Assign an available sample courier. Move to heading to pickup, then picked up; pickup captures the simulated original charge once.
6. Follow the recipient tracking link in a private browser window. It works without an account and exposes status, service, courier, event timestamps, and a simulated route using city labels. It grants no booking-management permission.
7. Open Demo courier in the footer and choose the assigned courier. Advance through pickup and the delivery route. Only that courier can access and complete the assigned job.
8. Choose Record delivery proof. For an attended delivery, enter the recipient PIN from the simulated inbox under My deliveries, or have the receiving person enter their name, draw a signature, and confirm receipt. The courier does not receive the PIN through their API.
9. For an authorized unattended delivery, select a sample photo and confirm the package is at a suitable drop-off location. The server rejects completion without sender consent and valid image evidence. Photos are normalized to WebP and stored privately in SQLite; they are not served from the public directory.
10. If nobody answers for an attended delivery, choose No one answered. A same-day return is scheduled immediately, with no waiting period. The courier can optionally choose Ask sender. In My deliveries, the sender explicitly authorizes unattended delivery; the courier refreshes and can then complete with a photo, without a return fee.
11. Alternatively, choose Start return now. That closes the sender authorization window. At the sender's address, Record return handoff captures the receiving person's name, signature, and receipt consent. The backend records the disclosed return distance/time charge once, without another pickup or expedited fee. Completion releases the courier for a new assignment.

There is no generic completion bypass in dispatch. Delivered and returned statuses require evidence from the assigned courier. Grocery bookings remain pending until a dispatcher reviews current store confirmation. In My deliveries, upload a screenshot or load a fictional ready/preparing sample. Demo dispatch displays the stored image and requires explicit checks for ready status, prepayment, pickup date, and matching store/order. Preparing or unclear evidence should be rejected with a reason; the sender can replace it. This is human review, not AI scanning or direct store verification.

## What is real and what is simulated

| Implemented with persistence | Simulation or unfinished integration |
| --- | --- |
| Accounts, expiring sessions, browser-bound single-use verification challenges | Email delivery and mailbox ownership verification are simulated |
| Quotes, 15-minute expiry, accepted snapshot, duplicate-request protection | Rates are illustrative fixtures, not approved commercial prices |
| Server validation of weight, service and date | City-name matching is a demo coverage check, not address validation |
| Staff-gated dispatch API, courier-scoped sessions, approved roster, one active job per courier | Demo role entry grants local access; no production staff authentication; shifts use the sample roster |
| PIN verification, captured signatures, normalized delivery photos and proof history | The app records evidence; it does not independently establish signer identity or confirm photo contents |
| Sender-only unattended authorization, immediate return scheduling, signed returns | No outgoing contact is sent; after-hours exceptions and other failure causes remain unfinished |
| Pickup capture, return charge, ledger and event history | Cancellation previews, fee capture and authorization release are simulated; no real money movement or original-charge refunds |
| Recipient tracking tokens, simulated route positions, automatic polling and stale-update labels | No phone GPS, geographic street maps or arrival estimates |
| Grocery screenshot uploads, staff approval/rejection, resubmission and current-date assignment checks | Human review only; no OCR or store integration |
| Customer-scoped notification history | Demo inbox includes sender and recipient copies; nothing is sent |

The local entrypoint binds to loopback and refuses a production start. Demo authentication can impersonate any sample email, so **use sample data and do not expose this server publicly**. This is intentional for a local portfolio walkthrough; it is not an authentication system suitable for a deployed service. Real business deployment requires a real email provider, stronger staff identity, token delivery, operational authorization, abuse controls, and production hosting. The separate public portfolio entrypoint isolates simulated roles inside temporary visitor workspaces.

## Corey: scripted portfolio demo

Corey runs locally in **mock mode by default**. No API key, AI account, external model requests, or AI charges are needed. Say `start` for guided booking, `help` for supported commands, or `groceries`, `returns`, `coverage`, or `status` for scripted support. Answer one prompt at a time. Correct details using `weight: 12`, `service: Expedited`, or another displayed field name followed by a colon. This is a scripted assistant, not natural-language AI.

The chat uses the real local backend for demo account verification, validated quotes, explicit customer confirmation, booking persistence, and account-scoped delivery statuses. Unattended consent remains an unchecked customer checkbox. Email, payments, routes and courier operations remain simulated. Both the form and chat remain available.

An optional server-only OpenAI Responses adapter is retained for a future owner. It is **disabled unless `COREY_MODE=live` is explicitly set**; an API key alone cannot enable it. A future owner would provide their own `OPENAI_API_KEY` and optional `OPENAI_MODEL` in ignored server configuration, restart the server, and validate the integration. The example configuration uses `COREY_MODE=mock`. Do not use a `VITE_` prefix for credentials. No live model call has been verified for this portfolio project.

In live mode, chat data is sent to OpenAI with `store: false` (not a claim of zero provider retention). The integration retains server-owned quote validation and customer confirmation. Sessions expire after one hour and use an HttpOnly cookie. Limits include 2,000 characters per message, 40 turns per conversation, 20 turns per minute across the server, and four model calls per live turn. Tests use local scripted behavior and injected AI fixtures; they do not spend API credits.

Grocery image analysis, actual support-case submission, chat cancellation tools and original-charge refunds remain future work. Public deployment still requires the identity and hosting changes described above.

## Illustrative pricing and dispatch behavior

The demo adapter uses $5 pickup, $1.25 per fixture mile, $0.20 per fixture minute, and an $8 expedited surcharge. It estimates distance from city centers with a multiplier and a 3-mile minimum; time is 2.5 minutes per fixture mile. These are explicit engineering fixtures to exercise quotes and receipts, not policy approval or measured driving routes. The displayed demo return price is locked to the accepted quote.

Pickup and delivery fields, including Corey’s address prompts, offer keyboard-accessible demo city completions. They preserve the typed street and format supported city/state text; they do not search or verify real street locations. Service selection shows backend estimates for Same-day, Expedited, and Scheduled before the final quote. Scheduled capacity is still checked separately. Replace `server/addresses.js` with a geocoding adapter for real address predictions.

Demo city matching supports Atlanta, Decatur, Marietta, Alpharetta, Lawrenceville, and Peachtree City. Real polygons, geocoding, vehicle constraints, dimensions, multiple packages, cold-item handling, holiday hours, and optimized routing remain open. Scheduled capacity uses the sample roster and fixture travel times. It is not real-world availability or a measured ETA. One active delivery per courier preserves custody and return capacity.

The return branch models recipient unavailability, sender cancellation after pickup, and staff-recorded company failures. Company failures can enter a custody/return hold with the courier assignment reserved. After-hours exceptions, reassignment, and unavailable senders still require further work. A same-day due date is recorded in Atlanta time, but this is not an automated feasibility or scheduling guarantee. The initial return-proof implementation uses a captured signature; unattended returns and alternative return-PIN policies are not yet implemented.

## Delivery windows and courier shifts

Scheduled quotes check available sample couriers but do not hold a slot. Confirmation transactionally reserves one courier for the entire selected window. The planning allowance is the fixture outbound travel time plus 15 minutes handling, then the same travel time plus 15 minutes for a possible return. A route that cannot fit that allowance is rejected. Confirmation rechecks capacity so simultaneous bookings cannot oversell a slot; cancelled or completed bookings release their reservation. Same-day and expedited bookings enter the unreserved dispatch queue, not a guaranteed time slot.

Demo dispatch has a dated schedule board with shift editing. Defaults are 8 a.m.–8 p.m. Eastern for all three sample couriers. Existing scheduled reservations and active jobs prevent conflicting shift changes. Staff can assign a scheduled job only on its delivery date; pickup cannot begin before the reserved window. Assignment and pickup reject windows with insufficient remaining time. Assigning a different available courier updates the reservation. Grocery readiness approval remains a separate requirement.

Same-day/expedited assignment requires the round-trip allowance to fit the courier’s current shift and avoid scheduled reservations. Active trips prevent another simultaneous assignment; unresolved return/exception jobs conservatively block additional capacity until resolved. This is a simple capacity planner, not dispatch optimization or a real traffic model. No automatic rebooking or missed-window recovery is implemented: dispatch must review these cases. Pre-existing scheduled records without a reservation are rechecked when assigned.

All schedule dates/times use America/New_York, including daylight-saving changes. Automated API tests inject a clock; browser test servers use 16:00 UTC on the current Atlanta date via TEST_PREVIEW for repeatable daytime assignments. Normal local development uses the actual clock.

## Cancellation and company exceptions

My deliveries offers a backend cancellation preview and an explicit confirmation checkbox. Before pickup, cancellation releases the authorization in full unless the courier is heading to pickup at or within two simulated miles; then only the base pickup fee is captured and the balance released. The sample pickup route starts at five miles. Its remaining distance is a fixture derived from server-owned progress, not real driving distance. Paused, missing or stale tracking blocks fee calculation until refreshed or reviewed. No guessed charge is applied.

Previews expire after two minutes and are bound to the booking state and tracking sequence. A changed state requires a fresh preview. Confirmation is transactional and retry-safe. Cancellation after pickup schedules a return on the same courier, retains the original charge and applies the disclosed return distance/time fee only at signed return. It closes unattended-delivery authorization and cannot be converted back into a delivery by a courier.

Demo dispatch can record a CoreRunner-caused failure with a reason and explicit confirmation. Before pickup, it cancels without a fee and releases the full authorization. After pickup, the return fee is waived. If immediate return is not feasible, an exception hold preserves the courier assignment; staff must confirm custody and return capability to arrange recovery. All returns still require a signed handoff. Original captured charges are marked **refund review required**; this does not issue a refund or imply a settled refund policy. Reassignment, losses, damage claims, and original-charge refund decisions remain future work.

## Simulated tracking

In Demo courier, start a pickup, delivery or return route, then choose **Advance demo location**. Each click advances the current illustrative route by 20%. Pause/resume controls demonstrate interrupted tracking. Positions and sequence numbers are persisted in the booking; clients cannot submit coordinates, arbitrary percentages, or timestamps. Only the assigned courier can operate these controls. Concurrent or repeated updates with an old sequence are rejected.

Recipient tracking refreshes every five seconds while visible and supports manual refresh. It shows an original schematic route, city labels, percentage, last server update, and paused/stale status. Positions become stale after 60 seconds without an update. A failed refresh keeps the last result with a connection warning; an expired tracking link clears the result. Completed deliveries/returns hide the courier marker. Route movement never changes custody, captures payments, or completes a handoff; those still require the normal actions and proof. No GPS permission, maps account, API key, or external tracking service is used.

## Grocery readiness

Evidence is stored as normalized WebP in SQLite and accessible only to the booking sender or a demo dispatcher. Uploads use the existing 4 MB image validation, metadata stripping, and 24-megapixel limit. Original filenames are not served. A booking allows up to ten uploads; idempotency keys prevent retry duplicates. Replacements invalidate previous approval. Review actions must reference the latest evidence, and completed reviews cannot be silently reversed.

Approval requires evidence dated today in Atlanta. Scheduled grocery deliveries can be approved and assigned only on their scheduled delivery date in this initial flow. Assignment rechecks evidence date and courier capacity, including the existing return reservation. Approval is separate from scheduling; assignment rechecks the scheduled date, shift and remaining fixture travel/return time. It does not guarantee real-world route feasibility. No grocery evidence can be replaced after courier assignment. Expired assigned orders and other operational exceptions still need a future staff exception flow.

## Proof and authorization rules

- New bookings receive a random six-digit PIN in a recipient-addressed simulated email. My deliveries includes recipient copies solely for the local demo walkthrough. PIN hashes are stored separately from bookings; neither tracking links nor courier listings expose them. Five incorrect attempts block PIN retries for five minutes. A captured signature remains available.
- Successful delivery or return consumes the PIN and records a single proof. Repeating the same submission does not duplicate proof, notifications, or charges.
- Signatures contain the receiving person's name, explicit receipt consent, and normalized drawing points. Presence validation rejects empty marks; it is not biometric or legal identity verification.
- Delivery photos must decode as JPEG, PNG, or WebP, fit within 4 MB and 24 million pixels, and contain a single frame. The server normalizes them, removes metadata including GPS, and restricts retrieval to the sender, assigned courier, or dispatch session. Recipient tracking tokens cannot retrieve evidence.
- Only the sender account can authorize unattended delivery. Authorization remains open before the return starts. A courier may start a return immediately; if that happens before authorization or photo submission finishes, the backend rejects the conflicting action. Authorization alone does not mark anything delivered.
- The courier must refresh the workspace to see new sender instructions. Recipient tracking polls every five seconds while visible; phone GPS remains future work.
- All evidence is stored in the ignored local database. The existing database gains new tables without removing prior records. Existing already-assigned bookings without a PIN can use a signature; new assignments provision a PIN if needed.

## Source layout

- `src/main.jsx`: homepage and guided booking.
- `src/CoreyChat.jsx`: conversational registration, quote review and booking.
- `server/corey.js`: server-only Responses adapter, session limits and validated tool execution.
- `src/DeliveryHub.jsx`: customer history, dispatch board, recipient tracking.
- `src/CourierWorkspace.jsx`: assigned jobs, handoff capture, failed attempts and returns.
- `src/ProofCapture.jsx`: PIN, signature, photo input and authenticated proof history.
- `src/api.js`: API requests and display formatting.
- `src/styles.css`: shared brand and responsive UI.
- `server/app.js`: authenticated API routes and transactional operations.
- `server/db.js`: SQLite schema and transactions.
- `server/domain.js`: validation and labeled sample routing/pricing.
- `server/proof.js`: signature validation and photo decoding/normalization.
- `server/index.js`: loopback-only entry point.
- `scripts/dev.mjs`: starts API and Vite together.
- `server/app.test.js`: isolation, validation, idempotency, payments, dispatch, persistence, and tracking access checks.
- `tests/preview.spec.js`: booking, dispatch and responsive checks.
- `tests/handoff.spec.js`: complete PIN and photo deliveries, sender consent, and signed returns in a browser.
- `tests/fixtures/delivery.png`: a synthetic solid-color image used only as an upload test fixture.

Technical references: [Node SQLite documentation](https://nodejs.org/api/sqlite.html) and [Express API](https://expressjs.com/en/5x/api/). The city scene is original SVG artwork; Lucide provides icons and Google Fonts supplies typography with local fallbacks.

## Hosting direction

The prepared portfolio destination is Vercel with Neon-backed, bounded demo snapshots. Live deployment still needs account setup and verification described in DEPLOYMENT.md. Commercial database/image storage and identity remain separate work. The public GitHub repository contains source and synthetic test fixtures, never local proof uploads or account records.
