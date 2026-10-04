# CoreRunner Courier

A local full-stack portfolio application for a fictional Atlanta courier service. React provides customer, dispatch, and courier experiences; an Express API and SQLite own accounts, quotes, bookings, assignments, handoff proof, status events, and simulated payment records. Open this folder in VS Code. Agreed product requirements remain in [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md).

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
7. Open Demo courier in the footer and choose the assigned courier. Advance through pickup and the delivery route. Only that courier can access and complete the assigned job.
8. Choose Record delivery proof. For an attended delivery, enter the recipient PIN from the simulated inbox under My deliveries, or have the receiving person enter their name, draw a signature, and confirm receipt. The courier does not receive the PIN through their API.
9. For an authorized unattended delivery, select a sample photo and confirm the package is at a suitable drop-off location. The server rejects completion without sender consent and valid image evidence. Photos are normalized to WebP and stored privately in SQLite; they are not served from the public directory.
10. If nobody answers for an attended delivery, choose No one answered. A same-day return is scheduled immediately, with no waiting period. The courier can optionally choose Ask sender. In My deliveries, the sender explicitly authorizes unattended delivery; the courier refreshes and can then complete with a photo, without a return fee.
11. Alternatively, choose Start return now. That closes the sender authorization window. At the sender's address, Record return handoff captures the receiving person's name, signature, and receipt consent. The backend records the disclosed return distance/time charge once, without another pickup or expedited fee. Completion releases the courier for a new assignment.

There is no generic completion bypass in dispatch. Delivered and returned statuses require evidence from the assigned courier. Grocery bookings remain pending and cannot be assigned until the readiness-review feature is implemented. Grocery screenshot selection is still a local placeholder, separate from the implemented delivery-photo upload.

## What is real and what is simulated

| Implemented with persistence | Simulation or unfinished integration |
| --- | --- |
| Accounts, expiring sessions, browser-bound single-use verification challenges | Email delivery and mailbox ownership verification are simulated |
| Quotes, 15-minute expiry, accepted snapshot, duplicate-request protection | Rates are illustrative fixtures, not approved commercial prices |
| Server validation of weight, service and date | City-name matching is a demo coverage check, not address validation |
| Staff-gated dispatch API, courier-scoped sessions, approved roster, one active job per courier | Demo role entry grants local access; no production staff authentication or shift planning |
| PIN verification, captured signatures, normalized delivery photos and proof history | The app records evidence; it does not independently establish signer identity or confirm photo contents |
| Sender-only unattended authorization, immediate return scheduling, signed returns | No outgoing contact is sent; after-hours exceptions and other failure causes remain unfinished |
| Pickup capture, return charge, ledger and event history | No real money movement, card processing, cancellation, or refunds yet |
| Recipient tracking tokens with expiration | No phone GPS, maps, ETA or automatic live updates yet |
| Customer-scoped notification history | Demo inbox includes sender and recipient copies; nothing is sent |

This application binds to loopback and refuses a production start. Demo authentication can impersonate any sample email, so **use sample data and do not expose this server publicly**. This is intentional for a local portfolio walkthrough; it is not an authentication system suitable for a deployed service. Public deployment requires a real email provider, stronger staff identity, token delivery, operational authorization, abuse controls, and a production hosting configuration.

## Real AI setup

Corey now uses OpenAI’s Responses API through the Express backend. Copy `.env.example` to `.env`, add `OPENAI_API_KEY` locally, then restart `npm run dev`. `OPENAI_MODEL` defaults to `gpt-5-mini` and can be changed to a compatible Responses model supporting function calls and low reasoning effort. The key stays on the server; never use a `VITE_` prefix. `.env` is ignored by Git. Without a key, chat clearly reports that it is unavailable and offers the manual form. There is no silent scripted fallback.

Corey gathers account and delivery details, answers policy questions, prepares backend quotes, and reads the signed-in customer’s recent statuses. Account verification and quote confirmation are explicit controls inside chat. The confirmation calls the same transactional booking API as the form. Unattended delivery is a customer checkbox, never an AI tool. Email verification, payments, route estimates, and dispatch remain local simulations even when the AI connection is real. Grocery image analysis, actual support-case submission, cancellation and refund tools are not implemented.

Messages and the delivery details supplied in chat go to OpenAI; use fictional sample details. Requests use `store: false` (this is not a claim of zero provider retention). Conversations are held in server memory for up to one hour, scoped by an HttpOnly cookie, and reset on an authenticated account change or server restart. The UI transcript is not restored on page refresh. Limits: 2,000 characters per message, 40 turns per conversation, four model calls per turn, 2,400 output tokens per call, 30-second request timeouts, 80 KB of accumulated context, and 20 turns per minute across this local server. An API key can incur usage charges; set a project budget in your provider account before an extended demo.

Tests inject deterministic model outputs or mock only the browser AI transport; they do not spend API credits. They verify tool boundaries, quote validation, isolation, explicit consent and booking persistence. A live API smoke test requires a configured key and is separate from these checks.

References: [Responses function calling](https://developers.openai.com/api/docs/guides/function-calling) and [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini).

## Illustrative pricing and dispatch behavior

The demo adapter uses $5 pickup, $1.25 per fixture mile, $0.20 per fixture minute, and an $8 expedited surcharge. It estimates distance from city centers with a multiplier and a 3-mile minimum; time is 2.5 minutes per fixture mile. These are explicit engineering fixtures to exercise quotes and receipts, not policy approval or measured driving routes. The displayed demo return price is locked to the accepted quote.

Demo city matching supports Atlanta, Decatur, Marietta, Alpharetta, Lawrenceville, and Peachtree City. Real polygons, geocoding, cutoff enforcement, capacity scheduling, vehicle constraints, dimensions, multiple packages, cold-item handling, and holiday hours remain open. Scheduled dates must not be in the past, but an offered window does not assert live availability. One active delivery per courier conservatively reserves return capacity; it is not optimized scheduling.

The implemented return branch models recipient unavailability only. Other failure reasons, company-caused returns, after-hours exceptions, and unavailable senders require further work. A same-day due date is recorded in Atlanta time, but this is not an automated feasibility or scheduling guarantee. The initial return-proof implementation uses a captured signature; unattended returns and alternative return-PIN policies are not yet implemented.

## Proof and authorization rules

- New bookings receive a random six-digit PIN in a recipient-addressed simulated email. My deliveries includes recipient copies solely for the local demo walkthrough. PIN hashes are stored separately from bookings; neither tracking links nor courier listings expose them. Five incorrect attempts block PIN retries for five minutes. A captured signature remains available.
- Successful delivery or return consumes the PIN and records a single proof. Repeating the same submission does not duplicate proof, notifications, or charges.
- Signatures contain the receiving person's name, explicit receipt consent, and normalized drawing points. Presence validation rejects empty marks; it is not biometric or legal identity verification.
- Delivery photos must decode as JPEG, PNG, or WebP, fit within 4 MB and 24 million pixels, and contain a single frame. The server normalizes them, removes metadata including GPS, and restricts retrieval to the sender, assigned courier, or dispatch session. Recipient tracking tokens cannot retrieve evidence.
- Only the sender account can authorize unattended delivery. Authorization remains open before the return starts. A courier may start a return immediately; if that happens before authorization or photo submission finishes, the backend rejects the conflicting action. Authorization alone does not mark anything delivered.
- The courier must refresh the workspace to see new sender instructions. Phone GPS and automatic updates remain future work.
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

The intended destination is Vercel with a hosted database. This local implementation still uses SQLite and is not deployment-ready. Database and image storage must be migrated before deployment, and local demo identity must be replaced or isolated appropriately. The public GitHub repository contains source and synthetic test fixtures, never local proof uploads or account records.
