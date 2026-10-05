import { randomUUID } from "node:crypto";
import { transaction } from "./db.js";
import { atlantaDate, fail, stamp, text } from "./domain.js";
import { normalizePhoto } from "./proof.js";

export function requireCurrentReadiness(b) {
  if (b.delivery.item !== "Groceries") return;
  if (b.readiness?.status !== "approved")
    fail(409, "Store readiness must be approved before dispatch.");
  if (b.readiness.pickupDate !== atlantaDate())
    fail(
      409,
      "Readiness evidence is not for today. Upload current store confirmation for review.",
    );
  if (b.delivery.service === "Scheduled" && b.delivery.date !== atlantaDate())
    fail(409, "Grocery pickup must occur on the scheduled delivery date.");
}
export function installGroceries(
  app,
  { db, auth, staff, read, owned, save, present, event, notify, canRead },
) {
  const editable = (b) => {
    if (b.delivery.item !== "Groceries")
      fail(400, "Readiness evidence is only for grocery deliveries.");
    if (
      !["awaiting_store_readiness", "confirmed"].includes(b.status) ||
      b.courier
    )
      fail(409, "Readiness evidence cannot change after assignment.");
  };
  app.post("/api/bookings/:id/readiness", auth, async (req, res) => {
    editable(owned(req));
    const requestKey = text(req.get("Idempotency-Key"), "Idempotency key", 100);
    const existing = () =>
      db
        .prepare(
          "SELECT id FROM grocery_evidence WHERE booking_id=? AND request_key=?",
        )
        .get(req.params.id, requestKey);
    if (existing())
      return res.json({ booking: present(owned(req)), reused: true });
    const store = text(req.body.store, "Store name", 100),
      orderReference = text(req.body.orderReference, "Order reference", 100),
      pickupDate = text(
        req.body.pickupDate,
        "Pickup date shown in evidence",
        10,
      );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) ||
      !Number.isFinite(Date.parse(pickupDate)) ||
      new Date(pickupDate).toISOString().slice(0, 10) !== pickupDate
    )
      fail(400, "Use a valid pickup date shown in the store confirmation.");
    const image = await normalizePhoto(req.body.image);
    const result = transaction(db, () => {
      const b = owned(req);
      editable(b);
      if (existing()) return { booking: present(b), reused: true };
      if (
        db
          .prepare("SELECT count(*) n FROM grocery_evidence WHERE booking_id=?")
          .get(b.id).n >= 10
      )
        fail(
          409,
          "This booking has reached its evidence upload limit. Contact demo dispatch.",
        );
      const evidence = {
        id: randomUUID(),
        store,
        orderReference,
        pickupDate,
        status: "pending",
        submittedAt: stamp(),
      };
      db.prepare("INSERT INTO grocery_evidence VALUES(?,?,?,?,?)").run(
        evidence.id,
        b.id,
        requestKey,
        JSON.stringify(evidence),
        image,
      );
      b.readiness = evidence;
      b.status = "awaiting_store_readiness";
      save(b);
      event(b, req.user.id, "readiness_submitted", { evidenceId: evidence.id });
      notify(
        b,
        "Grocery evidence received",
        "Your store pickup confirmation is pending dispatch review. No courier can be assigned until approved.",
        [db.prepare("SELECT email FROM users WHERE id=?").get(b.userId).email],
      );
      return { booking: present(b), reused: false };
    });
    res.status(result.reused ? 200 : 201).json(result);
  });
  app.get("/api/bookings/:id/readiness/:evidenceId", (req, res) => {
    const b = read(req.params.id);
    if (!canRead(req, b)) fail(404, "Evidence not found.");
    const evidence = db
      .prepare("SELECT image FROM grocery_evidence WHERE id=? AND booking_id=?")
      .get(req.params.evidenceId, b.id);
    if (!evidence) fail(404, "Evidence not found.");
    res.type("image/webp").send(Buffer.from(evidence.image));
  });
  app.post("/api/dispatch/:id/readiness", staff, (req, res) => {
    const result = transaction(db, () => {
      const b = read(req.params.id);
      editable(b);
      const r = b.readiness;
      if (!r || r.id !== req.body.evidenceId)
        fail(
          409,
          "The evidence changed. Refresh and review the latest upload.",
        );
      const decision = req.body.decision;
      if (!["approved", "rejected"].includes(decision))
        fail(400, "Choose approve or reject.");
      if (r.status === decision) return { booking: present(b), reused: true };
      if (r.status !== "pending")
        fail(
          409,
          "This evidence was already reviewed. A new upload is required.",
        );
      if (decision === "approved") {
        if (
          ["readyShown", "prepaidShown", "dateMatches", "orderMatches"].some(
            (k) => req.body[k] !== true,
          )
        )
          fail(
            400,
            "Confirm ready status, prepayment, pickup date, and matching store/order before approval.",
          );
        requireCurrentReadiness({
          ...b,
          readiness: { ...r, status: "approved" },
        });
      }
      const note =
        decision === "rejected"
          ? text(req.body.note, "Rejection reason", 500)
          : "Reviewer confirmed ready status, prepaid order, current pickup date and matching store/order.";
      b.readiness = {
        ...r,
        status: decision,
        note,
        reviewedAt: stamp(),
        reviewer: "demo-dispatch",
      };
      b.status =
        decision === "approved" ? "confirmed" : "awaiting_store_readiness";
      db.prepare("UPDATE grocery_evidence SET payload=? WHERE id=?").run(
        JSON.stringify(b.readiness),
        r.id,
      );
      save(b);
      event(b, "demo-dispatch", `readiness_${decision}`, {
        evidenceId: r.id,
        note,
      });
      notify(
        b,
        `Grocery readiness ${decision}`,
        decision === "approved"
          ? "Your evidence was approved for today. Courier assignment remains subject to availability."
          : `Please upload new store confirmation. ${note}`,
        [db.prepare("SELECT email FROM users WHERE id=?").get(b.userId).email],
      );
      return { booking: present(b), reused: false };
    });
    res.json(result);
  });
}
