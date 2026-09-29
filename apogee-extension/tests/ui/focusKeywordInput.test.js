import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import fs from "node:fs";
import { parseHTML } from "linkedom";

// #161: a per-page focus keyword input. app.js relies on chrome.* tab events
// and DOM state that this repo doesn't execute in tests (see
// popupMessageGate.test.js / validateLoopbackHost.test.js) - so, like those,
// the behavioral assertions here are source-text inspections rather than a
// live DOM run.

const appHtmlPath = new URL("../../ui/app.html", import.meta.url);
const appHtmlRaw = readFileSync(appHtmlPath, "utf8");

const appCode = fs.readFileSync(
  new URL("../../ui/app.js", import.meta.url),
  "utf-8",
);

const constantsCode = fs.readFileSync(
  new URL("../../lib/constants.js", import.meta.url),
  "utf-8",
);

test("app.html declares the focus keyword input with the documented cap (#161)", () => {
  const { document } = parseHTML(appHtmlRaw);
  const input = document.getElementById("focusKeywordInput");
  assert.ok(input, "#focusKeywordInput must exist in app.html");
  assert.strictEqual(input.getAttribute("type"), "text");
  assert.strictEqual(input.getAttribute("maxlength"), "200");
});

test("the focus keyword input is cleared on tab switch (#161)", () => {
  const onActivatedMatch = appCode.match(
    /chrome\.tabs\.onActivated\.addListener\(\(\) => \{[\s\S]*?\n {4}\}\);/,
  );
  assert.ok(onActivatedMatch, "chrome.tabs.onActivated listener found");
  assert.match(onActivatedMatch[0], /focusKeywordInput\.value = ""/);
});

test("the focus keyword input is cleared on same-tab navigation to a new URL (#161)", () => {
  const onUpdatedMatch = appCode.match(
    /chrome\.tabs\.onUpdated\.addListener\(\(tabId, changeInfo\) => \{[\s\S]*?\n\}\);/,
  );
  assert.ok(onUpdatedMatch, "chrome.tabs.onUpdated listener found");
  const body = onUpdatedMatch[0];
  assert.match(body, /changeInfo\.url/);
  assert.match(body, /tabId !== activeTabId/);
  assert.match(body, /focusKeywordInput\.value = ""/);
});

test("re-summarizing the same page does not clear the focus keyword (#161)", () => {
  const line = appCode
    .split("\n")
    .find((l) => l.includes('resummarizeBtn?.addEventListener("click"'));
  assert.ok(line, "resummarizeBtn click handler found");
  assert.doesNotMatch(line, /focusKeywordInput\.value/);
});

test("the focus keyword input is hidden on discussion, video, and multi-tab pages (#161)", () => {
  // Single source of truth lives in isFocusKeywordSupportedType (#319);
  // updateFocusKeywordAvailability just delegates to it.
  const helperMatch = appCode.match(
    /function isFocusKeywordSupportedType[\s\S]*?\n\}/,
  );
  assert.ok(helperMatch, "isFocusKeywordSupportedType function found");
  const helperBody = helperMatch[0];
  for (const needle of [
    "isVideoType(type)",
    "isDiscussionType(type)",
    '"multi-tab"',
  ]) {
    assert.ok(
      helperBody.includes(needle),
      `expected ${needle} in the support check`,
    );
  }

  // The discussion triple lives in one shared helper (lib/constants.js),
  // used by both the visibility gate above and the summarize prompt path
  // (lib/summarize/ollamaSummarize.js) - not copy-pasted in each.
  const discussionSetMatch = constantsCode.match(
    /DISCUSSION_PAGE_TYPES = new Set\([\s\S]*?\]\)/,
  );
  assert.ok(discussionSetMatch, "DISCUSSION_PAGE_TYPES set found");
  for (const needle of ['"hackernews"', '"reddit"', '"stackoverflow"']) {
    assert.ok(
      discussionSetMatch[0].includes(needle),
      `expected ${needle} in DISCUSSION_PAGE_TYPES`,
    );
  }
  assert.match(constantsCode, /function isDiscussionType/);
  assert.match(
    appCode,
    /import \{[\s\S]*?isDiscussionType[\s\S]*?\} from "\.\.\/lib\/constants\.js"/,
  );
  const summarizeCode = fs.readFileSync(
    new URL("../../lib/summarize/ollamaSummarize.js", import.meta.url),
    "utf-8",
  );
  assert.match(summarizeCode, /isDiscussionType\(type\)/);
  assert.doesNotMatch(summarizeCode, /type === "hackernews"/);

  const fnMatch = appCode.match(
    /function updateFocusKeywordAvailability[\s\S]*?\n\}/,
  );
  assert.ok(fnMatch, "updateFocusKeywordAvailability function found");
  assert.match(fnMatch[0], /isFocusKeywordSupportedType\(pageData\?\.type\)/);

  // Must actually be wired into the shared page-type resolver so every
  // existing (and future) call site stays in sync automatically.
  const chipFnMatch = appCode.match(/function updateExtractorChip[\s\S]*?\n\}/);
  assert.ok(chipFnMatch, "updateExtractorChip function found");
  assert.match(chipFnMatch[0], /updateFocusKeywordAvailability\(pageData\)/);
});

test("summarizeActivePage gates the focus keyword on page-type support (#319)", () => {
  const start = appCode.indexOf("async function summarizeActivePage()");
  assert.ok(start !== -1, "summarizeActivePage function found");
  const body = appCode.slice(start);

  // The raw input value is read once into requestedFocusKeyword; the gated
  // focusKeyword empties it for types whose prompt path ignores it, so a
  // value typed before the type resolves cannot fragment the cache.
  assert.match(
    body,
    /const requestedFocusKeyword = \(focusKeywordInput\?\.value \|\| ""\)\.trim\(\)/,
  );
  assert.doesNotMatch(
    body,
    /const focusKeyword = \(focusKeywordInput\?\.value/,
  );
  const gateIdx = body.indexOf("isFocusKeywordSupportedType(pageData");
  assert.ok(gateIdx !== -1, "type gate on pageData found");
  assert.match(body.slice(gateIdx, gateIdx + 200), /\? requestedFocusKeyword/);
  assert.match(body.slice(gateIdx, gateIdx + 200), /: ""/);

  // The gate must land before both cache-key call sites and the job
  // payloads, so video/discussion jobs and keys never carry the keyword.
  const cacheIdx = body.indexOf("getSummaryCacheKey(");
  const promptsIdx = body.indexOf("getPromptsCacheKey(");
  const summarizeIdx = body.indexOf("provider.summarize({");
  assert.ok(cacheIdx > gateIdx, "summary cache key computed after the gate");
  assert.ok(promptsIdx > gateIdx, "prompts cache key computed after the gate");
  assert.ok(summarizeIdx > gateIdx, "summarize job sent after the gate");

  // Cache keys and job payloads use the gated value, never the raw input.
  for (const idx of [cacheIdx, promptsIdx, summarizeIdx]) {
    const window = body.slice(idx, idx + 500);
    assert.ok(window.includes("focusKeyword"), "gated focusKeyword used");
    assert.ok(
      !window.includes("requestedFocusKeyword"),
      "raw requestedFocusKeyword must not reach cache keys or job payloads",
    );
  }
});
