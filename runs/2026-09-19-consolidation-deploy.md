# DataPipe TEST end-to-end verification — 2026-09-19

## Summary verdict

**The function consolidation looks healthy.** Every public path I exercised answered from the
new consolidated functions with the documented status and error code, in normal latencies, with
no 5xx, no crash and no missing route. Participant data landed in Google Drive for every
successful run, the Psych-DS layout was created, abandoned-session recovery ran on the sweep and
produced a hash-suffixed `.partial.json` queue entry, and the two deleted endpoints are 404.

**One problem found that I think matters**, plus several smaller ones:

1. **Rejected submissions are being resurrected by the sweep and queued for upload.** At
   17:15:10–17:15:12 UTC `scheduledsweep` created three upload-queue entries whose filenames are
   exactly the three payloads DataPipe had already **refused** with `400 METADATA_ERROR`. They are
   labelled "Upload was interrupted by a server restart or memory limit" and the dashboard shows
   "Next retry soon". If those retries succeed, data the service explicitly rejected lands in the
   researcher's Drive. Detail and evidence in Finding 1.
2. **The scenario-e recovery did not happen.** A streaming session whose final submission was
   refused with `FILE_EXISTS` at 16:51:00 had produced **no** `.partial.json` by 17:20 (29 min),
   against a documented "about 15 minutes". Finding 2.
3. **Five duplicate `.psychds-ignore` files** in the experiment's Drive folder — one per successful
   upload, rather than one per experiment. Finding 3.
4. **`METADATA_ERROR`'s wire message is `"Invalid metadata generated"`**, which is not the string
   `functions/src/api-messages.ts` defines for either `METADATA_ERROR` or `INVALID_METADATA_ERROR`.
   Finding 4.
5. **The testbed's documented `breaksave=1` scenario cannot work on a Psych-DS experiment** — its
   pre-claim payload is refused with `METADATA_ERROR` before it can claim the filename. Finding 5.

I could not tell from the browser whether (1) and (2) are regressions from this refactor or
pre-existing; both live in `scheduledsweep`, which is one of the consolidated functions, so both
deserve a look before this goes further.

**Server-side verification (step 7) was NOT possible**: the Firebase MCP tools and the local
`firebase` CLI are both unauthenticated (HTTP 401 from `cloudfunctions.googleapis.com` and
`logging.googleapis.com`). The 13-function inventory, the `scheduledsweep` tick cadence, the
per-function log severities and "no `compactiontask` execution" were therefore **not observed**.
Everything below is client-side and dashboard-side evidence only.

## Environment

| | |
|---|---|
| Site | https://datapipe-test.web.app (Firebase project `datapipe-test`) |
| Deployed commit under test | `a10464c` on `test`, deployed 2026-09-19 16:33 UTC |
| Account signed in (as shown on `/admin/account`) | <account> |
| Storage providers on that account | Google Drive **Connected**; Zenodo **Connected**; Dataverse not connected; OSF (legacy) connected but flagged **"Re-authorization required"** |
| Contact email | <account>, **Confirmed** |
| Experiment created for this run | `e2e-20260919-1637`, ID **`64asU9SsEIPJ`** |
| Its Drive folder | `My Drive / DataPipe / e2e-20260919-1637` (id `<folderId>`) |
| Test window | 2026-09-19 16:37 – 17:20 UTC (page logs show local time, UTC−4) |

Experiment configuration at the end of the run: data collection **OFF** (as instructed), base64
uploads ON, conditions ON (2), no session limit, validation OFF, Psych-DS metadata ON (locked by
the UI once data had arrived).

I did not touch any other experiment, did not sign out, did not change account settings, did not
disconnect a provider, did not delete anything, and did not open production.

## Scenarios

| # | Scenario | URL / action | Result | Evidence |
|---|---|---|---|---|
| 2 | Create experiment (Drive) | `/admin/new`, Google Drive, title `e2e-20260919-1637` | **PASS** | `POST /api/createexperiment` → 200 in 1327 ms; redirected to `/admin/64asU9SsEIPJ`; Drive folder link rendered |
| 2 | Psych-DS metadata ON | toggle on experiment page | **PASS** | `POST /api/ensurederivedpaths` → 200; `data/` and `data/raw/` folders present in Drive; `dataset_description.json` (3 KB) written on first upload |
| a | jsPsych clean finish, streaming ON | `/jspsych/?experiment=64asU9SsEIPJ&trials=40&auto=1&stream=1` | **PASS** | Dashboard showed "1 session in progress / In progress" while running; log: `final save SUCCEEDED (HTTP 201) {"message":"Success","metadataMessage":"Metadata is not in Firestore or the storage provider"}`; file `testbed-20260919T163954-rnos8b4w.csv` in Drive (5 KB) |
| b | jsPsych baseline, `stream=0` | `…&trials=10&auto=1&stream=0` | **PASS** | log: `streaming OFF — one submission at the end`; `final save SUCCEEDED (HTTP 201)`, `metadataMessage: "Metadata is in the storage provider and in Firestore"`; no in-progress row observed; file `testbed-20260919T164333-2f89v900.csv` (1 KB) |
| c1 | vanilla, streaming + condition | `/vanilla/?…&trials=8&auto=1&stream=1&condition=1` | **PASS** | log: `condition assigned: 0`; `→ POST /api/data/ (gzip)` → `← 201 {"message":"Success",…}`; file `testbed-20260919T164452-54dfitlz.csv` (221 B) |
| c2 | vanilla, second run (condition balance) | same, second run | **PASS** | log: `condition assigned: 1`; `← 201`. A third, direct `POST /api/condition` returned `{"condition":0}` → sequence 0, 1, 0 over 2 conditions, i.e. round-robin as documented |
| d | vanilla duplicate rejection | "Send the same file again" button | **PASS** | `→ POST /api/data/ (gzip)` → `← 400 {"error":"FILE_EXISTS","message":"A file with this name already exists in the storage provider. File names must be unique."}` |
| e | Failed final submission → recovery | See note below — ran as a **manual filename pre-claim** | **half PASS / half FAIL** | Final save refused: `final save FAILED (HTTP 400) {"error":"FILE_EXISTS",…}` at 16:51:00 UTC — the refusal half is a PASS. The `.partial.json` recovery half **did not happen**: no matching queue entry and no Drive file at 17:20 UTC, 29 min later, against a documented ~15 min (Finding 2) |
| e′ | Testbed's own `breaksave=1` | `…&breaksave=1` (twice) | **FAIL of the testbed scenario, not of DataPipe** | Both attempts logged `pre-claim responded 400`. Direct reproduction of the same body returned `400 {"error":"METADATA_ERROR","message":"Invalid metadata generated","metadataMessage":""}`. The filename is never claimed, so the scenario silently degrades into an ordinary successful run |
| f | Abandoned tab | `…&trials=60&auto=1&stream=1`, tab closed at 16:43:14 UTC after ~50 of 60 trials | **PASS** | Row read **"Connection lost — may resume"** within seconds; by 16:55 it read **"Stopped — being recovered"**; at 16:55:12 UTC a queue entry appeared: `data/raw/testbed-20260919T164136-qbdk2bgu-6b33aa40.partial.json`, `status: pending`, `retryCount: 0`, `failureReason: "Recovered from an abandoned session (50 trials)"`, `nextRetryAt: 2026-09-19T17:55:12Z`. The row then left the live-sessions table. Note the hash suffix `-6b33aa40` is present as documented |
| g | Closed experiment | data collection switched OFF, then `…&trials=5&auto=1&stream=1` | **PASS** | log: `datapipe: session not started (HTTP 400); data will be sent at the end`, then `final save FAILED (HTTP 400) {"error":"DATA_COLLECTION_NOT_ACTIVE","message":"Data collection is not active for this experiment"}` |
| — | Brief dropout (offline 30 s) | not run | **SKIPPED** | Needs DevTools network throttling, which the browser tooling here cannot set |
| — | "Ended early" (`abort=N`) | not run | **SKIPPED** | Not in the assigned minimum set; time spent on recovery observation instead |

### Note on scenario e

The testbed's `breaksave=1` path is supposed to claim the run's filename with a real
`POST /api/data` so the extension's final save is refused as a duplicate. On this experiment the
pre-claim itself is refused (see e′), so the scenario does not exercise what it advertises. I
reproduced it manually instead: I loaded the jsPsych page, read the filename it printed
(`testbed-20260919T164953-2kjl1y7q.csv`), claimed that filename myself with a valid one-row CSV
(`201`, 4357 ms), then ran the experiment. The extension's final save was then refused with
`400 FILE_EXISTS`, which is the state scenario e wants.

### Recovery timing (what I saw, and what I did not)

- Abandoned session (f): abandoned 16:43:14 → recovered into the upload queue **16:55:12** (≈12 min),
  with the first Drive attempt scheduled for **17:55:12**, i.e. one hour later. This matches the
  known behaviour described in the brief.
- Failed-final-submission session (e): final save refused 16:51:00. Checked the upload queue at
  17:00, 17:02, 17:04, 17:06, 17:08, 17:12, 17:15 and 17:20 UTC and the Drive `data/raw/` folder at
  17:04 and 17:10. **No `.partial.json` for that session ever appeared** — 29 minutes after the
  failure. See Finding 2.
- The live-sessions table emptied completely by 17:09 UTC, so the sessions were swept; the sweep
  simply did not turn this one into a partial.
- **Still open at hand-off**: the four queued entries below all have `retryCount: 0` and
  `lastAttemptAt: null` at 17:20 UTC. Worth re-checking `/api/queuestatus?experimentID=64asU9SsEIPJ`
  and the Drive folder after ~17:55 UTC to see which of them actually land.

## Direct endpoint probes

Run with `fetch` from a testbed tab (CORS open) unless noted.

| Endpoint | Input | Status | Body | Expected | Verdict |
|---|---|---|---|---|---|
| `POST /api/base64` | valid 1×1 PNG, `e2e-probe.png` | **201** | `{"message":"Success"}` | success | PASS |
| `POST /api/base64` | `"!!! not base64 !!!"` | **400** | `{"error":"INVALID_BASE64_DATA","message":"The data are not valid base64 data"}` | 400 `INVALID_BASE64_DATA` | PASS |
| `POST /api/data` | duplicate filename | **400** | `{"error":"FILE_EXISTS",…,"metadataMessage":"Metadata is in the storage provider and in Firestore"}` | 400 `FILE_EXISTS` | PASS |
| `POST /api/condition` | valid experiment | **200** | `{"message":"Success","condition":0}` | a condition number | PASS |
| `POST /api/data` | bogus experiment id | **400** | `EXPERIMENT_NOT_FOUND` | 400 `EXPERIMENT_NOT_FOUND` | PASS |
| `POST /api/base64` | bogus experiment id | **400** | `EXPERIMENT_NOT_FOUND` | same | PASS |
| `POST /api/session` | bogus experiment id | **400** | `EXPERIMENT_NOT_FOUND` | same | PASS |
| `POST /api/condition` | bogus experiment id | **400** | `EXPERIMENT_NOT_FOUND` | same | PASS |
| `POST /api/queuestatus` | any | **405** | `{"error":"Method not allowed"}` | GET-only | PASS |
| `GET /api/queuestatus?experimentID=…` + `Bearer` ID token | valid | **200** | `{"entries":[…],"count":1}` | owner's queue | PASS |
| `POST /api/getosftoken/` | — | **404** (308 → 404 after the trailing-slash redirect; Next.js 404 page) | — | gone | PASS |
| `POST /api/oauth2regenerate/` | — | **404** (same shape) | — | gone | PASS |
| `POST /api/finalize`, `/api/ensurederivedpaths` (unauthenticated, curl) | `{}` | **401** | — | own auth gate | PASS |
| `POST /api/createexperiment`, `/api/providersetupwarnings` (unauthenticated, curl) | `{}` | **400** | — | own validation gate | PASS |

Also observed, from the metadata path: `POST /api/data` with a body that is a plain sentence
(not CSV/JSON) returns
`400 {"error":"METADATA_ERROR","message":"Invalid metadata generated","metadataMessage":""}`.
`METADATA_ERROR` at 400 **is** documented in `pages/docs/api.js`, so the status and code are right;
it is the message string that does not match the source (see Findings).

## Endpoint-latency observations

Measured with `performance.getEntriesByType('resource')` and `performance.now()` around `fetch`.

| Call | When (UTC) | Duration |
|---|---|---|
| `POST /api/providersetupwarnings` — first dashboardapi call I saw, ~5 min after deploy | 16:38 | **745 ms** |
| `POST /api/createexperiment` — first write | 16:39 | **1327 ms** |
| `POST /api/providersetupwarnings` — later page load | 16:57 | 371 ms |
| `POST /api/getprovideraccesstoken` (Drive picker) | 16:57 | **193 ms** |
| `POST /api/data` (real upload + metadata, 1 row) | 16:50 | 4357 ms |
| `POST /api/data` (duplicate, refused) | 16:53 | 1791 ms |
| `POST /api/base64` (valid, real Drive write) | 16:53 | 2369 ms |
| `POST /api/base64` (invalid, refused before any write) | 16:53 | 300 ms |
| `POST /api/condition` (valid) | 16:53 | 473 ms |
| `POST /api/{data,session,base64,condition}` (bogus id, refused early) | 16:54 | 274–361 ms |

Reading: **no dramatic cold start was observed.** The first `dashboardapi` call in my session was
745 ms and the first write 1327 ms; both are plausible cold-ish starts but nothing alarming. Warm
`dashboardapi` calls settle around 190–370 ms. `participantapi`'s genuinely-first call after deploy
was made by the extension inside the page and is not visible to the page, so **its cold start was
not observed**; warm refusals on `/api/session` and `/api/condition` were 270–480 ms. `apidata`
calls that actually write to Drive cost 2–4.5 s, which is the provider round trip, not the function.

## Google Drive verification

`My Drive / DataPipe / e2e-20260919-1637`:

- `data/` (folder, created 16:38 by `ensurederivedpaths`)
  - `raw/` — the five original-named uploads:
    `testbed-20260919T163954-rnos8b4w.csv` (5 KB), `testbed-20260919T164333-2f89v900.csv` (1 KB),
    `testbed-20260919T164452-54dfitlz.csv` (221 B), `testbed-20260919T164545-usxs1ywb.csv` (221 B),
    `testbed-20260919T164953-2kjl1y7q.csv` (67 B)
  - the same five as Psych-DS-named copies: `subject-testbed20260919T163954Rnos8b4w_data.csv` etc.
- `dataset_description.json` (3 KB)
- `e2e-probe.png` (**70 bytes** — the 1×1 PNG from the base64 probe) ✔
- `.psychds-ignore` × **5** (24 bytes each) — see Findings

All files non-zero. File count matches the dashboard's "5 completed sessions".

**CSV row check**: I previewed `testbed-20260919T164333-2f89v900.csv` (the `trials=10` run). It has
a header row, one `html-keyboard-response` instruction trial (`trial_index` 0), and ten letter
trials with `trial_index` 1–10 — 12 lines total, exactly the expected shape for `trials=10`.

No `.partial.json` file had appeared in Drive by 17:10 UTC (last check). The scenario-f partial is
still sitting in the upload queue with its first attempt scheduled for 17:55 UTC, so its absence
from Drive is expected. The scenario-e partial is absent from both Drive and the queue, which is
Finding 2.

## Dashboard verification

- **Header counters** tracked correctly throughout: `Accepting data / N completed sessions /
  M sessions in progress`, ending at 5 completed.
- **Live sessions panel** (`LiveSessionsPanel`) behaved as documented: "In progress" with a running
  clock → "Connection lost — may resume" seconds after the tab closed → "Stopped — being recovered"
  after ~10 minutes → row removed once the partial was queued.
- **Errors panel** (`ErrorPanel`) showed "7 submissions to this experiment were rejected" and, when
  expanded, exactly the seven failures I caused, with their codes:
  3 × `FILE_EXISTS`, 3 × `METADATA_ERROR`, 1 × `INVALID_BASE64_DATA`. That is a precise match to what
  I sent; the rejection log is accurate. (Bogus-experiment-ID probes correctly produced no entries,
  since there is no experiment to log against.)
- **Queue panel** (`QueuePanel`) appeared once the partial was queued: "1 upload waiting to be
  stored", "1 file did not upload to your storage provider. DataPipe is retrying automatically.",
  row `data/raw/testbed-…-6b33aa40.partial.json`, status **Retrying — next retry in 57m**, reason
  "Recovered from an abandoned session (50 trials)", "Stored for 6d 23h", plus a
  "Download all as ZIP" button. After the 17:15 sweep tick it read "4 uploads waiting to be stored"
  / "4 files did not upload to your storage provider", the three new rows all reading "Upload was
  interrupted by a server restart or memory limit." with "Next retry soon" — see Finding 1.
- **`/api/queuestatus`** returned 200 with the same entry when called with the account's Firebase
  ID token.
- **`/api/providersetupwarnings`** fires automatically on `/admin/new` (200).
- **`/api/getprovideraccesstoken`** fires when "Choose Drive folder" is clicked; the Google Picker
  opened and listed the account's Drive folders, so the minted token works. I cancelled without
  selecting anything.
- **Finalize**: **correctly not rendered.** `pages/admin/[experiment_id].js` gates the whole Danger
  zone on `STORAGE_PROVIDERS[provider].supportsFinalizing`, and only Zenodo has it. A Drive
  experiment is not offered finalization at all, so there was no control to render and no
  pre-check to call. Nothing was finalized.
- **Contact-email verification: SKIPPED.** The account page shows the address as "Confirmed" with
  only a "Change" control. There is no resend that does not first change the address, and changing
  it was out of scope, so `/api/sendcontactemailverification` and `/api/verifycontactemail` were
  **not exercised**.

## Server-side verification

**NOT PERFORMED — tools unavailable.**

- `mcp__plugin_firebase_firebase__functions_list_functions` →
  `HTTP 401 … cloudfunctions.googleapis.com/v1/projects/datapipe-test/locations/-/functions`
- `mcp__plugin_firebase_firebase__functions_get_logs` → `HTTP 401 … logging.googleapis.com`
- Local `firebase` CLI (v15.19.0) → `Error: Failed to list functions for datapipe-test`

Per the brief I did not attempt to log in. Consequently **none** of the following were observed and
must not be inferred from this report: the 13-function inventory; absence of the 21 removed
functions (beyond the two public 404s above); `scheduledsweep`'s 5-minute tick; whether mail retry
and pending recovery ran on their 10- and 15-minute slots; any `scheduled-sweep: <job> failed`
lines; ERROR-severity or 5xx or OOM in `dashboardapi` / `participantapi` / `apidata`; and whether
`compactiontask` stayed at zero executions while `onexperimentgrew` ran without enqueueing.

The indirect signals: `scheduledsweep`'s recovery job *did* run, twice that I could time — it turned
an abandoned session into a queue entry at **16:55:12 UTC** (12 min after abandonment) and fired
again at **17:15:10–17:15:12 UTC**, clearing the live-sessions table and creating three more
entries. Two firings 20 minutes apart are consistent with a 15-minute-slot recovery job on a
5-minute sweep, so the consolidated scheduler is alive. What it did on the second firing is
Finding 1.

## Findings

### 1. The sweep queues payloads that DataPipe already rejected (most important)

At **17:15:10–17:15:12 UTC** — one `scheduledsweep` tick — the upload queue for this experiment went
from one entry to four. The three new entries:

```
data/raw/e2e-probe-claim-1.csv                 pending  retryCount 0  lastAttemptAt null
   failureReason: "Recovered from interrupted upload (server restart or memory limit)"
data/raw/testbed-20260919T164730-ot84p04g.csv  pending  retryCount 0  lastAttemptAt null   (same reason)
data/raw/testbed-20260919T164919-n57eadjv.csv  pending  retryCount 0  lastAttemptAt null   (same reason)
```

Those three filenames are **exactly and only** the three submissions this session had rejected with
`400 METADATA_ERROR`:

- `e2e-probe-claim-1.csv` — my direct probe, `POST /api/data` with `data: "claimed by the testbed to
  force a duplicate-filename refusal\n"`, answered `400 {"error":"METADATA_ERROR","message":"Invalid
  metadata generated","metadataMessage":""}` at 16:49 UTC. This one is decisive: it was a bare
  `fetch` with **no session and no streaming**, so it cannot be a staged-session artefact.
- `testbed-20260919T164730-ot84p04g.csv` and `testbed-20260919T164919-n57eadjv.csv` — the two
  `breaksave=1` pre-claims, both logged `pre-claim responded 400` (same `METADATA_ERROR`), both on
  runs whose trials never started.

None of the three was ever accepted; none of the three is in Drive. The dashboard presents them to
the researcher as **"4 files did not upload to your storage provider. DataPipe is retrying
automatically."**, each row reading *"Upload was interrupted by a server restart or memory limit."*
with **"Next retry soon"** (unlike the genuine partial, which says "Next retry in 39m").

So a submission that DataPipe deliberately refused is (a) persisted, (b) later re-labelled as an
infrastructure failure, and (c) scheduled to be written into the researcher's Drive. At 17:20 UTC
all four were still `pending` with zero attempts, so I did **not** observe the upload actually
completing — but nothing in the queue state suggests it will not.

**Reproduce**: on a Drive experiment with Psych-DS metadata on, `POST /api/data` a `data` string
that is not parseable as CSV/JSON (e.g. a plain sentence). Confirm the `400 METADATA_ERROR`. Wait
for the next sweep tick that runs the recovery job (15-minute slots, e.g. `:00/:15/:30/:45`) and
check `GET /api/queuestatus?experimentID=<id>`.

**Why it matters**: the rejection is the feature — metadata validation exists to keep malformed data
out of the dataset. A retry path that carries the rejected bytes back in defeats it, and the
"server restart or memory limit" wording sends the researcher looking for an infrastructure problem
that did not happen.

### 2. A refused final submission did not produce a recovered partial

Scenario e. A streaming jsPsych session ran 30 trials; its filename had been claimed beforehand, so
the extension's final `POST /api/data` was refused `400 FILE_EXISTS` at **16:51:00 UTC**. Per
`api-messages.ts`'s own comment ("DataPipe deliberately leaves staging alone on a duplicate-filename
refusal, so the staged trials should come back as a hash-suffixed `.partial.json`") and per the
testbed's "What to check" ("within about 15 minutes, not 24 hours"), a
`…-<hash>.partial.json` should have been queued and written.

It was not. Queue polled at 17:00, 17:02, 17:04, 17:06, 17:08, 17:12, 17:15 and 17:20 UTC; Drive
`data/raw/` checked at 17:04 and 17:10. The only `.partial.json` anywhere is the one from the
abandoned-tab scenario. Meanwhile the same 17:15 sweep tick that should have handled this session
instead produced the three bogus entries in Finding 1 — so the recovery job did run, and this
session was not among what it recovered.

**Caveat on reproduction**: I could not use the testbed's `breaksave=1` (Finding 5), so the
pre-claim was a separate `POST /api/data` of my own without a `sessionId`. That is the same shape
the testbed uses, but if the staged trials are matched by something the claim interfered with, that
would be the place to look first.

### 3. Five `.psychds-ignore` files in one experiment folder

The experiment's Drive folder holds five separate `.psychds-ignore` files, 24 bytes each, with
modified times 12:41, 12:44, 12:45, 12:46 and 12:50 local — which are the timestamps of the five
successful uploads. One per upload, not one per experiment. Drive permits duplicate names, so
nothing errors; it just accumulates. Reproduce: create a Drive experiment with Psych-DS metadata on
and submit more than one file.

### 4. `METADATA_ERROR` returns a message that is not in `api-messages.ts`

Observed on the wire:

```
POST /api/data  {experimentID:"64asU9SsEIPJ", filename:"…csv", data:"claimed by the testbed to force a duplicate-filename refusal\n"}
→ 400 {"error":"METADATA_ERROR","message":"Invalid metadata generated","metadataMessage":""}
```

`functions/src/api-messages.ts` at `origin/test` defines
`METADATA_ERROR → "An error occurred while processing metadata"` and
`INVALID_METADATA_ERROR → "Metadata produced from incoming data is invalid"`. Neither is
`"Invalid metadata generated"`. The code and the 400 status are as documented in `pages/docs/api.js`;
only the message string is off, which suggests a literal built somewhere other than `MESSAGES`, or
the wrong constant being used. Worth a grep. Low severity, but it means a researcher who matches on
the message rather than the code sees a string no docs contain.

### 5. `breaksave=1` cannot work on a Psych-DS experiment

Consequence of Finding 4. The testbed's pre-claim body is the plain sentence above; with Psych-DS metadata
on, metadata generation fails on it and the upload is refused, so the filename is never claimed and
the run finishes normally. I confirmed this is not the validation feature: I turned
"Check submissions before storing them" **off** and re-ran, and the pre-claim still returned 400.
The failure is silent from the testbed's point of view — it logs `pre-claim responded 400` and
carries on. Fix is in the testbed (send a valid one-row CSV), not in DataPipe, but it does mean the
published "What to check" list currently has a scenario that cannot pass on a metadata-on experiment.

### 6. The published testbed is behind the local checkout

The deployed https://jspsych.github.io/datapipe-testbed/ vanilla page does not support the
`base64=1|invalid` or `resubmit=1` URL parameters that exist in
`<repos>/datapipe-testbed/site/vanilla/experiment.js`. Its parameter strip
reads `… stream · condition · compression · auto` with no base64 or resubmit entry, and passing
`base64=1` produced no `/api/base64` request. I used direct `fetch` probes instead. If the automated
driver is being written against the local source, the site needs republishing first.

### 7. Queue UX calls an unattempted upload a failure

Exactly the behaviour the brief predicted, recorded here for completeness: the recovered partial has
`retryCount: 0` and `lastAttemptAt: null` — it has never been attempted — yet the dashboard banner
reads "1 file did not upload to your storage provider" and the row reads "Retrying". The first real
attempt is an hour after recovery.

### 8. Sessions that never ran leave live rows behind

Two runs where I loaded the jsPsych page and navigated away before pressing a key still created
sessions, which sat in "Sessions in progress" as "Connection lost — may resume" until the 17:15
sweep cleared the table. Harmless in itself, but if a driver asserts on the in-progress count it
will see sessions from pages that never ran a trial. (These are also the two runs whose pre-claims
became the bogus queue entries in Finding 1.)

## Driver notes (for the automated driver)

**Creating an experiment**
- Go to `/admin/new`. Provider radios are `radio "gdrive" | "dataverse" | "zenodo"`; Google Drive is
  preselected. One text input labelled **Title**. Submit is `button "Create experiment"`.
- On success the page navigates to `/admin/<EXPERIMENT_ID>` — **read the ID from `location.pathname`**,
  it is also rendered under "Experiment ID". `POST /api/createexperiment` took 1327 ms; budget ~10 s.
- The Drive folder link is an `<a href="https://drive.google.com/drive/folders/<folderId>">Open folder</a>`
  on the same page — grab it for storage assertions.

**Toggles**
- The settings switches expose an `<input type=checkbox>` with an accessible name
  (`Accept new data`, `Accept base64 file uploads`, `Assign conditions in sequence`,
  `Stop after a set number of sessions`, `Check submissions before storing them`,
  `Generate Psych-DS metadata`), but **clicking the input by its element reference did nothing** —
  I had to click the visible switch by coordinate. A real driver should click the switch element
  (the label/track), not the hidden input.
- Each switch renders a transient **"Saved"** badge next to it; that is the confirmation to wait for.
- Turning conditions on reveals a **"How many conditions?"** number input; triple-click + type + Tab
  worked and produced a "Saved" badge.
- **`Generate Psych-DS metadata` locks itself permanently once the experiment has data** ("Locked
  because this experiment has collected data"). Set it *before* the first submission or not at all.
- **Likely default trap** (reasoned, not observed): a new experiment ships with validation ON and a
  required field `trial_type`. The plain-JavaScript testbed page's rows are
  `{trial_index, task, stimulus, response, rt, correct}` — no `trial_type` — so vanilla submissions
  should fail validation. I removed the chip before running any vanilla scenario, so I never saw the
  rejection; a driver should remove it (click the × on the `trial_type` tag) or turn validation off
  during setup rather than find out.

**Knowing a testbed run has finished**
- The testbed maintains `window.__testbed` (`{schema, page, params, status, startedAt, finishedAt,
  sessionId, condition, filenames, requests, notes}`) mirrored to
  `document.documentElement.dataset.testbedStatus` and to JSON in `#testbed-result`. `status` is
  `running | finished | failed | aborted`. **Poll the dataset attribute or `#testbed-result`, not
  `window.__testbed`** — the Chrome extension's JS evaluation runs in an isolated world and could not
  see the page global, but DOM reads work fine.
- Fallback signal: the last line of the on-screen `#log` (`final save SUCCEEDED (HTTP 201)` /
  `final save FAILED (HTTP 400) {…}` / `Saved (201)` on the vanilla page). `get_page_text` on
  `jspsych.github.io` was intermittently refused by the extension's per-domain permission check;
  zooming a screenshot on the log region always worked.

**Starting a run — the single most annoying thing**
- Both pages wait for a real keypress ("Press any key to start"). In this tooling,
  `key: "space"` **never** started a run and a `type` issued in the *same* batched call as the
  preceding click **usually** did not either. What worked reliably: click the page body in one tool
  call, then send `type: "f"` as a **separate** call. Budget a verify-and-retry loop around the
  start; I had to retry on 4 of 8 runs. A real WebDriver/CDP driver should not hit this, but assert
  that the first trial appeared rather than assuming.
- `f` is also a valid trial response, so an extra keypress is harmless.

**Timing actually measured**
- jsPsych page, `auto=1`: ~1.1–1.7 s per trial (40 trials ≈ 70 s; 10 trials ≈ 18 s).
- Vanilla page, `auto=1`: 400 ms per trial (source-confirmed); 8 trials went from first keypress to
  `POST /api/data` in about 5 s. A larger gap I saw on one run is explained by my keypress not
  registering, not by the page.
- Final `POST /api/data` that writes to Drive: 2–4.5 s.
- Abandoned-session recovery: ~12 min from tab close to queue entry. First Drive attempt: +60 min.
- Live-session status transitions: "Connection lost" within seconds; "Stopped — being recovered"
  at ~10–12 min.

**Native dialogs**
- **None encountered.** Experiment creation, every toggle, the error panel disclosure, the queue
  panel and the Drive folder picker are all in-page. The Google Picker is an in-page overlay with
  `Select` / `Cancel` buttons, not a popup window. I did not open Finalize or Delete account, which
  are the two plausible `ConfirmDialog` sites; the Finalize section does not render for Drive
  experiments at all.

**Useful non-UI hooks**
- `GET /api/queuestatus/?experimentID=<id>` with `Authorization: Bearer <Firebase ID token>` returns
  `{entries:[{id,filename,dataType,status,errorCode,retryCount,maxRetries,createdAt,lastAttemptAt,
  nextRetryAt,failureReason}],count}` — far better evidence than the dashboard panel, and the only
  way I found to see `lastAttemptAt: null`. The ID token can be read from the
  `firebaseLocalStorageDb` IndexedDB store on the `datapipe-test.web.app` origin
  (`firebaseLocalStorage` → first record → `value.stsTokenManager.accessToken`).
- All `/api/*` participant endpoints are CORS-open, so probes can be driven straight from any tab's
  JS context. Note the **trailing slash**: `POST /api/getosftoken/` 308-redirects to
  `/api/getosftoken` and `fetch` reports "Failed to fetch" on the CORS-less 404 — use `curl`, or read
  the status via a no-slash URL, when checking that a route is gone.

**Ambiguities I hit**
- The brief refers to a testbed `session=1` parameter; the actual parameter is **`stream`**
  (`common.js` `readParams`). There is no `session` parameter.
- Two runs of the vanilla page assign conditions 0 then 1; a third assignment (direct API) returned 0.
  Confirm expected wrap-around before asserting on a fixed sequence.

## What I did not test, and why

- **Everything in step 7 (server side)** — Firebase MCP and the `firebase` CLI are unauthenticated
  (401). Function inventory, `scheduledsweep` tick cadence, mail-retry and pending-recovery slot
  timing, per-function log severity, and `compactiontask` non-execution are all **not observed**.
- **Compaction** — I could not confirm that no `compactiontask` ran for this Drive experiment, since
  that requires logs. Nothing client-side contradicts it.
- **Brief-dropout scenario** — requires DevTools offline throttling, unavailable here.
- **"Ended early" (`abort=N`) scenario** — not in the assigned minimum set.
- **Finalize / `/api/finalize`** — the control is deliberately absent for Google Drive; only its
  unauthenticated 401 was probed. Nothing was finalized.
- **Contact-email verification** (`/api/sendcontactemailverification`, `/api/verifycontactemail`) —
  the UI offers no resend without changing the address; skipped as instructed.
- **`/api/connectprovider`, `connectstatictokenprovider`, `disconnectprovider`, `deleteaccount`,
  `generateoauthstate`, `oauth2callback`, `saveosftoken`, `checkemailconflict`** — all require
  connecting, disconnecting or destroying something on the user's real account. Not run.
- **The `.partial.json` file itself, and the three bogus queue entries, actually reaching Drive** —
  all four were still `pending` with `retryCount: 0` at 17:20 UTC. I did not wait for the hour.
  Whether Finding 1's rejected payloads really do get written is the single most useful follow-up.

## Cleanup

- Experiment `64asU9SsEIPJ` left in place with **data collection OFF**, as instructed. Its data,
  the probe PNG and the queued partial are untouched.
- I closed the two testbed/Drive tabs I opened. The third — the dashboard tab, left on
  `/admin/64asU9SsEIPJ` — could not be closed: once the other two were gone Chrome dissolved the
  automation tab group, and the tool refuses to act on a tab outside it. **One extra tab is left
  open on the experiment's dashboard page.** No pre-existing tab was navigated or closed.
- Nothing was deleted in Drive, no provider was disconnected, no account setting was changed.
- Configuration changes I made to the new experiment, for the record: removed the default
  `trial_type` required field (the plain-JavaScript testbed emits no such column), then turned
  validation off entirely so the scenario-e pre-claim could be diagnosed. Both were on the e2e
  experiment only.

---

## Corrections added after the run (2026-09-19, from code review and the runner's own timeline)

- **Finding 2 is WITHDRAWN.** Collection was switched off (~16:58:50Z) before the refused-save session became recoverable (tab left ~16:56:35Z + grace). The sweep discards staged trials for an experiment that is not collecting, by design (`scheduled-staging-sweep.ts`, "THE SECOND DOOR"). Test-ordering artefact, not a defect. Scenario e's verdict is: refusal half PASS, recovery half NOT TESTED.
- **Finding 1 is intended behaviour, unchanged by the refactor.** `api-data.ts` deliberately keeps the pending copy on a metadata failure so `scheduled-pending-recovery` can salvage it; `METADATA_ERROR` means metadata generation failed, not that the data was refused (policy since f7dd079). What remains a fair criticism: the queue wording ("server restart or memory limit") is misleading for this case, and the retry worker re-checks `finalized` but not `active`.
- **Finding 4 is by design**: `metadata-block.ts` overrides the message with the specific error text. Assert on `error`, not `message`.
- **Finding 3 (duplicate `.psychds-ignore` on Drive) and Finding 5 (testbed `breaksave` pre-claim) stand**; neither is related to the consolidation.
- **Finding 6** is an artefact: the local testbed checkout was on the unmerged `e2e-result-contract` branch. The note about `window.__testbed` and the extension's isolated world was therefore not observed on a deployed page.
- Positive evidence for the consolidation worth stating: pending recovery fired at 17:15:10Z, a 15-minute slot, and the staging sweep queued the abandoned session at 16:55:12Z — both from inside the new `scheduledsweep`.

## Server-side verification, completed later the same day (after `firebase login --reauth`; the CLI's stored refresh token had been rejected by Google, hence the earlier 401s)

- **Function inventory**: exactly the 13 expected functions plus hosting's `ssrdatapipetest`. Memory as designed: `apidata` 512, `compactiontask`/`finalizetask` 1024, `onexperimentgrew`/`onuploadqueuechanged` 256, `scheduledsweep` 512. None of the old functions remain.
- **`scheduledsweep` cadence**: fired on every 5-minute tick from 16:35Z to 18:45Z, none missed, no `scheduled-sweep: <job> failed` lines, no errors. Pending recovery ran at 17:15 (a 15-minute slot).
- **Finding 2's explanation confirmed in the logs**: 17:05:05Z, three lines "Experiment 64asU9SsEIPJ is not collecting; discarding staging session …" — "recovered 0, discarded 3".
- **Queued uploads all delivered**: 17:20Z "Successfully retried upload" ×3 (the salvaged METADATA_ERROR payloads, to `data/raw/`); 18:00Z the abandoned-tab partial `…-6b33aa40.partial.json` (queued 16:55, `nextRetryAt` 17:55, delivered on the next tick).
- **Errors since deploy**: zero E-level lines in `dashboardapi`, `participantapi`, `apidata`. Their W-level lines have empty text, consistent with request logs for the deliberate 4xx responses (not individually verified).
- **Compaction**: `compactiontask` has deploy lines only — zero executions. `onexperimentgrew` logged 19 info lines and no errors, i.e. it ran and did not enqueue, as expected for a Drive experiment. `onuploadqueuechanged` cold-started at 16:55, 17:15 and 18:00 — exactly when queue documents were written — with no errors.
