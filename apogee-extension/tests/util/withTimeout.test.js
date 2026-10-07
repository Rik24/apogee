import test from "node:test";
import assert from "node:assert";
import { withTimeout } from "../../lib/util/withTimeout.js";

test("withTimeout resolves with the inner value before the deadline", async () => {
  assert.strictEqual(await withTimeout(Promise.resolve("ok"), 50), "ok");
});

test("withTimeout rejects with the onTimeout throw", async () => {
  await assert.rejects(
    () =>
      withTimeout(new Promise(() => {}), 20, {
        onTimeout: () => {
          throw new Error("Offscreen document did not signal ready");
        },
      }),
    /did not signal ready/,
  );
});

test("withTimeout resolves the onTimeout fallback value", async () => {
  assert.strictEqual(
    await withTimeout(new Promise(() => {}), 20, {
      onTimeout: () => "timeout",
    }),
    "timeout",
  );
});

test("withTimeout rejects with a generic error without onTimeout", async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 20),
    /Timed out/,
  );
});
