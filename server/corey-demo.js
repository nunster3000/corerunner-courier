import { email, text, fail } from "./domain.js";
const prompts = {
  name: "What’s your full name?",
  email: "What email should we use for your demo account?",
  phone: "What’s your phone number?",
  pickup: "What’s the pickup address? Include the city and ZIP code.",
  dropoff: "What’s the delivery address? Include the city and ZIP code.",
  recipient: "Who will receive it?",
  recipientEmail: "What’s the recipient’s email?",
  item: "What are you sending? Choose Everyday package, Flowers or gifts, Documents or keys, Small-business order, or Groceries.",
  weight: "How much does the package weigh in pounds? Maximum 50 lb.",
  service: "Choose Same-day, Expedited, or Scheduled.",
  date: "What delivery date? Use YYYY-MM-DD.",
  window:
    "Choose a delivery window: 8–10 a.m., 10 a.m.–1 p.m., 1–4 p.m., 4–6 p.m., or 6–8 p.m.",
};
export function demoReply(s, message, user, createQuote, listBookings) {
  const value = message.trim();
  const result = (reply) => ({
    reply,
    draft: s.draft,
    quote: s.quote,
    verified: !!user,
  });
  if (/^(help|policies|what can you do)\??$/i.test(value))
    return result(
      "I’m a scripted demo guide. Say “start” to book, “status” for your deliveries, or “groceries”, “returns”, “cancellation”, or “coverage” for service details. To correct a detail, use its field name and a colon, such as weight: 12 or service: Expedited.",
    );
  if (/^(cancel|cancellation|refunds?)\??$/i.test(value))
    return result(
      "Open My deliveries and choose Review cancellation to see the backend fee before confirming. Before pickup it is free unless the courier is heading to pickup within 2 simulated miles; then only the base fee applies. After pickup, cancellation schedules a return with the original charge retained and the disclosed return fee. Company-caused failures have no return fee. Refunds need staff review.",
    );
  if (/^groceries\??$/i.test(value))
    return result(
      "Groceries must be prepaid and confirmed ready for pickup by the store. No shopping or prepared restaurant food. Store readiness review is required before dispatch.",
    );
  if (/^returns\??$/i.test(value))
    return result(
      "Signature or PIN is required by default. No mandatory wait if nobody answers: same-day return is the default. A courier may optionally request sender permission for unattended delivery before returning. Photos are required for unattended delivery. Customer-caused returns add only the disclosed distance and time fee.",
    );
  if (/^coverage\??$/i.test(value))
    return result(
      "Demo coverage includes Atlanta, Decatur, Marietta, Alpharetta, Lawrenceville, and Peachtree City. Packages must fit a car/SUV, be manageable by one courier, and weigh no more than 50 lb each.",
    );
  if (/^status\??$/i.test(value)) {
    if (!user)
      return result(
        "Verify your demo account before viewing deliveries. Say “start” to provide your account details.",
      );
    const bookings = listBookings(user.id);
    return result(
      bookings.length
        ? bookings
            .map((b) => `${b.id}: ${b.status.replaceAll("_", " ")}`)
            .join("\n")
        : "You have no saved deliveries yet. Say “start” to book.",
    );
  }
  const correction = value.match(/^([a-zA-Z]+):\s*(.+)$/);
  const command =
    /^(start|book|quote|continue|hello|hi|prepare my quote)$/i.test(value);
  const field = correction ? correction[1] : command ? null : s.pending;
  if (field) {
    if (!Object.hasOwn(prompts, field))
      return result(
        "That field is not supported. Try weight: 12, dropoff: your address, or service: Expedited.",
      );
    let answer = correction ? correction[2] : value;
    try {
      answer = text(answer, field, 300);
      if (field.toLowerCase().includes("email")) answer = email(answer);
      if (field === "phone" && answer.replace(/\D/g, "").length < 10)
        fail(400, "Enter a phone number with at least 10 digits.");
      if (field === "weight") {
        answer = answer.replace(/\s*(lb|lbs|pounds)\.?$/i, "");
        if (
          !Number.isFinite(Number(answer)) ||
          Number(answer) <= 0 ||
          Number(answer) > 50
        )
          fail(400, "Enter a weight greater than 0 and at most 50 lb.");
      }
      const options =
        field === "service"
          ? ["Same-day", "Expedited", "Scheduled"]
          : field === "item"
            ? [
                "Everyday package",
                "Flowers or gifts",
                "Documents or keys",
                "Small-business order",
                "Groceries",
              ]
            : null;
      if (options) {
        answer = options.find((o) => o.toLowerCase() === answer.toLowerCase());
        if (!answer) fail(400, prompts[field]);
      }
      s.draft[field] = answer;
      s.quote = null;
      s.pending = null;
    } catch (error) {
      return result(error.message);
    }
  } else if (!command && !correction)
    return result(
      "This mock assistant uses a guided conversation. Say “start” to begin, “quote” to review, or “help” for supported questions.",
    );
  const required = [
    ...(!user ? ["name", "email", "phone"] : []),
    "pickup",
    "dropoff",
    "recipient",
    "recipientEmail",
    "item",
    "weight",
    "service",
    ...(s.draft.service === "Scheduled" ? ["date", "window"] : []),
  ];
  const missing = required.find((k) => !s.draft[k]);
  if (missing) {
    s.pending = missing;
    return result(prompts[missing]);
  }
  if (!user)
    return result(
      "Your details are ready. Use Verify account below, then say “quote”. Verification and email are simulated.",
    );
  try {
    s.quote = createQuote(user.id, { ...s.draft, unattended: false });
  } catch (error) {
    return result(
      `${error.message} Correct a detail using field: value, or continue in the form.`,
    );
  }
  return result(
    "Here’s your backend demo quote. Review the package, service, and return policy, then confirm below. Only your checkbox can authorize unattended delivery.",
  );
}
