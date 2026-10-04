export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The API is unavailable. Start both services with npm run dev.",
    );
  }
  if (!response.ok)
    throw Object.assign(new Error(result.error || "Request failed."), {
      status: response.status,
    });
  return result;
}
export const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const statusLabel = (status) =>
  status.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
