import test from "node:test";
import assert from "node:assert";
import { readSource } from "../helpers/readSource.js";

// #351: cancel-stream broadcast `cancelled` but left subscriber ports open
// until sliding expiry. Open ports waste relay time and hide terminal
// state, so cancel must drop every port at once through the same shared
// helper the expiry path uses.

const swCode = readSource("../../offscreen/offscreen.js", import.meta.url);

test("cancel-stream drops subscriber ports via the shared disconnect helper", () => {
  const cancelIdx = swCode.indexOf('case "cancel-stream"');
  assert.ok(cancelIdx !== -1, "cancel-stream handler exists");
  const cancelBody = swCode.slice(cancelIdx, cancelIdx + 1200);
  assert.ok(
    cancelBody.includes('broadcastToStream(stream, { type: "cancelled" })'),
    "cancel still broadcasts the terminal message first",
  );
  assert.ok(
    cancelBody.includes("disconnectStreamPorts(stream)"),
    "cancel drops every port through the shared expiry helper",
  );
});
