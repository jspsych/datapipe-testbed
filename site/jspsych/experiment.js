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
  recordRequest,
  noteResult,
  addFilename,
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
              url: `${params.base}/api/data/`,
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
          on_finish: () => {
            // ?abort=N ends the experiment at trial N, the way a failed
            // attention check would. The extension still submits, because
            // abortExperiment() unwinds the timeline and falls through to
            // on_finish -- a save TRIAL would never have been reached, which
            // is the behaviour difference this scenario exists to show.
            const n = jsPsych.data.get().filter({ task: "testbed-letter" }).count();
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
      const url = `${params.base}/api/data/`;
      const startedAt = performance.now();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: params.experiment,
          filename,
          data: "claimed by the testbed to force a duplicate-filename refusal\n",
        }),
      });
      log(`  pre-claim responded ${response.status}`);
      // The page's own request, so it is timed and recorded in full -- unlike
      // the extension's save below.
      recordRequest({
        label: "preclaim",
        url,
        status: response.status,
        ms: Math.round(performance.now() - startedAt),
      });
    }

    jsPsych.run(timeline);
  }

  run();
}
