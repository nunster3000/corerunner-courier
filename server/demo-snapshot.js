// Bounded portfolio workspaces only. Real operator data needs a relational hosted adapter.
// SQLite runs only in memory; the durable snapshot lives in hosted Postgres.
export function captureDemo(db, chat) {
  const tables = {};
  for (const { name } of db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()) {
    tables[name] = db
      .prepare(`SELECT * FROM "${name}" ORDER BY rowid`)
      .all()
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            value instanceof Uint8Array
              ? { binary: Buffer.from(value).toString("base64") }
              : value,
          ]),
        ),
      );
  }
  return {
    version: 1,
    tables,
    chat: { sessions: [...chat.sessions], requestTimes: chat.requestTimes },
  };
}
export function restoreDemo(db, chat, snapshot) {
  if (snapshot.version !== 1) throw new Error("Unsupported demo snapshot");
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  db.exec("BEGIN; PRAGMA defer_foreign_keys=ON;");
  try {
    for (const { name } of tables) db.exec(`DELETE FROM "${name}"`);
    for (const { name } of tables) {
      const columns = db
        .prepare(`PRAGMA table_info("${name}")`)
        .all()
        .map((c) => c.name);
      const insert = db.prepare(
        `INSERT INTO "${name}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      );
      for (const row of snapshot.tables[name] || [])
        insert.run(
          ...columns.map((c) => {
            const value = row[c];
            return value && typeof value === "object"
              ? Buffer.from(value.binary, "base64")
              : (value ?? null);
          }),
        );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  chat.sessions.clear();
  for (const [key, value] of snapshot.chat?.sessions || [])
    chat.sessions.set(key, value);
  chat.requestTimes.splice(
    0,
    chat.requestTimes.length,
    ...(snapshot.chat?.requestTimes || []),
  );
}
