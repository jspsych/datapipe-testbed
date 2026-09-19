# DataPipe testbed

Test experiments for [DataPipe](https://pipe.jspsych.org), for checking a
deployment end to end. Published at **https://jspsych.github.io/datapipe-testbed/**.

- **jsPsych page** (`site/jspsych/`) — jsPsych 8 with
  [`@jspsych/extension-pipe`](https://www.npmjs.com/package/@jspsych/extension-pipe).
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
| `run` | both | — | Free-form label for one run (see below) |
| `trials` | both | `20` | Number of trials (1–500) |
| `format` | both | `csv` | `csv` or `json` |
| `auto` | both | `0` | `1` advances trials automatically |
| `stream` | both | `1` | Incremental upload on/off |
| `breaksave` | jsPsych | `0` | `1` makes the final submission fail on purpose |
| `abort` | jsPsych | `0` | End the experiment at this trial; `0` runs to the end |
| `condition` | plain JS | `0` | Call `/api/condition` before starting |
| `compress` | plain JS | `1` | Gzip the submission |
| `base64` | plain JS | `0` | `1` sends a valid payload to `/api/base64`; `invalid` sends one that is not base64 |
| `resubmit` | plain JS | `0` | `1` presses *Send the same file again* without waiting for a click |

Nothing here is secret: DataPipe experiment IDs are public by design, and none
is committed — they come from the URL. Do point tests at a *test* experiment:
they send real data to real storage.

## Driving it

The pages are also meant to be run by an agent or a headless job, so a run
produces a result a driver can assert on instead of prose to read.

### `run`

A free-form id for one run. It is echoed into the result below **and into the
filename**, which is the part of a run that outlives the tab: it is how you
recognise a file — or, an hour later, a recovered `.partial.json` — as having
come from a particular scenario.

### The result contract

Every run maintains `window.__testbed`:

```js
{
  schema: 1,
  page: "jspsych" | "vanilla",
  params: { ... },            // the resolved settings, including run
  status: "running" | "finished" | "failed" | "aborted",
  startedAt, finishedAt,      // ISO strings
  sessionId, condition,       // null when the run did not use them
  filenames: [ ... ],         // every name this run asked storage to hold
  requests: [ { label, method, url, status, ok, ms, error? } ],
  notes: [ ... ]
}
```

`status` means:

- **running** — still going. A tab closed mid-run never leaves this, which is
  what the abandoned-session scenarios look for.
- **finished** — the run reached its end and the final submission was accepted.
- **failed** — the run reached its end and the final submission was not.
- **aborted** — the page stopped before running any trials (no experiment ID,
  or no condition assigned).

A driver that cannot evaluate JavaScript reads the same two things from the
DOM: `document.documentElement.dataset.testbedStatus`, and the full JSON in
`<pre id="testbed-result">` under *Machine-readable result* at the bottom of
each page.

**`requests` holds only the requests the page issues itself.** The extension
and `datapipe-client` make their own — `POST /api/session`, the jsPsych page's
final `POST /api/data`, and the staging writes — and the page cannot see them.
`fetch` is deliberately not wrapped to catch them: staging uses its own
transport rather than `fetch`, and the two requests a wrapper *would* intercept
are the two most easily broken by touching them (a gzip `Blob` body, and
whatever is sent while the page unloads). What those paths do surface — the
extension's `on_save` callback, the library warnings mirrored into the log, the
assigned condition, the session id — is recorded, and `notes` says plainly
which per-request detail is unavailable.

### The scenario manifest

[`site/scenarios.json`](site/scenarios.json) is the single source of truth for
what to check. The home page's "What to check" list is rendered from it. Each
scenario carries its `params`, the `driverActions` beyond opening the URL, and
what to expect from the page (`expectPage`), the dashboard (`expectDashboard`)
and the provider folder (`expectStorage`), plus `timing` and an `automation`
level:

- **full** — open the URL and read the result.
- **agent** — needs a browser-driving agent: closing a tab, toggling the
  network, or flipping a dashboard switch first.
- **manual** — a human.

Scenarios marked `deferredCheck` cannot finish inside a normal run: a recovered
partial session is *queued* by the five-minute sweep and its first upload
attempt is an hour later, so the file appears in storage roughly 65–75 minutes
after the participant dropped out. `deferredNote` says what to look for and
when.

The runbook that drives all of this lives in the DataPipe repo, at
`.claude/skills/e2e-testbed/SKILL.md`.

## Versions

Everything loads from the CDN at a pinned version: jsPsych, the trial plugin,
`@jspsych/extension-pipe` (which bundles `datapipe-client` and Firebase, hence
its size), and `datapipe-client` on the plain JavaScript page. Pinning is what
makes a test result say which release it checked. To test a new release, bump
the version in `site/jspsych/index.html` or `site/vanilla/index.html`, and in
the note at the bottom of `site/index.html` that names the versions under test.

## Deploying

Pushing to `main` publishes `site/` to GitHub Pages
(`.github/workflows/pages.yml`). There is no build step.
