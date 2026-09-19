// A jsPsych experiment using @jspsych/extension-pipe, written the way the
// extension's own documentation tells researchers to write it -- so this page
// doubles as a check that the documented pattern actually works.
//
// The whole integration is the `extensions` array passed to initJsPsych. There
// is no save trial, no `await`, and no session variable threaded through the
// timeline. Compare this file's history: the plugin version needed all three,
// and an async wrapper around jsPsych.run() to hold them together.

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
  addFilename,
  endpointURL,
} from "../common.js";

const params = readParams();
startResult("jspsych", params);
mirrorClientWarnings();
describeRun(params, {
  run: params.run || "—",
  trials: params.trials,
  format: params.format,
  stream: params.stream ? "on" : "off",
  auto: params.auto ? "on" : "off",
  breaksave: params.breaksave ? "ON" : "off",
  abort: params.abort ? `at trial ${params.abort}` : "off",
});

// Everything this page does with DataPipe after the pre-claim below happens
// inside the extension. Said once, up front, so a driver reading the result
// never has to guess whether an empty `requests` means "nothing was sent".
noteResult(
  "extension-pipe issues POST /api/session, the staging writes and the final " +
    "POST /api/data itself; per-request detail for those is unavailable to the " +
    "page. The final save is recorded from the extension's on_save callback, " +
    "and any degraded path it reports arrives as an `extension-pipe:` note."
);

// Said once, because "sessionId: null" on a page that plainly DID stream reads
// like a bug until you know why. @jspsych/extension-pipe 0.2.0 keeps its
// DataPipeSession in a field its source declares `private` (src/index.ts,
// `private session: DataPipeSession | null`) and exposes nothing else: no
// getter, no event, and an on_save result of {ok, status, body} with no id in
// it. TypeScript's `private` is erased at runtime, so
// `jsPsych.extensions.pipe.session.sessionId` would in fact answer today -- and
// it is not this page's to read. A testbed that asserts on a library's private
// field stops testing the library's contract and starts testing its internals,
// and would break on a patch release without a semver signal. So the field
// stays null here, and the smallest upstream fix is a three-line public getter
// on the extension.
noteResult(
  "sessionId is null on this page BY DESIGN: extension-pipe 0.2.0 exposes no " +
    "public way to read the session id it opened. The plain-JavaScript page, " +
    "which calls datapipe-client itself, does report one."
);

if (requireExperiment(params)) {
  const jsPsych = initJsPsych({
    display_element: "target",
    extensions: [
      {
        type: jsPsychExtensionPipe,
        params: {
          experiment_id: params.experiment,
          // A function, because `filename` below is declared after this object
          // literal -- it needs the jsPsych instance that initJsPsych returns.
          // A plain string here would read it in the temporal dead zone.
          filename: () => filename,
          format: params.format,
          stream: params.stream,
          base_url: params.base,
          on_save: (result) => {
            log(`final save ${result.ok ? "SUCCEEDED" : "FAILED"} (HTTP ${result.status})`, result.body);
            saved = true;
            recordRequest({
              label: "final-save",
              // With the trailing slash, because that is the URL the extension
              // actually used: datapipe-client's endpoint() adds it. Recording
              // the slashless form here would be tidier and untrue.
              url: `${params.base}/api/data/`,
              source: "library",
              status: result.status,
              ok: result.ok,
              // Not timed: the extension started this request, not the page.
              ms: null,
              error: result.ok ? undefined : result.body?.error ?? result.body,
            });
            setResultStatus(result.ok ? "finished" : "failed");
          },
        },
      },
    ],
    on_finish: () => {
      document.getElementById("target").innerHTML =
        '<p class="notice">Finished. Check the log below, then the experiment\'s dashboard ' +
        "and your storage for the file.</p>";
      // on_save may land before or after this, so the terminal status is set
      // there and not here. The watchdog only exists so that an extension that
      // never calls back leaves a driver with an answer rather than a run that
      // sits at "running" forever -- which is the one status that is supposed
      // to mean "the participant is still going".
      if (saved) return;
      noteResult("timeline finished; waiting for the extension's on_save callback");
      setTimeout(() => {
        if (saved) return;
        noteResult("no on_save callback within 30s of the timeline ending");
        setResultStatus("failed");
      }, 30000);
    },
  });

  let saved = false;

  const participantId = jsPsych.randomization.randomID(8);
  const filename = makeFilename(participantId, params.format, params.run);
  addFilename(filename);
  const letters = ["F", "J"];

  const timeline = [
    {
      type: jsPsychHtmlKeyboardResponse,
      stimulus:
        `<p><strong>DataPipe test run.</strong> ${params.trials} trials.</p>` +
        (params.auto
          ? "<p>Trials will advance on their own.</p>"
          : "<p>Press <kbd>F</kbd> or <kbd>J</kbd> to match the letter shown.</p>") +
        "<p>Press any key to start.</p>",
    },
    {
      timeline: [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: () =>
            `<p class="stimulus">${jsPsych.randomization.sampleWithReplacement(letters, 1)[0]}</p>`,
          choices: ["f", "j"],
          trial_duration: params.auto ? 400 : null,
          data: { task: "testbed-letter" },
          // The participant's own start. The instruction trial before this one
          // waits for a keypress however `auto` is set, so the first time a
          // letter is on screen is the first moment "trials are advancing" is
          // true -- which is what a driver is waiting to see before it stops
          // resending the start key.
          on_start: () => markRunning(),
          on_finish: () => {
            // Counted from the data rather than a local variable so that it
            // stays right whatever the timeline does around it -- and filtered
            // to `testbed-letter`, so the instruction trial is not counted.
            // trialsCompleted has to reach `trials` exactly on a clean finish,
            // and the stored CSV holds one more row than that.
            const n = jsPsych.data.get().filter({ task: "testbed-letter" }).count();
            setTrialsCompleted(n);

            // ?abort=N ends the experiment at trial N, the way a failed
            // attention check would. The extension still submits, because
            // abortExperiment() unwinds the timeline and falls through to
            // on_finish -- a save TRIAL would never have been reached, which
            // is the behaviour difference this scenario exists to show.
            if (params.abort && n >= params.abort) {
              log(`aborting at trial ${n} -- the extension should still submit`);
              noteResult(`timeline ended early at trial ${n} of ${params.trials}`);
              jsPsych.abortExperiment("<p>Ended early, as an attention check would.</p>");
            }
          },
        },
      ],
      repetitions: params.trials,
    },
  ];

  /**
   * A pre-claim payload DataPipe will actually accept.
   *
   * It has to survive two gates the old plain-sentence body did not. With
   * Psych-DS metadata on, the raw submission is parsed to derive the dataset's
   * tables, and anything that is not CSV or JSON is refused with
   * METADATA_ERROR. With validation on -- which is the DEFAULT for a new
   * experiment (`requiredFields: ["trial_type"]` in create-experiment.ts) --
   * a row without a `trial_type` column is refused with INVALID_DATA. This is
   * the smallest body that passes both, and it deliberately mirrors the shape
   * of what the run itself submits.
   */
  function preclaimBody(format) {
    const row = { trial_type: "html-keyboard-response", trial_index: 0, rt: 100 };
    if (format === "json") return JSON.stringify([row]);
    return `${Object.keys(row).join(",")}\n${Object.values(row).join(",")}\n`;
  }

  async function run() {
    log(`filename ${filename}`);
    log(
      params.stream
        ? "streaming ON -- trials are staged as they happen"
        : "streaming OFF -- one submission at the end, as before incremental upload"
    );

    if (params.breaksave) {
      // Claim the filename before the experiment ends, so DataPipe refuses the
      // extension's submission as a duplicate. That is a REAL server refusal
      // rather than a simulated one, and it exercises the path that matters:
      // DataPipe deliberately leaves staging alone on a duplicate-filename
      // refusal, so the staged trials should come back as a hash-suffixed
      // .partial.json rather than being discarded with the rejected request.
      log("breaksave: claiming the filename first, so the final save is refused");
      const url = endpointURL(params.base, "data");
      const startedAt = performance.now();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: params.experiment,
          filename,
          data: preclaimBody(params.format),
        }),
      });
      const body = await response.json().catch(() => null);
      log(`  pre-claim responded ${response.status}`, body ?? undefined);
      // The page's own request, so it is timed and recorded in full -- unlike
      // the extension's save below.
      recordRequest({
        label: "preclaim",
        url,
        status: response.status,
        ms: Math.round(performance.now() - startedAt),
        error: response.ok ? undefined : (body?.error ?? body),
      });

      // STOP if the claim did not land. Observed against datapipe-test on
      // 2026-09-19: the old pre-claim body was a plain sentence, which a
      // Psych-DS experiment refuses with METADATA_ERROR before the name is
      // ever taken. The run then went on to SUCCEED, and the scenario
      // reported a pass while testing nothing it claimed to test. A run whose
      // pre-claim failed is meaningless, so it ends here and says so.
      if (!response.ok) {
        const detail = body?.error ?? response.status;
        log(`  breaksave ABORTED: the filename was not claimed (${detail})`);
        document.getElementById("target").innerHTML =
          `<p class="notice">breaksave could not claim the filename (${detail}), so the ` +
          "final save would not be refused. The run was not started. See the log.</p>";
        noteResult(`breaksave pre-claim failed (${detail}); the timeline was not run`);
        setResultStatus("failed");
        return;
      }
    }

    jsPsych.run(timeline);
  }

  run();
}
