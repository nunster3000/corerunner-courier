// Serialize first-time DDL across concurrent Vercel instances.
// This only creates missing demo objects; it never imports or drops data.
export async function initializeHostedSchema(sql) {
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext('corerunner_demo_schema_v1'))`,
    sql`CREATE TABLE IF NOT EXISTS corerunner_demo_workspaces (id text PRIMARY KEY, snapshot jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, expires timestamptz NOT NULL)`,
    sql`CREATE INDEX IF NOT EXISTS corerunner_demo_expiry ON corerunner_demo_workspaces(expires)`,
    sql`CREATE TABLE IF NOT EXISTS corerunner_accounts (id text PRIMARY KEY, email text UNIQUE NOT NULL, password text NOT NULL, profile jsonb NOT NULL, role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')), snapshot jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`,
    sql`ALTER TABLE corerunner_accounts ADD COLUMN IF NOT EXISTS expires_at timestamptz`,
    sql`UPDATE corerunner_accounts SET expires_at=created_at + interval '48 hours' WHERE expires_at IS NULL`,
    sql`ALTER TABLE corerunner_accounts ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours')`,
    sql`ALTER TABLE corerunner_accounts ALTER COLUMN expires_at SET NOT NULL`,
    sql`CREATE INDEX IF NOT EXISTS corerunner_account_expiry ON corerunner_accounts(expires_at)`,
    sql`ALTER TABLE corerunner_accounts ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false`,
    sql`ALTER TABLE corerunner_accounts ADD COLUMN IF NOT EXISTS verification jsonb`,
    sql`CREATE TABLE IF NOT EXISTS corerunner_account_sessions (token text PRIMARY KEY, account_id text NOT NULL REFERENCES corerunner_accounts(id) ON DELETE CASCADE, expires timestamptz NOT NULL)`,
    sql`CREATE INDEX IF NOT EXISTS corerunner_account_session_expiry ON corerunner_account_sessions(expires)`,
    sql`CREATE TABLE IF NOT EXISTS corerunner_demo_limits (id text PRIMARY KEY, bucket bigint NOT NULL, count integer NOT NULL, expires timestamptz NOT NULL)`,
  ]);
}
