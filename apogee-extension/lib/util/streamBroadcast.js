// Best-effort port helpers shared by the service worker, the offscreen
// document, and the popup: postMessage/disconnect throw when the other end
// already went away, and every call site wants to ignore exactly that.
// Returns true when the call went through, false when the port was already
// closed (or missing).
// Single best-effort wrapper behind safePost/safeDisconnect: postMessage and
// disconnect throw for exactly the same reason (the other end already went
// away), and every call site wants to ignore exactly that.
function safePortCall(port, method, ...args) {
  try {
    port[method](...args);
    return true;
  } catch {
    // intent: best-effort, ignore if port already closed
    return false;
  }
}

export function safePost(port, msg) {
  return safePortCall(port, "postMessage", msg);
}

export function safeDisconnect(port) {
  return safePortCall(port, "disconnect");
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

export function disconnectIfUnknownPort(port, disconnect = safeDisconnect) {
  if (isKnownPortName(port?.name)) return false;
  disconnect(port);
  return true;
}

// Shared subscriber iteration for broadcast and teardown: copy the set
// because a port that disconnects mid-loop mutates `subscribers` via its
// onDisconnect handler, and iterating the live set would skip the next
// subscriber.
function forEachSubscriber(stream, fn) {
  for (const port of [...stream.subscribers]) {
    fn(port);
  }
}

export function broadcastToStream(stream, msg) {
  forEachSubscriber(stream, (port) => safePost(port, msg));
}

// Shared terminal-port teardown (#351): expiry and cancel both drop every
// subscriber at once instead of leaving ports open, then clear the set so the
// disconnected ports are gone even if an onDisconnect handler never runs.
export function disconnectStreamPorts(stream) {
  forEachSubscriber(stream, safeDisconnect);
  stream.subscribers.clear();
}
