# DataPipe TEST — browser run 2: rejections panel, "Clear this list", schema-2 testbed, polished queue panel

- **Deployment**: https://datapipe-test.web.app (`datapipe-test`). Production never touched.
- **Experiment**: `64asU9SsEIPJ` — "e2e-20260919-1637", Google Drive, Psych-DS metadata ON (locked), conditions ON, validation ON, base64 OFF.
- **Code read from**: `origin/test` @ `0077cab` (fetched 2026-09-19 23:58Z; `e1a6862..0077cab`).
- **Testbed**: https://jspsych.github.io/datapipe-testbed/ — served **schema 2** on both pages, no cache fight needed.
- **Browser**: Chrome via claude-in-chrome, macOS, **dark mode** (site stores `datapipe-color-mode: "dark"`, `<html class="dark">`).
- All times UTC. Dashboard absolute timestamps render in the browser's local zone (GMT-4); converted here where quoted.

---

## 1. Timeline (UTC)

| Time | Event |
|---|---|
| 23:58:49 | `git fetch origin test` → `0077cab`. Runbook (`SKILL.md`, `dashboard.md`, `endpoints.md`) read. |
| ~00:00:10 | Dashboard tab hard-reloaded (⌘⇧R). `GET /api/queuestatus` → `{"entries":[],"count":0}` — queue empty, so Part A first. |
| 00:00:1x | Rejections panel recorded collapsed + expanded, computed styles measured. |
| ~00:00:38 | **"Clear this list" clicked.** `POST /api/clearerrors` → **200**. |
| 00:00:43.7 | Panel + header chip still present (10.4 s after click, request still `pending` in the network log). |
| ≤00:00:54.7 | Panel **and** header chip gone, no reload. |
| ~00:01:1x | Dashboard hard-reloaded. |
| 00:01:45.5 | Closed-experiment probe `POST /api/data` → **400 `DATA_COLLECTION_NOT_ACTIVE`** (`run2-closed-probe-0001.csv`). |
| 00:01:51 | Panel back, live (no reload): "One submission to this experiment was rejected." / "The most recent was just now." |
| 00:02:42 | **"Accept new data" switched ON** (header chip → "Accepting data"). |
| 00:02:54 | `run2-abandon` page opened (`trials=120`), `data-testbed-status=ready`, 0/120, `schema: 2`. |
| ~00:03:3x | Abandon run started (3rd click+key attempt). |
| 00:04:41 | `data-testbed-trials-completed` first read **≥60 → 64**. Result JSON captured *before* closing. |
| **00:04:48** | **Abandon tab closed** at 64 completed trials, ~70 s into the run. |
| 00:04:59.8 | Metadata probe `POST /api/data` → **400 `METADATA_ERROR`**, new wording (`run2-metadata-probe-0004.csv`). |
| 00:05:06 | `run2-clean` page opened, `ready`, 0/8, `schema: 2`. |
| ~00:07:10 | Clean run started (4th attempt — see driver note). |
| 00:07:26.5 | Clean run **finished**, 8/8, `final-save` → 201. |
| 00:07:53 | `run2-vanilla` opened (`condition=1`), `ready`, 0/8, condition **1**, `sessionId` still null. |
| 00:08:12 | Vanilla **running**, `sessionId` = `<sessionId>` present **while running**. |
| 00:08:19.4 | Vanilla **finished**, 8/8, `final-save` → 201, `source: "page"`, `ms: 4789`, URL with **no** trailing slash. |
| ~00:12 | Light-mode check on the rejections panel; `resize_window` proved inert (see §6). |
| **00:15:13.2** | **Recovered partial queued** — 10 min 25 s after the tab closed. `nextRetryAt` = exactly +60 min. |
| 00:15:2x | Dashboard hard-reloaded; queue panel recorded + screenshot; rejections panel correctly hidden. |
| ~00:17:3x | Per-row download → `GET /api/queuestatus?...&download=…` **200**. |
| ~00:18 | Light-mode queue-panel screenshots; colour mode restored to `dark`. |
| 00:21–00:30 | Queue polled continuously at ~6 s; `count` stayed 1. |
| **00:30:24.2** | **Metadata-probe entry queued** — 25 min 24 s after the probe, at the `:30` pending-recovery slot. `nextRetryAt` = **+1 min**, not +60. |
| 00:30:2x–00:30:4x | Two-entry queue panel recorded + screenshotted (live, no reload). |
| **00:31:34** | **"Accept new data" switched OFF** (header chip → "Not accepting data"). |
| 00:31:4x | Testbed tab closed; dashboard tab left on the experiment page, dark mode restored. |

---

## 2. Part A — rejections panel and "Clear this list"

### 2.1 Panel as found (10 rejections, queue empty)

Header chip, verbatim: **`Some submissions were rejected`** (icon `lucide-circle-x`, stroke `#F17761` = `status.error`).

Panel, verbatim:

```
10 submissions to this experiment were rejected.
DataPipe refused these submissions. The most recent was 1 hour ago.
Show what was rejected
Clear this list
```

`1 hour ago` carries `title="19/09/2026, 18:33:48 GMT-4"` (= **22:33:48Z**), i.e. the absolute time is in the hover title as specified.

**Measurements (dark mode):**

| | Value |
|---|---|
| `border-left` | **3px `rgb(241,119,97)`** (`--chakra-colors-status-error` = `#F17761`) |
| `border-top/right/bottom` | `1px rgb(113,113,122)` each |
| Panel `background-color` | `rgb(28,31,34)` |
| Page (`body`/`html`) background | `rgb(28,31,34)` |
| Headline icon | `svg.lucide lucide-circle-x`, stroke `rgb(241,119,97)` |
| Headline label colour | `rgb(250,250,250)` (`fg`) |

No red fill, no red body text — matches the component's stated intent. **One difference worth recording: in dark mode the panel background is byte-identical to the page background** (`rgb(28,31,34)` both), so the only thing separating the panel from the page is the 1px border. In light mode they do differ (panel `rgb(255,255,255)` on page `rgb(245,247,248)`).

### 2.2 Expanded accordion

Trigger text: **`Show what was rejected`** (not "Show the 20 most recent of N" — count was 10, ≤ MAX_ROWS 20, as coded). Columns: **`What happened`** / **`Time`**. 10 rows.

Newest row (22:33:48Z) — **the new METADATA_ERROR detail is live in the panel**, first time it has been seen there:

```
An error occurred while processing metadata
No columns were found in the submitted data, so Psych-DS metadata could not be generated. The data must be a JSON array of trials or a CSV with a header row.
The raw data was kept. DataPipe stores it in your storage provider without Psych-DS metadata, usually within about half an hour.
Code: METADATA_ERROR
19/09/2026, 18:33:48 GMT-4
```

Older METADATA_ERROR rows (16:49:39Z, 16:49:21Z, and one more) still read `Invalid metadata generated` as their detail, with the same kept-note and code. Other rows seen: `Data collection is not active for this experiment` / `DATA_COLLECTION_NOT_ACTIVE` ×2; `A file with this name already exists in the storage provider. File names must be unique.` / `FILE_EXISTS` ×2; `The data are not valid base64 data` / `INVALID_BASE64_DATA` ×1.

**Differences from expected copy/appearance: none.** Every string, the row order (newest first), the per-row METADATA_ERROR note, the `Code: …` fine print and the neutral outline `Clear this list` button matched.

### 2.3 "Clear this list"

- `POST https://datapipe-test.web.app/api/clearerrors` → **200**. (The extension's network log exposes status only; the response *body* was not readable through it — recorded as **not observed**.)
- **Latency is the one rough edge.** 10.4 s after the click the panel and chip were both still on screen and the request still showed `statusCode: pending`. By the next sample window they were gone. Bound: **> 10.4 s and ≤ 16 s** from click to disappearance. A 100 ms DOM poller ran throughout, so this is not sampling error — the round trip really was slow (cold `dashboardapi`, most likely). During that window the button showed its loading state and nothing flashed or errored.
- **It disappeared without a reload** — the parent's Firestore listener unmounted the panel and the chip together, exactly as the component comment says.
- No `Could not clear this list…` error alert appeared at any point.
- **Post-reload:** the page was hard-reloaded at ~00:01:1x, and the next read (00:01:51) showed **"One submission…"**, i.e. the watermark survived the reload and the count restarted at 1. *Strictly:* I did not capture a read in the gap between the reload and the new probe, so "the panel was absent immediately after the reload" is **not observed**; what is proven is that the count went 10 → 1 rather than 10 → 11, which only the persisted watermark can produce.

### 2.4 One fresh rejection with collection OFF

`POST /api/data` `{filename: "run2-closed-probe-0001.csv", data: "trial_type,rt\nx,1\n"}` at **00:01:45.5Z**:

```json
{"error":"DATA_COLLECTION_NOT_ACTIVE","message":"Data collection is not active for this experiment"}
```
HTTP **400**. **The rejection IS logged for a closed experiment** — no need for the duplicate-filename fallback.

Dashboard, read at 00:01:51 **without a reload**:

```
Some submissions were rejected                 (header chip)
One submission to this experiment was rejected.
DataPipe refused these submissions. The most recent was just now.
```

Expanded, exactly one row:

```
Data collection is not active for this experiment
Code: DATA_COLLECTION_NOT_ACTIVE
19/09/2026, 20:01:48 GMT-4        (= 00:01:48Z)
```

Singular headline, "just now", one row. **No differences from expected.**

---

## 3. Part B — testbed result contract, schema 2

All three runs reported `schema: 2`. No schema-1/cached page was encountered.

### 3.1 Clean run — `run2-clean` (jsPsych, trials=8, auto=1, stream=1)

**Before any keypress:** `data-testbed-status` = `ready`, `data-testbed-trials-planned` = `8`, `data-testbed-trials-completed` = `0`, `schema` = 2, `status` = `"ready"` in the JSON too. Exactly as documented.

Counter samples after the start key: `00:07:17 running 4` → `00:07:25 running 8` → `00:07:28 finished 8` → stable. (I caught `ready` before the key and `running` after it, but **did not** catch the single instant of the first trial, so "running was set only at trial 1, not at the keypress" is **not observed** — only that it was not set before the key.)

Final `#testbed-result`:

```json
{
  "schema": 2, "page": "jspsych",
  "params": {"experiment":"64asU9SsEIPJ","base":"https://datapipe-test.web.app","trials":8,"format":"csv","auto":true,"stream":true,"breaksave":false,"abort":0,"condition":false,"compress":true,"base64":"off","resubmit":false,"failvalidation":false,"run":"run2-clean"},
  "status": "finished",
  "startedAt": "2026-09-20T00:05:06.228Z",
  "finishedAt": "2026-09-20T00:07:26.486Z",
  "trialsCompleted": 8, "trialsPlanned": 8,
  "sessionId": null, "condition": null,
  "filenames": ["testbed-run2-clean-20260920T000506-tks1p30e.csv"],
  "requests": [
    {"label":"final-save","method":"POST","url":"https://datapipe-test.web.app/api/data/","status":201,"ok":true,"ms":null,"source":"library"}
  ],
  "notes": [
    "extension-pipe issues POST /api/session, the staging writes and the final POST /api/data itself; per-request detail for those is unavailable to the page. The final save is recorded from the extension's on_save callback, and any degraded path it reports arrives as an `extension-pipe:` note.",
    "sessionId is null on this page BY DESIGN: extension-pipe 0.2.0 exposes no public way to read the session id it opened. The plain-JavaScript page, which calls datapipe-client itself, does report one."
  ]
}
```

`finished`, `trialsCompleted === trialsPlanned === 8`, `final-save` 201, `source: "library"`, `ms: null`, URL **with** trailing slash — all exactly as the README says a library-issued request looks.

### 3.2 Abandoned tab — `run2-abandon` (jsPsych, trials=120)

- Pre-key: `ready`, 0/120, `schema: 2`.
- Filename captured before closing: **`testbed-run2-abandon-20260920T000254-7en1ll2y.csv`**.
- Polled `data-testbed-trials-completed` every ~5 s; first read ≥ 60 was **64** at 00:04:41.7.
- **Tab closed at 00:04:48Z**, at **64** completed trials, ~**70 s** after the first trial (~00:03:3x) and 1 min 54 s after the page opened its result at 00:02:54.4.
- `sessionId` was `null` throughout, as documented for the jsPsych page; `requests` was empty at close (the final save never happened).

**Finding:** the queue entry that came back says **"(60 trials)"** while the page counter read **64** at the moment of the close. The four trials in flight were staged-but-not-flushed. This is a real, reportable gap between what `trialsCompleted` promises a driver ("polling `trialsCompleted` is how a driver acts *at trial N*") and what actually survives; a driver aiming for "≥ N recovered" must overshoot. Not a regression — just undocumented.

### 3.3 Vanilla page — `run2-vanilla` (trials=8, condition=1)

```json
{
  "schema": 2, "page": "vanilla",
  "status": "finished",
  "startedAt": "2026-09-20T00:07:53.132Z",
  "finishedAt": "2026-09-20T00:08:19.402Z",
  "trialsCompleted": 8, "trialsPlanned": 8,
  "sessionId": "<sessionId>",
  "condition": 1,
  "filenames": ["testbed-run2-vanilla-20260920T000753-sx7fcupi.csv"],
  "requests": [
    {"label":"final-save","method":"POST","url":"https://datapipe-test.web.app/api/data","status":201,"ok":true,"ms":4789,"source":"page"}
  ],
  "notes": [
    "POST /api/condition was made inside datapipe-client; per-request detail is unavailable. A non-null `condition` means it returned 200.",
    "POST /api/session and the staging writes happen inside datapipe-client; per-request detail is unavailable. A non-null `sessionId` below means /api/session returned 200."
  ]
}
```

- **`sessionId` IS present while `status === "running"`** — observed at 00:08:12, 00:08:14, 00:08:16, all `running`, all carrying `<sessionId>`. This is the fix working.
  - Nuance: at the **`ready`** sample (00:08:01, before the start key) `sessionId` was still `null`. So it is captured when `/api/session` returns, which on this page is after the start key — not at page load.
- **Condition assigned: `1`** (on-page log line `condition assigned: 1` at 00:07:53).
- The one page-issued request has **no trailing slash** (`…/api/data`), `source: "page"`, and a real `ms` (4789 — a genuinely slow Drive write, consistent with the runbook's 2–4.5 s band).
- Final status `finished`, 8/8.

### 3.4 Metadata probe

`POST /api/data` `{filename:"run2-metadata-probe-0004.csv", data:"this sentence is not a data file\n"}` at **00:04:59.8Z**:

```json
{"success":false,"error":"METADATA_ERROR","message":"No columns were found in the submitted data, so Psych-DS metadata could not be generated. The data must be a JSON array of trials or a CSV with a header row.","metadataMessage":""}
```

HTTP **400**, message begins "No columns were found" as expected. Its kept copy reappeared in the queue at **00:30:24.2Z** — see §4.4.

---

## 4. Part C — the polished upload-queue panel

### 4.1 `/api/queuestatus` evidence

At 00:15:15.7Z (first non-empty poll; the 00:15:09 poll was still empty):

```json
{"entries":[{
  "id":"64asU9SsEIPJ:data_raw_testbed-run2-abandon-20260920T000254-7en1ll2y-a1b85ca1.partial.json",
  "filename":"data/raw/testbed-run2-abandon-20260920T000254-7en1ll2y-a1b85ca1.partial.json",
  "dataType":"data",
  "status":"pending",
  "errorCode":0,
  "retryCount":0,
  "maxRetries":5,
  "createdAt":"2026-09-20T00:15:13.221Z",
  "lastAttemptAt":null,
  "nextRetryAt":"2026-09-20T01:15:13.221Z",
  "failureReason":"Recovered from an abandoned session (60 trials)"
}],"count":1}
```

No `retainUntil` field — so "Kept for another" falls back to `createdAt + 7 d`, which is what "6d 23h" is. `lastAttemptAt: null` + `retryCount: 0` + a held reason ⇒ kind `waiting`. Queued **10 min 25 s** after the tab closed; `nextRetryAt` exactly **+60 min**. Both match the runbook's measured figures.

### 4.2 Panel, verbatim (dark, 1384 CSS px viewport)

```
Accepting data   8 completed sessions   0 sessions in progress   1 upload waiting to be stored

 One file is waiting to be stored.
 DataPipe is storing these automatically; nothing has failed. You can download them now if you need them sooner.
 What is happening to these files?
                                                        Download all as ZIP
 Filename                    Status                Reason                                        Kept for another
 testbed-run2-abandon-       Waiting to be stored  Recovered from a session that did not         6d 23h
 20260920T000254-7en          First attempt in 1h   finish (60 trials). It will be stored
 1ll2y-a1b85ca1.partial.json                        as a partial file.
```

Explainer body, expanded, verbatim:

```
DataPipe tries to store each submission in your storage provider the moment it arrives. A file is listed here when that has not happened yet.
• Waiting to be stored — DataPipe recovered the data from a session that did not finish, or kept the raw file after a processing problem, and has not tried to store it yet. Nothing has failed.
• Retrying — An attempt failed, usually because your storage provider was busy or unavailable, or because DataPipe's connection to it needs refreshing. DataPipe tries again automatically.
• Failed — Every retry was used up. Download the file and upload it to your storage provider yourself.
Files are stored for seven days, or up to fourteen if we couldn't deliver a failure notification to you.
```

### 4.3 Checks

| Expectation | Result |
|---|---|
| Plain neutral bordered panel, no fill, no coloured edge | **Yes.** `background rgb(28,31,34)` (= page bg), all four borders `1px rgb(113,113,122)`. No `border-left` accent. |
| Clock icon + "One file is waiting to be stored." | **Yes.** `svg.lucide-clock`, stroke `rgb(212,212,216)` = `status.neutral` (dark). |
| Header chip: clock + "1 upload waiting to be stored" | **Yes**, same `lucide-clock`, same stroke. Correctly singular. |
| Clock icon in all three places | **Yes — 3 × `lucide-clock`** found (chip @x=589, headline @x=156, row status @x=501). |
| No minus-sign icon in the panel | **Confirmed: `svg.lucide-minus` count = 0** on the whole page. |
| Explainer "What is happening to these files?" | **Yes**, text above. |
| "Download all as ZIP" right-aligned directly above the table | **Yes.** Button right edge **1214 px**, table right edge **1214 px** — flush. Sits between the accordion and the table header. |
| Columns Filename / Status / Reason / Kept for another | **Yes** (+ a visually-hidden "Download" header). Widths 338 / 170 / 379 / 123 / 48. |
| Row shows the BASENAME, full path in `title` | **Yes.** Cell text `testbed-run2-abandon-…partial.json`; `title="data/raw/testbed-run2-abandon-20260920T000254-7en1ll2y-a1b85ca1.partial.json"`. The row download button's `aria-label` still uses the **full path** (`Download data/raw/…`), which is by design per the component comment but is worth knowing when driving by accessible name. |
| Status on ONE line | **Yes.** `white-space: nowrap` on the label; header row height 37 px uniform — **nothing wraps at 1384 px**, including "Kept for another". |
| Sub-line indented under the label, not the icon | **Yes, exactly.** icon `x = 501.07`, label `x = 525.07`, **sub-line `x = 525.07`** — sub-line left edge is pixel-identical to the label's, 24 px right of the icon. |
| Sub-line wording | `First attempt in 1h` right after queueing; later re-read as `First attempt in 59m`. Both are the coded forms; the brief's "57m" was just an example. |
| "Kept for another" on one line | **Yes**, `6d 23h`, `white-space: nowrap`. |
| Per-row download | Clicked → `GET /api/queuestatus?experimentID=64asU9SsEIPJ&download=64asU9SsEIPJ:data_raw_…partial.json` → **200**. |
| Rejections panel hidden while the queue is non-empty | **Yes** — the "Some submissions were rejected" chip and panel both disappeared once the partial was queued, as documented. |

**Differences from expected: none in copy or layout.** The only notes are the aria-label full path (above) and the dark-mode panel-bg/page-bg identity (§2.1).

### 4.4 Two entries — the metadata-probe entry caught in its short window

The `METADATA_ERROR` probe's kept copy was queued at **00:30:24.211Z**, **25 min 24 s** after the 00:04:59.8Z probe, on the `:30` pending-recovery slot. `/api/queuestatus` at 00:30:28Z:

```json
{"entries":[
 {"id":"64asU9SsEIPJ:data_raw_run2-metadata-probe-0004.csv",
  "filename":"data/raw/run2-metadata-probe-0004.csv",
  "dataType":"data","status":"pending","errorCode":0,
  "retryCount":0,"maxRetries":5,
  "createdAt":"2026-09-20T00:30:24.211Z",
  "lastAttemptAt":null,
  "nextRetryAt":"2026-09-20T00:31:24.211Z",
  "failureReason":"Kept after a metadata failure (raw data stored without Psych-DS files)"},
 {"id":"64asU9SsEIPJ:data_raw_testbed-run2-abandon-20260920T000254-7en1ll2y-a1b85ca1.partial.json",
  "filename":"data/raw/testbed-run2-abandon-20260920T000254-7en1ll2y-a1b85ca1.partial.json",
  "dataType":"data","status":"pending","errorCode":0,
  "retryCount":0,"maxRetries":5,
  "createdAt":"2026-09-20T00:15:13.221Z",
  "lastAttemptAt":null,
  "nextRetryAt":"2026-09-20T01:15:13.221Z",
  "failureReason":"Recovered from an abandoned session (60 trials)"}
],"count":2}
```

Neither entry carries `retainUntil`. Note the **two different first-attempt delays**: the metadata-kept entry gets `nextRetryAt = createdAt + 1 min`, the recovered partial `+60 min`. The panel reflects both correctly.

The dashboard updated **live, with no reload**:

```
Accepting data   8 completed sessions   0 sessions in progress   2 uploads waiting to be stored

 2 files are waiting to be stored.
 DataPipe is storing these automatically; nothing has failed. You can download them now if you need them sooner.

 Filename                       Status                 Reason                                                Kept for another
 run2-metadata-probe-0004.csv   Waiting to be stored   DataPipe could not generate Psych-DS metadata for      6d 23h
                                 First attempt in 1m    this submission, so it is storing the raw file
                                                        without it.
 testbed-run2-abandon-…         Waiting to be stored   Recovered from a session that did not finish           6d 23h
 …partial.json                   First attempt in 45m   (60 trials). It will be stored as a partial file.
```

- Chip correctly plural: **`2 uploads waiting to be stored`**; headline **`2 files are waiting to be stored.`**
- Both rows are kind `waiting` (clock icon), neither says "did not upload" or "Retrying".
- Both filenames render as basenames; the `data/raw/` prefix is only in `title`.
- Both "Kept for another" values `6d 23h`, one line.
- Sub-lines `First attempt in 1m` / `First attempt in 45m` — the code's `in <n>m` form. I did **not** observe the `within 5 minutes` variant (it needs `nextRetryAt` already in the past).
- The panel stayed the plain neutral `SectionPanel` — no coloured edge — with two waiting entries.

---

## 5. Light mode

`dashboard.md` says the pages have **no theme override**. That is **wrong on the current build**: there is one.

- `localStorage["datapipe-color-mode"]` = `"dark"`, and `<html class="dark">` (next-themes with `attribute="class"`). The `<html>` element has exactly two attributes, `class` and `style`; there is no `data-theme`.
- Flipping `document.documentElement.className` to `"light"` switches the whole page instantly, and **restoring it restores exactly** — I never wrote to `localStorage`, so the user's stored preference was untouched. Verified restored: `class="dark"`, `localStorage["datapipe-color-mode"]="dark"`.

Light-mode measurements:

| | Light | Dark |
|---|---|---|
| Page background | `rgb(245,247,248)` | `rgb(28,31,34)` |
| Panel background | `rgb(255,255,255)` | `rgb(28,31,34)` |
| `--chakra-colors-status-error` | `#A82E16` | `#F17761` |
| Rejections `border-left` | `3px rgb(168,46,22)` | `3px rgb(241,119,97)` |
| Queue clock stroke | `rgb(63,63,70)` | `rgb(212,212,216)` |
| Queue sub-line ("First attempt in 59m") | `rgb(63,63,70)` | muted `fg.muted` |

The red left edge, the clock icon and the muted sub-line are all clearly legible in light mode (screenshots below). Nothing looked washed out or invisible.

---

## 6. Widths / responsive

`resize_window` **reported success and changed nothing**, exactly as the earlier run found:

```
resize to 1280x900 → inner=1384x703  outer=772x392  screen=1710  dpr=2
resize to 420x800  → inner=1384x703  outer=772x392
```

`window.innerWidth` never moved off 1384. The Chrome window is in macOS fullscreen, so the renderer viewport does not follow the window bounds. **I did not fight it.** Consequences:

- The **420 px layout is still never-observed.** So is anything below 1384.
- At the width I had (**1384 CSS px**): no header or status label wraps; `Filename` wraps inside its own cell only (long filename, `word-break: break-all`), which is intended; the table does not overflow (`scrollWidth === clientWidth === 1058`); the header chips sit on one line; nothing overlaps.

To get the responsive check done, someone needs to take the Chrome window **out of macOS fullscreen** first.

---

## 7. Schema-2 verdict

**It works, and it is a large improvement for a driver.**

| Contract item | Verdict |
|---|---|
| `ready` before the keypress | **Held on all 3 runs.** This is the headline win: schema 1's `running`-at-load made the start unverifiable. |
| `running` proves the key landed | **Held.** It was the only reliable signal — and it caught 3 silently-dropped keypresses that would otherwise have been invisible. |
| `trialsCompleted` / `trialsPlanned` | **Held.** `0/8` pre-start, monotone during, `8 === 8` at finish on both pages. Polling it to act at trial N worked. |
| `finished` on a clean run | **Held**, both pages. |
| `source` = page / library | **Held.** Vanilla page-issued save: `source:"page"`, real `ms` (4789), no trailing slash. jsPsych library save: `source:"library"`, `ms:null`, trailing slash. |
| `sessionId` captured as soon as `/api/session` returns | **Held on the vanilla page** — present at the first `running` sample and thereafter. `null` on the jsPsych page by design. |
| `schema: 2` served | **Yes**, no cached schema-1 page. |

**Still wrong or awkward for a driver:**

1. **`trialsCompleted` overstates what is recoverable.** Closed at 64; the recovered partial says 60. The README sells the counter as the way to act at trial N, but the staging flush lags it. Worth a sentence in the README ("expect the recovered partial to hold fewer trials than `trialsCompleted` at the moment of the close — unflushed trials are lost").
2. **The vanilla page's `/api/condition` and `/api/session` produce no `requests[]` entries at all**, only `notes`. The README's "What `requests` does and does not hold" reads as though library calls appear in `requests` with `source:"library"`; on the vanilla page they do not appear at all, and only the jsPsych page's `final-save` is recorded that way. A driver told to "check each expected request label" cannot assert on session/condition at all — it has to infer them from the non-null `sessionId` / `condition` fields (which the notes do say, clearly).
3. **`ready` is reached before `/api/session` runs** on the vanilla page, so `sessionId` is null at `ready`. Fine, but the README's "as soon as `POST /api/session` lands rather than only at the end" could say explicitly that this is after the start key.
4. There is no `data-testbed-schema` DOM attribute — a driver must parse `#testbed-result` JSON just to learn the schema it is about to trust. A fourth `<html>` attribute would make the degrade-path check a one-liner.

---

## 8. Runbook feedback (`.claude/skills/e2e-testbed/*`)

Things that were **wrong**, **missing**, or cost me time:

1. **`dashboard.md` → "What the browser tooling cannot do": "The experiment pages follow the OS colour scheme and have no theme toggle — no `data-theme`, nothing in the accessibility tree."** — **Wrong.** There is a persisted override: `localStorage["datapipe-color-mode"]` plus `<html class="dark">` (next-themes, `attribute="class"`). It is true there is no *visible* toggle and no `data-theme`, but a driver can flip modes non-destructively in one line and restore it. This should be written down; light mode has now been screenshotted because of it.

2. **The start-key procedure is incomplete, and it is the single biggest time sink.** `SKILL.md` §5.3 says "click the page body; send a single `f`". That is not sufficient: **keypresses only reach the tab that Chrome is actually displaying**, and a tab created with `tabs_create_mcp` + `navigate` is *not* displayed — `document.visibilityState` reads `"hidden"` while `document.hasFocus()` misleadingly reads `true`. I burned 4 click+key attempts on `run2-clean` before spotting it. What actually works, reliably: **take a `computer` `screenshot` of the tab first** (that is what brings it to the front), *then* send the key — no click needed. Recommended replacement text: *"Before the start key, take a screenshot of the tab: it is what makes the tab visible. Check `document.visibilityState === 'visible'` if the key does not land. `document.hasFocus()` is not a reliable check — it returns true on a hidden tab."*
   - `type` with a single character was **also** ignored on a hidden tab, so it is not a workaround.

3. **Coordinate frames differ per tab and are not the CSS-pixel frame.** The `computer` tool's coordinates are in the *screenshot* frame (1544×784 on the testbed tabs, 1384×703 initially on the dashboard tab), while `getBoundingClientRect()` returns CSS pixels (1384×703). Clicking a rect read from JS without scaling silently misses — my first download-button click did nothing and produced no network request. Worth a line: **scale JS rects by `screenshotWidth / window.innerWidth` before clicking**, and scroll the target into view first.

4. **`javascript_tool` has a hard ~45 s CDP ceiling** ("Runtime.evaluate timed out after 45000ms… renderer may be frozen"). An in-page polling loop must stay under ~40 s per call. The runbook's "poll every 2 s until terminal" invites writing one long loop that dies. Also: the extension **blocks results that look like cookie/query-string data** — `[BLOCKED: Cookie/query string data]` — which it did for any expression that enumerated `localStorage` keys *together with* other values, and for `[...html.attributes].map(a => a.name+'='+a.value)`. Split such reads into separate one-value calls.

5. **`get_page_text` returned "No text content found"** on the dashboard immediately after a hard reload (it worked before the reload). `document.body.innerText` always worked. Same class of problem as the note already in §5 of SKILL.md about `jspsych.github.io`, but it happens on the dashboard too.

6. **`dashboard.md`'s queue section is now out of date in a good way.** It says "THE PANEL IS MID-POLISH… **Do not** assert on column headings, sub-line wording or filename rendering." The polish has landed: the headings are `Filename / Status / Reason / Kept for another`, the sub-line is `First attempt in 1h`, the filename is the basename with the full path in `title`, and the waiting icon is a clock. That warning should be replaced with the concrete strings — they are all in §4.2 above.

7. **`dashboard.md`'s live-sessions section** says the panel is "only rendered while at least one session is open, so its absence is the assertion". True, but the **header chip now reads `0 sessions in progress`** even with none open, so the chip is not a proxy for the panel. Minor, but a driver matching on chips will trip.

8. **`ErrorPanel`'s accordion trigger is `Show what was rejected` at ≤20 rows and `Show the 20 most recent of N` above** — `dashboard.md` says **50**, not 20. `MAX_ROWS = 20` in the component. The table is also capped at 20 rows, not 50. (The 50 is the backend's `MAX_ERROR_ENTRIES`.)

9. **"Clear this list" had never been exercised**, per `dashboard.md`. Now it has: **200**, panel + chip both vanish without a reload, but the round trip took **>10 s**. Worth recording as an expected wait, because at ~5 s a driver would reasonably conclude the button did nothing.

10. The runbook's deferred-check timings were **accurate**: abandoned tab → queue entry **10 min 25 s** (predicted 10–12 min); that entry → first attempt **+60:00 exactly**; `METADATA_ERROR` refusal → queue entry **25 min 24 s** (predicted ~27 min, the next `:00`/`:15`/`:30`/`:45` slot).
    - **One correction:** `endpoints.md`/`SKILL.md` §9 imply the metadata-kept entry also waits like the others. It does not — its `nextRetryAt` is **`createdAt + 1 minute`**, while a recovered partial's is `createdAt + 60 minutes`. That is why its window is ~5 minutes: it is picked up on the very next `*/5` retry tick. Worth stating outright, because it changes how tight the dashboard-watching window is.

11. **`SKILL.md` §11 cleanup says "switch Accept new data off"**, but §4 says switching it off makes the sweep discard staged sessions. Those two only coexist safely if the cleanup step is gated on "every recovery entry is already in `uploadQueue`". It is, in §4, but only for `mustRunLast` scenarios — a driver doing an ad-hoc run (like this one) has to work that out. One sentence in §11 pointing back at §4's `runAfterCondition` would close it.

---

## 9. Screenshots

All under `<local screenshots dir>/` (Chrome-extension temp dir; copy them out if they need to survive).

| File | What it shows |
|---|---|
| `screenshot-1789862375361-7.jpg` | Rejections panel, **collapsed**, dark. 10 rejections, red left edge, header chip. |
| `screenshot-1789862418119-8.jpg` | Rejections panel, **expanded**, dark. New METADATA_ERROR wording in row 1. |
| `screenshot-1789863015501-9.jpg` | Rejections panel in **light mode** (2 rejections at that point), plus the "Sessions in progress" panel showing `Connection lost — may resume` for the abandoned run. |
| `screenshot-1789863366828-10.jpg` | **Queue panel, dark**, collapsed explainer — clock icons, right-aligned ZIP button, the four columns, basename, `First attempt in 1h`, `6d 23h`. |
| `screenshot-1789863383138-11.jpg` | Queue panel, dark, explainer **mid-animation** (clipped — the known accordion artefact, not a clipping bug). |
| `screenshot-1789863435993-12.jpg` | Queue panel, **light mode**, explainer fully expanded — the three-kind copy. |
| `screenshot-1789863450518-13.jpg` | Queue panel, light mode, scrolled to the **table row** — `First attempt in 59m` indented under the status label. |
| `screenshot-1789864250811-14.jpg` | **Two-entry** queue panel, dark — `2 uploads waiting to be stored` chip, `2 files are waiting to be stored.`, explainer open. |
| `screenshot-1789864262909-15.jpg` | Two-entry queue **table**, dark — metadata-probe row (`First attempt in 1m`) above the partial (`First attempt in 45m`). |

---

## 10. Not observed / not done

- The **`/api/clearerrors` response body** (the extension's network log gives status only).
- **The dashboard state in the gap between the post-clear hard reload and the new probe** — see §2.3.
- **The exact instant `running` was set** relative to the first trial (only "not before the key, yes after").
- **Any viewport other than 1384 CSS px** — `resize_window` is inert in macOS fullscreen. The 420 px and 1280 px layouts remain unchecked, as they were after the previous run.
- The **`retrying` and `failed`** queue-panel treatments (orange edge / filled red alert) — both need the Drive connection broken; still unverified.
- The **`First attempt within 5 minutes`** sub-line variant (needs a `nextRetryAt` already in the past) and the **`Storing now`** / **`Retrying now`** processing labels.
- The **`All queued uploads completed successfully.`** drain notice (8 s auto-hide; the queue never drained while I was watching).
- The **`Show the 20 most recent of N`** accordion label (needs >20 rejections since the last clear).
- **Drive storage contents** were not checked this run (the brief did not ask). Outstanding, for whoever looks next:
  - `run2-metadata-probe-0004.csv` should have landed in `My Drive/DataPipe/e2e-20260919-1637/data/raw/` at about **00:31:30Z**, with no derived `subject-…_data.csv` beside it.
  - `testbed-run2-abandon-20260920T000254-7en1ll2y-a1b85ca1.partial.json` — first storage attempt **01:15:13Z**; expect it in `data/raw/` shortly after, holding **60** trials.
  - `testbed-run2-clean-20260920T000506-tks1p30e.csv` and `testbed-run2-vanilla-20260920T000753-sx7fcupi.csv` were both accepted 201 and should already be there, each with a derived CSV.
  - Once the queue drains, the rejections panel reappears with the two probes from this run (`DATA_COLLECTION_NOT_ACTIVE` 00:01:48Z, `METADATA_ERROR` 00:04:59Z) — a chance to see the drain notice and the `Clear this list` button again.

## 11. Experiment state left behind

`64asU9SsEIPJ` is **not** in its default state, and was not in it before this run either:

- **"Accept new data": OFF** (restored — it was off when I started; I turned it on at 00:02:42 and off again at 00:31:34).
- "Generate Psych-DS metadata": **ON and permanently locked** (pre-existing).
- "Assign conditions in sequence": **ON** (pre-existing, untouched). One condition was consumed by `run2-vanilla`.
- Validation: **ON**, `requiredFields: ["trial_type"]` (default, untouched).
- Rejections list: **cleared at ~00:00:38Z**; the visible count now starts from this run's two probes. Lifetime counters untouched.
- Completed sessions went 6 → 8 (`run2-clean`, `run2-vanilla`).
- Colour mode: restored to `dark` (`localStorage["datapipe-color-mode"]` was never written).
- Nothing was deleted, disconnected or finalized. One testbed tab and one clean-run tab were opened and closed; the user's dashboard tab is left on `/admin/64asU9SsEIPJ`.
