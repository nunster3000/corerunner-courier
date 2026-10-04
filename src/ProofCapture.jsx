import React, { useRef, useState } from "react";
import {
  CheckCircle2,
  Camera,
  PenLine,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { api } from "./api";

export function SignatureDrawing({ strokes }) {
  return (
    <svg
      viewBox="0 0 600 180"
      preserveAspectRatio="none"
      role="img"
      aria-label="Recorded recipient signature"
    >
      {strokes.map((s, i) => (
        <polyline
          key={i}
          points={s.map(([x, y]) => `${x * 600},${y * 180}`).join(" ")}
          fill="none"
          stroke="#142348"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
function SignaturePad({ value, onChange }) {
  const active = useRef(false),
    current = useRef(value);
  function point(e) {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  }
  function start(e) {
    e.preventDefault();
    active.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = [...value, [point(e)]];
    onChange(current.current);
  }
  function move(e) {
    if (!active.current) return;
    const next = current.current.map((s, i) =>
      i === current.current.length - 1 ? [...s, point(e)] : s,
    );
    current.current = next;
    onChange(next);
  }
  return (
    <div className="signature-control">
      <p id="signature-instructions">
        Ask the receiving person to sign below with a finger, mouse, or pen. For
        an attended delivery, PIN is an alternative.
      </p>
      <div
        className="signature-pad"
        aria-label="Draw recipient signature"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => {
          active.current = false;
        }}
        onPointerCancel={() => {
          active.current = false;
        }}
      >
        <SignatureDrawing strokes={value} />
        {!value.length && <span>Sign here</span>}
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          current.current = [];
          onChange([]);
        }}
      >
        <RotateCcw size={13} /> Clear signature
      </button>
    </div>
  );
}
export default function ProofCapture({ booking, onComplete, onCancel }) {
  const leg = booking.status === "returning" ? "return" : "delivery";
  const [method, setMethod] = useState(
      leg === "return"
        ? "signature"
        : booking.delivery.unattended
          ? "photo"
          : "pin",
    ),
    [pin, setPin] = useState(""),
    [signer, setSigner] = useState(""),
    [strokes, setStrokes] = useState([]),
    [consent, setConsent] = useState(false),
    [photo, setPhoto] = useState(""),
    [safeLocation, setSafeLocation] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  async function upload(e) {
    setError("");
    setPhoto("");
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setError("Choose a photo smaller than 4 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.onerror = () => setError("The photo could not be read.");
    reader.readAsDataURL(f);
  }
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/courier/${booking.id}/complete`, {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: {
          leg,
          method,
          pin,
          signer,
          strokes,
          consent,
          photo,
          safeLocation,
        },
      });
      await onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const failed = ["handoff_failed", "return_scheduled"].includes(
    booking.status,
  );
  return (
    <form className="proof-capture" onSubmit={submit}>
      <div className="proof-title">
        <div>
          <p className="eyebrow">
            {leg === "return" ? "RETURN HANDOFF" : "PROOF OF DELIVERY"}
          </p>
          <h3>
            {leg === "return"
              ? "Back in the sender’s hands."
              : "Make the handoff official."}
          </h3>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onCancel}
        >
          Close
        </button>
      </div>
      <fieldset disabled={busy}>
        {leg === "delivery" && !failed && (
          <div className="proof-tabs">
            {[
              ["pin", "Recipient PIN", KeyRound],
              ["signature", "Signature", PenLine],
              ...(booking.delivery.unattended
                ? [["photo", "Unattended photo", Camera]]
                : []),
            ].map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={method === v}
                className={method === v ? "selected" : ""}
                onClick={() => {
                  setMethod(v);
                  setError("");
                  key.current = crypto.randomUUID();
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        )}
        {method === "pin" && (
          <>
            <p>
              The recipient’s six-digit PIN is in their simulated email. Ask for
              it only when handing over the package.
            </p>
            <label className="field">
              Recipient PIN
              <input
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="6-digit PIN"
              />
            </label>
          </>
        )}
        {method === "signature" && (
          <>
            <label className="field">
              Receiving person’s name
              <input
                required
                value={signer}
                onChange={(e) => setSigner(e.target.value)}
                maxLength={100}
                placeholder={
                  leg === "return"
                    ? "Sender or authorized receiver"
                    : "Recipient name"
                }
              />
            </label>
            <SignaturePad value={strokes} onChange={setStrokes} />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={consent}
                required
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I am the receiving person and confirm that I have received this
                package.
              </span>
            </label>
          </>
        )}
        {method === "photo" && (
          <>
            <p className="info-note">
              The sender has authorized unattended delivery. Place the package
              in a suitable location, then photograph the completed drop-off.
            </p>
            <label className="field">
              Delivery photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={upload}
                required
              />
            </label>
            <small>
              JPEG, PNG, or WebP · up to 4 MB. Use a sample photo for this local
              demo.
            </small>
            {photo && (
              <img
                className="photo-preview"
                src={photo}
                alt="Selected delivery proof, not yet submitted"
              />
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={safeLocation}
                onChange={(e) => setSafeLocation(e.target.checked)}
                required
              />
              <span>
                I confirm the package is at a suitable drop-off location and
                this photo shows the completed delivery.
              </span>
            </label>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button"
          disabled={
            busy ||
            (method === "signature" && !strokes.length) ||
            (method === "photo" && !photo)
          }
        >
          {busy
            ? "Saving handoff…"
            : leg === "return"
              ? "Confirm signed return"
              : "Complete delivery"}
          <CheckCircle2 size={17} />
        </button>
      </fieldset>
    </form>
  );
}
export function ProofHistory({ booking }) {
  const [opened, setOpened] = useState(null),
    [record, setRecord] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!booking.proofs?.length) return null;
  async function show(p) {
    setBusy(true);
    setError("");
    try {
      const r = await api(`/bookings/${booking.id}/proofs/${p.id}`);
      setRecord(r);
      setOpened(p.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="proof-history">
      {booking.proofs.map((p) => (
        <button
          className="text-button"
          key={p.id}
          disabled={busy}
          onClick={() => (opened === p.id ? setOpened(null) : show(p))}
        >
          <CheckCircle2 size={16} />
          {p.leg === "return" ? "Return" : "Delivery"} proof · {p.method}
        </button>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {opened && record && (
        <div className="proof-record">
          <p>
            Recorded {new Date(record.created).toLocaleString()}
            {record.signer ? ` · Received by ${record.signer}` : ""}
          </p>
          {record.method === "photo" ? (
            <img
              className="photo-preview"
              src={`/api/bookings/${booking.id}/proofs/${record.id}?image=1`}
              alt="Recorded delivery photo"
            />
          ) : record.method === "signature" ? (
            <SignatureDrawing strokes={record.strokes} />
          ) : (
            <p>
              Recipient PIN successfully verified. The PIN is not displayed or
              reusable.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
