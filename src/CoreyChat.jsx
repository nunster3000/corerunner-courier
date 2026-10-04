import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Send, Sparkles, X } from "lucide-react";
import { api, money } from "./api.js";

export default function CoreyChat({
  open,
  onClose,
  onForm,
  data,
  onDraft,
  user,
  onUser,
}) {
  const [mode, setMode] = useState("mock");
  const [available, setAvailable] = useState(null),
    [messages, setMessages] = useState([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [draft, setDraft] = useState(null),
    [quote, setQuote] = useState(null),
    [verification, setVerification] = useState(null),
    [accepted, setAccepted] = useState(false),
    [unattended, setUnattended] = useState(false),
    [booking, setBooking] = useState(null);
  const key = useRef(crypto.randomUUID()),
    end = useRef(null),
    close = useRef(null);
  useEffect(() => {
    if (open) {
      close.current?.focus();
      api("/corey/status")
        .then((r) => {
          setAvailable(r.available);
          setMode(r.mode || "live-ai");
        })
        .catch((e) => setError(e.message));
    }
  }, [open]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy, quote, booking]);
  const previousUser = useRef(user?.id);
  useEffect(() => {
    if (previousUser.current && previousUser.current !== user?.id) {
      setMessages([]);
      setDraft(null);
      setQuote(null);
      setBooking(null);
      setVerification(null);
      setInput("");
    }
    previousUser.current = user?.id;
  }, [user?.id]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const send = (e) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    run(async () => {
      const result = await api("/corey/message", {
        method: "POST",
        body: { message, draft: data },
      });
      setMessages((m) => [
        ...m,
        { role: "user", text: message },
        { role: "assistant", text: result.reply },
      ]);
      setInput("");
      setDraft(result.draft);
      onDraft(result.draft);
      setQuote(result.quote);
      setAccepted(false);
      setUnattended(false);
      setBooking(null);
      key.current = crypto.randomUUID();
    });
  };
  const verify = () =>
    run(async () => {
      await api("/auth/request", { method: "POST", body: draft || data });
      setVerification(await api("/auth/inbox"));
    });
  const finishVerify = () =>
    run(async () => {
      const result = await api("/auth/verify", {
        method: "POST",
        body: { token: verification.token },
      });
      onUser(result.user);
      setVerification(null);
      setMessages([
        {
          role: "assistant",
          text: "Your demo account is verified. Tell me to prepare your quote, or add any missing delivery details.",
        },
      ]);
    });
  const refreshQuote = (value) =>
    run(async () => {
      setQuote(null);
      setAccepted(false);
      setUnattended(value);
      const q = await api("/quotes", {
        method: "POST",
        body: { ...(draft || data), unattended: value },
      });
      setQuote(q);
      key.current = crypto.randomUUID();
    });
  const confirm = () =>
    run(async () => {
      const result = await api("/bookings", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: { quoteId: quote.id, accepted: true, paymentOutcome: "approve" },
      });
      setBooking(result.booking);
      setQuote(null);
      setAccepted(false);
    });
  if (!open) return null;
  return (
    <section
      className="chat-panel"
      role="region"
      aria-label="Corey booking assistant"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="chat-header">
        <span className="corey-ai-icon">
          <Sparkles size={24} />
        </span>
        <div>
          <strong>Corey the Courier</strong>
          <small>
            {mode === "mock"
              ? "Scripted demo assistant"
              : available
                ? "AI booking & support"
                : "AI connection setup"}
          </small>
        </div>
        <button
          ref={close}
          className="icon-button"
          aria-label="Close Corey"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="chat-content" aria-live="polite" aria-busy={busy}>
        <p className="chat-disclaimer">
          {mode === "mock"
            ? "Scripted portfolio demo · no AI service or API key is used. Say start to book or help for service questions. Use sample details."
            : available
              ? "AI conversations are sent to OpenAI. Use sample details in this portfolio demo. Email, payments and delivery operations are simulated."
              : "Corey needs a server API key before AI chat is available. You can still book using the form."}
        </p>
        <div className="bubble">
          Hey, I’m Corey! Say “start” and I’ll guide you through a delivery. I
          can help with delivery questions, your account, and booking right
          here.
        </div>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble ${m.role === "user" ? "user-bubble" : ""}`}
          >
            {m.text}
          </div>
        ))}
        {!user &&
          draft?.name &&
          draft?.email &&
          draft?.phone &&
          draft?.pickup &&
          !verification && (
            <button className="button" disabled={busy} onClick={verify}>
              Verify account
            </button>
          )}
        {verification && (
          <div className="corey-card">
            <strong>Demo email inbox</strong>
            <p>
              Verification for {verification.email}. No real email was sent.
            </p>
            <button className="button" disabled={busy} onClick={finishVerify}>
              Simulate email verification
            </button>
          </div>
        )}
        {quote && !booking && (
          <div className="corey-card">
            <strong>
              Your backend demo quote · {money(quote.price.total)}
            </strong>
            <p>
              {quote.delivery.pickup} → {quote.delivery.dropoff}
            </p>
            <p>
              {quote.delivery.recipient} · {quote.delivery.item} ·{" "}
              {quote.delivery.weight} lb · {quote.delivery.service}
              {quote.delivery.date &&
                ` · ${quote.delivery.date} · ${quote.delivery.window}`}
            </p>
            <p>
              Base {money(quote.price.base)} · Distance{" "}
              {money(quote.price.distance)} · Time {money(quote.price.time)} ·
              Expedited {money(quote.price.expedited)}
            </p>
            <p>
              Illustrative route and rates. Quote expires at{" "}
              {new Date(quote.expires).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              .
            </p>
            <label>
              <input
                type="checkbox"
                checked={unattended}
                disabled={busy}
                onChange={(e) => refreshQuote(e.target.checked)}
              />{" "}
              Allow unattended delivery (photo required)
            </label>
            <p>
              {unattended
                ? "You authorize a photographed unattended delivery."
                : "Signature or recipient PIN required."}{" "}
              If handoff fails, a same-day return is the default.
              Customer-caused return adds {money(quote.price.returnTotal)};
              original charge is retained. No extra return fee for a
              CoreRunner-caused failure.
            </p>
            {quote.delivery.item === "Groceries" && (
              <p>Store readiness review is required before dispatch.</p>
            )}
            <label>
              <input
                type="checkbox"
                checked={accepted}
                disabled={busy}
                onChange={(e) => setAccepted(e.target.checked)}
              />{" "}
              I accept this demo quote and the return policy.
            </label>
            <button
              className="button"
              disabled={busy || !accepted}
              onClick={confirm}
            >
              Confirm demo booking
            </button>
          </div>
        )}
        {booking && (
          <div className="corey-card">
            <strong>Booking saved · {booking.id}</strong>
            <p>
              {booking.status === "awaiting_store_readiness"
                ? "Awaiting store readiness review."
                : "Awaiting dispatch assignment."}{" "}
              Demo payment authorized: {money(booking.price.total)}.
            </p>
            <a href={`/?track=${booking.trackingToken}`}>Track this delivery</a>
          </div>
        )}
        {busy && <div className="bubble">Corey is working…</div>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div ref={end} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-reply">
          Reply to Corey
        </label>
        <input
          id="chat-reply"
          value={input}
          maxLength={2000}
          disabled={!available || busy}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell Corey about your delivery…"
          autoComplete="off"
        />
        <button
          className="icon-button"
          aria-label="Send reply"
          type="submit"
          disabled={!available || busy || !input.trim()}
        >
          <Send size={20} />
        </button>
      </form>
      <button className="chat-switch" disabled={busy} onClick={onForm}>
        Prefer a form? Continue there <ArrowUpRight size={13} />
      </button>
      <button
        className="chat-switch"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await api("/corey/reset", { method: "POST", body: {} });
            setMessages([]);
            setDraft(null);
            setQuote(null);
            setBooking(null);
            setAccepted(false);
            setVerification(null);
          })
        }
      >
        Start a new conversation
      </button>
    </section>
  );
}
