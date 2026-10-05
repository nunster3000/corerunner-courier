import React, { useRef, useState } from "react";
import { api, money } from "./api";
const before = [
  "awaiting_store_readiness",
  "confirmed",
  "assigned",
  "heading_to_pickup",
];
export default function DeliveryExceptions({ booking: b, dispatch, onChange }) {
  const [preview, setPreview] = useState(null),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [company, setCompany] = useState(false),
    [canReturn, setCanReturn] = useState(false),
    [custody, setCustody] = useState(false);
  const key = useRef(crypto.randomUUID());
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
      setPreview(null);
      setAccepted(false);
    } finally {
      setBusy(false);
    }
  };
  const path = `/bookings/${b.id}`;
  return (
    <section
      className="exception-panel"
      aria-label={`Cancellation and exceptions for ${b.id}`}
    >
      {b.cancellation && (
        <p>
          <strong>
            {b.cancellation.action === "cancel"
              ? "Cancelled before pickup"
              : "Return requested after pickup"}
            .
          </strong>{" "}
          {b.cancellation.action === "cancel"
            ? `Cancellation fee: ${money(b.cancellation.fee)}. Authorization released: ${money(b.cancellation.released)}.`
            : `Original charge retained: ${money(b.cancellation.retained)}. Return fee at signed handoff: ${money(b.returnFeeOverride ?? b.cancellation.fee)}.`}{" "}
          All amounts simulated.
        </p>
      )}
      {b.exception && (
        <div className="info-note">
          <strong>CoreRunner-caused failure</strong>
          <p>{b.exception.reason}</p>
          <p>
            No return fee.{" "}
            {b.exception.refundStatus === "review_required"
              ? "Original charge needs staff refund review; no refund has been issued."
              : "The authorization was released with no cancellation fee."}
          </p>
          {b.status === "exception_hold" && (
            <p>
              Return needs staff attention. The courier assignment stays
              reserved until custody and a return plan are confirmed.
            </p>
          )}
        </div>
      )}
      {!dispatch &&
        [...before, "picked_up", "heading_to_delivery"].includes(b.status) && (
          <>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setPreview(
                    await api(`${path}/cancellation-quote`, {
                      method: "POST",
                      body: {},
                    }),
                  );
                  setAccepted(false);
                  key.current = crypto.randomUUID();
                })
              }
            >
              {before.includes(b.status)
                ? "Review cancellation"
                : "Review cancellation and return"}
            </button>
            {preview && (
              <div className="cancellation-preview">
                <h3>
                  {preview.action === "cancel"
                    ? "Cancellation preview"
                    : "Return preview"}
                </h3>
                <p>{preview.reason}</p>
                <p>
                  <strong>
                    {preview.action === "cancel"
                      ? "Cancellation fee"
                      : "Return fee"}
                    : {money(preview.fee)}
                  </strong>
                </p>
                <p>
                  {preview.action === "cancel"
                    ? `Release unused authorization: ${money(preview.released)}.`
                    : `Original charge retained: ${money(preview.retained)}. Courier retains the package until a signed return.`}
                </p>
                {preview.distance !== null &&
                  preview.distance !== undefined && (
                    <p>
                      {preview.distance} simulated miles to pickup. Uses a
                      five-mile demo route, not measured driving distance.
                    </p>
                  )}
                <p>
                  Preview valid for two minutes, provided delivery and tracking
                  stay unchanged. All amounts are simulated.
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  I accept these cancellation terms.
                </label>
                <button
                  className="button"
                  disabled={busy || !accepted}
                  onClick={() =>
                    run(async () => {
                      await api(`${path}/cancel`, {
                        method: "POST",
                        headers: { "Idempotency-Key": key.current },
                        body: { quoteId: preview.id, accepted: true },
                      });
                      setPreview(null);
                      await onChange();
                    })
                  }
                >
                  {preview.action === "cancel"
                    ? "Confirm cancellation"
                    : "Confirm return request"}
                </button>
              </div>
            )}
          </>
        )}
      {dispatch &&
        !b.exception &&
        [
          ...before,
          "picked_up",
          "heading_to_delivery",
          "return_scheduled",
          "returning",
          "handoff_failed",
        ].includes(b.status) && (
          <details>
            <summary>Record a CoreRunner-caused failure</summary>
            <fieldset disabled={busy}>
              <label>
                Failure reason
                <textarea
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={company}
                  onChange={(e) => setCompany(e.target.checked)}
                />
                I confirm this failure was caused by CoreRunner.
              </label>
              {!before.includes(b.status) && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={canReturn}
                    onChange={(e) => setCanReturn(e.target.checked)}
                  />
                  The assigned courier has the package and can return it today.
                </label>
              )}
              <p>
                {before.includes(b.status)
                  ? "This cancels the booking and releases the full authorization. No fee."
                  : "No return fee will apply. If the courier cannot return now, the booking stays on hold with the assignment reserved. Original-charge refunds require staff review."}
              </p>
              <button
                className="button secondary"
                disabled={!company || !reason.trim()}
                onClick={() =>
                  run(async () => {
                    await api(`/dispatch/${b.id}/company-failure`, {
                      method: "POST",
                      headers: { "Idempotency-Key": key.current },
                      body: { reason, confirmed: company, canReturn },
                    });
                    await onChange();
                  })
                }
              >
                Confirm company failure
              </button>
            </fieldset>
          </details>
        )}
      {dispatch && b.status === "exception_hold" && (
        <fieldset disabled={busy}>
          <legend>Arrange the no-fee return</legend>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={custody}
              onChange={(e) => setCustody(e.target.checked)}
            />
            Package custody is confirmed with the assigned courier.
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={canReturn}
              onChange={(e) => setCanReturn(e.target.checked)}
            />
            The courier can return the package today.
          </label>
          <button
            className="button"
            disabled={!custody || !canReturn}
            onClick={() =>
              run(async () => {
                await api(`/dispatch/${b.id}/resolve-return`, {
                  method: "POST",
                  body: { packageWithCourier: custody, canReturn },
                });
                await onChange();
              })
            }
          >
            Schedule no-fee return
          </button>
        </fieldset>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
