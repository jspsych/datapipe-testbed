// A tiny experiment with no jsPsych and no plugin: every DataPipe call is a
// plain fetch(), exactly as the "Plain JavaScript" section of DataPipe's docs
// describes. It exercises the API a researcher calls by hand:
//
//   POST /api/condition   (?condition=1)  condition assignment
//   POST /api/session     (?session=1)    admit a session; nothing is staged
//                                         from this page, but the final save
//                                         carries the session id so DataPipe
//                                         drops the (empty) session
//   POST /api/data                        the submission itself, optionally
//                                         gzip-compressed (?compress=0 to send
//                                         it plain)
//
// Incremental upload itself is not tested here: staging trials without the
// plugin would mean hand-copying its Realtime Database logic, which is not a
// documented path. The jsPsych page covers streaming.

import {
  readParams,
  log,
  describeRun,
  requireExperiment,
  makeFilename,
} from "../common.js";

const params = readParams();
describeRun(params, {
  trials: params.trials,
  format: params.format,
  session: params.session ? "on" : "off",
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

  if (params.condition) {
    await post("condition", { experimentID: params.experiment });
  }

  let sessionId;
  if (params.session) {
    const { status, body } = await post("session", { experimentID: params.experiment, filename });
    if (status === 200 && body?.sessionId) {
      sessionId = body.sessionId;
      log(`session admitted (id ${sessionId.slice(0, 6)}…); staging database ${body.databaseURL}`);
    }
  }

  target.innerHTML =
    `<p><strong>DataPipe test run.</strong> ${params.trials} trials.</p>` +
    (params.auto
      ? "<p>Trials will advance on their own.</p>"
      : "<p>Press <kbd>F</kbd> or <kbd>J</kbd> to match the letter shown.</p>") +
    "<p>Press any key to start.</p>";
  target.focus();
  await waitForKey();

  const rows = [];
  for (let i = 0; i < params.trials; i++) rows.push(await runTrial(i));

  target.innerHTML = "<p>Saving data…</p>";
  const data = params.format === "json" ? JSON.stringify(rows) : toCSV(rows);
  const submission = {
    experimentID: params.experiment,
    filename,
    data,
    ...(sessionId ? { sessionId } : {}),
  };
  const { status } = await post("data", submission, { compress: params.compress });

  target.innerHTML =
    status === 201 || status === 202
      ? `<p class="notice">Saved (${status}). Check the experiment's dashboard and your storage.</p>`
      : `<p class="notice">The submission was not accepted (${status || "no response"}). See the log.</p>`;

  const actions = document.getElementById("actions");
  actions.hidden = false;
  document.getElementById("resubmit").addEventListener("click", () =>
    post("data", { experimentID: params.experiment, filename, data }, { compress: params.compress })
  );
}

if (requireExperiment(params)) main();
