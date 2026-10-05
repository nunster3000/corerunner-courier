export const ACCOUNT_TTL_MS = 48 * 60 * 60 * 1000;
export const accountExpiry = (account) =>
  new Date(account.expires_at).getTime();
