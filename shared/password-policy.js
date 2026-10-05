// Shared by registration UI and API. Login still accepts existing passwords.
export const passwordRules = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    id: "uppercase",
    label: "An uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  { id: "number", label: "A number", test: (value) => /[0-9]/.test(value) },
  {
    id: "special",
    label: "A special character (for example !, @, #)",
    test: (value) => /[^\p{L}\p{N}\s]/u.test(value),
  },
];
export function passwordRequirements(value) {
  const password = typeof value === "string" ? value : "";
  return passwordRules.map(({ id, label, test }) => ({
    id,
    label,
    met: test(password),
  }));
}
export function validNewPassword(value) {
  return (
    typeof value === "string" &&
    value.length <= 128 &&
    passwordRequirements(value).every((rule) => rule.met)
  );
}
export const passwordGuidance =
  "Use 8–128 characters, including an uppercase letter, a number, and a special character. Spaces do not count as special characters.";
