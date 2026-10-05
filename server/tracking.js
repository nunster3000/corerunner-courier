import { simulatedZone, fail, stamp } from "./domain.js";
export const movingStatuses = [
  "heading_to_pickup",
  "heading_to_delivery",
  "returning",
];
const ended = ["delivered", "returned", "cancelled"];
export function syncSimulation(b) {
  if (b.simulatedTrip?.status === b.status) return;
  b.simulatedTrip = {
    status: b.status,
    sequence: (b.simulatedTrip?.sequence || 0) + 1,
    progress: [
      "picked_up",
      "return_scheduled",
      "handoff_failed",
      ...ended,
    ].includes(b.status)
      ? 100
      : 0,
    updatedAt:
      movingStatuses.includes(b.status) ||
      ["picked_up", "return_scheduled", "handoff_failed", ...ended].includes(
        b.status,
      )
        ? stamp()
        : null,
    paused: false,
  };
}
export function trackingView(b) {
  const s = b.simulatedTrip || {
    sequence: 0,
    progress: 0,
    updatedAt: null,
    paused: false,
  };
  const phase = ["returning", "returned"].includes(b.status)
    ? "return"
    : ["assigned", "heading_to_pickup", "picked_up"].includes(b.status)
      ? "pickup"
      : "delivery";
  const points =
    phase === "pickup"
      ? [
          [12, 78],
          [24, 78],
          [24, 56],
          [38, 56],
        ]
      : phase === "return"
        ? [
            [86, 22],
            [66, 22],
            [66, 56],
            [38, 56],
          ]
        : [
            [38, 56],
            [66, 56],
            [66, 22],
            [86, 22],
          ];
  const progress = s.progress || 0;
  const n = ((points.length - 1) * progress) / 100,
    i = Math.min(points.length - 2, Math.floor(n)),
    f = n - i;
  const active = !!b.courier && !ended.includes(b.status);
  const location =
    active && s.updatedAt
      ? {
          x: points[i][0] + (points[i + 1][0] - points[i][0]) * f,
          y: points[i][1] + (points[i + 1][1] - points[i][1]) * f,
          source: "simulation",
        }
      : null;
  return {
    simulated: true,
    pickupMilesRemaining:
      phase === "pickup"
        ? Math.round(5 * (1 - progress / 100) * 10) / 10
        : null,
    phase,
    progress,
    sequence: s.sequence,
    paused: s.paused,
    active,
    moving: movingStatuses.includes(b.status),
    updatedAt: s.updatedAt,
    stale:
      !!s.updatedAt &&
      active &&
      (s.paused || Date.now() - Date.parse(s.updatedAt) > 60000),
    location,
    route: {
      points,
      from:
        phase === "pickup"
          ? "Demo starting point"
          : simulatedZone(
              phase === "return" ? b.delivery.dropoff : b.delivery.pickup,
            )[0],
      to: simulatedZone(
        phase === "return" || phase === "pickup"
          ? b.delivery.pickup
          : b.delivery.dropoff,
      )[0],
    },
    note: "Simulated route and location, not phone GPS, a street map, or a promised arrival time.",
  };
}
export function changeSimulation(b, input) {
  if (!movingStatuses.includes(b.status))
    fail(
      409,
      "Start a pickup, delivery, or return route before simulating movement.",
    );
  syncSimulation(b);
  const s = b.simulatedTrip;
  if (input.sequence !== s.sequence)
    fail(
      409,
      "Tracking changed. Refresh the courier workspace before retrying.",
    );
  if (!["advance", "pause", "resume"].includes(input.action))
    fail(400, "Choose advance, pause, or resume.");
  if (input.action === "advance") {
    if (s.paused) fail(409, "Resume simulated tracking before advancing.");
    if (s.progress >= 100)
      fail(
        409,
        "The simulated route is complete. Record the pickup or handoff separately.",
      );
    s.progress = Math.min(100, s.progress + 20);
    s.updatedAt = stamp();
  } else {
    s.paused = input.action === "pause";
    if (!s.paused) s.updatedAt = stamp();
  }
  s.sequence++;
}
