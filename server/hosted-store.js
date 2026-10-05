import { neon } from "@neondatabase/serverless";

export function hostedStore(url) {
  const sql = neon(url);
  return {
    async read(id) {
      const rows =
        await sql`SELECT snapshot, revision, expires FROM corerunner_demo_workspaces WHERE id=${id} AND expires > now()`;
      return rows[0] || null;
    },
    async create(id, snapshot, expires) {
      await sql`DELETE FROM corerunner_demo_limits WHERE expires <= now()`;
      await sql`DELETE FROM corerunner_demo_workspaces WHERE expires <= now()`;
      await sql`INSERT INTO corerunner_demo_workspaces (id, snapshot, expires) VALUES (${id}, ${JSON.stringify(snapshot)}::jsonb, ${new Date(expires).toISOString()})`;
    },
    async save(id, revision, snapshot) {
      const rows =
        await sql`UPDATE corerunner_demo_workspaces SET snapshot=${JSON.stringify(snapshot)}::jsonb, revision=revision+1 WHERE id=${id} AND revision=${revision} AND expires > now() RETURNING revision`;
      return rows.length === 1;
    },
    async allow(key, maximum, windowMs, now) {
      const bucket = Math.floor(now / windowMs);
      const rows =
        await sql`INSERT INTO corerunner_demo_limits (id, bucket, count, expires) VALUES (${key}, ${bucket}, 1, ${new Date(now + windowMs * 2).toISOString()}) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN corerunner_demo_limits.bucket=EXCLUDED.bucket THEN corerunner_demo_limits.count+1 ELSE 1 END, bucket=EXCLUDED.bucket, expires=EXCLUDED.expires RETURNING count`;
      return rows[0].count <= maximum;
    },
    async cleanup() {
      await sql`DELETE FROM corerunner_demo_workspaces WHERE expires <= now()`;
      await sql`DELETE FROM corerunner_demo_limits WHERE expires <= now()`;
    },
  };
}
