import React, { useRef, useState } from "react";
import { api, statusLabel } from "./api";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export default function GroceryReadiness({ booking, dispatch, onChange }) {
  const [store, setStore] = useState(""),
    [orderReference, setOrderReference] = useState(""),
    [pickupDate, setPickupDate] = useState(today),
    [image, setImage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [checks, setChecks] = useState({});
  const requestKey = useRef(crypto.randomUUID());
  const r = booking.readiness,
    editable =
      ["awaiting_store_readiness", "confirmed"].includes(booking.status) &&
      !booking.courier;
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const sample = (ready) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 640;
    const c = canvas.getContext("2d");
    c.fillStyle = "#f3f6ff";
    c.fillRect(0, 0, 960, 640);
    c.fillStyle = "#142348";
    c.font = "bold 42px sans-serif";
    c.fillText("DEMO MARKET", 60, 95);
    c.font = "24px sans-serif";
    c.fillText("Fictional sample confirmation • no real store order", 60, 150);
    c.font = "bold 40px sans-serif";
    c.fillText(ready ? "Ready for pickup" : "Preparing your order", 60, 260);
    c.font = "28px sans-serif";
    c.fillText("Order: DEMO-1042", 60, 335);
    c.fillText(`Pickup date: ${today()}`, 60, 395);
    c.fillText("Paid in full · Pickup at the booking address", 60, 455);
    c.font = "22px sans-serif";
    c.fillText("For portfolio review demonstration only", 60, 565);
    setImage(canvas.toDataURL("image/png"));
    setStore("Demo Market");
    setOrderReference("DEMO-1042");
    setPickupDate(today());
    requestKey.current = crypto.randomUUID();
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setImage("");
    if (file.size > 4 * 1024 * 1024) {
      setError("Choose an image no larger than 4 MB.");
      return;
    }
    setBusy(true);
    try {
      const value = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read this image."));
        reader.readAsDataURL(file);
      });
      setImage(value);
      requestKey.current = crypto.randomUUID();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="readiness-panel"
      aria-label={`Grocery readiness for ${booking.id}`}
    >
      <h3>Store pickup confirmation</h3>
      <p className="readiness-caption">
        Human-reviewed demo evidence. No AI scanning or direct store
        verification.
      </p>
      {r ? (
        <div className="readiness-record">
          <strong>
            {statusLabel(r.status)} · {r.store}
          </strong>
          <p>
            Order {r.orderReference} · Pickup date {r.pickupDate} (Atlanta)
          </p>
          {r.note && <p>{r.note}</p>}
          <a
            href={`/api/bookings/${booking.id}/readiness/${r.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Open submitted confirmation
          </a>
          {dispatch && (
            <img
              className="readiness-image"
              src={`/api/bookings/${booking.id}/readiness/${r.id}`}
              alt="Store pickup confirmation submitted for review"
            />
          )}
        </div>
      ) : (
        <p>No confirmation uploaded yet. Dispatch remains blocked.</p>
      )}
      {!dispatch && editable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(`/bookings/${booking.id}/readiness`, {
                method: "POST",
                headers: { "Idempotency-Key": requestKey.current },
                body: { store, orderReference, pickupDate, image },
              });
              setImage("");
              requestKey.current = crypto.randomUUID();
            });
          }}
        >
          <fieldset disabled={busy}>
            <legend>
              {r ? "Submit replacement evidence" : "Upload pickup confirmation"}
            </legend>
            <p>
              Show the store, order reference, ready status, payment
              confirmation, and pickup date. Preparing orders cannot be
              approved. Replacing evidence requires a new review.
            </p>
            <div className="readiness-samples">
              <button
                type="button"
                className="button secondary"
                onClick={() => sample(true)}
              >
                Load sample ready screen
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => sample(false)}
              >
                Load sample preparing screen
              </button>
            </div>
            <label>
              Store name
              <input
                required
                maxLength={100}
                value={store}
                onChange={(e) => setStore(e.target.value)}
              />
            </label>
            <label>
              Order reference
              <input
                required
                maxLength={100}
                value={orderReference}
                onChange={(e) => setOrderReference(e.target.value)}
              />
            </label>
            <label>
              Pickup date shown in confirmation
              <input
                required
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </label>
            <label>
              Readiness screenshot
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={upload}
              />
            </label>
            {image && (
              <img
                className="readiness-image"
                src={image}
                alt="Selected pickup confirmation preview"
              />
            )}
            <button className="button" disabled={!image} type="submit">
              Submit for readiness review
            </button>
          </fieldset>
        </form>
      )}
      {dispatch && editable && r?.status === "pending" && (
        <fieldset disabled={busy} key={r.id}>
          <legend>Review the submitted screen</legend>
          <p>
            Approve only if each detail is visible and matches this booking.
            Today’s pickup date is {today()}. Scheduled grocery pickups must be
            on the delivery date. Assignment still checks courier availability.
          </p>
          {Object.entries({
            readyShown: "Store explicitly shows Ready for pickup",
            prepaidShown: "Order is prepaid",
            dateMatches: "Pickup date shown matches today and the booking",
            orderMatches: "Store, pickup location and order reference match",
          }).map(([key, label]) => (
            <label className="checkbox-label" key={key}>
              <input
                type="checkbox"
                checked={checks[key] === r.id}
                onChange={(e) =>
                  setChecks((c) => ({
                    ...c,
                    [key]: e.target.checked ? r.id : null,
                  }))
                }
              />
              {label}
            </label>
          ))}
          <button
            className="button"
            disabled={
              ![
                "readyShown",
                "prepaidShown",
                "dateMatches",
                "orderMatches",
              ].every((k) => checks[k] === r.id)
            }
            onClick={() =>
              run(() =>
                api(`/dispatch/${booking.id}/readiness`, {
                  method: "POST",
                  body: {
                    evidenceId: r.id,
                    decision: "approved",
                    ...Object.fromEntries(
                      Object.entries(checks).map(([k, v]) => [k, v === r.id]),
                    ),
                  },
                }),
              )
            }
          >
            Approve readiness
          </button>
          <label>
            Reason for rejection
            <textarea
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: order is still preparing, or pickup date is missing."
            />
          </label>
          <button
            className="button secondary"
            disabled={!note.trim()}
            onClick={() =>
              run(() =>
                api(`/dispatch/${booking.id}/readiness`, {
                  method: "POST",
                  body: { evidenceId: r.id, decision: "rejected", note },
                }),
              )
            }
          >
            Reject evidence
          </button>
        </fieldset>
      )}
      {r?.status === "approved" && (
        <p>
          Approved for {r.pickupDate} only. A later pickup day requires new
          evidence and review.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
