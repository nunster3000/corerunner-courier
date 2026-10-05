import { neon } from "@neondatabase/serverless";
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!process.env.DATABASE_URL)
  throw new Error(
    "Set server-only DATABASE_URL before running hosted storage setup.",
  );
const sql = neon(process.env.DATABASE_URL);
await sql.transaction([
  sql`CREATE TABLE IF NOT EXISTS corerunner_demo_workspaces (id text PRIMARY KEY, snapshot jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, expires timestamptz NOT NULL)`,
  sql`CREATE INDEX IF NOT EXISTS corerunner_demo_expiry ON corerunner_demo_workspaces(expires)`,
  sql`CREATE TABLE IF NOT EXISTS corerunner_demo_limits (id text PRIMARY KEY, bucket bigint NOT NULL, count integer NOT NULL, expires timestamptz NOT NULL)`,
]);
console.log(
  "Hosted portfolio tables are ready. No local accounts, bookings or uploads were copied.",
);
