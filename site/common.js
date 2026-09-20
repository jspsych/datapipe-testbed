// Shared by both test pages: reading the test's settings from the URL, and an
// on-page log of everything that goes to and comes back from DataPipe.
//
// Every setting lives in the URL, so a test is a link: it can be bookmarked,
// pasted into an issue, or opened on a phone to test a flaky mobile connection.

export const DEFAULT_BASE = "https://datapipe-test.web.app";

/**
 * A DataPipe endpoint URL for a request this PAGE makes.
 *
 * No trailing slash, deliberately: it is the path exactly as firebase.json
 * spells the rewrite. On a LIVE endpoint the slash makes no difference --
 * Firebase Hosting matches the rewrite either way (checked on datapipe-test,
 * 2026-09-19: same response, same latency, no redirect). It matters on a path
 * with no rewrite at all -- a removed endpoint, a typo -- which falls through
 * to the Next.js app, gets a 308 to the slashless form, and then a CORS-less
 * 404 that `fetch` reports as nothing more useful than "Failed to fetch". A
 * driver probing whether a route is gone needs the slashless form to get a
 * real status back.
 *
 * datapipe-client spells it the other way: `endpoint()` in
 * packages/client/src/http.ts builds `${base}/api/${path}/`. That is the whole
 * reason a recorded request's url ends in a slash when `source` is "library"
 * and does not when `source` is "page" -- each is recorded as it was sent.
 */
export function endpointURL(base, path) {
  return `${base}/api/${path}`;
}

function flag(value, fallback) {
  if (value === null) return fallback;
  return value === "1" || value === "true";
}

/**
 * A run id is spliced into a filename that becomes a path in a researcher's
 * Drive folder, so it is narrowed to what is safe there rather than trusted.
 */
function sanitizeRun(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 48);
}

/** The test's settings, from the query string. */
export function readParams() {
  const q = new URLSearchParams(window.location.search);
  const trials = Number.parseInt(q.get("trials") ?? "20", 10);
  return {
    // The DataPipe experiment to send to. Experiment ids are public by design
    // (they sit in every experiment's own JavaScript), which is why this repo
    // can be public and still never commit one.
    experiment: (q.get("experiment") ?? "").trim(),
    base: (q.get("base") ?? DEFAULT_BASE).replace(/\/+$/, ""),
    trials: Number.isFinite(trials) ? Math.min(Math.max(trials, 1), 500) : 20,
    format: q.get("format") === "json" ? "json" : "csv",
    // Trials advance on their own, so a long session can be abandoned
    // part-way without pressing keys for minutes.
    auto: flag(q.get("auto"), false),
    // Both pages: stage trials as they happen (the feature under test). The
    // plain-JavaScript page can do this too now that the client is its own
    // package -- while staging lived inside the jsPsych plugin it could not.
    stream: flag(q.get("stream"), true),
    // Claim the filename before the run ends, so DataPipe refuses the final
    // submission as a duplicate and the staged copy has to be recovered.
    breaksave: flag(q.get("breaksave"), false),
    // End the experiment at this trial, the way a failed attention check
    // would. 0 disables. jsPsych page only.
    abort: Number.parseInt(q.get("abort") ?? "0", 10) || 0,
    // Plain-JS page: request a condition before the timeline is built.
    condition: flag(q.get("condition"), false),
    compress: flag(q.get("compress"), true),
    // Plain-JS page: POST /api/base64 after the main submission. "1" sends a
    // tiny valid payload, "invalid" sends something that is not base64 at all,
    // so both sides of that endpoint's validation can be checked without a
    // recording device. Anything else leaves the endpoint alone.
    base64: q.get("base64") === "1" ? "valid" : q.get("base64") === "invalid" ? "invalid" : "off",
    // Plain-JS page: press "Send the same file again" without waiting for a
    // human, so duplicate rejection is a scenario a driver can run unattended.
    resubmit: flag(q.get("resubmit"), false),
    // Plain-JS page: leave `trial_type` off every row, so the submission fails
    // the validation rules a new experiment ships with. The only way to reach
    // INVALID_DATA without changing a dashboard setting first.
    failvalidation: flag(q.get("failvalidation"), false),
    // A free-form id for ONE run. It is echoed into the result contract below
    // and into the filename, which is what lets a driver tie a dashboard row
    // and a file in storage back to the scenario that produced them.
    run: sanitizeRun(q.get("run")),
  };
}

// ---------------------------------------------------------------------------
// The machine-readable result
// ---------------------------------------------------------------------------
//
// The on-page log is written for a human squinting at a phone. A driver -- a
// browser-driving agent, or a headless job after a deploy -- needs something
// it can assert on, so every run also maintains `window.__testbed`:
//
//   { schema, page, params, status, startedAt, finishedAt,
//     trialsCompleted, trialsPlanned,
//     sessionId, condition, filenames, requests, notes }
//
// SCHEMA 2. Schema 1 had no `ready` status and no trial counter, and a driver
// written against it will find both missing on a cached copy of these pages --
// read `schema` before relying on either.
//
// THE STATE MACHINE:
//
//   ready ──▶ running ──▶ finished | failed
//     └───────────────▶ aborted
//
//   ready     -- the page loaded, its settings are valid, and it is waiting
//                for the participant's first keypress. BOTH pages sit here on
//                "Press any key to start", so this is the status a driver must
//                see before it sends that key -- and `running` is what proves
//                the key landed.
//   running   -- the first trial has started. Trials are advancing.
//   finished  -- the run reached its end AND the final submission was accepted
//   failed    -- the run reached its end and the final submission was not
//   aborted   -- the page stopped before any trial ran (no experiment id, no
//                condition assigned). Reached from `ready`: a page with no
//                experiment id publishes both in the same synchronous pass, so
//                a driver never observes `ready` for that run.
//
// `failed` is reachable straight from `ready` too, in one case: the jsPsych
// page's ?breaksave=1 pre-claim happens before the timeline starts, and a run
// whose pre-claim was refused is meaningless, so it ends there rather than
// running trials it would prove nothing with.
//
// Schema 1 set `running` at page load, before the first keypress. A driver
// that read it as "trials are advancing" was wrong twice on 2026-09-19.
//
// A tab closed mid-run never leaves a terminal status, which is exactly what
// the abandoned-session scenarios want to observe.
//
// `startedAt` is when the PAGE opened the result, not when the participant
// started: the gap between them is however long the tab sat on "Press any key
// to start". The ready ──▶ running transition is the participant's own start.
//
// TRIAL COUNTING. `trialsPlanned` is the `trials` parameter and nothing else,
// and `trialsCompleted` reaches it on a clean finish, so
// `trialsCompleted === trialsPlanned` is the whole of "it ran to the end".
// Instruction screens are not counted on either page, even though the jsPsych
// page's stored CSV holds a row for its one instruction trial -- the count is
// about the task, and a driver polling for "half way" should not have to know
// how many non-task screens a page happens to show first.
//
// Mirrored twice, because drivers differ in what they can do: `window.__testbed`
// for anything that can evaluate JavaScript, and the DOM for anything that
// cannot -- `data-testbed-schema`, `data-testbed-status`,
// `data-testbed-trials-completed` and `data-testbed-trials-planned` on
// `<html>`, plus the full JSON in `#testbed-result`. **The DOM is the primary
// interface.** A browser extension evaluates JavaScript in an isolated world
// and may not see a page global at all; `window.__testbed` is a convenience
// for same-world drivers such as Playwright.
//
// `data-testbed-schema` is read FIRST, before anything else here is trusted:
// it is a one-line DOM check for which contract a driver is about to rely on,
// rather than a JSON parse of #testbed-result just to find that out. Fall
// back to the JSON's `schema` field if the attribute is ever absent (an older
// published page), then to schema-1 behaviour if neither is there.
//
// WHAT IS DELIBERATELY MISSING. `requests` holds only the requests the PAGE
// issues -- `source: "page"`. The extension and datapipe-client make their own
// -- POST /api/session, the jsPsych page's final POST /api/data, and the
// staging writes -- and the page cannot see them. `fetch` is NOT wrapped to
// catch them. Staging talks to the Realtime Database over its own transport
// rather than fetch, so a wrapper would miss the bulk of them anyway; and the
// two it WOULD intercept are the two most easily broken by touching them -- a
// gzip Blob body produced by CompressionStream, and whatever the extension
// sends while the page is unloading, where handing back a different promise can
// cost the browser its keepalive guarantee. Runs say in `notes` which paths are
// invisible instead of inventing entries for them; what those paths DO surface
// (callbacks, the library warnings mirrored below, the final outcome) is
// recorded with `source: "library"`, and only `source: "page"` entries carry a
// real `ms` -- the page cannot time a request it did not start.

const result = {
  schema: 2,
  page: "",
  params: {},
  status: "ready",
  startedAt: null,
  finishedAt: null,
  trialsCompleted: 0,
  trialsPlanned: 0,
  sessionId: null,
  condition: null,
  filenames: [],
  requests: [],
  notes: [],
};

const TERMINAL = ["finished", "failed", "aborted"];

function publish() {
  window.__testbed = result;
  const dom = document.documentElement.dataset;
  // Mirrored first, and on its own, so a driver can learn which contract it is
  // about to trust with a single DOM read -- `data-testbed-schema` -- instead
  // of parsing #testbed-result's JSON just to find out. A driver should still
  // fall back to the JSON's `schema` field if this attribute is ever absent
  // (an older published page), and to schema-1 behaviour if neither is there.
  dom.testbedSchema = String(result.schema);
  dom.testbedStatus = result.status;
  dom.testbedTrialsCompleted = String(result.trialsCompleted);
  dom.testbedTrialsPlanned = String(result.trialsPlanned);
  const el = document.getElementById("testbed-result");
  if (el) el.textContent = JSON.stringify(result, null, 2);
}

/** Open the result. Call once, before anything is sent. */
export function startResult(page, params) {
  result.page = page;
  result.params = { ...params };
  result.trialsPlanned = params.trials;
  result.startedAt = new Date().toISOString();
  publish();
}

export function setResultStatus(status) {
  result.status = status;
  if (TERMINAL.includes(status)) result.finishedAt = new Date().toISOString();
  publish();
}

/**
 * The participant has started: the first trial is on screen.
 *
 * Only ever moves `ready` forward, so the pages can call it from a per-trial
 * hook without having to know whether it is the first one -- and so a late
 * call can never drag a finished run back to `running`.
 */
export function markRunning() {
  if (result.status === "ready") setResultStatus("running");
}

/**
 * How many of the task's trials have finished.
 *
 * Called once per trial, which is one DOM write per trial: cheap next to the
 * trial itself, and the only thing a driver can poll to act "at trial N".
 */
export function setTrialsCompleted(completed) {
  result.trialsCompleted = completed;
  publish();
}

/**
 * One request.
 *
 * `source` is "page" for a request this page issued through its own fetch, and
 * "library" for one the extension or datapipe-client issued, which the page can
 * only describe from a callback. `ms` is a real duration for "page" and null
 * for "library" -- see the note above.
 */
export function recordRequest({
  label,
  method = "POST",
  url = "",
  status = 0,
  ok,
  ms = null,
  source = "page",
  // True when `status` was not read off a response but deduced from what the
  // library exposed afterwards (a returned condition, a non-empty sessionId).
  // A field rather than a line in `notes`, so a driver asserting on a status
  // can tell evidence from inference without parsing prose.
  inferred = false,
  error,
}) {
  result.requests.push({
    label,
    method,
    url,
    status,
    ok: ok === undefined ? status >= 200 && status < 300 : ok,
    ms,
    source,
    ...(inferred ? { inferred: true } : {}),
    ...(error === undefined ? {} : { error: String(error) }),
  });
  publish();
}

/** Something a driver should know that is not a request: usually a gap. */
export function noteResult(text) {
  result.notes.push(text);
  publish();
}

export function setSessionId(sessionId) {
  result.sessionId = sessionId || null;
  publish();
}

export function setCondition(condition) {
  result.condition = condition;
  publish();
}

/** Every name this run asked storage to hold, in the order it claimed them. */
export function addFilename(filename) {
  if (!result.filenames.includes(filename)) result.filenames.push(filename);
  publish();
}

const logEl = () => document.getElementById("log");

/** Append a line to the on-page log (and the console). */
export function log(message, detail) {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const line = document.createElement("div");
  line.className = "log-line";
  const text = detail === undefined ? message : `${message} ${stringify(detail)}`;
  line.textContent = `${time}  ${text}`;
  logEl()?.appendChild(line);
  logEl()?.scrollTo(0, logEl().scrollHeight);
  console.log(`[testbed] ${text}`);
}

function stringify(value) {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Mirror the extension's and the client's console warnings into the page log.
 *
 * Both report every degraded path -- session refused, flush failed, trial too
 * large, disconnect-slot cap reached -- as a console.warn prefixed
 * "extension-pipe:" or "datapipe:". Those are exactly what a tester needs to
 * see, and exactly what is invisible on a phone with no DevTools.
 */
const WARN_PREFIXES = ["extension-pipe:", "datapipe:"];

export function mirrorClientWarnings() {
  const original = console.warn.bind(console);
  console.warn = (...args) => {
    original(...args);
    if (typeof args[0] === "string" && WARN_PREFIXES.some((p) => args[0].startsWith(p))) {
      const text = args.map((a) => (typeof a === "string" ? a : stringify(a))).join(" ");
      const line = document.createElement("div");
      line.className = "log-line log-warn";
      line.textContent = `${new Date().toLocaleTimeString([], { hour12: false })}  ${text}`;
      logEl()?.appendChild(line);
      // These warnings are the only account a driver gets of what happened
      // inside the extension or the client, so they belong in the result too.
      noteResult(text);
    }
  };
}

/** Show the settings this run is using, so a screenshot says what was tested. */
export function describeRun(params, extra = {}) {
  const el = document.getElementById("run-settings");
  if (!el) return;
  const shown = { experiment: params.experiment, base: params.base, ...extra };
  el.textContent = Object.entries(shown)
    .map(([k, v]) => `${k}=${v}`)
    .join("  ·  ");
}

/**
 * Stop with a clear message if no experiment id was given, rather than sending
 * requests DataPipe will reject with MISSING_PARAMETER.
 */
export function requireExperiment(params) {
  if (params.experiment) return true;
  document.getElementById("target").innerHTML =
    '<p class="notice">No experiment id. Start from <a href="../">the testbed home page</a>, ' +
    "or add <code>?experiment=YOUR_ID</code> to this URL.</p>";
  noteResult("no experiment id in the URL; nothing was sent");
  setResultStatus("aborted");
  return false;
}

/**
 * A readable, unique filename for this run.
 *
 * The run id goes in the name, not only in the result contract: the filename
 * is the one part of a run that outlives the tab, so it is what a driver
 * matches against when it goes looking in the researcher's storage an hour
 * later for a recovered partial.
 */
export function makeFilename(participantId, format, run = "") {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const tag = run ? `${run}-` : "";
  return `testbed-${tag}${stamp}-${participantId}.${format}`;
}
