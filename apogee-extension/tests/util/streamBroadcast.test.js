import test from "node:test";
import assert from "node:assert";
import {
  broadcastToStream,
  KNOWN_PORT_NAMES,
  KNOWN_PORT_PREFIXES,
  disconnectIfUnknownPort,
  isKnownPortName,
} from "../../lib/util/streamBroadcast.js";
import { createStreamState } from "../../lib/util/streamState.js";
import { createCollectingPort } from "../helpers/streamTestUtils.js";

// The subscriber set must be copied before broadcast (#314): a port that
// disconnects mid-broadcast mutates `subscribers` via its onDisconnect
// handler, and iterating the live set would skip the next subscriber.

test("broadcast reaches every subscriber even when one unsubscribes mid-broadcast", () => {
  const stream = createStreamState();
  const ports = [
    createCollectingPort(),
    createCollectingPort(),
    createCollectingPort(),
  ];
  // First port's delivery removes the second port, as an onDisconnect
  // handler would during a real disconnect.
  const origPost = ports[0].postMessage;
  ports[0].postMessage = (msg) => {
    origPost(msg);
    stream.subscribers.delete(ports[1]);
  };
  for (const port of ports) stream.subscribers.add(port);

  broadcastToStream(stream, { type: "chunk", text: "hello" });

  assert.strictEqual(
    ports[0].messages.length,
    1,
    "first subscriber gets the chunk",
  );
  assert.strictEqual(
    ports[1].messages.length,
    1,
    "removed-mid-broadcast subscriber still gets the in-flight chunk",
  );
  assert.strictEqual(
    ports[2].messages.length,
    1,
    "later subscribers are not skipped after a mid-broadcast removal",
  );
});

test("broadcast tolerates a throwing port and still delivers to the rest", () => {
  const stream = createStreamState();
  const good = createCollectingPort();
  stream.subscribers.add(good);
  stream.subscribers.add(createCollectingPort({ throwOnPost: true }));
  const good2 = createCollectingPort();
  stream.subscribers.add(good2);

  broadcastToStream(stream, { type: "done" });

  assert.strictEqual(good.messages.length, 1);
  assert.strictEqual(good2.messages.length, 1);
});

test("known service-worker ports remain connected", () => {
  const names = ["side-panel-tab-42", "popup-lifecycle", "popup-stream-abc"];
  for (const name of names) {
    let disconnected = false;
    assert.strictEqual(
      disconnectIfUnknownPort({ name }, () => {
        disconnected = true;
      }),
      false,
    );
    assert.strictEqual(disconnected, false);
  }
});

test("ports owned by other extension contexts remain known", () => {
  assert.ok(KNOWN_PORT_PREFIXES.includes("offscreen-stream-"));
  assert.strictEqual(isKnownPortName("offscreen-stream-abc"), true);
});

test("unknown port names are disconnected", () => {
  const port = { name: "unrecognized-port" };
  let disconnectedPort;
  assert.strictEqual(
    disconnectIfUnknownPort(port, (unknownPort) => {
      disconnectedPort = unknownPort;
    }),
    true,
  );
  assert.strictEqual(disconnectedPort, port);
});

test("missing or malformed port names are treated as unknown", () => {
  for (const port of [{}, { name: null }, { name: 42 }]) {
    let disconnected = false;
    assert.strictEqual(
      disconnectIfUnknownPort(port, () => {
        disconnected = true;
      }),
      true,
    );
    assert.strictEqual(disconnected, true);
  }
});

assert.deepStrictEqual(KNOWN_PORT_NAMES, ["popup-lifecycle"]);
