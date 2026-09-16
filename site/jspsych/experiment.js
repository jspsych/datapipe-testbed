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
} from "../common.js";

const params = readParams();
mirrorClientWarnings();
describeRun(params, {
  trials: params.trials,
  format: params.format,
  stream: params.stream ? "on" : "off",
  auto: params.auto ? "on" : "off",
  breaksave: params.breaksave ? "ON" : "off",
  abort: params.abort ? `at trial ${params.abort}` : "off",
});

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
          },
        },
      },
    ],
    on_finish: () => {
      document.getElementById("target").innerHTML =
        '<p class="notice">Finished. Check the log below, then the experiment\'s dashboard ' +
        "and your storage for the file.</p>";
    },
  });

  const participantId = jsPsych.randomization.randomID(8);
  const filename = makeFilename(participantId, params.format);
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
      const response = await fetch(`${params.base}/api/data/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: params.experiment,
          filename,
          data: "claimed by the testbed to force a duplicate-filename refusal\n",
        }),
      });
      log(`  pre-claim responded ${response.status}`);
    }

    jsPsych.run(timeline);
  }

  run();
}
