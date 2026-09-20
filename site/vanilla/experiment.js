// A tiny experiment with no jsPsych: every DataPipe call is either a plain
// fetch() or a datapipe-client call, exactly as the "Plain JavaScript" section
// of DataPipe's docs describes.
//
//   POST /api/data                        the submission, optionally
//                                         gzip-compressed (?compress=0 to send
//                                         it plain)
//   DataPipe.getCondition  (?condition=1) condition assignment, which THROWS on
//                                         failure -- the one call in the
//                                         library that does
//   DataPipe.createSession (?stream=1)    stage each trial as it happens
//
// Streaming from a page with no framework is new. While the staging client
// lived inside the jsPsych plugin there was no way to reach it without jsPsych,
// so this half of the testbed could only ever submit once at the end. That is
// the main thing this page now exists to prove.

import {
  readParams,
  log,
  mirrorClientWarnings,
  describeRun,
  requireExperiment,
  makeFilename,
  startResult,
  setResultStatus,
  markRunning,
  setTrialsCompleted,
  recordRequest,
  noteResult,
  setSessionId,
  setCondition,
  addFilename,
  endpointURL,
} from "../common.js";

const params = readParams();
startResult("vanilla", params);
mirrorClientWarnings();
describeRun(params, {
  run: params.run || "—",
  trials: params.trials,
  format: params.format,
  stream: params.stream ? "on" : "off",
  condition: params.condition ? "on" : "off",
  compress: params.compress ? "on" : "off",
  base64: params.base64,
  failvalidation: params.failvalidation ? "ON" : "off",
  auto: params.auto ? "on" : "off",
});

if (params.failvalidation) {
  log("failvalidation: rows will carry no trial_type, so validation should refuse them");
  noteResult("failvalidation: `trial_type` is omitted from every row on purpose");
}

const target = document.getElementById("target");

/**
 * POST JSON to a DataPipe endpoint; log, record, and return {status, body}.
 *
 * Every request this PAGE makes goes through here, which is why the result
 * contract needs no wrapper around fetch itself -- see common.js.
 */
async function post(path, body, { compress = false, label = path } = {}) {
  const url = endpointURL(params.base, path);
  const json = JSON.stringify(body);
  const headers = { "Content-Type": "application/json" };
  let payload = json;

  if (compress && typeof CompressionStream !== "undefined") {
    // What the docs tell plain-JS users to do for large submissions: gzip the
    // body with CompressionStream and say so in Content-Encoding.
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
    payload = await new Response(stream).blob();
    headers["Content-Encoding"] = "gzip";
  }

  log(`→ POST /api/${path}${headers["Content-Encoding"] ? " (gzip)" : ""}`);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { method: "POST", headers, body: payload });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text.slice(0, 200);
    }
    log(`← ${response.status} /api/${path}`, parsed);
    recordRequest({
      label,
      url,
      status: response.status,
      ms: Math.round(performance.now() - startedAt),
      error: response.ok ? undefined : parsed?.error ?? parsed,
    });
    return { status: response.status, body: parsed };
  } catch (error) {
    log(`← network error on /api/${path}`, error);
    recordRequest({
      label,
      url,
      status: 0,
      ok: false,
      ms: Math.round(performance.now() - startedAt),
      error: `${error.name}: ${error.message}`,
    });
    return { status: 0, body: null };
  }
}

// What this page's one trial type is. It goes on every row under the name
// `trial_type`, because that is the field a NEW DataPipe experiment requires by
// default (create-experiment.ts: `requiredFields ?? ["trial_type"]`) -- so
// without it the plain-JavaScript page's very first submission is refused with
// INVALID_DATA, and a testbed that needs a dashboard setting changed before it
// can send anything is testing the wrong thing.
//
// jsPsych fills this in itself, from the plugin's `info.name`. There is no
// plugin here, so the name is written out: a letter shown, a keyboard response
// taken. It deliberately does NOT claim to be `html-keyboard-response` -- that
// is a jsPsych plugin and this page has no jsPsych in it.
const TRIAL_TYPE = "letter-keyboard-response";

/** One trial: show a letter, wait for F or J (or time out in auto mode). */
function runTrial(index) {
  return new Promise((resolve) => {
    const letter = Math.random() < 0.5 ? "F" : "J";
    target.innerHTML = `<p class="stimulus">${letter}</p>`;
    const shownAt = performance.now();
    let timer = null;

    const finish = (response) => {
      window.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
      resolve({
        // First, as the column DataPipe validates on. ?failvalidation=1 drops
        // it, which is the whole of that scenario.
        ...(params.failvalidation ? {} : { trial_type: TRIAL_TYPE }),
        trial_index: index,
        task: "testbed-letter",
        stimulus: letter,
        response,
        rt: response === null ? null : Math.round(performance.now() - shownAt),
        correct: response === null ? null : response.toUpperCase() === letter,
      });
    };
    const onKey = (event) => {
      const key = event.key.toLowerCase();
      if (key === "f" || key === "j") finish(key);
    };

    window.addEventListener("keydown", onKey);
    if (params.auto) timer = setTimeout(() => finish(null), 400);
  });
}

function toCSV(rows) {
  const columns = Object.keys(rows[0] ?? {});
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join(
    "\n"
  );
}

function waitForKey() {
  return new Promise((resolve) => window.addEventListener("keydown", resolve, { once: true }));
}

async function main() {
  const participantId = Math.random().toString(36).slice(2, 10);
  const filename = makeFilename(participantId, params.format, params.run);
  addFilename(filename);
  log(`filename ${filename}`);

  DataPipe.setBaseURL(params.base);

  if (params.condition) {
    // The one call in this library that throws. A condition decides which
    // timeline a participant runs, so there is no safe value to fall back to;
    // catching it and showing something is the documented pattern.
    //
    // datapipe-client does not hand back a Response for this call, so the
    // entry below is RECONSTRUCTED from what the page can observe -- the
    // return value or the thrown error -- not read off the wire. `ms` still
    // times the real round trip, because it wraps the whole await.
    const conditionStartedAt = performance.now();
    try {
      const condition = await DataPipe.getCondition({ experimentID: params.experiment });
      const ms = Math.round(performance.now() - conditionStartedAt);
      log(`condition assigned: ${condition}`);
      setCondition(condition);
      recordRequest({
        label: "condition",
        url: endpointURL(params.base, "condition"),
        source: "library",
        inferred: true,
        status: 200,
        ok: true,
        ms,
      });
      noteResult(
        "POST /api/condition was made inside datapipe-client; per-request detail is " +
          "not observed on the wire. The `condition` entry above is reconstructed: " +
          "status 200 is what a returned (non-null) condition implies, not a status " +
          "read off a response."
      );
    } catch (error) {
      const ms = Math.round(performance.now() - conditionStartedAt);
      // getCondition() embeds the real HTTP status in its message when it has
      // one ("...(HTTP 400)..."); parsed here rather than guessed. 0 means
      // the request never reached DataPipe at all (offline, DNS, CORS).
      const status = Number(/\(HTTP (\d+)\)/.exec(error.message)?.[1]) || 0;
      log("getCondition THREW -- the designed behaviour on failure", error);
      recordRequest({
        label: "condition",
        url: endpointURL(params.base, "condition"),
        source: "library",
        inferred: true,
        status,
        ok: false,
        ms,
        error: error.message,
      });
      target.innerHTML =
        '<p class="notice">The experiment could not be started: no condition was assigned.</p>';
      noteResult(`getCondition threw (${error.name}: ${error.message}); no trials were run`);
      setResultStatus("aborted");
      return;
    }
  }

  // Synchronous on purpose: the /api/session round trip is still in flight,
  // and trials recorded before it lands are buffered rather than dropped.
  const session = params.stream
    ? DataPipe.createSession({ experimentID: params.experiment, filename })
    : null;
  log(
    params.stream
      ? "streaming ON -- trials are staged as they happen"
      : "streaming OFF -- one submission at the end"
  );
  if (session) {
    // Record the /api/session round trip by WATCHING, never by calling into the
    // client. The obvious hook -- an early `session.flush()`, which waits for
    // the start to settle -- is not the no-op it looks like: flush() cancels
    // the pending flush timer and then writes whatever is buffered, so if the
    // participant starts before the round trip lands it flushes the first few
    // trials early and changes the very batching this page exists to exercise.
    // Reading the public `sessionId` property on a timer starts no request and
    // touches no state. `ms` is therefore accurate to the polling interval, and
    // the status is inferred -- see `inferred` and the note below.
    const sessionStartedAt = performance.now();
    const SESSION_POLL_MS = 100;
    const SESSION_GIVE_UP_MS = 30000;
    const sessionWatch = setInterval(() => {
      const elapsed = Math.round(performance.now() - sessionStartedAt);
      const started = Boolean(session.sessionId);
      if (!started && elapsed < SESSION_GIVE_UP_MS) return;
      clearInterval(sessionWatch);
      recordRequest({
        label: "session",
        url: endpointURL(params.base, "session"),
        source: "library",
        inferred: true,
        status: started ? 200 : 0,
        ok: started,
        ms: elapsed,
        ...(started
          ? {}
          : {
              error:
                "no sessionId after 30 s; see the mirrored `datapipe:` warning note for the real reason/status",
            }),
      });
    }, SESSION_POLL_MS);
    noteResult(
      "POST /api/session and the staging writes happen inside datapipe-client; per-request " +
        "detail is not observed on the wire. The `session` entry is INFERRED (`inferred: true`) " +
        "from the public `sessionId` property becoming non-empty: status 200 is what that " +
        "implies, `ms` is accurate to 100 ms, and a failure's real HTTP status, when there is " +
        "one, is in the mirrored `datapipe:` warning instead."
    );
  }

  target.innerHTML =
    `<p><strong>DataPipe test run.</strong> ${params.trials} trials.</p>` +
    (params.auto
      ? "<p>Trials will advance on their own.</p>"
      : "<p>Press <kbd>F</kbd> or <kbd>J</kbd> to match the letter shown.</p>") +
    "<p>Press any key to start.</p>";
  target.focus();
  // Until this resolves the run is `ready`: loaded, valid, and waiting for a
  // participant who has not pressed anything yet.
  await waitForKey();
  markRunning();

  const rows = [];
  let sessionIdReported = false;
  for (let i = 0; i < params.trials; i++) {
    const row = await runTrial(i);
    rows.push(row);
    // One line is the whole streaming integration for a page with no
    // framework. Safe to call whether or not the session started.
    session?.record(row);
    setTrialsCompleted(rows.length);
    // As early as it is true, rather than only at the flush below. `sessionId`
    // is an empty string until the /api/session round trip lands, and a run
    // that is going to be abandoned never reaches the flush -- so reporting it
    // only at the end would mean never reporting it for exactly the runs where
    // the staged copy matters most. Reading the public property costs nothing
    // and starts no request of its own.
    if (session && !sessionIdReported && session.sessionId) {
      setSessionId(session.sessionId);
      sessionIdReported = true;
    }
  }

  target.innerHTML = "<p>Saving data…</p>";
  const data = params.format === "json" ? JSON.stringify(rows) : toCSV(rows);

  // Flush BEFORE reading sessionId. flush() waits for the session to start,
  // and until it has, sessionId is an empty string -- submitting without it
  // would leave DataPipe unable to match this file to the staged copy, which
  // it would then recover separately as a spurious .partial.json.
  await session?.flush();
  if (session) setSessionId(session.sessionId);

  const { status } = await post(
    "data",
    {
      experimentID: params.experiment,
      filename,
      data,
      ...(session?.sessionId ? { sessionId: session.sessionId } : {}),
    },
    { compress: params.compress, label: "final-save" }
  );

  const ok = status === 201 || status === 202;
  // Tell the session what happened. On success the abandonment marker is
  // cancelled; on failure it is written now, so the staged trials are
  // recovered on the sweep rather than waiting out the 24-hour expiry.
  await session?.close({ submitted: ok });

  target.innerHTML = ok
    ? `<p class="notice">Saved (${status}). Check the experiment's dashboard and your storage.</p>`
    : `<p class="notice">The submission was not accepted (${status || "no response"}). See the log.</p>`;

  const resubmit = () =>
    post(
      "data",
      { experimentID: params.experiment, filename, data },
      { compress: params.compress, label: "resubmit" }
    );

  const actions = document.getElementById("actions");
  actions.hidden = false;
  document.getElementById("resubmit").addEventListener("click", resubmit);

  // ?resubmit=1 presses that button for a driver. The duplicate is expected to
  // be refused, so it never changes this run's status -- the status is about
  // the submission, and that one already landed.
  if (params.resubmit) await resubmit();

  // ?base64=1|invalid exercises POST /api/base64, which now runs inside the
  // same consolidated function as /api/data. Kept off the main submission
  // path: a refusal here says nothing about whether the participant's data
  // was stored, so it does not change the run's status either.
  if (params.base64 !== "off") {
    const b64Filename = `${filename.replace(/\.[^.]+$/, "")}.b64.txt`;
    addFilename(b64Filename);
    await post(
      "base64",
      {
        experimentID: params.experiment,
        filename: b64Filename,
        data:
          params.base64 === "valid"
            ? btoa("testbed base64 payload\n")
            : // Not base64 under any padding: is-base64 rejects it before the
              // endpoint ever tries to decode.
              "!!! not base64 !!!",
      },
      { label: "base64" }
    );
  }

  // Last, so the status a driver polls for is only ever set once every request
  // this run makes has been recorded.
  setResultStatus(ok ? "finished" : "failed");
}

if (requireExperiment(params)) main();
