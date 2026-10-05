import { initializeHostedSchema } from "../server/hosted-schema.js";
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
await initializeHostedSchema(sql);
console.log(
  "Hosted portfolio tables are ready. No local accounts, bookings or uploads were copied.",
);
