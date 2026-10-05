import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Package, RotateCcw, ShieldCheck } from "lucide-react";
import { api, statusLabel } from "./api";
const demoProfile = () => ({
  name: "Alex Sample",
  email: `tour-${crypto.randomUUID()}@example.com`,
  phone: "4045550123",
  pickup: "100 Sample Street, Atlanta, GA 30303",
});
export function nextStep(run) {
  const b = run.booking;
  if (b.status === "awaiting_store_readiness")
    return {
      page: "deliveries",
      title: "Review grocery readiness",
      text: "In My deliveries, load a sample preparing screen and submit it. In Demo dispatch, reject it with a reason. Replace it with the ready sample and approve the four review checks.",
    };
  if (b.status === "confirmed")
    return {
      page: "dispatch",
      title: "Assign an available courier",
      text: "Enter demo dispatch, find this booking, and choose an available courier. Assignment respects Atlanta operating hours, shifts and existing reservations.",
    };
  if (["assigned", "heading_to_pickup", "picked_up"].includes(b.status))
    return {
      page: "courier",
      title: "Take the pickup route",
      text: "Choose the assigned courier, open the workspace, and start pickup. Advance the demo location, confirm pickup, then head to the recipient. Open tracking to see updates.",
    };
  if (b.status === "heading_to_delivery")
    return run.scenario === "return"
      ? {
          page: "courier",
          title: "Try the failed-handoff path",
          text: "Choose No one answered. A return is scheduled immediately. Start the return, then capture the sender’s signature.",
        }
      : {
          page: "courier",
          title: "Complete the attended handoff",
          text: "Find the recipient PIN in My deliveries → Demo inbox. In the courier workspace, record delivery proof with that PIN or a sample signature.",
        };
  if (["return_scheduled", "handoff_failed", "returning"].includes(b.status))
    return {
      page: "courier",
      title: "Bring it back to the sender",
      text: "Start the return if needed, then record a signed return handoff. The backend records the disclosed return charge once.",
    };
  if (["delivered", "returned", "cancelled"].includes(b.status))
    return {
      page: "deliveries",
      title: "Walkthrough complete",
      text: "Review the activity timeline, simulated receipt and proof history. Return to Guided demo to reset these generated records or try another scenario.",
    };
  return {
    page: "dispatch",
    title: "Review the exception",
    text: "Open dispatch to review custody and arrange the next permitted action.",
  };
}
export function DemoGuide({ run, onNavigate, onExit }) {
  const [current, setCurrent] = useState(run);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api("/bookings/" + run.booking.id)
        .then((r) => {
          if (active) setCurrent({ ...run, booking: r.booking });
        })
        .catch(() => {});
    setCurrent(run);
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [run]);
  const step = nextStep(current);
  return (
    <aside className="demo-guide container" aria-label="Active demo guide">
      <div>
        <span className="eyebrow">GUIDED DEMO · {current.booking.id}</span>
        <strong>{step.title}</strong>
        <p>{step.text}</p>
      </div>
      <div className="guide-actions">
        <button
          className="button compact"
          onClick={() => onNavigate(step.page)}
        >
          Next workspace <ArrowRight size={15} />
        </button>
        <button className="text-button" onClick={() => onNavigate("demo")}>
          All scenarios
        </button>
        <a
          className="text-button"
          href={`/?track=${current.booking.trackingToken}`}
          target="_blank"
          rel="noreferrer"
        >
          Tracking
        </a>
        <button className="text-button" onClick={onExit}>
          Hide guide
        </button>
      </div>
    </aside>
  );
}
export default function DemoStudio({
  user,
  onUser,
  onRun,
  onNavigate,
  onReset,
}) {
  const [scenarios, setScenarios] = useState([]),
    [runs, setRuns] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmReset, setConfirmReset] = useState(false),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  async function load() {
    const id = ++generation.current;
    try {
      const result = await api("/demo/walkthrough");
      if (id === generation.current) setRuns(result.runs);
    } catch (e) {
      if (id === generation.current) {
        if (e.status === 401) setRuns([]);
        else setError(e.message);
      }
    }
  }
  useEffect(() => {
    api("/demo/scenarios")
      .then((r) => setScenarios(r.scenarios))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [user?.id]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const start = (scenario) =>
    run(async () => {
      if (!user) {
        await api("/auth/request", { method: "POST", body: demoProfile() });
        const inbox = await api("/auth/inbox");
        const r = await api("/auth/verify", {
          method: "POST",
          body: { token: inbox.token },
        });
        onUser(r.user);
      }
      const result = await api("/demo/scenarios/" + scenario.id, {
        method: "POST",
        body: { accepted: true },
      });
      await load();
      onRun(result);
      setNotice(`${result.booking.id} is ready. Follow the guide below.`);
    });
  return (
    <section className="container demo-studio">
      <p className="eyebrow">EXPLORE THE PORTFOLIO</p>
      <h1>
        One delivery.
        <br />
        Every perspective.
      </h1>
      <p className="demo-lead">
        Try CoreRunner as the customer, the dispatcher and the courier. Follow a
        package from booking to proof of delivery—or bring it safely back home.
      </p>
      <div className="demo-callout">
        <ShieldCheck size={24} />
        <div>
          <strong>A working demo with clear boundaries</strong>
          <p>
            Starting a scenario creates a sample booking and, if needed, a
            sample account. Payments, emails, tracking and Corey are simulated.
            Nothing is sent or charged. Dispatch follows current Atlanta
            operating hours and available shifts.
          </p>
        </div>
      </div>
      <div className="scenario-grid">
        {scenarios.map((s) => {
          const existing = runs.find((r) => r.scenario === s.id);
          return (
            <article className="scenario-card" key={s.id}>
              <Package size={28} />
              <h2>{s.title}</h2>
              <p>{s.description}</p>
              {existing && (
                <p className="scenario-status">
                  {existing.booking.id}
                  <br />
                  {statusLabel(existing.booking.status)}
                </p>
              )}
              <button
                className="button"
                disabled={busy}
                onClick={() => (existing ? onRun(existing) : start(s))}
              >
                {existing ? "Resume walkthrough" : "Create sample booking"}{" "}
                <ArrowRight size={16} />
              </button>
            </article>
          );
        })}
      </div>
      {notice && (
        <p role="status" className="info-note">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="demo-reset">
        <div>
          <h2>A fresh walkthrough.</h2>
          <p>
            Reset removes only the scenario bookings generated in this browser
            for your current account, including their proof uploads, tracking
            links and simulated receipts. Manually created bookings, accounts,
            courier shifts and other browsers’ scenarios remain.
          </p>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            disabled={busy || !runs.length}
            checked={confirmReset}
            onChange={(e) => setConfirmReset(e.target.checked)}
          />
          Clear my {runs.length} generated scenario
          {runs.length === 1 ? "" : "s"} and their related records.
        </label>
        <button
          className="button secondary"
          disabled={busy || !confirmReset || !runs.length}
          onClick={() =>
            run(async () => {
              const result = await api("/demo/walkthrough/reset", {
                method: "POST",
                body: { confirmed: true },
              });
              setConfirmReset(false);
              onReset();
              await load();
              setNotice(
                `Removed ${result.removed} walkthrough bookings. Your other work is still here.`,
              );
            })
          }
        >
          <RotateCcw size={16} /> Reset walkthrough records
        </button>
      </section>
      <section className="project-story">
        <p className="eyebrow">ABOUT THIS PROJECT</p>
        <h2>A small service, with the details handled.</h2>
        <p>
          CoreRunner explores what a personal and small-business courier
          platform needs beyond a booking form: capacity, custody, consent,
          evidence and recovery when a delivery goes wrong.
        </p>
        <div className="story-grid">
          <div>
            <h3>Customers stay in control</h3>
            <p>
              Verified demo accounts, clear quote confirmation, cancellation
              previews and explicit unattended-delivery permission.
            </p>
          </div>
          <div>
            <h3>Operations own the outcome</h3>
            <p>
              The backend validates assignments, reserves return capacity,
              checks grocery evidence reviews and requires delivery proof.
            </p>
          </div>
          <div>
            <h3>Prepared for a future operator</h3>
            <p>
              A modular React and JavaScript codebase with documented simulation
              boundaries. Commercial use still needs deployment, production
              identity and the buyer’s selected services.
            </p>
          </div>
        </div>
        <a
          className="text-button"
          href="https://github.com/nunster3000/corerunner-courier"
          target="_blank"
          rel="noreferrer"
        >
          Explore the source on GitHub ↗
        </a>
      </section>
      <button className="text-button" onClick={() => onNavigate("home")}>
        Back to CoreRunner
      </button>
    </section>
  );
}
