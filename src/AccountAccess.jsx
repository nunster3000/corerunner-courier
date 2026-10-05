import {
  passwordRequirements,
  validNewPassword,
  passwordGuidance,
} from "../shared/password-policy.js";
import React, { useState, useId } from "react";
import { api } from "./api.js";
import AddressInput from "./AddressInput.jsx";
export default function AccountAccess({
  data = {},
  onUser,
  initialMode = "register",
}) {
  const [mode, setMode] = useState(initialMode),
    [values, setValues] = useState({
      name: data.name || "",
      email: data.email || "",
      phone: data.phone || "",
      pickup: data.pickup || "",
    }),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const register = mode === "register";
  const requirementsId = useId();
  const requirements = passwordRequirements(password);
  const passwordValid = validNewPassword(password);
  const passwordsMatch = password.length > 0 && password === confirmation;
  const update = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  async function submit(e) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (register && !passwordValid) {
      setError(passwordGuidance);
      return;
    }
    if (register && password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: { ...(register ? values : { email: values.email }), password },
      });
      setPassword("");
      setConfirmation("");
      onUser(r.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-access">
      <h2>{register ? "Create your account" : "Welcome back"}</h2>
      <p className="muted">
        {register
          ? "Your demo account and delivery history remain available for 48 hours after signup."
          : "Log in to access your saved account and deliveries."}
      </p>
      <form onSubmit={submit}>
        {register && (
          <label className="field">
            Full name
            <input
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              autoComplete="name"
              maxLength={100}
            />
          </label>
        )}
        <label className="field">
          Email address
          <input
            type="email"
            required
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            autoComplete="username"
            maxLength={254}
          />
        </label>
        {register && (
          <>
            <label className="field">
              Phone number
              <input
                type="tel"
                required
                value={values.phone}
                onChange={(e) => update("phone", e.target.value)}
                autoComplete="tel"
                maxLength={40}
              />
            </label>
            <AddressInput
              label="Default pickup address"
              value={values.pickup}
              onChange={(v) => update("pickup", v)}
            />
          </>
        )}
        <label className="field">
          Password
          <input
            type="password"
            required
            minLength={register ? 8 : 1}
            aria-describedby={register ? requirementsId : undefined}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <>
            <div id={requirementsId} className="password-requirements">
              <p role="status" aria-live="polite">
                {requirements.filter((rule) => rule.met).length} of 4 password
                requirements met
              </p>
              <ul aria-label="Password requirements">
                {requirements.map((rule) => (
                  <li key={rule.id} className={rule.met ? "met" : ""}>
                    <span aria-hidden="true">{rule.met ? "✓" : "○"}</span>
                    <span className="sr-only">
                      {rule.met ? "Met: " : "Not met: "}
                    </span>
                    {rule.label}
                  </li>
                ))}
              </ul>
              <small>
                Up to 128 characters. Spaces do not count as special characters.
              </small>
            </div>
            <label className="field">
              Confirm password
              <input
                type="password"
                required
                value={confirmation}
                maxLength={128}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {confirmation && (
              <p
                className={passwordsMatch ? "password-match" : "muted"}
                role="status"
              >
                {passwordsMatch
                  ? "✓ Passwords match"
                  : "Passwords do not match yet"}
              </p>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button"
          disabled={busy || (register && (!passwordValid || !passwordsMatch))}
          type="submit"
        >
          {busy ? "Please wait…" : register ? "Create account" : "Log in"}
        </button>
      </form>
      <button
        type="button"
        className="text-button"
        disabled={busy}
        onClick={() => {
          setMode(register ? "login" : "register");
          setPassword("");
          setConfirmation("");
          setError("");
        }}
      >
        {register
          ? "Already have an account? Log in"
          : "New here? Create an account"}
      </button>
      <p className="muted">
        After signup, verify your email in the demo inbox. Accounts expire after
        48 hours and are deleted during automatic cleanup. No real email is
        sent; mailbox ownership and password recovery are not connected.
      </p>
    </section>
  );
}
