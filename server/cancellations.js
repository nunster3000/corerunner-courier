import { randomUUID } from "node:crypto";
import { transaction } from "./db.js";
import { fail, text, stamp, atlantaDate } from "./domain.js";
import { trackingView } from "./tracking.js";
const before = [
  "awaiting_store_readiness",
  "confirmed",
  "assigned",
  "heading_to_pickup",
];
const after = ["picked_up", "heading_to_delivery"];
const fingerprint = (b) =>
  JSON.stringify([
    b.status,
    b.simulatedTrip?.sequence,
    b.simulatedTrip?.updatedAt,
    b.returnCause,
  ]);
export function cancellationTerms(b) {
  if (![...before, ...after].includes(b.status))
    fail(
      409,
      "Cancellation is not available in this state. Refresh your delivery or contact demo dispatch.",
    );
  if (after.includes(b.status))
    return {
      action: "return",
      fee: b.price.returnTotal,
      retained: b.price.total,
      released: 0,
      reason:
        "Pickup is complete. The original charge is retained; the disclosed distance/time return fee is charged after signed return.",
    };
  let fee = 0,
    distance = null;
  if (b.status === "heading_to_pickup") {
    const t = trackingView(b);
    if (!t.updatedAt || t.stale || t.paused)
      fail(
        409,
        "Pickup location is stale or paused. Refresh simulated tracking with the courier, or ask demo dispatch to review. No cancellation charge has been applied.",
      );
    distance = t.pickupMilesRemaining;
    if (distance <= 2) fee = b.price.base;
  }
  return {
    action: "cancel",
    fee,
    retained: 0,
    released: b.price.total - fee,
    distance,
    reason: fee
      ? "Courier is heading to pickup within 2 simulated miles. Only the base pickup fee applies."
      : "Cancellation before pickup is free at this stage. The authorization will be released.",
  };
}
export function installCancellations(
  app,
  { db, auth, staff, owned, read, save, present, event, payment, notify },
) {
  const cancelBefore = (b, actor, fee) => {
    b.status = "cancelled";
    b.paymentStatus = fee
      ? "cancellation_fee_captured"
      : "authorization_released";
    if (fee) payment(b, "cancellation_fee", fee);
    payment(b, "authorization_release", b.price.total - fee);
    db.prepare("UPDATE handoff_codes SET used=1 WHERE booking_id=?").run(b.id);
    event(b, actor, "cancelled", { fee });
  };
  const schedule = (b, cause) => {
    b.status = "return_scheduled";
    b.returnCause = cause;
    b.returnDueDate = atlantaDate();
    b.returnOnly = true;
  };
  app.post("/api/bookings/:id/cancellation-quote", auth, (req, res) => {
    const b = owned(req),
      terms = cancellationTerms(b);
    const quote = {
      id: randomUUID(),
      ...terms,
      expires: Date.now() + 120000,
      simulated: true,
    };
    // Keep a single active preview per booking; confirmation is tied to this backend snapshot.
    db.prepare("DELETE FROM cancellation_quotes WHERE booking_id=?").run(b.id);
    db.prepare("INSERT INTO cancellation_quotes VALUES(?,?,?,?,?,?)").run(
      quote.id,
      b.id,
      req.user.id,
      fingerprint(b),
      JSON.stringify(quote),
      quote.expires,
    );
    res.json(quote);
  });
  app.post("/api/bookings/:id/cancel", auth, (req, res) => {
    const result = transaction(db, () => {
      const b = owned(req),
        key = text(req.get("Idempotency-Key"), "Idempotency key", 100);
      if (b.cancellation) {
        if (
          b.cancellation.requestKey === key &&
          b.cancellation.quoteId === req.body.quoteId
        )
          return { booking: present(b), reused: true };
        fail(
          409,
          "This cancellation was already processed. Refresh your delivery.",
        );
      }
      const row = db
        .prepare(
          "SELECT * FROM cancellation_quotes WHERE id=? AND booking_id=? AND user_id=?",
        )
        .get(String(req.body.quoteId), b.id, req.user.id);
      if (!row || row.expires < Date.now())
        fail(409, "Cancellation preview expired. Review a new quote.");
      if (req.body.accepted !== true)
        fail(400, "Explicitly confirm the cancellation terms.");
      if (row.fingerprint !== fingerprint(b))
        fail(
          409,
          "Delivery or tracking changed. Review the updated cancellation terms.",
        );
      const terms = cancellationTerms(b),
        quote = JSON.parse(row.payload);
      if (terms.fee !== quote.fee || terms.action !== quote.action)
        fail(409, "Cancellation terms changed. Request a fresh preview.");
      b.cancellation = {
        quoteId: quote.id,
        requestKey: key,
        created: stamp(),
        ...terms,
      };
      if (terms.action === "cancel") cancelBefore(b, req.user.id, terms.fee);
      else {
        schedule(b, "sender_cancellation");
        b.returnReason = "Sender cancelled after pickup";
        event(b, req.user.id, "return_scheduled", {
          cause: b.returnCause,
          fee: terms.fee,
        });
      }
      save(b);
      notify(
        b,
        "Courier cancellation update",
        `${terms.reason} All amounts are simulated.`,
      );
      return { booking: present(b), reused: false };
    });
    res.json(result);
  });
  app.post("/api/dispatch/:id/company-failure", staff, (req, res) => {
    const result = transaction(db, () => {
      const b = read(req.params.id),
        key = text(req.get("Idempotency-Key"), "Idempotency key", 100);
      if (b.exception) {
        if (b.exception.requestKey === key)
          return { booking: present(b), reused: true };
        fail(
          409,
          "A company exception is already recorded. Refresh the delivery.",
        );
      }
      if (
        ![
          ...before,
          ...after,
          "return_scheduled",
          "returning",
          "handoff_failed",
        ].includes(b.status)
      )
        fail(
          409,
          "This booking is already finished or cannot enter an exception.",
        );
      const reason = text(req.body.reason, "Failure reason", 500);
      if (req.body.confirmed !== true)
        fail(400, "Confirm that this is a company-caused failure.");
      const pickedUp = !before.includes(b.status);
      b.exception = {
        requestKey: key,
        reason,
        created: stamp(),
        refundStatus: pickedUp ? "review_required" : "authorization_released",
      };
      b.returnCause = "company_failure";
      b.returnReason = reason;
      b.returnFeeOverride = 0;
      b.returnOnly = true;
      if (!pickedUp) cancelBefore(b, "demo-dispatch", 0);
      else if (req.body.canReturn === true) schedule(b, "company_failure");
      else {
        b.status = "exception_hold";
        b.returnDueDate = atlantaDate();
      }
      event(b, "demo-dispatch", "company_failure", {
        reason,
        returnFee: 0,
        refundStatus: b.exception.refundStatus,
      });
      save(b);
      notify(
        b,
        "Courier service exception",
        pickedUp
          ? "A company-caused failure was recorded. No return fee will be charged. The original captured charge needs staff refund review; no refund has been issued."
          : "A company-caused failure cancelled this delivery with no fee. The simulated authorization was released.",
      );
      return { booking: present(b), reused: false };
    });
    res.json(result);
  });
  app.post("/api/dispatch/:id/resolve-return", staff, (req, res) => {
    const b = transaction(db, () => {
      const b = read(req.params.id);
      if (b.status !== "exception_hold" || !b.exception)
        fail(409, "This delivery is not awaiting return recovery.");
      if (req.body.packageWithCourier !== true || req.body.canReturn !== true)
        fail(
          400,
          "Confirm package custody and the courier’s ability to return it.",
        );
      schedule(b, "company_failure");
      save(b);
      event(b, "demo-dispatch", "return_recovered", { returnFee: 0 });
      notify(
        b,
        "Return arranged",
        "The assigned courier can return the package. No return fee applies.",
      );
      return b;
    });
    res.json({ booking: present(b) });
  });
}
