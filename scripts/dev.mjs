import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["server/index.js"], {
    stdio: "inherit",
    env: process.env,
  }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      ...(process.env.TEST_PREVIEW ? ["preview"] : []),
      "--host",
      "127.0.0.1",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: process.env },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 100).unref();
}
for (const c of children) {
  c.on("error", (e) => {
    console.error(e);
    stop(1);
  });
  c.on("exit", (code) => stop(code || 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
