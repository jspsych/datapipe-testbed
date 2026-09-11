// A jsPsych experiment using plugin-pipe with incremental upload, written the
// way the plugin's own documentation tells researchers to write it -- so this
// page doubles as a check that the documented pattern actually works:
//
//   1. create jsPsych first, with on_data_update wired to the session;
//   2. start the session inside an async function (an ordinary page cannot
//      `await` at the top level);
//   3. put the save trial, given the session, at the end of the timeline.

import {
  readParams,
  log,
  mirrorPluginWarnings,
  describeRun,
  requireExperiment,
  makeFilename,
} from "../common.js";

const params = readParams();
mirrorPluginWarnings();
describeRun(params, {
  trials: params.trials,
  format: params.format,
  stream: params.stream ? "on" : "off",
  auto: params.auto ? "on" : "off",
  breaksave: params.breaksave ? "ON" : "off",
});

if (requireExperiment(params)) {
  jsPsychPipe.setBaseURL(params.base);

  let session = null;

  const jsPsych = initJsPsych({
    display_element: "target",
    // Every trial goes to the session as it finishes. `?.` because with
    // ?stream=0 there is no session at all: that is the submit-at-the-end
    // baseline this page can also run.
    on_data_update: (data) => session?.record(data),
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
          stimulus: () => `<p class="stimulus">${jsPsych.randomization.sampleWithReplacement(letters, 1)[0]}</p>`,
          choices: ["f", "j"],
          trial_duration: params.auto ? 400 : null,
          data: { task: "testbed-letter" },
        },
      ],
      repetitions: params.trials,
    },
  ];

  async function runExperiment() {
    log(`filename ${filename}`);

    if (params.stream) {
      session = await jsPsychPipe.startSession(params.experiment, { filename });
      if (session.enabled) {
        // The id is a write capability into this session. Fine to show a
        // prefix on a test page; a real experiment should never display it.
        log(`session started (id ${session.sessionId.slice(0, 6)}…) — trials will be staged as they happen`);
      } else {
        log("session NOT started — the plugin fell back to submitting once at the end (see warnings above)");
      }
    } else {
      log("stream=off — submitting once at the end, as without incremental upload");
    }

    timeline.push({
      type: jsPsychPipe,
      action: "save",
      experiment_id: params.experiment,
      filename,
      data_string: () =>
        params.format === "json" ? jsPsych.data.get().json() : jsPsych.data.get().csv(),
      session,
      // ?breaksave=1 aims the final submission at a path that answers with a
      // 404 page, so the save fails. The plugin should then stamp the session
      // abandoned at once, and DataPipe should recover the staged trials as a
      // .partial.json within ~15 minutes.
      base_url: params.breaksave ? `${params.base}/__testbed-broken-save` : null,
      wait_message: "<p>Saving data…</p>",
      on_finish: (data) => {
        log(`final submission ${data.success ? "SUCCEEDED" : "FAILED"}:`, data.result);
      },
    });

    jsPsych.run(timeline);
  }

  runExperiment();
}
