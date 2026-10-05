import { transaction } from "./db.js";
import { fail } from "./domain.js";
export const scenarios = [
  {
    id: "everyday",
    title: "A package across town",
    description:
      "Follow booking, courier assignment, tracking and a PIN or signature handoff.",
    item: "Everyday package",
    weight: 8,
  },
  {
    id: "groceries",
    title: "Ready for pickup?",
    description:
      "Review a preparing order, replace it with ready confirmation, then release it for dispatch.",
    item: "Groceries",
    weight: 12,
  },
  {
    id: "return",
    title: "Nobody answers the door",
    description:
      "Attempt an attended handoff, schedule a return, and record the signed return receipt.",
    item: "Flowers or gifts",
    weight: 5,
  },
];
export function installWalkthrough(
  app,
  {
    db,
    auth,
    demoOnly,
    createQuote,
    createBooking,
    read,
    present,
    cookies,
    cookie,
    hash,
    secret,
  },
) {
  const browserKey = (req, res) => {
    let token = cookies(req).cr_walkthrough;
    if (!/^[a-f0-9]{64}$/.test(token || "")) {
      // Concurrent first-use requests must establish the same browser key.
      token = hash("walkthrough:" + cookies(req).cr_session);
      cookie(res, "cr_walkthrough", token, 30 * 86400000);
    }
    return hash(token);
  };
  app.get("/api/demo/scenarios", demoOnly, (req, res) =>
    res.json({ scenarios }),
  );
  app.get("/api/demo/walkthrough", demoOnly, auth, (req, res) => {
    const key = browserKey(req, res);
    res.json({
      runs: db
        .prepare(
          "SELECT booking_id,scenario FROM demo_records WHERE user_id=? AND browser_key=?",
        )
        .all(req.user.id, key)
        .map((r) => ({
          scenario: r.scenario,
          booking: present(read(r.booking_id)),
        })),
    });
  });
  app.post("/api/demo/scenarios/:scenario", demoOnly, auth, (req, res) => {
    const scenario = scenarios.find((s) => s.id === req.params.scenario);
    if (!scenario) fail(404, "Demo scenario not found.");
    if (req.body.accepted !== true)
      fail(400, "Confirm that you want to create a sample booking.");
    const key = browserKey(req, res);
    const result = transaction(db, () => {
      const old = db
        .prepare(
          "SELECT booking_id FROM demo_records WHERE user_id=? AND browser_key=? AND scenario=?",
        )
        .get(req.user.id, key, scenario.id);
      if (old)
        return {
          scenario: scenario.id,
          booking: present(read(old.booking_id)),
          reused: true,
        };
      const d = {
        pickup: "100 Sample Street, Atlanta, GA 30303",
        dropoff: "200 Example Lane, Decatur, GA 30030",
        recipient: "Jamie Sample",
        recipientEmail: "jamie@example.com",
        item: scenario.item,
        weight: scenario.weight,
        service: "Same-day",
        unattended: false,
      };
      const quote = createQuote(req.user.id, d);
      const result = createBooking({
        user: req.user,
        body: { quoteId: quote.id, accepted: true, paymentOutcome: "approve" },
        get: () => `tour:${key}:${scenario.id}`,
      });
      db.prepare("INSERT INTO demo_records VALUES(?,?,?,?)").run(
        result.booking.id,
        req.user.id,
        key,
        scenario.id,
      );
      return { ...result, scenario: scenario.id };
    });
    res.status(result.reused ? 200 : 201).json(result);
  });
  app.post("/api/demo/walkthrough/reset", demoOnly, auth, (req, res) => {
    if (req.body.confirmed !== true)
      fail(
        400,
        "Confirm removal of this browser’s generated walkthrough records.",
      );
    const key = browserKey(req, res);
    const count = transaction(db, () => {
      const records = db
        .prepare(
          "SELECT d.booking_id,b.quote_id FROM demo_records d JOIN bookings b ON b.id=d.booking_id WHERE d.user_id=? AND d.browser_key=?",
        )
        .all(req.user.id, key);
      for (const r of records) {
        // Only backend-tagged walkthrough bookings are eligible. No caller-provided IDs or broad account deletion.
        for (const table of [
          "proofs",
          "grocery_evidence",
          "cancellation_quotes",
          "tracking",
          "handoff_codes",
          "events",
          "payments",
          "notifications",
          "demo_records",
        ])
          db.prepare(`DELETE FROM ${table} WHERE booking_id=?`).run(
            r.booking_id,
          );
        db.prepare("DELETE FROM bookings WHERE id=?").run(r.booking_id);
        db.prepare("DELETE FROM quotes WHERE id=? AND user_id=?").run(
          r.quote_id,
          req.user.id,
        );
      }
      return records.length;
    });
    res.json({ removed: count });
  });
}
