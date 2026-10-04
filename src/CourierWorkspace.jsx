import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Truck,
  Package,
  MapPin,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { api, statusLabel } from "./api";
import ProofCapture, { ProofHistory } from "./ProofCapture";
export default function CourierWorkspace({ onBack }) {
  const [couriers, setCouriers] = useState([]),
    [selected, setSelected] = useState(""),
    [courier, setCourier] = useState(null),
    [jobs, setJobs] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [proof, setProof] = useState(null);
  const next = {
    assigned: "heading_to_pickup",
    heading_to_pickup: "picked_up",
    picked_up: "heading_to_delivery",
    return_scheduled: "returning",
    handoff_failed: "returning",
  };
  const actionName = {
    heading_to_pickup: "Start pickup route",
    picked_up: "Confirm package pickup",
    heading_to_delivery: "Head to recipient",
    returning: "Start return now",
  };
  async function load() {
    const r = await api("/courier");
    setCourier(r.courier);
    setSelected(r.courier.id);
    setJobs(r.bookings);
  }
  useEffect(() => {
    api("/demo/couriers")
      .then((r) => setCouriers(r.couriers))
      .catch((e) => setError(e.message));
    load().catch((e) => {
      if (e.status !== 403) setError(e.message);
    });
  }, []);
  async function run(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const active = jobs.filter(
      (j) => !["delivered", "returned", "cancelled"].includes(j.status),
    ),
    finished = jobs.filter((j) => ["delivered", "returned"].includes(j.status));
  return (
    <section className="container courier-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> Back to home
      </button>
      <div className="hub-heading">
        <div>
          <p className="eyebrow">COURIER WORKSPACE · LOCAL DEMO</p>
          <h1>
            {courier
              ? `Your route, ${courier.name.split(" ")[0]}.`
              : "Ready for your next stop?"}
          </h1>
          <p>One package at a time. Every handoff accounted for.</p>
        </div>
        <button
          className="button secondary"
          disabled={!courier || busy}
          onClick={() => run(async () => {})}
        >
          <RefreshCw size={16} /> Refresh jobs
        </button>
      </div>
      <div className="courier-selector">
        <Truck size={24} />
        <div>
          <strong>Choose a demo courier</strong>
          <p>
            This local role switch is simulated. A courier can access only their
            assigned jobs.
          </p>
        </div>
        <label className="sr-only" htmlFor="courier-select">
          Demo courier
        </label>
        <select
          id="courier-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select courier</option>
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.vehicle}
            </option>
          ))}
        </select>
        <button
          className="button compact"
          disabled={!selected || busy}
          onClick={() =>
            run(async () => {
              await api("/demo/courier-session", {
                method: "POST",
                body: { courierId: selected },
              });
              setProof(null);
            })
          }
        >
          Open workspace <ArrowRight size={16} />
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {courier && (
        <>
          <div className="courier-stats">
            <span>
              <strong>{active.length}</strong> active delivery
            </span>
            <span>
              <strong>{finished.length}</strong> completed handoffs
            </span>
            <span>
              <Clock3 size={20} />{" "}
              {active.length
                ? "Return capacity reserved"
                : "Available for assignment"}
            </span>
          </div>
          {!active.length && (
            <div className="empty-state">
              <Package size={35} />
              <h2>You’re all caught up.</h2>
              <p>
                Dispatch assignments will appear here. Refresh after a new
                assignment.
              </p>
            </div>
          )}
          {active.map((b) => (
            <article className="courier-job delivery-card" key={b.id}>
              <div className="delivery-card-head">
                <div>
                  <p className="delivery-id">{b.id}</p>
                  <h2>{b.delivery.item}</h2>
                </div>
                <span className="status-badge">{statusLabel(b.status)}</span>
              </div>
              <div className="courier-route">
                <div>
                  <span className="route-marker">A</span>
                  <div>
                    <small>
                      {b.status === "returning" ? "RETURN TO SENDER" : "PICKUP"}
                    </small>
                    <p>{b.delivery.pickup}</p>
                  </div>
                </div>
                <div>
                  <span className="route-marker destination">B</span>
                  <div>
                    <small>
                      DELIVER TO {b.delivery.recipient.toUpperCase()}
                    </small>
                    <p>{b.delivery.dropoff}</p>
                  </div>
                </div>
              </div>
              <div className="job-facts">
                <span>{b.delivery.weight} lbs</span>
                <span>{b.delivery.service}</span>
                <span>
                  {b.delivery.unattended
                    ? "Unattended authorized · photo required"
                    : "Signature or PIN required"}
                </span>
              </div>
              {["return_scheduled", "handoff_failed", "returning"].includes(
                b.status,
              ) && (
                <div className="return-callout">
                  <strong>
                    {b.status === "returning"
                      ? "Return underway"
                      : "Same-day return scheduled"}
                  </strong>
                  <p>
                    Return to the original pickup address
                    {b.returnDueDate ? ` by ${b.returnDueDate}` : ""}. No
                    waiting period is required.
                    {b.status === "returning"
                      ? " Delivery authorization is now closed."
                      : " You may optionally request sender authorization before leaving."}
                  </p>
                  {b.contactRequested && (
                    <small>
                      Sender authorization request recorded. Nothing was sent
                      outside the demo inbox.
                    </small>
                  )}
                  {b.delivery.unattended && b.status !== "returning" && (
                    <p className="authorization-success">
                      <CheckCircle2 size={16} /> The sender authorized
                      unattended delivery. Complete with a photo if a suitable
                      drop-off is possible, or proceed with the return.
                    </p>
                  )}
                </div>
              )}
              {proof === b.id ? (
                <ProofCapture
                  key={b.id + ":" + b.status + ":" + b.delivery.unattended}
                  booking={b}
                  onCancel={() => setProof(null)}
                  onComplete={async () => {
                    setProof(null);
                    await run(async () => {});
                  }}
                />
              ) : (
                <div className="courier-actions">
                  {next[b.status] && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          api(`/courier/${b.id}/advance`, {
                            method: "POST",
                            body: { status: next[b.status] },
                          }),
                        )
                      }
                    >
                      {actionName[next[b.status]]}
                      <ArrowRight size={16} />
                    </button>
                  )}
                  {(b.status === "heading_to_delivery" ||
                    b.status === "returning" ||
                    (["return_scheduled", "handoff_failed"].includes(
                      b.status,
                    ) &&
                      b.delivery.unattended)) && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => setProof(b.id)}
                    >
                      {b.status === "returning"
                        ? "Record return handoff"
                        : "Record delivery proof"}
                      <CheckCircle2 size={17} />
                    </button>
                  )}
                  {b.status === "heading_to_delivery" &&
                    !b.delivery.unattended && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            api(`/courier/${b.id}/advance`, {
                              method: "POST",
                              body: { status: "handoff_failed" },
                            }),
                          )
                        }
                      >
                        No one answered
                      </button>
                    )}
                  {["return_scheduled", "handoff_failed"].includes(b.status) &&
                    !b.delivery.unattended && (
                      <button
                        className="button secondary"
                        disabled={busy || !!b.contactRequested}
                        onClick={() =>
                          run(() =>
                            api(`/courier/${b.id}/contact-sender`, {
                              method: "POST",
                              body: {},
                            }),
                          )
                        }
                      >
                        {b.contactRequested
                          ? "Sender request recorded"
                          : "Ask sender · optional"}
                      </button>
                    )}
                </div>
              )}
              <p className="prototype-note">
                Phone GPS is not connected. Status and proof are stored by the
                backend. Refresh to check for new sender instructions.
              </p>
            </article>
          ))}
          {finished.length > 0 && (
            <section className="completed-jobs">
              <p className="eyebrow">COMPLETED HANDOFFS</p>
              {finished.map((b) => (
                <article className="delivery-card" key={b.id}>
                  <div className="delivery-card-head">
                    <div>
                      <p className="delivery-id">{b.id}</p>
                      <h2>{b.delivery.item}</h2>
                    </div>
                    <span className="status-badge">
                      {statusLabel(b.status)}
                    </span>
                  </div>
                  <ProofHistory booking={b} />
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
