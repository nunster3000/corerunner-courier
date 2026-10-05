// Serialize first-time DDL across concurrent Vercel instances.
// This only creates missing demo objects; it never imports or drops data.
export async function initializeHostedSchema(sql) {
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext('corerunner_demo_schema_v1'))`,
    sql`CREATE TABLE IF NOT EXISTS corerunner_demo_workspaces (id text PRIMARY KEY, snapshot jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, expires timestamptz NOT NULL)`,
    sql`CREATE INDEX IF NOT EXISTS corerunner_demo_expiry ON corerunner_demo_workspaces(expires)`,
    sql`CREATE TABLE IF NOT EXISTS corerunner_demo_limits (id text PRIMARY KEY, bucket bigint NOT NULL, count integer NOT NULL, expires timestamptz NOT NULL)`,
  ]);
}
