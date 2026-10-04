import test from "node:test";
import assert from "node:assert/strict";
import { openAIProvider } from "./corey.js";
test("Responses adapter keeps credentials server-side, disables storage and supplies strict tools", async () => {
  const provider = openAIProvider({
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(options.headers.Authorization, "Bearer test-key");
      const b = JSON.parse(options.body);
      assert.equal(b.store, false);
      assert.equal(b.parallel_tool_calls, false);
      assert.ok(b.tools.every((t) => t.strict));
      assert.ok(!options.body.includes("test-key"));
      return {
        ok: true,
        json: async () => ({ status: "completed", output: [] }),
      };
    },
  });
  assert.deepEqual(await provider([{ role: "user", content: "Hi" }]), []);
});
test("Responses errors do not expose provider bodies or credentials", async () => {
  const provider = openAIProvider({
    apiKey: "secret",
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "secret" }),
    }),
  });
  await assert.rejects(
    provider([]),
    (e) => e.status === 503 && !e.message.includes("secret"),
  );
});
