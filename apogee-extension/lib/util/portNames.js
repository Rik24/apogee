export const KNOWN_PORT_PREFIXES = Object.freeze([
  "offscreen-stream-",
  "popup-stream-",
  "side-panel-tab-",
]);

export const KNOWN_PORT_NAMES = Object.freeze(["popup-lifecycle"]);

export function isKnownPortName(name) {
  return (
    typeof name === "string" &&
    (KNOWN_PORT_NAMES.includes(name) ||
      KNOWN_PORT_PREFIXES.some((prefix) => name.startsWith(prefix)))
  );
}

export function disconnectIfUnknownPort(port, disconnect) {
  if (isKnownPortName(port?.name)) return false;
  disconnect(port);
  return true;
}
