import React, { useState } from "react";
import { api } from "./api.js";
export default function DemoVerification({ user, onVerified, onSignOut }) {
  const [inbox, setInbox] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const open = () =>
    run(async () => {
      await api("/auth/request", { method: "POST", body: {} });
      setInbox(await api("/auth/inbox"));
    });
  const verify = () =>
    run(async () => {
      const r = await api("/auth/verify", {
        method: "POST",
        body: { token: inbox.token },
      });
      onVerified(r.user);
    });
  return (
    <section className="account-access" aria-labelledby="verify-title">
      <h2 id="verify-title">Verify your email</h2>
      <p>
        Your account is saved. Complete demo email verification to access your
        deliveries and book a courier.
      </p>
      <p>
        <strong>{user.email}</strong>
      </p>
      {user.expiresAt && (
        <p className="muted">
          This demo account expires on{" "}
          {new Date(user.expiresAt).toLocaleString()}. Its data is then deleted
          during automatic cleanup.
        </p>
      )}
      <p className="muted">
        This is a simulated inbox. No real email is sent, and this does not
        confirm ownership of an actual mailbox.
      </p>
      {!inbox ? (
        <button className="button" disabled={busy} onClick={open}>
          {busy ? "Opening…" : "Open demo inbox"}
        </button>
      ) : (
        <div className="corey-card">
          <h3>Demo inbox</h3>
          <p>To: {inbox.email}</p>
          <p>
            Welcome to CoreRunner. Verify your email to finish setting up your
            saved account.
          </p>
          <button className="button" disabled={busy} onClick={verify}>
            {busy ? "Please wait…" : "Simulate email verification"}
          </button>
          <small>This verification expires in 10 minutes.</small>
          <button className="text-button" disabled={busy} onClick={open}>
            Request new demo email
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="text-button" disabled={busy} onClick={onSignOut}>
        Sign out
      </button>
    </section>
  );
}
