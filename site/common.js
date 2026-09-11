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
    // jsPsych page: stage trials as they happen (the feature under test).
    stream: flag(q.get("stream"), true),
    // jsPsych page: send the final submission to a URL that cannot answer, to
    // exercise the "submission failed, recover the staged copy" path.
    breaksave: flag(q.get("breaksave"), false),
    // Plain-JS page: call /api/session first, and /api/condition.
    session: flag(q.get("session"), false),
    condition: flag(q.get("condition"), false),
    compress: flag(q.get("compress"), true),
  };
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
 * Mirror the plugin's own console warnings into the page log. plugin-pipe
 * reports every degraded path (session refused, flush failed, slot cap
 * reached) as a console.warn prefixed "plugin-pipe:", and those are exactly
 * what a tester needs to see without opening DevTools on a phone.
 */
export function mirrorPluginWarnings() {
  const original = console.warn.bind(console);
  console.warn = (...args) => {
    original(...args);
    if (typeof args[0] === "string" && args[0].startsWith("plugin-pipe:")) {
      const line = document.createElement("div");
      line.className = "log-line log-warn";
      line.textContent = `${new Date().toLocaleTimeString([], { hour12: false })}  ${args
        .map((a) => (typeof a === "string" ? a : stringify(a)))
        .join(" ")}`;
      logEl()?.appendChild(line);
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
  return false;
}

/** A readable, unique filename for this run. */
export function makeFilename(participantId, format) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `testbed-${stamp}-${participantId}.${format}`;
}
