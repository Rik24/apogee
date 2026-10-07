import test from "node:test";
import assert from "node:assert";
import {
  NotificationTargetManager,
  NOTIFICATION_TARGET_TTL_MS,
  MAX_NOTIFICATION_TARGETS,
} from "../../lib/util/notificationTargets.js";

test("notification-target limits stay pinned", () => {
  assert.strictEqual(NOTIFICATION_TARGET_TTL_MS, 60 * 60 * 1000);
  assert.strictEqual(MAX_NOTIFICATION_TARGETS, 50);
});

test("NotificationTargetManager stores and retrieves notification target within TTL", () => {
  const manager = new NotificationTargetManager({
    ttlMs: 1000,
    maxCapacity: 5,
  });
  manager.set("notif-1", { tabId: 10, windowId: 1 });

  const target = manager.get("notif-1");
  assert.ok(target);
  assert.strictEqual(target.tabId, 10);
  assert.strictEqual(target.windowId, 1);
});

test("NotificationTargetManager expires entries after TTL elapses", (t) => {
  const manager = new NotificationTargetManager({ ttlMs: 50, maxCapacity: 5 });
  manager.set("notif-1", { helpUrl: "https://example.com/help" });

  const originalNow = Date.now;
  t.after(() => {
    Date.now = originalNow;
  });

  Date.now = () => originalNow() + 100;

  assert.strictEqual(manager.get("notif-1"), null);
  assert.strictEqual(manager.size, 0);
});

test("NotificationTargetManager evicts oldest entries when capacity is exceeded", () => {
  const manager = new NotificationTargetManager({
    ttlMs: 60000,
    maxCapacity: 3,
  });
  manager.set("id-1", { tabId: 1 });
  manager.set("id-2", { tabId: 2 });
  manager.set("id-3", { tabId: 3 });

  assert.strictEqual(manager.size, 3);
  assert.ok(manager.get("id-1"));

  manager.set("id-4", { tabId: 4 });

  assert.strictEqual(manager.size, 3);
  assert.strictEqual(manager.get("id-1"), null);
  assert.ok(manager.get("id-2"));
  assert.ok(manager.get("id-3"));
  assert.ok(manager.get("id-4"));
});

test("NotificationTargetManager delete and clear work as expected", () => {
  const manager = new NotificationTargetManager({
    ttlMs: 60000,
    maxCapacity: 10,
  });
  manager.set("id-1", { tabId: 1 });
  manager.set("id-2", { tabId: 2 });

  assert.strictEqual(manager.delete("id-1"), true);
  assert.strictEqual(manager.get("id-1"), null);
  assert.strictEqual(manager.size, 1);

  manager.clear();
  assert.strictEqual(manager.size, 0);
});

test("NotificationTargetManager take removes entries and honors TTL", () => {
  const manager = new NotificationTargetManager({
    ttlMs: 1000,
    maxCapacity: 5,
  });
  const now = 1_000_000;

  manager.set("take-1", { tabId: 1 }, now);
  assert.strictEqual(manager.take("take-1", now)?.tabId, 1);
  assert.strictEqual(manager.has("take-1", now), false);
  assert.strictEqual(manager.take("missing", now), null);

  manager.set("take-expired", { tabId: 2 }, now - 1000);
  assert.strictEqual(manager.take("take-expired", now), null);
  assert.strictEqual(manager.has("take-expired", now), false);
});

test("NotificationTargetManager treats entries at the TTL boundary as expired", () => {
  const manager = new NotificationTargetManager({
    ttlMs: 1000,
    maxCapacity: 5,
  });
  const now = 1_000_000;

  manager.set("fresh", { tabId: 1 }, now - 999);
  manager.set("old", { tabId: 2 }, now - 1000);
  manager.evictStale(now);

  assert.strictEqual(manager.has("fresh", now), true);
  assert.strictEqual(manager.has("old", now), false);
});

test("NotificationTargetManager evicts entries without timestamps", () => {
  const manager = new NotificationTargetManager({
    ttlMs: 1000,
    maxCapacity: 5,
  });
  const now = 1_000_000;

  manager.targets.set("corrupt", { tabId: 1 });
  manager.evictStale(now);

  assert.strictEqual(manager.has("corrupt", now), false);
});

test("NotificationTargetManager re-setting an entry refreshes recency", () => {
  const manager = new NotificationTargetManager({
    ttlMs: 60000,
    maxCapacity: 3,
  });
  const now = 1_000_000;

  manager.set("id-1", { tabId: 1 }, now);
  manager.set("id-2", { tabId: 2 }, now);
  manager.set("id-3", { tabId: 3 }, now);
  manager.set("id-1", { tabId: 1 }, now);
  manager.set("id-4", { tabId: 4 }, now);

  assert.strictEqual(manager.has("id-2", now), false);
  assert.strictEqual(manager.has("id-1", now), true);
  assert.strictEqual(manager.has("id-3", now), true);
  assert.strictEqual(manager.has("id-4", now), true);
});
