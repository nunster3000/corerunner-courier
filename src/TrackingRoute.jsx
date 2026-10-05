import React from "react";
export default function TrackingRoute({ tracking: t }) {
  if (!t) return null;
  const line = t.route.points.map((p) => p.join(",")).join(" ");
  const first = t.route.points[0],
    last = t.route.points.at(-1);
  return (
    <section
      className="tracking-route-panel"
      aria-label="Simulated courier route"
    >
      <div className="tracking-route-heading">
        <strong>
          {t.phase === "return"
            ? "Returning to sender"
            : t.phase === "pickup"
              ? "On the way to pickup"
              : "Pickup to recipient"}
        </strong>
        <span className="status-badge">Simulation</span>
      </div>
      <svg
        viewBox="0 0 100 90"
        role="img"
        aria-label={`Illustrative route from ${t.route.from} to ${t.route.to}${t.location ? `, ${t.progress}% progressed` : ""}`}
      >
        <rect width="100" height="90" rx="5" fill="#edf2ff" />
        {[15, 35, 55, 75].map((y) => (
          <path
            key={"h" + y}
            d={`M0 ${y} H100`}
            stroke="white"
            strokeWidth="5"
          />
        ))}
        {[18, 42, 62, 82].map((x) => (
          <path
            key={"v" + x}
            d={`M${x} 0 V90`}
            stroke="white"
            strokeWidth="5"
          />
        ))}
        <polyline
          points={line}
          fill="none"
          stroke="#2450d8"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeDasharray="3 2"
        />
        {[first, last].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="4" fill={i ? "#142348" : "#2450d8"} />
            <text
              x={x}
              y={y + 1.3}
              textAnchor="middle"
              fill="white"
              fontSize="4"
              fontWeight="bold"
            >
              {i ? "B" : "A"}
            </text>
          </g>
        ))}
        {t.location && (
          <g>
            <circle
              cx={t.location.x}
              cy={t.location.y}
              r="6"
              fill="#d4a62a"
              opacity=".25"
            />
            <circle
              cx={t.location.x}
              cy={t.location.y}
              r="3"
              fill="#d4a62a"
              stroke="#142348"
              strokeWidth=".7"
            />
          </g>
        )}
      </svg>
      <div className="tracking-route-labels">
        <span>A · {t.route.from}</span>
        <span>B · {t.route.to}</span>
      </div>
      {t.location ? (
        <>
          <p>
            <strong>
              {t.progress}% of simulated {t.phase} route
            </strong>{" "}
            ·{" "}
            {t.paused
              ? "Updates paused"
              : t.stale
                ? "Location is stale"
                : "Latest simulated position"}
          </p>
          <progress
            max="100"
            value={t.progress}
            aria-label="Simulated route progress"
          />
        </>
      ) : (
        <p>
          {t.active
            ? "Waiting for the courier to start this route."
            : "No active courier location is shared."}
        </p>
      )}
      {t.phase === "pickup" && t.location && (
        <p>
          {t.pickupMilesRemaining} simulated miles to pickup · five-mile demo
          route.
        </p>
      )}
      <p className="prototype-note">
        {t.updatedAt
          ? `Last simulated update: ${new Date(t.updatedAt).toLocaleTimeString()}. `
          : ""}
        {t.note}
      </p>
    </section>
  );
}
