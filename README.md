# DataPipe testbed

Test experiments for [DataPipe](https://pipe.jspsych.org), for checking a
deployment end to end. Published at **https://jspsych.github.io/datapipe-testbed/**.

- **jsPsych page** (`site/jspsych/`) — jsPsych 8 with
  [`@jspsych/extension-pipe`](https://github.com/jspsych/jsPsych/tree/main/packages/extension-pipe).
  Registering the extension is the whole integration: no save trial, no `await`,
  no session variable. Trials are staged as they happen and abandoned sessions
  are recovered. Written exactly the way the extension's docs tell researchers
  to write it, so it also checks that the documented pattern works.
- **Plain JavaScript page** (`site/vanilla/`) — no jsPsych and no framework, using
  [`datapipe-client`](https://www.npmjs.com/package/datapipe-client) for staging
  and condition assignment, and a bare `fetch` for the submission (optionally
  gzipped). **Streaming without jsPsych is new**: while the staging client lived
  inside the jsPsych plugin there was no way to reach it from a page like this.

Both pages log every request and response on screen, so a run can be checked
without DevTools — including on a phone, where flaky connections are easiest
to reproduce.

## Using it

1. Create an experiment on the deployment you are testing — for the test
   deployment, sign in at <https://datapipe-test.web.app> — and switch data
   collection on.
2. Open the [testbed home page](https://jspsych.github.io/datapipe-testbed/),
   enter the experiment ID, pick the options, and open a test.
3. Keep the experiment's dashboard open alongside. The home page lists the
   scenarios to check and what each should look like.

Every setting is a URL parameter, so a test is a link you can share:

| Parameter | Pages | Default | Meaning |
|---|---|---|---|
| `experiment` | both | — | DataPipe experiment ID (required) |
| `base` | both | `https://datapipe-test.web.app` | DataPipe deployment |
| `trials` | both | `20` | Number of trials (1–500) |
| `format` | both | `csv` | `csv` or `json` |
| `auto` | both | `0` | `1` advances trials automatically |
| `stream` | jsPsych | `1` | Incremental upload on/off |
| `breaksave` | jsPsych | `0` | `1` makes the final submission fail on purpose |
| `session` | plain JS | `0` | Call `/api/session` before starting |
| `condition` | plain JS | `0` | Call `/api/condition` before starting |
| `compress` | plain JS | `1` | Gzip the submission |

Nothing here is secret: DataPipe experiment IDs are public by design, and none
is committed — they come from the URL. Do point tests at a *test* experiment:
they send real data to real storage.

## The unreleased extension

`@jspsych/extension-pipe` is not published yet, so its browser bundle is
committed in `site/vendor/extension-pipe/`, with
[`SOURCE.md`](site/vendor/extension-pipe/SOURCE.md) recording the exact commit
it was built from. Running the unreleased build before it ships is the point of
this repository. To rebuild it from a local checkout of jsPsych:

```sh
scripts/refresh-extension.sh ../jsPsych
```

`datapipe-client` needs no vendoring — it is published, and the plain
JavaScript page loads it from the CDN at a pinned version. It is also bundled
inside the extension's browser build, which is why that file is ~185 KB.

Once the extension publishes, point `site/jspsych/index.html` at
`https://unpkg.com/@jspsych/extension-pipe` and delete `site/vendor/` and
`scripts/refresh-extension.sh`.

## Deploying

Pushing to `main` publishes `site/` to GitHub Pages
(`.github/workflows/pages.yml`). There is no build step.
