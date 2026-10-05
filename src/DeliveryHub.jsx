import TrackingRoute from "./TrackingRoute";
import GroceryReadiness from "./GroceryReadiness";
import React, { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Package,
  ShieldCheck,
  Mail,
  Truck,
  MapPin,
} from "lucide-react";
import { api, money, statusLabel } from "./api";
import { ProofHistory } from "./ProofCapture";
export default function DeliveryHub({ mode, onBack, onBook }) {
  const [bookings, setBookings] = useState([]),
    [couriers, setCouriers] = useState([]),
    [messages, setMessages] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(mode !== "dispatch"),
    [selected, setSelected] = useState({}),
    [authorization, setAuthorization] = useState({});
  async function load() {
    setError("");
    setBusy(true);
    try {
      if (mode === "dispatch") {
        const r = await api("/dispatch");
        setBookings(r.bookings);
        setCouriers(r.couriers);
      } else {
        const [b, m] = await Promise.all([api("/bookings"), api("/inbox")]);
        setBookings(b.bookings);
        setMessages(m.messages);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (ready) load();
  }, [mode, ready]);
  async function act(path, body) {
    setBusy(true);
    setError("");
    try {
      await api(path, { method: "POST", body });
      await load();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  const next = {
    assigned: "heading_to_pickup",
    heading_to_pickup: "picked_up",
    picked_up: "heading_to_delivery",
    handoff_failed: "returning",
    return_scheduled: "returning",
  };
  return (
    <section className="container hub-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> Back to home
      </button>
      <div className="hub-heading">
        <div>
          <p className="eyebrow">
            {mode === "dispatch"
              ? "OPERATIONS · LOCAL DEMO"
              : "YOUR EVERYDAY DELIVERIES"}
          </p>
          <h1>
            {mode === "dispatch" ? "Dispatch, in view." : "Your deliveries."}
          </h1>
          <p>
            {mode === "dispatch"
              ? "An approved roster. Every package accounted for."
              : "Saved to the backend, ready whenever you come back."}
          </p>
        </div>
        <div className="hub-actions">
          <button
            className="button secondary"
            onClick={load}
            disabled={busy || !ready}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          {mode !== "dispatch" && (
            <button className="button" onClick={onBook}>
              New delivery <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
      {mode === "dispatch" && (
        <div className="demo-callout">
          <ShieldCheck size={23} />
          <div>
            <strong>Demo staff access</strong>
            <p>
              Local-only role switch with sample couriers. Manual assignment
              reserves one courier for the delivery and its possible return.
              Open Demo courier to record PIN, signature, or photo proof. Live
              scheduling is not connected yet. Grocery evidence is reviewed
              below.
            </p>
            {!ready && (
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("/demo/dispatch-session", {
                      method: "POST",
                      body: {},
                    });
                    setReady(true);
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Enter demo dispatch
              </button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {mode === "dispatch" && ready && (
        <div className="roster">
          {couriers.map((c) => {
            const b = bookings.find(
              (b) =>
                b.courier?.id === c.id &&
                !["delivered", "returned", "cancelled"].includes(b.status),
            );
            return (
              <div key={c.id}>
                <Truck size={20} />
                <strong>
                  {c.name}
                  <small>
                    {c.vehicle} ·{" "}
                    {b ? "Assigned + return reserved" : "Available"}
                  </small>
                </strong>
                <span className={b ? "roster-dot busy" : "roster-dot"} />
              </div>
            );
          })}
        </div>
      )}
      {ready && !busy && !error && bookings.length === 0 && (
        <div className="empty-state">
          <Package size={35} />
          <h2>A fresh start.</h2>
          <p>
            {mode === "dispatch"
              ? "Customer bookings will appear here."
              : "Book your first demo delivery to see it here."}
          </p>
        </div>
      )}
      <div className="delivery-list">
        {bookings.map((b) => (
          <article className="delivery-card" key={b.id}>
            <div className="delivery-card-head">
              <div>
                <span className="delivery-id">{b.id}</span>
                <h2>{b.delivery.item}</h2>
              </div>
              <span
                className={
                  "status-badge " +
                  (b.status === "awaiting_store_readiness" ? "pending" : "")
                }
              >
                {statusLabel(b.status)}
              </span>
            </div>
            <div className="delivery-card-body">
              <div className="delivery-route">
                <MapPin size={20} />
                <div>
                  <small>PICKUP</small>
                  <p>{b.delivery.pickup}</p>
                  <small>DELIVER TO {b.delivery.recipient.toUpperCase()}</small>
                  <p>{b.delivery.dropoff}</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Service</dt>
                  <dd>{b.delivery.service}</dd>
                </div>
                <div>
                  <dt>Handoff</dt>
                  <dd>
                    {b.delivery.unattended
                      ? "Unattended · photo required"
                      : "Signature or PIN"}
                  </dd>
                </div>
                <div>
                  <dt>Demo price</dt>
                  <dd>{money(b.price.total)}</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>{statusLabel(b.paymentStatus)} · simulated</dd>
                </div>
                <div>
                  <dt>Courier</dt>
                  <dd>{b.courier?.name || "Awaiting assignment"}</dd>
                </div>
              </dl>
            </div>
            {b.delivery.item === "Groceries" && (
              <GroceryReadiness
                booking={b}
                dispatch={mode === "dispatch"}
                onChange={load}
              />
            )}
            <details>
              <summary>Activity and simulated receipt</summary>
              <ol className="event-list">
                {b.events.map((e, i) => (
                  <li key={i}>
                    <span>{statusLabel(e.kind)}</span>
                    <time>{new Date(e.created).toLocaleString()}</time>
                  </li>
                ))}
              </ol>
              <div className="payment-list">
                {b.payments.map((p) => (
                  <div key={p.kind}>
                    <span>{statusLabel(p.kind)}</span>
                    <strong>{money(p.amount)}</strong>
                  </div>
                ))}
              </div>
            </details>
            <div className="delivery-card-actions">
              <a
                className="text-button"
                href={`/?track=${b.trackingToken}`}
                target="_blank"
                rel="noreferrer"
              >
                Open recipient tracking <ArrowRight size={15} />
              </a>
              {mode === "dispatch" && b.status === "confirmed" && (
                <div className="assign-controls">
                  <label className="sr-only" htmlFor={"assign-" + b.id}>
                    Courier for {b.id}
                  </label>
                  <select
                    id={"assign-" + b.id}
                    value={selected[b.id] || ""}
                    onChange={(e) =>
                      setSelected({ ...selected, [b.id]: e.target.value })
                    }
                  >
                    <option value="">Choose courier</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="button compact"
                    disabled={busy || !selected[b.id]}
                    onClick={() =>
                      act(`/dispatch/${b.id}/assign`, {
                        courierId: selected[b.id],
                      })
                    }
                  >
                    Assign
                  </button>
                </div>
              )}
              {mode === "dispatch" && next[b.status] && (
                <div className="assign-controls">
                  <button
                    className="button compact"
                    disabled={busy}
                    onClick={() =>
                      act(`/dispatch/${b.id}/advance`, {
                        status: next[b.status],
                      })
                    }
                  >
                    {statusLabel(next[b.status])} <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {mode === "dispatch" &&
                b.status === "heading_to_delivery" &&
                !b.delivery.unattended && (
                  <button
                    className="button compact secondary"
                    disabled={busy}
                    onClick={() =>
                      act(`/dispatch/${b.id}/advance`, {
                        status: "handoff_failed",
                      })
                    }
                  >
                    Recipient unavailable
                  </button>
                )}
            </div>
            {mode !== "dispatch" &&
              [
                "heading_to_delivery",
                "return_scheduled",
                "handoff_failed",
              ].includes(b.status) &&
              !b.delivery.unattended && (
                <div className="sender-authorization">
                  <h3>Your handoff instructions</h3>
                  <p>
                    {b.contactRequested
                      ? "Your courier requested permission for an unattended drop-off."
                      : "You can authorize an unattended drop-off while the courier is still at the delivery stage."}{" "}
                    A photo is required. Once the courier starts the return,
                    this option closes.
                  </p>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!authorization[b.id]}
                      onChange={(e) =>
                        setAuthorization({
                          ...authorization,
                          [b.id]: e.target.checked,
                        })
                      }
                    />
                    <span>I authorize unattended delivery for {b.id}.</span>
                  </label>
                  <button
                    className="button compact"
                    disabled={busy || !authorization[b.id]}
                    onClick={() =>
                      act(`/bookings/${b.id}/unattended`, { authorize: true })
                    }
                  >
                    Authorize unattended delivery
                  </button>
                </div>
              )}
            {b.returnDueDate &&
              ["return_scheduled", "handoff_failed", "returning"].includes(
                b.status,
              ) && (
                <p className="info-note">
                  Same-day return due {b.returnDueDate}. The assigned courier
                  retains the package and reserved return capacity.
                </p>
              )}
            <ProofHistory booking={b} />
            {mode === "dispatch" &&
              ["heading_to_delivery", "returning"].includes(b.status) && (
                <p className="prototype-note">
                  Use Demo courier to complete the handoff with required proof.
                  Dispatch cannot bypass it.
                </p>
              )}
          </article>
        ))}
      </div>
      {mode !== "dispatch" && messages.length > 0 && (
        <section className="notification-section">
          <p className="eyebrow">SIMULATED EMAIL · NOTHING SENT</p>
          <h2>
            <Mail size={24} /> Your demo inbox
          </h2>
          {messages.map((m, i) => (
            <details key={i}>
              <summary>
                {m.subject}
                <small>To {m.recipient}</small>
              </summary>
              <p>{m.body.split("Tracking:")[0]}</p>
              <small>{new Date(m.created).toLocaleString()}</small>
            </details>
          ))}
        </section>
      )}
    </section>
  );
}
export function RecipientTracking({ token, onBack }) {
  const [record, setRecord] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useRef(() => {});
  useEffect(() => {
    let disposed = false,
      pending = false,
      controller;
    const load = async () => {
      if (pending || disposed) return;
      pending = true;
      setBusy(true);
      controller = new AbortController();
      try {
        const next = await api("/track/" + encodeURIComponent(token), {
          signal: controller.signal,
        });
        if (!disposed) {
          setRecord(next);
          setError("");
        }
      } catch (e) {
        if (!disposed) {
          setError(e.message);
          if (e.status === 404) setRecord(null);
        }
      } finally {
        pending = false;
        if (!disposed) setBusy(false);
      }
    };
    refresh.current = load;
    setRecord(null);
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
      controller?.abort();
    };
  }, [token]);
  return (
    <section className="container tracking-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> CoreRunner home
      </button>
      <p className="eyebrow">RECIPIENT TRACKING · LOCAL DEMO</p>
      <h1>
        A little closer
        <br />
        to your door.
      </h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {record && (
        <article className="delivery-card">
          <div className="delivery-card-head">
            <div>
              <p className="delivery-id">{record.id}</p>
              <h2>{statusLabel(record.status)}</h2>
            </div>
            <Package size={35} />
          </div>
          <p>
            {record.service} ·{" "}
            {record.courier
              ? `Courier: ${record.courier.name}`
              : "Waiting for a courier assignment"}
          </p>
          <TrackingRoute tracking={record.tracking} />
          <p className="info-note">
            Updates refresh every 5 seconds while this page is visible.{" "}
            {error
              ? "Connection interrupted; showing the last received update."
              : ""}
          </p>
          <ol className="event-list">
            {record.events.map((e, i) => (
              <li key={i}>
                <strong>{statusLabel(e.kind)}</strong>
                <time>{new Date(e.created).toLocaleString()}</time>
              </li>
            ))}
          </ol>
          <p className="prototype-note">
            This link provides tracking only. It cannot change a booking or
            authorize unattended delivery.
          </p>
        </article>
      )}
      <button
        className="button"
        disabled={busy}
        onClick={() => refresh.current()}
      >
        <RefreshCw size={16} /> Refresh progress
      </button>
    </section>
  );
}
