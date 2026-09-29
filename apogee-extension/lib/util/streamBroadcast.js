// Best-effort port helpers shared by the service worker, the offscreen
// document, and the popup: postMessage/disconnect throw when the other end
// already went away, and every call site wants to ignore exactly that.
// Returns true when the call went through, false when the port was already
// closed (or missing).
export function safePost(port, msg) {
  try {
    port.postMessage(msg);
    return true;
  } catch {
    // intent: best-effort, ignore if port already closed
    return false;
  }
}

export function safeDisconnect(port) {
  try {
    port.disconnect();
    return true;
  } catch {
    // intent: best-effort, ignore if already closed/unavailable
    return false;
  }
}

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

export function broadcastToStream(stream, msg) {
  // Copy the set: a port that disconnects mid-broadcast mutates
  // `subscribers` via its onDisconnect handler, and iterating the live set
  // would skip the next subscriber.
  for (const port of [...stream.subscribers]) {
    safePost(port, msg);
  }
}
