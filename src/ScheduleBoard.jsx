import React, { useEffect, useState } from "react";
import { api } from "./api";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function Shift({ courier: c, date, onSave }) {
  const [onDuty, setOnDuty] = useState(!!c.shift.on_duty),
    [start, setStart] = useState(c.shift.start_minute / 60),
    [end, setEnd] = useState(c.shift.end_minute / 60),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <article className="shift-card">
      <h3>{c.name}</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`/dispatch/shifts/${c.id}`, {
              method: "POST",
              body: {
                date,
                onDuty,
                startHour: Number(start),
                endHour: Number(end),
              },
            });
            await onSave();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onDuty}
              onChange={(e) => setOnDuty(e.target.checked)}
            />
            On duty
          </label>
          <div className="shift-times">
            <label>
              Start hour (Eastern)
              <input
                type="number"
                min="8"
                max="19"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              End hour (Eastern)
              <input
                type="number"
                min="9"
                max="20"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <button className="button secondary compact">Save shift</button>
        </fieldset>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ul>
        {c.reservations.map((r) => (
          <li key={r.bookingId}>
            <strong>{r.window}</strong>
            <br />
            {r.bookingId} · {r.status.replaceAll("_", " ")}
            <br />
            {r.returnReserveMinutes} minutes reserved for a possible return
          </li>
        ))}
      </ul>
      {!c.reservations.length && (
        <p>No scheduled reservations for this date.</p>
      )}
    </article>
  );
}
export default function ScheduleBoard({ revision }) {
  const [date, setDate] = useState(today),
    [board, setBoard] = useState(null),
    [error, setError] = useState("");
  async function load() {
    setError("");
    setBoard(await api("/dispatch/schedule?date=" + encodeURIComponent(date)));
  }
  useEffect(() => {
    let current = true;
    setBoard(null);
    api("/dispatch/schedule?date=" + encodeURIComponent(date))
      .then((r) => {
        if (current) setBoard(r);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [date, revision]);
  return (
    <details className="schedule-board">
      <summary>Courier schedule and availability</summary>
      <p>
        Daily shifts and scheduled reservations · Eastern time. Each window
        includes delivery handling and a conservative return allowance. Existing
        commitments cannot be removed by editing a shift.
      </p>
      <label>
        Schedule date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {board && (
        <>
          <div className="availability-grid">
            {board.windows.map((w) => (
              <div key={w.label}>
                <strong>{w.label}</strong>
                <span>{w.available} slots available</span>
              </div>
            ))}
          </div>
          <div className="shift-grid">
            {board.couriers.map((c) => (
              <Shift
                key={
                  c.id +
                  date +
                  c.shift.start_minute +
                  c.shift.end_minute +
                  c.shift.on_duty
                }
                courier={c}
                date={date}
                onSave={load}
              />
            ))}
          </div>
        </>
      )}
    </details>
  );
}
export function WindowAvailability({ date, selected }) {
  const [result, setResult] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setResult(null);
    setError("");
    if (date)
      api("/availability?date=" + encodeURIComponent(date))
        .then((r) => {
          if (current) setResult(r);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [date]);
  if (!date)
    return (
      <p className="info-note">
        Choose a date to check sample courier capacity.
      </p>
    );
  return (
    <div className="info-note" aria-live="polite">
      {error ||
        (result
          ? `${result.windows.find((w) => w.label === selected)?.available ?? 0} sample courier slots available for ${selected}. Confirmation reserves capacity; quotes do not hold a slot.`
          : "Checking courier capacity…")}
    </div>
  );
}
