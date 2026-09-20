# e2e run — 2026-09-20 14:11–14:37 UTC

| | |
|---|---|
| Deployment | https://datapipe-test.web.app (project `datapipe-test`) |
| Commit | `d58bb67` — `Merge pull request #266 from jspsych/partials-now-and-ignore-once` |
| Deploy run | `Deploy to Test` #257, success, 13:54:01Z → 14:05:10Z (no deploy in progress at start; run began 14:11Z) |
| Experiment | `NA6QpJbK4Gzf` — title `e2e-20260920-1415` |
| Provider | Google Drive — `My Drive/DataPipe/e2e-20260920-1415` |
| Manifest | published (`jspsych.github.io/datapipe-testbed/scenarios.json`, HTTP 200) — byte-identical to `site/scenarios.json` in this checkout |
| Result contract | `schema: 2` (read from `data-testbed-schema` on `<html>`, every run) |
| Setup deviations | **Psych-DS metadata ON** (set before the first submission; now locked — "Locked because this experiment has collected data"). Base64 uploads ON for scenarios 12–13, switched back OFF. Conditions ON with **2** conditions for scenario 10, switched OFF by scenario 11. Validation left at defaults. |

This was the runbook's first use from its new home; a section at the end records
where it was wrong, unclear, or cost time.

## Timeline (UTC)

| Time | Event |
|---|---|
| 14:11 | Deploy confirmed complete; no run in progress |
| 14:12 | Experiment created |
| 14:13–14:14 | Metadata ON, Accept new data ON, base64 ON, conditions ON (2) |
| 14:14:21–14:15:04 | `clean-finish` |
| 14:15:17 | `abandoned-tab` started |
| **14:16:27** | **`abandoned-tab` tab closed** at `trials-completed` 58 / planned 120 |
| 14:17 | Drive check 1 — exactly **one** `.psychds-ignore` |
| 14:18–14:21 | `baseline-no-streaming`, `ended-early`, `vanilla-streaming`, `vanilla-uncompressed`, `duplicate-rejection`, `validation-failure` |
| 14:20:41 | First rejection produced; Time-column measured (below) |
| 14:22:04–14:22:40 | `failed-final-submission`; final save refused 14:22:38–14:22:40 |
| **14:22:50** | **`failed-final-submission` tab closed** |
| 14:22:53–14:25:20 | `vanilla-condition` ×2, `vanilla-condition-off` |
| 14:25:33–14:25:43 | Endpoint probes |
| 14:26:56 → 14:27:10 | `abandoned-tab` row: `Connection lost — may resume` → `Stopped — being recovered` |
| 14:30:10 → 14:30:22 | `abandoned-tab` row disappears (sweep tick); queue polled at 14:30:22 and 14:30:34 — **empty** |
| **14:30:54** | **`abandoned-tab` `.partial.json` visible in Drive `data/raw/`** — 14 min 27 s after the close |
| 14:33:00 → 14:33:10 | `failed-final-submission` row → `Stopped — being recovered` |
| **14:35:08** | **queue entry caught**: `processing`, `createdAt` 14:35:06.181Z, `nextRetryAt` **= `createdAt`**, `lastAttemptAt` 14:35:07.066Z |
| 14:35:19 | Queue empty again (entry lived ~13 s) |
| **14:35:37** | **`failed-final-submission` `.partial.json` visible in Drive** — 12 min 47 s after the close |
| 14:36:04–14:36:15 | `closed-experiment` |
| 14:36:45 | Drive check 3 — still exactly **one** `.psychds-ignore` |
| 14:37:18 | Cleanup switches confirmed |

## Scenarios

Run in the manifest's `order` with one deliberate departure: `abandoned-tab`
(order 8) was run **second**, immediately after `clean-finish`, so its 10-minute
grace period ran underneath scenarios 2–7. Nothing in `ordering` forbids this —
the constraint is only that `closed-experiment` must run after the recovery
scenarios' `runAfterCondition` holds, which it did.

| # | Scenario | Automation | Verdict | Evidence |
|---|---|---|---|---|
| 1 | `clean-finish` | full | PASS | `final-save` 201 (`source: library`); `trialsCompleted` 20/20; status `finished`; `testbed-clean-finish-1414-…-7qg5ck52.csv` alone in `data/raw/`; dashboard showed `In progress` / `under a minute` during the run, row gone after |
| 8 | `abandoned-tab` | agent | PASS (incl. deferred check) | last status before close `running`, `trialsCompleted` 58 / planned 120; row `Connection lost — may resume` ≤14:26:56, `Stopped — being recovered` at 14:27:10, gone by 14:30:22; `testbed-abandoned-tab-1415-…-huvrudav-7699ad39.partial.json` in `data/raw/` at 14:30:54 |
| 2 | `baseline-no-streaming` | full | PASS | `final-save` 201 (`library`); 20/20; `finished`; one `.json` in `data/raw/`; no live-session row and no queue entry for it |
| 3 | `ended-early` | full | PASS | `final-save` 201; `trialsCompleted` 5, `trialsPlanned` 20; note `timeline ended early at trial 5 of 20`; one file |
| 4 | `vanilla-streaming` | full | PASS | `session` 200 (`library`, ms 1470), `final-save` 201 (`page`, ms 4845); 20/20; `sessionId` a non-empty string; one file |
| 5 | `vanilla-uncompressed` | full | PASS | `session` 200, `final-save` 201 (`page`); 20/20; one file |
| 6 | `duplicate-rejection` | full | PASS | `final-save` 201 then `resubmit` **400 `FILE_EXISTS`**; 5/5; rejections row with `Code: FILE_EXISTS` at 10:20:41 local; exactly one stored file for the stem |
| 7 | `validation-failure` | full | PASS | `final-save` **400 `INVALID_DATA`**, status `failed`, 5/5; note `failvalidation: trial_type is omitted from every row on purpose`; **no** file in `data/raw/`; no queue entry at any later poll through 14:36 |
| 9 | `failed-final-submission` | full | PASS (incl. deferred check) | `preclaim` 201 (`page`, ms 5184) then `final-save` **400 `FILE_EXISTS`** (`library`); status `failed`, 20/20; pre-claim file in `data/raw/` immediately; `…-j368td91-69ba4da2.partial.json` there at 14:35:37; queue entry caught (table below) |
| 10 | `vanilla-condition` | agent | PASS | run a: `condition` 200, `session` 200, `final-save` 201, `condition: 0`, 10/10. run b: same, `condition: 1` — sequential assignment confirmed; both files stored |
| 11 | `vanilla-condition-off` | agent | PASS | status `aborted` without a keypress, `trialsCompleted` 0 / 10; `condition` 400 with `CONDITION_ASSIGNMENT_NOT_ACTIVE` in the thrown message; note begins `getCondition threw`; nothing stored; rejections row with that code |
| 12 | `base64-valid` | agent | PASS | `final-save` 201 (`page`) and `base64` 201 (`page`); 3/3; data file in `data/raw/`, `…-95jlej5i.b64.txt` at the **folder root** |
| 13 | `base64-invalid` | agent | PASS | `final-save` 201, `base64` **400 `INVALID_BASE64_DATA`**; 3/3; only the data file stored, no `.b64.txt` for this stem; rejections row with that code |
| 14 | `brief-dropout` | manual | SKIPPED | `automation: manual`; the extension cannot take the browser offline |
| 15 | `closed-experiment` | agent | PASS | run after both recoveries had completed; `final-save` **400 `DATA_COLLECTION_NOT_ACTIVE`** (`library`), status `failed`, 5/5; note `datapipe: session not started (HTTP 400); data will be sent at the end`; no live-session row for it; **two** new rejections rows with `DATA_COLLECTION_NOT_ACTIVE` (10:36:04 and 10:36:15 local), as the manifest predicts; nothing stored |

No FAILs.

## The two behaviours under test

### Recovered partials are delivered on the same sweep tick — CONFIRMED

Both recovery scenarios produced a `.partial.json` in storage **within 15
minutes of the tab closing**, and the one queue entry that was caught proves the
mechanism rather than inferring it:

```
filename     data/raw/testbed-failed-final-submission-…-69ba4da2.partial.json
status       processing
retryCount   0
createdAt    2026-09-20T14:35:06.181Z
nextRetryAt  2026-09-20T14:35:06.181Z      <- equal to createdAt
lastAttemptAt 2026-09-20T14:35:07.066Z     <- 0.9 s later
failureReason "Recovered from an abandoned session (21 trials)"
```

`nextRetryAt == createdAt`, and the first provider attempt ran 0.9 s after the
entry was created — the same sweep invocation. This is **not** the older
`createdAt + 60 min` behaviour; no entry anywhere in this run showed "First
attempt in 59m" or an hour-long `nextRetryAt`.

States caught by polling `GET /api/queuestatus?experimentID=<id>` (Bearer ID
token re-read from IndexedDB on every poll, ~40 polls between 14:23:59 and
14:36:28):

| Poll window | Queue |
|---|---|
| 14:23:59 – 14:34:59 | `count: 0` (absent) at every poll, including 14:30:22 and 14:30:34, either side of `abandoned-tab`'s delivery |
| 14:35:08 | `count: 1`, the entry above, `processing` |
| 14:35:19 – 14:36:28 | `count: 0` (gone) |

`abandoned-tab`'s own entry was never caught: it was queued and delivered
between two polls 12 s apart. The dashboard's live-session row disappearing
(14:30:10 → 14:30:22) and the file appearing at 14:30:54 are the evidence there.

Elapsed, close → file visible in Drive: **14 min 27 s** (`abandoned-tab`,
closed 14:16:27, file seen 14:30:54) and **12 min 47 s**
(`failed-final-submission`, closed 14:22:50, file seen 14:35:37). Both inside
the 10–15 minute window the manifest predicts. Note the Drive checks were
periodic, so these are upper bounds on the true delivery time, not exact.

### `.psychds-ignore` is written once per experiment — CONFIRMED

Counted by exact name over the whole folder-root listing (`role="row"[data-id]`
entries, not a search):

| When | Successful uploads so far | `.psychds-ignore` copies at the folder root |
|---|---|---|
| 14:17 | 1 (`clean-finish`) | **1** |
| 14:28 | 11 | **1** |
| 14:36 | 13 (incl. both recovered partials) | **1** |

The root listing was, at every check, exactly: `data/` (folder),
`.psychds-ignore`, `dataset_description.json`, plus the two base64 files once
they existed. The experiment document's `psychdsIgnoreWrittenAt` claim was not
read directly (no API exposes it, and Firestore was not read from the page);
the file count is the evidence.

## Deferred checks

Both cleared inside this run; neither needs a return visit.

| Scenario | Look for | In | Not before | Result |
|---|---|---|---|---|
| `abandoned-tab` | `testbed-abandoned-tab-1415-…-huvrudav-<8 hex>.partial.json` | `data/raw/` of the experiment folder | 14:26 | Present 14:30:54, suffix `7699ad39` |
| `failed-final-submission` | `testbed-failed-final-submission-1422-…-j368td91-<8 hex>.partial.json` | same | 14:33 | Present 14:35:37, suffix `69ba4da2` |

Neither partial's contents were opened; the check was the filename in the
folder listing.

## Endpoint probes

Fired from an open testbed tab at 14:25:33–14:25:43, against the real
experiment. **Conditions had been switched OFF by scenario 11 at that point**,
so the `/api/condition` probe deliberately exercises the off path.

| Probe | Expected | Got |
|---|---|---|
| `/api/base64` valid | 201 Success | **201**, body `{message}` |
| `/api/base64` invalid | 400 `INVALID_BASE64_DATA` | **400 `INVALID_BASE64_DATA`** |
| `/api/base64` missing filename | 400 `MISSING_PARAMETER` | **400 `MISSING_PARAMETER`** |
| `/api/condition` | 200 `condition: <n>` with conditions on | **400 `CONDITION_ASSIGNMENT_NOT_ACTIVE`** — conditions were off; the 200 path is covered by scenario 10 (condition 0, then 1) |
| `/api/session` | 200 `sessionId`, `databaseURL` | **200**, keys `sessionId, databaseURL, maxTrialBytes, maxTrials, flushIntervalMs, flushEveryNTrials, maxDisconnects` |
| `/api/data` missing `data` | 400 `MISSING_PARAMETER` | **400 `MISSING_PARAMETER`** |
| `/api/session` GET | 405 Method not allowed | **405**, body `{"error":"Method not allowed"}` |
| unknown experiment ×4 (`data`, `base64`, `session`, `condition`) | 400 `EXPERIMENT_NOT_FOUND` | **400 `EXPERIMENT_NOT_FOUND`** on all four |

These deliberately produced rejections-panel entries (two of the nine: one
`INVALID_BASE64_DATA`, one `CONDITION_ASSIGNMENT_NOT_ACTIVE`). The panel was
visible throughout — the queue was empty at every moment a panel assertion was
made. The valid base64 probe left `probe-<epoch>.txt` at the folder root, and
the `/api/session` probe left a live-session row that was still showing
`In progress` at the end of the run (expected: it staged no trials, so the
sweep discards it).

No `METADATA_ERROR` probe was fired, so the known "kept copy comes back in the
queue" behaviour was not exercised this run.

## Queue state

From `GET /api/queuestatus?experimentID=<id>`. Only one entry existed at any
point during the run:

| Filename | status | retryCount | lastAttemptAt | nextRetryAt | failureReason |
|---|---|---|---|---|---|
| `data/raw/testbed-failed-final-submission-1422-…-69ba4da2.partial.json` | `processing` | 0 | 14:35:07.066Z | 14:35:06.181Z (= `createdAt`) | `Recovered from an abandoned session (21 trials)` |

The dashboard's queue panel was never seen rendered — on this build the entry
existed for ~13 s, in a tab that was not in the foreground. Its row states,
headline strings and the "Waiting to be stored" / "First attempt in `<n>`"
wording therefore remain **unverified against a live deployment**, exactly as
before this run.

`retryCount: 0` with a non-null `lastAttemptAt` less than a second after
`createdAt` is the current build's signature; the template's note that such an
entry "has never been attempted" holds only for the sub-second window before
the same tick attempts it.

## Server-side

- [ ] **Checked**
- [x] **Not checked** — `functions_list_functions` on `datapipe-test` returned
      `HTTP 401, Request had invalid authentication credentials`. No login was
      attempted. The function inventory (13 exports; no standalone
      `apisessionstart` / `apicondition` / `apibase64`), `scheduledsweep`'s tick
      cadence, per-function log severities and `compactiontask` non-execution
      are therefore **unverified** and must not be inferred from anything above.

What *was* checkable without those tools: the deployed commit's
`firebase.json` routes `/api/session` and `/api/condition` to `participantapi`
and `/api/base64` to `apidata`, matching endpoints.md's routing table. That is
read off the deployed source, not off the running project.

`logs/<experimentID>` counters and the `uploadQueue` collection were not read —
same 401.

## The rejections table's Time column

Produced by `duplicate-rejection`, then re-measured with all nine rows present.
Window `innerWidth` 1476 px (the window was not resized — no check in this run
needed a different width, and resizing the user's window was avoided).

- `Time` column header width: **259 px**; the cell's content box: **243 px**.
- The time is rendered in a `<p>` with **`white-space: nowrap`** (the `<td>`
  itself is `normal`).
- Each cell's text lays out as **exactly one client rect, 170 px wide** — all
  nine rows, identical. `scrollWidth === clientWidth`, so no overflow either.
- Sample text: `20/09/2026, 10:20:41 GMT-4`.

**It does not wrap at this width**, with 73 px of slack. Screenshot (not
committed): the panel shows its 3 px red left edge, the headline
`One submission to this experiment was rejected.`, one row whose left cell
reads the `FILE_EXISTS` sentence with `Code: FILE_EXISTS` beneath it, and the
timestamp sitting on a single line at the right, vertically centred against the
two-line left cell.

Not checked: narrower viewports. At 243 px of content box the string needs
170 px, so the margin is real but not enormous; a column narrower than about
180 px would wrap.

## Anything surprising

Checked against `knownIssues` and `docs/e2e-testing.md` first; none of the
below is on those lists.

1. **A recovered partial can report MORE trials than `trialsCompleted`.** The
   caught entry says `Recovered from an abandoned session (21 trials)` for a
   `failed-final-submission` run whose result reported `trialsCompleted: 20`.
   The manifest asserts N is "in `[trialsCompleted - (flushEveryNTrials - 1),
   trialsCompleted]`, never `trialsCompleted` exactly". That range is wrong for
   the jsPsych page: the instruction trial is staged but is not counted by
   `trialsCompleted` (the manifest's own `trialCounter` note says the stored CSV
   holds one row more), so N can exceed `trialsCompleted` by one. The assertion
   as written would fail a correct run.
2. **The derived Psych-DS CSV is not beside the raw file.** With metadata on,
   `data/raw/` held only raw submissions; the derived
   `subject-<mangled stem>_data.csv` sat one level up, in `data/`. SKILL.md §5
   step 8 says raw files sit under `data/raw/` "with a derived
   `subject-…_data.csv` **beside each**". Observed layout: `<title>/` holds
   `.psychds-ignore`, `dataset_description.json`, base64 files and `data/`;
   `<title>/data/` holds the derived CSVs; `<title>/data/raw/` holds the raw
   submissions.
3. **"How many conditions?" defaults to 1, below its own stated minimum.**
   Switching conditions on gave a spinbutton with `value="1"` and
   `aria-valuemin="2"`. dashboard.md says the field has a minimum of 2 and does
   not mention that it opens below it. Typing `2` and tabbing out saved
   normally.
4. **The live-sessions panel carries no run identifier.** Its only columns are
   `Status`, `Running for`, `Started`. Both SKILL.md §5 step 7 and dashboard.md
   instruct the driver to "match the live-session row by the scenario's `run`
   id" — there is nothing in the row to match on. In practice rows were
   identified by their `Started` clock time against the run's own `startedAt`,
   which works only while no two runs start in the same minute.
5. The abandonment grace measured **10 min 29 s** (`abandoned-tab`, closed
   14:16:27, `Stopped — being recovered` first seen 14:27:10 with the previous
   poll at 14:26:56) and **~10 min 20 s** (`failed-final-submission`). Both
   consistent with a 10-minute grace plus polling granularity.
6. A `POST /api/data` that wrote to Drive took **4845 ms** on the
   `vanilla-streaming` run, and the `failed-final-submission` pre-claim took
   **5184 ms** — both at or just past the top of dashboard.md's stated 2–4.5 s
   band. Nothing failed; the band is just optimistic on a cold-ish function.
7. **Browser-extension redaction fired on three harmless reads** (not a DataPipe
   issue, but it costs a driver time): `document.body.innerText` on the
   dashboard returned `[BLOCKED: Cookie/query string data]`; a result object
   with a key named `sessions` or `getSession` returned
   `[BLOCKED: Sensitive key]`; and the `.b64.txt` filename returned
   `[BLOCKED: JWT token]` because a dotted base64-ish filename looks like a JWT.
   `get_page_text` worked on the dashboard where `innerText` did not — the
   opposite of what dashboard.md warns about. Workaround: rename result keys,
   and read text through `get_page_text`.
8. `get_page_text` on Google Drive returns "No text content found"; the folder
   listing has to be read from `[role="row"][data-id]` elements and their
   descendant `aria-label`s.

## Cleanup

- [x] "Accept new data" switched off — at 14:35:57, after both partials had been
      delivered (14:30:54 and 14:35:37), satisfying the `runAfterCondition`
- [x] Any switch a scenario turned on switched back — base64 uploads OFF
      (14:37:18); conditions already OFF via scenario 11
- [x] Setup deviations recorded in the header table above — Psych-DS metadata is
      ON and now permanently locked on this experiment
- [x] Tabs opened by this run are closed; the researcher's own dashboard tab was
      left on the experiment page
- [x] Nothing deleted — the experiment, its folder and all 13 stored files plus
      `.psychds-ignore`, `dataset_description.json` and the two base64 files are
      intact

## Runbook notes from this first run

Kept here, not applied to the skill files. Each is a correction someone should
make separately, as a timeless statement.

- SKILL.md §5 step 8 and dashboard.md "Finding the files": the derived
  `subject-…_data.csv` lives in `data/`, not beside the raw file in `data/raw/`.
- The manifest's `abandoned-tab.expectPage.trials` upper bound
  (`never trialsCompleted exactly`) is wrong for the jsPsych page; the staged
  instruction trial makes N up to one *more* than `trialsCompleted`.
- SKILL.md §5 step 7 and dashboard.md "Live sessions": "match the row by the
  scenario's `run` id" is not possible — the panel has no such column. The
  usable discriminator is the `Started` time.
- dashboard.md "Switches": the conditions count field opens at 1 while its
  `aria-valuemin` is 2.
- dashboard.md "What the browser tooling cannot do": `document.body.innerText`
  is not reliable on the dashboard either — it can be refused by the extension's
  redaction as cookie/query-string data, while `get_page_text` succeeds.
- SKILL.md §5 step 3's start ritual worked exactly as written (screenshot to
  foreground the tab, then one `f` in a separate call) — every one of the eleven
  starts landed on the first `f`. The instruction not to click the page body
  first is right; no click was needed at all.
