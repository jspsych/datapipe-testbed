// Shared by both test pages: reading the test's settings from the URL, and an
// on-page log of everything that goes to and comes back from DataPipe.
//
// Every setting lives in the URL, so a test is a link: it can be bookmarked,
// pasted into an issue, or opened on a phone to test a flaky mobile connection.

export const DEFAULT_BASE = "https://datapipe-test.web.app";

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
//     sessionId, condition, filenames, requests, notes }
//
// `status` is one of:
//   running   -- the run is still going
//   finished  -- the run reached its end AND the final submission was accepted
//   failed    -- the run reached its end and the final submission was not
//   aborted   -- the page stopped before running the trials (no experiment id,
//                no condition assigned)
//
// A tab closed mid-run never leaves a terminal status, which is exactly what
// the abandoned-session scenarios want to observe.
//
// Mirrored twice, because drivers differ in what they can do: `window.__testbed`
// for anything that can evaluate JavaScript, and
// `document.documentElement.dataset.testbedStatus` plus the JSON in
// `#testbed-result` for anything that can only read the DOM.
//
// WHAT IS DELIBERATELY MISSING. `requests` holds only the requests the PAGE
// issues. The extension and datapipe-client make their own -- POST /api/session,
// the jsPsych page's final POST /api/data, and the staging writes -- and the
// page cannot see them. `fetch` is NOT wrapped to catch them. Staging talks to
// the Realtime Database over its own transport rather than fetch, so a wrapper
// would miss the bulk of them anyway; and the two it WOULD intercept are the
// two most easily broken by touching them -- a gzip Blob body produced by
// CompressionStream, and whatever the extension sends while the page is
// unloading, where handing back a different promise can cost the browser its
// keepalive guarantee. Runs say in `notes` which paths are invisible instead of
// inventing entries for them; what those paths DO surface (callbacks, the
// library warnings mirrored below, the final outcome) is recorded.

const result = {
  schema: 1,
  page: "",
  params: {},
  status: "running",
  startedAt: null,
  finishedAt: null,
  sessionId: null,
  condition: null,
  filenames: [],
  requests: [],
  notes: [],
};

const TERMINAL = ["finished", "failed", "aborted"];

function publish() {
  window.__testbed = result;
  document.documentElement.dataset.testbedStatus = result.status;
  const el = document.getElementById("testbed-result");
  if (el) el.textContent = JSON.stringify(result, null, 2);
}

/** Open the result. Call once, before anything is sent. */
export function startResult(page, params) {
  result.page = page;
  result.params = { ...params };
  result.startedAt = new Date().toISOString();
  publish();
}

export function setResultStatus(status) {
  result.status = status;
  if (TERMINAL.includes(status)) result.finishedAt = new Date().toISOString();
  publish();
}

/** One request the page made itself. `ms` is null when it was not timed. */
export function recordRequest({ label, method = "POST", url = "", status = 0, ok, ms = null, error }) {
  result.requests.push({
    label,
    method,
    url,
    status,
    ok: ok === undefined ? status >= 200 && status < 300 : ok,
    ms,
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
