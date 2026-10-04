import React, { useEffect, useState } from "react";
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
export default function DeliveryHub({ mode, onBack, onBook }) {
  const [bookings, setBookings] = useState([]),
    [couriers, setCouriers] = useState([]),
    [messages, setMessages] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(mode !== "dispatch"),
    [selected, setSelected] = useState({}),
    [received, setReceived] = useState({});
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
    returning: "returned",
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
              Live scheduling, readiness review, and delivery proof are not
              connected yet.
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
            {b.status === "awaiting_store_readiness" && (
              <p className="grocery-note">
                Dispatch blocked: store readiness evidence has not been
                reviewed. A preparing order or an uploaded filename never counts
                as approval.
              </p>
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
                  {b.status === "returning" && (
                    <input
                      aria-label={"Return recipient for " + b.id}
                      placeholder="Return received by"
                      value={received[b.id] || ""}
                      onChange={(e) =>
                        setReceived({ ...received, [b.id]: e.target.value })
                      }
                    />
                  )}
                  <button
                    className="button compact"
                    disabled={
                      busy ||
                      (b.status === "returning" && !received[b.id]?.trim())
                    }
                    onClick={() =>
                      act(`/dispatch/${b.id}/advance`, {
                        status: next[b.status],
                        receivedBy: received[b.id],
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
            {mode === "dispatch" && b.status === "heading_to_delivery" && (
              <p className="prototype-note">
                Successful completion will require the proof-of-delivery
                integration. There is no button to bypass the required proof.
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
  async function load() {
    setBusy(true);
    try {
      setRecord(await api("/track/" + encodeURIComponent(token)));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
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
          <p className="info-note">{record.note}</p>
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
      <button className="button" disabled={busy} onClick={load}>
        <RefreshCw size={16} /> Refresh progress
      </button>
    </section>
  );
}
