import { createApp } from "./app.js";
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (process.env.NODE_ENV === "production")
  throw new Error(
    "Local demo only: replace demo identity and staff access before production deployment.",
  );
const { app, db } = createApp({
  dbPath: process.env.DB_PATH || "data/corerunner.sqlite",
  demo: true,
});
const server = app.listen(
  Number(process.env.API_PORT || 3001),
  "127.0.0.1",
  () =>
    console.log(
      `CoreRunner local demo API: http://127.0.0.1:${process.env.API_PORT || 3001}`,
    ),
);
function close() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
