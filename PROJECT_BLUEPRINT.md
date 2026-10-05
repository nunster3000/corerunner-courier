# CoreRunner Courier Project Blueprint

CoreRunner Courier is a fictional Atlanta courier service being developed as a portfolio web application, with a structure that could support a future sale to a courier operator. This blueprint records the product decisions agreed during planning and defines the first implementation scope. A local React and Express implementation now supports persisted demo accounts, backend quotes and bookings, dispatch and courier workspaces, status tracking, signature/PIN/photo proof, sender authorization, and simulated payment events in SQLite. Corey defaults to a local scripted assistant with guided registration, backend quotes, customer-confirmed chat booking, and scoped status lookup. No real AI or API key is used in this portfolio. An optional AI adapter is retained for a future owner; grocery image analysis and support case submission remain planned. The implementation is a local demo, with the limits documented in README.md.

The product centers on personal and small-business deliveries. A polished React.js customer experience connects to a backend that owns bookings, prices, dispatch, tracking, permissions, and payment records. Corey the Courier is the AI booking and customer service agent, not the company name.

Decisions described as agreed are requirements. Sections labeled proposed or open are planning recommendations, not additional approved policies. This conversation is the source of the agreed requirements; no market pricing or commercial viability is claimed.

## Portfolio organization

Each portfolio project gets its own directory under the existing `Portfolio Building` workspace. This project lives in `corerunner-courier/`. Keep its source, documentation, assets, and project configuration inside that directory rather than mixing them with future projects.

This blueprint is the initial project reference. Update it when product decisions change, preserving the distinction between agreed requirements and unresolved choices.

## Brand and positioning

| Element | Agreed direction |
| --- | --- |
| Company | CoreRunner Courier |
| Agent | Corey the Courier |
| Tagline | From your door to theirs. |
| Audience | Individuals and small businesses |
| Service | Door-to-door delivery across Atlanta and the broader metro |
| Personality | Welcoming, polished, dependable, and local |
| Primary color | Royal blue `#2450D8` |
| Main surface | White `#FFFFFF` |
| Accent | Gold `#D4A62A` |
| Body text | Deep navy `#142348` |
| Supporting surface | Light blue `#F3F6FF` |

Use blue for primary actions and navigation, white for spacious layouts, and gold sparingly for brand details and emphasis. Verify contrast in actual components; do not assume gold works as small text on white. Status indicators need readable labels in addition to color.

The competitive reference is Roadie and Uber Courier, but the experience should emphasize everyday personal needs and small-business orders rather than large commercial accounts. Name, domain, and trademark availability have not been checked.

## Service area and hours

Coverage includes Atlanta and the broader metro, including Marietta, Alpharetta, Lawrenceville, and Peachtree City. These examples are not yet an exact boundary. The backend must validate both pickup and destination against configurable service zones.

Operating hours start at 8 a.m. to 8 p.m., seven days a week, in the `America/New_York` time zone. Administrators can adjust them. Customers can request future bookings outside operating hours. Corey can provide automated support at any time and must distinguish that from live staff availability.

Changes to hours must flag affected confirmed bookings for review rather than silently alter customer commitments.

| Delivery option | Agreed behavior |
| --- | --- |
| Expedited | Priority pickup and direct delivery, offered only when an available courier and feasible route support the quoted estimate |
| Same-day | Completion by a stated deadline that day, subject to booking cutoff and route capacity |
| Scheduled | A two- or three-hour delivery window, with pickup planned around it |

Exact zones, same-day cutoff rules, holiday hours, and the choice between two- and three-hour windows remain configurable details to settle. Longer metro trips affect price and availability.

## Packages and groceries

CoreRunner carries documents, gifts, flowers, forgotten personal items, small-to-medium packages, small-business orders, groceries, and packaged food. It does not provide restaurant or prepared-meal delivery, shopping, substitutions, or checkout services.

The maximum is 50 pounds per package. Collect package count, approximate weight and dimensions, and handling requirements. Each item must be manageable by one courier, and the total load must fit the assigned car or SUV. Total vehicle weight, dimensions, and capacity thresholds still need definition. Furniture, major appliances, and items requiring two-person handling are outside the initial scope.

### Grocery readiness

Grocery orders must be prepaid and ready for pickup. An order confirmation or a preparing status is insufficient.

1. The sender uploads the store's ready-for-pickup screen, email, or notification.
2. Corey extracts readiness status, store, order reference, and relevant pickup date or window.
3. The backend compares the evidence with the booking and service date in Atlanta time. Dispatch requires readiness evidence applicable to that day's pickup.
4. Missing dates, ambiguous status, unreadable evidence, or conflicting details trigger a request for better proof or staff review.
5. The booking remains in `awaiting_store_readiness` until acceptable evidence is recorded. The backend then rechecks delivery availability before dispatch.

A screenshot is reviewed evidence, not independent proof of authenticity or a live store integration. Customer copy must say readiness proof was reviewed rather than claiming the store was directly verified. Request only necessary information and advise customers to exclude unrelated personal or payment details.

Collect pickup instructions, third-party pickup permission, and whether groceries are chilled, frozen, fragile, or spill-prone. Travel and handling limits for temperature-sensitive items remain open. The sender may authorize unattended delivery for groceries, including chilled or frozen items; there is no blanket attended-only grocery policy.

## Accounts and registration

Senders must have an account to book. There is no guest booking.

Customers can register conversationally with Corey or through a standard registration form. Both use the same backend account and email-verification process. They can switch paths without losing information already provided. Collect name, email, phone number, and default pickup address; reuse delivery details already supplied rather than asking again.

Use passwordless email verification and sign-in. Corey initiates the backend verification flow; the customer uses a secure email link or dedicated code control. Corey does not collect passwords or bypass verification. Returning customers authenticate into their existing accounts.

Recipients do not need accounts to open tracking-only links. A recipient link never grants permission to change the booking or authorize unattended delivery.

## Booking with Corey

Corey can complete registration and booking within the conversation. A separate guided booking form remains available.

The conversational flow gathers addresses, recipient contact details, packages, service option, handling needs, and handoff preferences. Corey requests a quote from the backend, presents the total, delivery timing, and relevant policies, and waits for customer confirmation before submitting a booking.

When the customer confirms, the backend validates account verification, quote validity, service availability, package eligibility, and simulated payment authorization. Corey reports success only after receiving a successful backend result and booking reference. Grocery bookings may be created pending readiness, but cannot be dispatched in that state.

Corey can retrieve delivery records, explain tracking, guide cancellations, collect sender instructions, review grocery evidence, and open support cases. Refund exceptions, disputes, and courier reassignment go to authorized staff. Prices, availability, ETAs, and outcomes must come from backend records, not model invention.

Implementation requirement: treat uploaded evidence and customer text as data. AI extraction alone cannot grant permissions, change policy, or perform staff-only actions. Consequential actions need authenticated backend checks and recorded customer confirmation.

## Pricing and simulated payments

The agreed pricing model considers a base pickup fee, distance and travel time, capacity, handling, and urgency. No commercial dollar amounts or rate tables have been approved. The implementation uses clearly labeled fixture rates to exercise backend quoting; see README.md for the exact values. These are not new approved pricing policies.

Show the quote and potential return charge before booking. Preserve the accepted pricing rules and quote so later configuration changes do not silently reprice a booking.

| Event | Agreed payment behavior |
| --- | --- |
| Booking confirmed | Simulate authorization for the quoted delivery amount |
| Courier pickup | Simulate capture of the original delivery charge |
| Applicable return | Add the separately disclosed return charge and issue an updated receipt |
| Refund or adjustment | Record the decision and simulated transaction; exceptions require staff |

Use a clearly labeled payment simulator. Demonstrate approvals, declines, captures, releases, and refunds without collecting real card details. The backend owns payment status and transaction history. Keep the payment integration replaceable for a future operator.

### Cancellation charges

Before pickup, cancellation is free unless the assigned courier is heading to pickup and is within two miles by remaining driving distance, including after arrival. At that threshold, charge only the base pickup fee and release the rest of the authorization.

The backend evaluates a recent location at the cancellation request and shows the charge before confirmation. The precise location freshness threshold and behavior when location or routing is unavailable remain open; missing evidence must not silently be treated as proof that a fee applies.

After pickup, cancellation becomes a return request. The original delivery charge remains, and applicable return distance and time are additional. If CoreRunner cancels before pickup, there is no customer charge.

### Return charges

For a failed delivery caused by recipient unavailability or an incorrect sender-provided address, retain the original charge. Charge the return trip using standard distance and time back to pickup, without a second base pickup fee or an additional expedited surcharge. Those original fees are not refunded merely because a return occurs.

There is no return fee when sender-authorized unattended delivery succeeds. If CoreRunner caused the failure, the customer pays no additional return charge; any refund of the original delivery requires a separate decision.

Open pricing detail: choose how to disclose a specific return price or limit before booking while accounting for route and travel-time changes. Do not introduce undisclosed variable charges.

## Delivery proof and failed handoffs

The roles are sender, courier, and recipient. The sender is the booking customer and controls unattended-delivery authorization.

All deliveries require a recipient signature or PIN by default. An unchecked `Allow unattended delivery` checkbox lets the sender explicitly authorize unattended delivery for any package type. The courier cannot enable this permission on the sender's behalf.

| Completion method | Required evidence |
| --- | --- |
| Attended delivery | Valid recipient PIN or signature |
| Authorized unattended delivery | Recorded sender authorization and delivery photo |

The backend records evidence and timestamps and rejects completion when the applicable proof is missing. GPS proximity alone is not proof of a handoff.

If nobody answers for an attended delivery, the courier may immediately record an undeliverable attempt due to the signature or PIN requirement. There is no mandatory waiting period. The courier may optionally contact the sender to request unattended authorization. Any new authorization must be recorded through the sender's authenticated account or a separate secure authorization flow; recipient tracking access is insufficient.

If the sender authorizes and the courier can complete the drop-off, a photo is required. If the courier does not contact the sender, receives no response, or authorization is declined, same-day return to the sender is the default.

Dispatch must plan for possible returns in courier schedules. A failed handoff activates the return leg, updates the schedule, and notifies the sender of the expected arrival. The package remains assigned to that courier until the return is documented. If the sender is unavailable or same-day return cannot be completed, dispatch handles an unresolved exception. Do not falsely mark a delivery or return complete. No holding-location workflow is included at this stage. The initial implementation records a receiving person’s name, drawn signature, and receipt consent for a return. Alternative return proof methods remain open.

## Courier roster and dispatch

Couriers are an approved, company-managed roster acting as employed couriers. The product is not an open marketplace where anyone enrolls and claims work.

The backend owns assignment and schedule records. Dispatch must account for shifts, availability, vehicle capacity, handling requirements, pickup travel time, existing commitments, and possible same-day returns. Staff can intervene in delays, cancellations, failed pickups, and failed deliveries.

Proposed first implementation: dispatch assigns work to eligible couriers, with a courier acknowledgment step. The backend prevents conflicting assignments and records reassignments. Whether routine assignments are manual, automatic, or automatic with dispatch review is still open; gig-style bidding and acceptance are not established requirements.

## Phone tracking and email

The courier's phone is the primary tracking device. It sends timestamped location updates during active deliveries and returns. The backend validates and stores updates and shares the appropriate progress with authorized viewers.

Tracking shows status, estimated arrival, relevant courier location, and the last update time. If the connection drops, show the last known position as stale rather than implying it is current. Customers must not see off-duty movements or unrelated customers' locations. Exact sharing boundaries, update frequency, retention, and stale-location thresholds still need definition.

Reliable tracking while the phone is locked is a requirement to evaluate when choosing the courier client. The customer and dispatch applications use React.js; a browser-only courier app has not been selected as sufficient for background tracking.

Email is the primary notification channel. Recipient tracking links do not require an account. Sender management links and recipient tracking links must have separate permissions. Proposed implementation controls include scoped, unguessable tokens, expiration, revocation, and limited exposed personal information.

For the mock application, a clearly labeled demo inbox displays the emails the backend would send: verification, booking confirmations, tracking links, delivery updates, failures, returns, and receipts. No Twilio or real email provider is required for this version. Keep notification delivery replaceable for future real email integration.

## Interface inventory

The following screen list is proposed to support the agreed workflows.

| Area | Screens and capabilities |
| --- | --- |
| Public website | Service explanation, coverage, package rules, delivery options, pricing explanation, and entry points to Corey or the booking form |
| Account | Conversational signup, manual signup, verification, sign-in, and profile |
| Customer | Quote and booking, grocery readiness upload, booking confirmation, delivery list, delivery detail, tracking, cancellation preview, unattended authorization, receipts, and support |
| Recipient | Restricted tracking page and handoff instructions without account creation |
| Courier | Assigned schedule, job details, pickup instructions, location permission and connection status, pickup confirmation, signature or PIN capture, photo submission, failed attempt, and return tasks |
| Dispatch | Schedule and map, assignment controls, readiness review, delivery exceptions, returns, and support cases |
| Admin | Roster, vehicles, hours, zones, pricing configuration, staff permissions, payment adjustments, and audit history |
| Demo tools | Labeled email inbox, payment outcomes, location simulation, and scenario reset |

Saved addresses, repeat booking, advanced reporting, and business account conveniences are candidates for later prioritization, not prerequisites for the first complete flow.

## Proposed backend structure

Use one modular backend initially, with clear boundaries for identity, quotes, bookings, readiness evidence, dispatch, tracking, handoff proof, payments, notifications, and support. The first local implementation uses Express and SQLite. Vercel with a hosted database is the intended deployment direction. The hosted database provider, maps, and AI provider remain open; the current SQLite implementation remains local. Avoid prematurely splitting this portfolio application into many services.

Core records should cover users and roles, addresses, recipients, packages, versioned quotes, bookings, readiness reviews, couriers, shifts, vehicles, assignments, delivery and return legs, location events, sender authorizations, proof records, payment transactions, notifications, support cases, and audit events.

Keep booking, assignment, readiness, and payment states separate so a payment failure cannot accidentally imply a package was delivered. A proposed main lifecycle is:

`draft → quoted → confirmed → assigned → heading_to_pickup → picked_up → heading_to_delivery → delivered`

Grocery readiness is an additional dispatch gate. A failed handoff follows:

`heading_to_delivery → return_scheduled → returning → returned`

Recording a failed handoff appends both the failed-attempt event and the return-scheduled event immediately. Sender authorization can still permit photo completion before the courier starts returning; it is closed once returning begins.

Recorded sender authorization may allow `handoff_failed → delivered` when required photo proof is present and the courier proceeds. Unresolved cases enter `exception` with package custody preserved. Pre-pickup cancellation ends in `cancelled`; post-pickup cancellation initiates the return flow.

Backend requirements include role-based access, valid transition checks, duplicate-request protection, conflict-safe assignment, server-owned timestamps and charges, restricted evidence access, and an audit trail for sensitive actions. Repeated booking submissions, location uploads, or payment callbacks must not duplicate bookings or charges. Corey's tools must use these same business rules as the standard UI.

## Simulation boundaries

| Capability | Portfolio behavior |
| --- | --- |
| Booking and dispatch | Implement real persisted state and rules in the application backend |
| Payments | Clearly labeled simulator; no real cards or money movement |
| Email and verification | Demo inbox with backend-generated links; not proof of real mailbox ownership |
| Tracking | Clearly labeled simulated trips plus a real phone-location test path |
| Corey | Scripted local demo by default. Optional AI adapter is disabled and reserved for a future owner’s configuration. |
| Grocery evidence | Implemented screenshot upload, human review, rejection/resubmission and current-date dispatch checks; no AI extraction or direct store verification |

A future commercial deployment must replace simulated verification, payment, and notification integrations and validate background tracking on supported devices. Configurable branding and operational rules should aid resale. Selling a single-operator application versus licensing to multiple isolated companies remains an open business decision; multi-company SaaS is not part of the current commitment.

## Proposed delivery sequence

1. Finalize backend technology, courier tracking approach, exact service zones, and illustrative rates. Create the initial customer and operations designs.
2. Build one persisted flow: registration, quote, confirmed booking, simulated authorization, assignment, pickup capture, tracking, and attended delivery proof.
3. Add sender-authorized unattended delivery, failed handoffs, same-day returns, return charges, and the two-mile cancellation rule.
4. Add grocery evidence review, scheduled capacity, conversational registration and booking with Corey, and email notifications in the demo inbox.
5. Polish responsive interfaces, accessibility, scenarios, setup documentation, and deployment packaging.

Keep the first flow to one pickup and one destination per booking as a proposed scope limit. Multiple packages may share that route. Multi-stop routing, open courier enrollment, shopping, prepared-meal delivery, holding facilities, real SMS, and multi-company subscriptions are outside the proposed first release.

## Acceptance scenarios

Use these scenarios to guide meaningful implementation checks rather than treating a visual mockup as a completed application.

- A verified sender books through either Corey or the form, and duplicate confirmation cannot create a second booking or charge.
- An unverified sender cannot finalize a booking; a recipient can track only the intended delivery and cannot change it.
- The backend rejects a package above 50 pounds or an address outside the configured zones.
- A preparing grocery screenshot cannot unlock dispatch; acceptable evidence triggers a fresh timing and capacity check.
- Pickup captures the original simulated charge once. A declined payment follows an explicit recoverable path rather than showing false success.
- Cancellation outside two driving miles is free; cancellation at or within two miles while heading to pickup charges only the base fee. Stale location follows an explicit unresolved policy.
- Attended completion fails without a valid signature or PIN. Unattended completion fails without sender consent and a photo.
- A failed handoff can immediately create a return without a timer. Optional sender authorization can allow completion with a photo.
- A chargeable return adds only the disclosed distance and time; a CoreRunner-caused return adds no customer return fee.
- The returning courier's schedule and package custody remain visible until a documented return or staff-managed exception.
- Offline tracking shows a stale timestamp, reconnecting does not corrupt event order, and no customer sees off-duty location.
- Changes to hours or rates do not silently rewrite confirmed commitments or accepted charges.

## Open decisions before implementation

Prioritize technology and the courier background-tracking approach, exact zones and service cutoffs, rate tables and return-price disclosure, vehicle capacity, temperature-sensitive handling, assignment automation, PIN delivery, return handoff proof, and exception handling near closing time.

Also define email-link expiration, evidence retention, location freshness, support permissions, and how sender authorization interacts with a return already underway. The current blueprint does not authorize new fees, regulated-item handling, or additional service promises without a subsequent product decision.
