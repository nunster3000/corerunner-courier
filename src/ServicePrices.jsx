import React, { useEffect, useState } from "react";
import { api, money } from "./api";

export function useServicePrices(pickup, dropoff, enabled = true) {
  const [result, setResult] = useState(null);
  const key = JSON.stringify([pickup, dropoff]);
  useEffect(() => {
    if (!enabled || !pickup || !dropoff) return;
    const abort = new AbortController();
    const timer = setTimeout(
      () =>
        api("/delivery-options", {
          method: "POST",
          body: { pickup, dropoff },
          signal: abort.signal,
        })
          .then((data) => setResult({ key, data }))
          .catch((e) => {
            if (!abort.signal.aborted) setResult({ key, error: e.message });
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [key, enabled]);
  return result?.key === key ? result : null;
}
export default function ServicePrices({ pickup, dropoff, onSelect, disabled }) {
  const result = useServicePrices(pickup, dropoff);
  return (
    <div className="corey-card service-prices">
      <strong>Compare delivery prices</strong>
      {!result && <p role="status">Loading demo prices…</p>}
      {result?.error && <p role="alert">{result.error}</p>}
      {result?.data?.options.map((option) => (
        <button
          type="button"
          key={option.service}
          disabled={disabled}
          onClick={() => onSelect(option.service)}
        >
          {option.service}
          <strong>{money(option.price.total)}</strong>
        </button>
      ))}
      {result?.data && <small>{result.data.note}</small>}
    </div>
  );
}
