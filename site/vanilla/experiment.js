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
} from "../common.js";

const params = readParams();
mirrorClientWarnings();
describeRun(params, {
  trials: params.trials,
  format: params.format,
  stream: params.stream ? "on" : "off",
  condition: params.condition ? "on" : "off",
  compress: params.compress ? "on" : "off",
  auto: params.auto ? "on" : "off",
});

const target = document.getElementById("target");

/** POST JSON to a DataPipe endpoint; log and return {status, body}. */
async function post(path, body, { compress = false } = {}) {
  const url = `${params.base}/api/${path}/`;
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

  log(`→ POST /api/${path}/${headers["Content-Encoding"] ? " (gzip)" : ""}`);
  try {
    const response = await fetch(url, { method: "POST", headers, body: payload });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text.slice(0, 200);
    }
    log(`← ${response.status} /api/${path}/`, parsed);
    return { status: response.status, body: parsed };
  } catch (error) {
    log(`← network error on /api/${path}/`, error);
    return { status: 0, body: null };
  }
}

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
  const filename = makeFilename(participantId, params.format);
  log(`filename ${filename}`);

  DataPipe.setBaseURL(params.base);

  if (params.condition) {
    // The one call in this library that throws. A condition decides which
    // timeline a participant runs, so there is no safe value to fall back to;
    // catching it and showing something is the documented pattern.
    try {
      const condition = await DataPipe.getCondition({ experimentID: params.experiment });
      log(`condition assigned: ${condition}`);
    } catch (error) {
      log("getCondition THREW -- the designed behaviour on failure", error);
      target.innerHTML =
        '<p class="notice">The experiment could not be started: no condition was assigned.</p>';
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

  target.innerHTML =
    `<p><strong>DataPipe test run.</strong> ${params.trials} trials.</p>` +
    (params.auto
      ? "<p>Trials will advance on their own.</p>"
      : "<p>Press <kbd>F</kbd> or <kbd>J</kbd> to match the letter shown.</p>") +
    "<p>Press any key to start.</p>";
  target.focus();
  await waitForKey();

  const rows = [];
  for (let i = 0; i < params.trials; i++) {
    const row = await runTrial(i);
    rows.push(row);
    // One line is the whole streaming integration for a page with no
    // framework. Safe to call whether or not the session started.
    session?.record(row);
  }

  target.innerHTML = "<p>Saving data…</p>";
  const data = params.format === "json" ? JSON.stringify(rows) : toCSV(rows);

  // Flush BEFORE reading sessionId. flush() waits for the session to start,
  // and until it has, sessionId is an empty string -- submitting without it
  // would leave DataPipe unable to match this file to the staged copy, which
  // it would then recover separately as a spurious .partial.json.
  await session?.flush();

  const { status } = await post(
    "data",
    {
      experimentID: params.experiment,
      filename,
      data,
      ...(session?.sessionId ? { sessionId: session.sessionId } : {}),
    },
    { compress: params.compress }
  );

  const ok = status === 201 || status === 202;
  // Tell the session what happened. On success the abandonment marker is
  // cancelled; on failure it is written now, so the staged trials are
  // recovered on the sweep rather than waiting out the 24-hour expiry.
  await session?.close({ submitted: ok });

  target.innerHTML = ok
    ? `<p class="notice">Saved (${status}). Check the experiment's dashboard and your storage.</p>`
    : `<p class="notice">The submission was not accepted (${status || "no response"}). See the log.</p>`;

  const actions = document.getElementById("actions");
  actions.hidden = false;
  document.getElementById("resubmit").addEventListener("click", () =>
    post("data", { experimentID: params.experiment, filename, data }, { compress: params.compress })
  );
}

if (requireExperiment(params)) main();
