import React, { useState } from "react";
import { api } from "./api";

export default function HostedAccess() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function unlock(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/demo-access", { method: "POST", body: { password } });
      window.location.reload();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <main className="hosted-access container">
      <p className="eyebrow">COURIER PORTFOLIO DEMO</p>
      <h1>
        A delivery business,
        <br />
        ready to explore.
      </h1>
      <p>
        Enter the access password provided by the portfolio owner. You’ll get
        your own temporary workspace to try customer bookings, dispatch and
        courier handoffs.
      </p>
      <form onSubmit={unlock}>
        <label htmlFor="demo-password">Demo access password</label>
        <input
          id="demo-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="button primary" disabled={busy}>
          {busy ? "Opening demo…" : "Explore the demo"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      <p className="muted">
        Use sample information only. Workspaces expire after two hours. No real
        emails, payments, GPS or AI requests are sent. Tracking links work
        within your demo browser.
      </p>
    </main>
  );
}
