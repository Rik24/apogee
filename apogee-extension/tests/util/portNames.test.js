import test from "node:test";
import assert from "node:assert";
import {
  KNOWN_PORT_NAMES,
  KNOWN_PORT_PREFIXES,
  disconnectIfUnknownPort,
  isKnownPortName,
} from "../../lib/util/portNames.js";

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
