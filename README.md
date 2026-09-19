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
| `failvalidation` | plain JS | `0` | `1` omits `trial_type`, so the data fails validation |

Nothing here is secret: DataPipe experiment IDs are public by design, and none
is committed — they come from the URL. Do point tests at a *test* experiment:
they send real data to real storage.

## What the data looks like

Both pages run the same task — a letter, `F` or `J`, answered with a keypress —
and both produce one row per trial:

```
trial_type,trial_index,task,stimulus,response,rt,correct
letter-keyboard-response,0,testbed-letter,F,f,412,true
```

`trial_type` is first because it is the field **DataPipe itself requires by
default**: a new experiment is created with validation on and
`requiredFields: ["trial_type"]`. jsPsych fills it in from each plugin's
`info.name`; the plain-JavaScript page has no plugins, so it writes
`letter-keyboard-response` — a description of the trial, not a claim to be the
jsPsych plugin of a similar name.

The point is that **neither page needs a dashboard setting changed before it
can send anything**. A testbed that requires validation to be switched off
before its first submission is testing a configuration no new experiment has.
`?failvalidation=1` drops the column deliberately, which is the only way to
reach `INVALID_DATA` without editing the experiment.

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
  schema: 2,
  page: "jspsych" | "vanilla",
  params: { ... },            // the resolved settings, including run
  status: "ready" | "running" | "finished" | "failed" | "aborted",
  startedAt, finishedAt,      // ISO strings
  trialsCompleted, trialsPlanned,
  sessionId, condition,       // null when the run did not report them
  filenames: [ ... ],         // every name this run asked storage to hold
  requests: [ { label, method, url, status, ok, ms, source, error? } ],
  notes: [ ... ]
}
```

#### Status

```
ready ──▶ running ──▶ finished | failed
  └───────────────▶ aborted
```

- **ready** — the page has loaded, its settings are valid, and it is waiting
  for the participant's first keypress. Both pages sit here on *Press any key
  to start*.
- **running** — the first trial has started. Trials are advancing.
- **finished** — the run reached its end and the final submission was accepted.
- **failed** — the run reached its end and the final submission was not.
- **aborted** — the page stopped before any trial ran (no experiment ID, or no
  condition assigned). Reached from **ready**; a page with no experiment ID
  publishes both in the same synchronous pass, so **ready** is never observable
  for that run.

A tab closed mid-run never leaves a terminal status, which is what the
abandoned-session scenarios look for. **failed** is reachable straight from
**ready** in one case: the jsPsych page's `?breaksave=1` pre-claim runs before
the timeline starts, and a run whose pre-claim was refused ends there rather
than running trials that would prove nothing.

**`ready` is the one a driver waits for before sending the start key**, and
`running` is what proves the key landed. Schema 1 set `running` at page load,
before any keypress, and a driver that read it as "trials are advancing" was
wrong twice on 2026-09-19. `startedAt` is likewise when the *page* opened the
result, not when the participant started.

#### The trial counter

`trialsPlanned` is the `trials` parameter, and `trialsCompleted` reaches it
exactly on a clean finish — so `trialsCompleted === trialsPlanned` is the whole
of "it ran to the end", and polling `trialsCompleted` is how a driver acts *at
trial N* (closing the tab half-way, say) instead of guessing from the clock.

**Instruction screens are not counted**, on either page. The jsPsych page shows
one instruction trial before the task, and jsPsych records a row for it, so
with `?trials=10` the stored CSV holds 11 rows while `trialsCompleted` stops at
10. The counter is about the task; a driver should not have to know how many
non-task screens a page happens to show first.

#### Reading it

A driver that cannot evaluate JavaScript in the page's own world reads all of
it from the DOM — on `<html>`:

| Attribute | |
|---|---|
| `data-testbed-status` | the status above |
| `data-testbed-trials-completed` | `trialsCompleted`, updated as each trial ends |
| `data-testbed-trials-planned` | `trialsPlanned` |

plus the full JSON in `<pre id="testbed-result">` under *Machine-readable
result* at the bottom of each page.

**The DOM is the primary interface; the page global is not.** A browser
extension evaluating JavaScript does so in an isolated world and may not see
`window.__testbed` at all, while DOM reads always work. Treat the global as a
convenience for same-world drivers such as Playwright.

#### What `requests` does and does not hold

**Only the requests the page issues itself** carry `source: "page"`, a real
`ms`, and a URL with no trailing slash. The extension and `datapipe-client`
make their own — `POST /api/session`, the jsPsych page's final `POST /api/data`,
and the staging writes — and the page cannot see them. `fetch` is deliberately
not wrapped to catch them: staging uses its own transport rather than `fetch`,
and the two requests a wrapper *would* intercept are the two most easily broken
by touching them (a gzip `Blob` body, and whatever is sent while the page
unloads). What those paths do surface — the extension's `on_save` callback, the
library warnings mirrored into the log, the assigned condition, the session id
— is recorded with `source: "library"`, an unavoidably null `ms`, and a URL
ending in a slash, and `notes` says plainly which per-request detail is missing.

That slash is not a typo. `datapipe-client`'s `endpoint()`
(`packages/client/src/http.ts`) builds `${base}/api/${path}/`, and
`/api/data/` matches no Firebase Hosting rewrite, so every library-issued
request takes a 308 redirect to the slashless form first. The pages' own
requests do not, and the recorded URLs are left exactly as each was sent rather
than tidied into agreement.

#### `sessionId`

**The plain JavaScript page reports it** — it calls `DataPipe.createSession()`
itself and reads the public `session.sessionId`, as soon as `POST /api/session`
lands rather than only at the end, so an abandoned run still carries it.

**The jsPsych page leaves it `null`, and that is not a bug.**
`@jspsych/extension-pipe` 0.2.0 keeps its `DataPipeSession` in a field its
source declares `private` and exposes nothing else: no getter, no event, and an
`on_save` result of `{ok, status, body}` with no id in it. TypeScript's
`private` is erased at runtime, so `jsPsych.extensions.pipe.session.sessionId`
would in fact answer today — and reaching for it would mean this testbed
asserts on a library's internals rather than its contract, and breaks on a
patch release with no semver signal. The run says so in `notes`. The smallest
upstream fix is a public read-only getter on the extension
(`get sessionId() { return this.session?.sessionId ?? ""; }`), which would make
it `jsPsych.extensions.pipe.sessionId`.

#### Schema 1

A cached or not-yet-redeployed copy of these pages publishes `schema: 1`: no
`ready` (it sat at `running` from load), no trial counter and no
`source`/`trialsCompleted` fields. Read `schema` from `#testbed-result` before
relying on any of them.

### The scenario manifest

[`site/scenarios.json`](site/scenarios.json) is the single source of truth for
what to check. The home page's "What to check" list is rendered from it. Each
scenario carries its `params`, the `driverActions` beyond opening the URL, and
what to expect from the page (`expectPage`), the dashboard (`expectDashboard`)
and the provider folder (`expectStorage`), plus `timing` and an `automation`
level:

- **full** — open the URL and read the result.
- **agent** — needs a browser-driving agent: closing a tab or flipping a
  dashboard switch first.
- **manual** — a human. Only *Brief dropout*, which needs the network turned
  off and back on; a browser extension cannot do that, and faking it in the
  page would exercise neither the disconnect stamp nor the reconnect that
  clears it.

**Run them in `order`.** It is load-bearing, not decorative. Switching data
collection off — which *Closed experiment* does — makes the sweep **discard**
any session still staged, so running it early destroys the recoveries the
`deferredCheck` scenarios are waiting on. `mustRunLast`, `runAfter` and
`mutatesExperimentState` say which scenarios constrain which.

Scenarios marked `deferredCheck` cannot finish inside a normal run: a recovered
partial session is *queued* by the five-minute sweep and its first upload
attempt is an hour later, so the file appears in storage roughly 65–75 minutes
after the participant dropped out. `deferredNote` says what to look for and
when.

`preconditions` and `knownIssues` are worth reading before the first run. The
one that bites hardest: on Google Drive a `.psychds-ignore` file accumulates
per upload, so count files by filename stem, never by folder total.

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
