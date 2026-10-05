import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const status = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=normal"],
  { encoding: "utf8" },
).trim();
if (status)
  throw new Error(
    "Commit or safely set aside working changes before packaging. The archive exports the committed source.",
  );
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const unsafe = files.filter(
  (p) =>
    /(^|\/)(node_modules|data|artifacts)(\/|$)/.test(p) ||
    (/(^|\/)\.env/.test(p) && p !== ".env.example") ||
    /\.(pem|key|sqlite|sqlite-wal|sqlite-shm)$/.test(p),
);
if (unsafe.length)
  throw new Error(
    "Packaging stopped: tracked local data or credential-file paths must be removed from the source export.",
  );
mkdirSync("artifacts", { recursive: true });
execFileSync("git", [
  "archive",
  "--format=zip",
  "--prefix=corerunner-courier/",
  "--output=artifacts/CoreRunner-source.zip",
  "HEAD",
]);
console.log(
  "Created artifacts/CoreRunner-source.zip from committed source. Local credentials, uploads, database records, dependencies and Git history are excluded. This remains a portfolio/demo handoff, not a production-ready release.",
);
