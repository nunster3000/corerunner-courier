import { api } from "./api";

// Loaded before React renders. Company data comes only from the backend.
export const operator = {};
export async function loadOperator() {
  Object.assign(operator, await api("/operator"));
  document.documentElement.style.setProperty(
    "--blue",
    operator.brand.primaryColor,
  );
  document.documentElement.style.setProperty(
    "--gold",
    operator.brand.accentColor,
  );
  document.title = `${operator.brand.name} | From your door to theirs.`;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", operator.brand.primaryColor);
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      "content",
      `${operator.brand.name} — personal and small-business courier demo. ${operator.coverage.headline}.`,
    );
}
