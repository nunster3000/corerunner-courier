# CoreRunner Courier

A local full-stack portfolio application for a fictional Atlanta courier service. React provides the customer and dispatch experiences; an Express API and SQLite own accounts, quotes, bookings, assignments, status events, and simulated payment records. Open this folder in VS Code. Agreed product requirements remain in [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md).

## Run in VS Code

Use Node.js 22.13 or newer. From the project terminal:

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
6. Follow the recipient tracking link in a private browser window. It works without an account and exposes only status, service, courier, and the event timeline. It grants no booking-management permission.
7. For an attended delivery, dispatch can advance to heading to delivery, record recipient unavailable, start a return, and document who received the return. The backend adds the previously disclosed demo return distance/time charge, without another pickup or expedited fee. There is no wait timer.

No successful-delivery bypass is provided: signature/PIN/photo proof and the dedicated courier interface are the next work. Grocery bookings remain pending and cannot be assigned until the readiness-review feature is implemented. The selected screenshot is not uploaded or accepted in this version.

## What is real and what is simulated

| Implemented with persistence | Simulation or unfinished integration |
| --- | --- |
| Accounts, expiring sessions, browser-bound single-use verification challenges | Email delivery and mailbox ownership verification are simulated |
| Quotes, 15-minute expiry, accepted snapshot, duplicate-request protection | Rates are illustrative fixtures, not approved commercial prices |
| Server validation of weight, service and date | City-name matching is a demo coverage check, not address validation |
| Staff-gated dispatch API, approved roster, one active job per courier | Demo staff entry grants a local role; no production staff authentication or shift planning |
| Pickup capture, return charge, ledger and event history | No real money movement, card processing, cancellation, or refunds yet |
| Recipient tracking tokens with expiration | No phone GPS, maps, ETA or automatic live updates yet |
| Customer-scoped notification history | Demo inbox includes sender and recipient copies; nothing is sent |

This application binds to loopback and refuses a production start. Demo authentication can impersonate any sample email, so **use sample data and do not expose this server publicly**. This is intentional for a local portfolio walkthrough; it is not an authentication system suitable for a deployed service. Public deployment requires a real email provider, stronger staff identity, token delivery, operational authorization, abuse controls, and a production hosting configuration.

Corey remains a scripted assistant. He collects information and transfers it to the booking form; no AI model is connected and he does not yet complete the entire booking inside chat.

## Illustrative pricing and dispatch behavior

The demo adapter uses $5 pickup, $1.25 per fixture mile, $0.20 per fixture minute, and an $8 expedited surcharge. It estimates distance from city centers with a multiplier and a 3-mile minimum; time is 2.5 minutes per fixture mile. These are explicit engineering fixtures to exercise quotes and receipts, not policy approval or measured driving routes. The displayed demo return price is locked to the accepted quote.

Demo city matching supports Atlanta, Decatur, Marietta, Alpharetta, Lawrenceville, and Peachtree City. Real polygons, geocoding, cutoff enforcement, capacity scheduling, vehicle constraints, dimensions, multiple packages, cold-item handling, and holiday hours remain open. Scheduled dates must not be in the past, but an offered window does not assert live availability. One active delivery per courier conservatively reserves return capacity; it is not optimized scheduling.

The implemented return branch models recipient unavailability only. Other failure reasons, company-caused returns, sender authorization after failure, and return exceptions require further work. Return recipient entry is a demo staff record, not a completed signature-verification integration. Never infer delivery from location or bypass proof requirements.

## Source layout

- `src/main.jsx`: homepage, guided booking, and Corey preview.
- `src/DeliveryHub.jsx`: customer history, dispatch board, recipient tracking.
- `src/api.js`: API requests and display formatting.
- `src/styles.css`: shared brand and responsive UI.
- `server/app.js`: authenticated API routes and transactional operations.
- `server/db.js`: SQLite schema and transactions.
- `server/domain.js`: validation and labeled sample routing/pricing.
- `server/index.js`: loopback-only entry point.
- `scripts/dev.mjs`: starts API and Vite together.
- `server/app.test.js`: isolation, validation, idempotency, payments, dispatch, persistence, and tracking access checks.
- `tests/preview.spec.js`: browser flows and responsive screenshots.

Technical references: [Node SQLite documentation](https://nodejs.org/api/sqlite.html) and [Express API](https://expressjs.com/en/5x/api/). The city scene is original SVG artwork; Lucide provides icons and Google Fonts supplies typography with local fallbacks.
