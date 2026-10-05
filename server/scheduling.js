import { fail, price, text } from "./domain.js";
import { transaction } from "./db.js";
export const windows = [
  ["8–10 a.m.", 480, 600],
  ["10 a.m.–1 p.m.", 600, 780],
  ["1–4 p.m.", 780, 960],
  ["4–6 p.m.", 960, 1080],
  ["6–8 p.m.", 1080, 1200],
];
const terminal = ["cancelled", "delivered", "returned"];
export function easternClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
function validDate(value) {
  const date = text(value, "Schedule date", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    fail(400, "Choose a valid schedule date.");
  return date;
}
export function scheduler(db, now = () => new Date()) {
  const jobs = () =>
    db
      .prepare("SELECT id,payload FROM bookings")
      .all()
      .map((r) => ({ id: r.id, ...JSON.parse(r.payload) }))
      .filter((b) => !terminal.includes(b.status));
  const shift = (id, date) =>
    db
      .prepare("SELECT * FROM courier_shifts WHERE courier_id=? AND date=?")
      .get(id, date) || {
      courier_id: id,
      date,
      on_duty: 1,
      start_minute: 480,
      end_minute: 1200,
    };
  const overlaps = (a, b) =>
    a.startMinute < b.endMinute && b.startMinute < a.endMinute;
  const conflicts = (id, date, slot, exclude) => {
    const clock = easternClock(now());
    return jobs()
      .filter((b) => b.id !== exclude)
      .some((b) => {
        if (
          b.schedule?.courierId === id &&
          b.schedule.date === date &&
          overlaps(slot, b.schedule)
        )
          return true;
        // An active job has priority over a planned window until custody is closed.
        if (
          b.courier?.id === id &&
          ([
            "exception_hold",
            "returning",
            "return_scheduled",
            "handoff_failed",
          ].includes(b.status) ||
            date === clock.date)
        )
          return true;
        return false;
      });
  };
  const eligible = (id, date, slot, exclude) => {
    const s = shift(id, date);
    return (
      !!s.on_duty &&
      s.start_minute <= slot.startMinute &&
      s.end_minute >= slot.endMinute &&
      !conflicts(id, date, slot, exclude)
    );
  };
  const availability = (date) => {
    validDate(date);
    const clock = easternClock(now());
    return {
      date,
      timeZone: "America/New_York",
      simulated: true,
      windows: windows.map(([label, startMinute, endMinute]) => ({
        label,
        startMinute,
        endMinute,
        available:
          date < clock.date ||
          (date === clock.date && clock.minute >= startMinute)
            ? 0
            : db
                .prepare("SELECT id FROM couriers")
                .all()
                .filter((c) => eligible(c.id, date, { startMinute, endMinute }))
                .length,
      })),
      note: "Sample roster capacity. Quote checks route fit; confirmation reserves the slot. Quotes do not hold capacity.",
    };
  };
  const plan = (d, { exclude, courierId } = {}) => {
    if (d.service !== "Scheduled") return null;
    const clock = easternClock(now());
    const w = windows.find((w) => w[0] === d.window);
    if (!w) fail(400, "Choose a supported delivery window.");
    if (d.date < clock.date || (d.date === clock.date && clock.minute >= w[1]))
      fail(409, "This delivery window has started. Choose a later window.");
    const routeMinutes = price(d).minutes,
      returnReserveMinutes = routeMinutes + 15;
    if (routeMinutes + 15 + returnReserveMinutes > w[2] - w[1])
      fail(
        409,
        "This demo route needs a longer delivery window to reserve its possible return.",
      );
    const slot = {
      date: d.date,
      window: d.window,
      startMinute: w[1],
      endMinute: w[2],
      returnReserveMinutes,
      simulated: true,
    };
    const c = db
      .prepare("SELECT id FROM couriers")
      .all()
      .find(
        (c) =>
          (!courierId || c.id === courierId) &&
          eligible(c.id, d.date, slot, exclude),
      );
    if (!c)
      fail(
        409,
        "No courier capacity remains for this window. Choose another window.",
      );
    return { ...slot, courierId: c.id };
  };
  const assignment = (b, id) => {
    const clock = easternClock(now());
    if (b.delivery.service === "Scheduled") {
      if (b.delivery.date !== clock.date)
        fail(
          409,
          "Scheduled jobs can be dispatched only on their delivery date.",
        );
      const slot = b.schedule || {
        startMinute: windows.find((w) => w[0] === b.delivery.window)?.[1],
        endMinute: windows.find((w) => w[0] === b.delivery.window)?.[2],
      };
      const needed = 2 * price(b.delivery).minutes + 30;
      if (Math.max(clock.minute, slot.startMinute) + needed > slot.endMinute)
        fail(
          409,
          "Not enough time remains in this window for delivery and a possible return. Dispatch review is required.",
        );
      if (!eligible(id, clock.date, slot, b.id))
        fail(
          409,
          "This courier is off duty or reserved during the delivery window.",
        );
      return {
        ...slot,
        date: clock.date,
        window: b.delivery.window,
        courierId: id,
        returnReserveMinutes: price(b.delivery).minutes + 15,
        simulated: true,
      };
    }
    // Unscheduled jobs reserve a conservative round trip at assignment, never a promised arrival time.
    const s = shift(id, clock.date),
      end = clock.minute + 2 * price(b.delivery).minutes + 30;
    if (!s.on_duty || clock.minute < s.start_minute || end > s.end_minute)
      fail(
        409,
        "This trip and its possible return do not fit the courier’s shift. Choose another courier or a scheduled window.",
      );
    if (
      jobs().some(
        (j) =>
          j.id !== b.id &&
          j.schedule?.courierId === id &&
          j.schedule.date === clock.date &&
          overlaps({ startMinute: clock.minute, endMinute: end }, j.schedule),
      )
    )
      fail(
        409,
        "This trip would conflict with a scheduled delivery and its reserved return time.",
      );
    return null;
  };
  const board = (date) => ({
    ...availability(date),
    couriers: db
      .prepare("SELECT * FROM couriers")
      .all()
      .map((c) => ({
        ...c,
        shift: shift(c.id, date),
        reservations: jobs()
          .filter(
            (b) => b.schedule?.date === date && b.schedule.courierId === c.id,
          )
          .map((b) => ({ bookingId: b.id, status: b.status, ...b.schedule })),
      })),
  });
  const updateShift = (id, body) =>
    transaction(db, () => {
      const date = validDate(body.date),
        start = Number(body.startHour) * 60,
        end = Number(body.endHour) * 60;
      if (!db.prepare("SELECT id FROM couriers WHERE id=?").get(id))
        fail(404, "Courier not found.");
      if (
        typeof body.onDuty !== "boolean" ||
        !Number.isInteger(start / 60) ||
        !Number.isInteger(end / 60) ||
        start < 480 ||
        end > 1200 ||
        start >= end
      )
        fail(400, "Choose a valid shift within 8 a.m.–8 p.m. Eastern.");
      if (
        jobs().some(
          (b) =>
            (b.schedule?.date === date &&
              b.schedule.courierId === id &&
              (!body.onDuty ||
                start > b.schedule.startMinute ||
                end < b.schedule.endMinute)) ||
            (b.courier?.id === id && date === easternClock(now()).date),
        )
      )
        fail(
          409,
          "This shift change conflicts with a reservation or active job. Existing commitments are preserved.",
        );
      db.prepare(
        "INSERT INTO courier_shifts VALUES(?,?,?,?,?) ON CONFLICT(courier_id,date) DO UPDATE SET on_duty=excluded.on_duty,start_minute=excluded.start_minute,end_minute=excluded.end_minute",
      ).run(id, date, body.onDuty ? 1 : 0, start, end);
      return board(date);
    });
  return { availability, plan, assignment, board, updateShift };
}
