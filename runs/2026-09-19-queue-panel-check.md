# Queue-panel / rejections-panel check — datapipe-test — 2026-09-19

Driver: browser session against https://datapipe-test.web.app (Firebase project `datapipe-test`).
Production was never touched. No code was changed.
All UI observations are **dark mode** (see "Dark mode" below).

## PR #262 status during the run

| Time (UTC) | #262 state |
|---|---|
| 22:25:39 | `OPEN`, no merge commit |
| 22:30:06 | `MERGED` as `e1a686287c3e05c044401531710981a83ac6627f` |
| 22:27–22:33 | "Deploy to Test" run for `e1a6862` `in_progress` |
| **22:33:22** | Deploy `completed / success` — **#262 live from here on** |

`origin/test` HEAD = `e1a6862 Merge pull request #262 from jspsych/queue-panel-states`.

**Observations before 22:33:22 were against the OLD build** (previous successful
deploy `0cededd`, 20:34:50): the initial dashboard state and the rejections panel.
**Everything about the upload-queue panel was observed against the NEW build.**

## Timeline (UTC)

| Time | Event |
|---|---|
| 22:26 | Dashboard opened in the signed-in tab (<account>). Queue empty; rejections panel visible (9 rejections). OLD build. |
| 22:26 | Rejections panel + expanded accordion captured. OLD build. |
| 22:27 | "Accept new data" switched ON (visible track clicked; "Saved" badge seen). |
| 22:26:32 | Run `queue-ui-2226` loaded (jspsych page, trials=60, auto=1, stream=1). |
| 22:27:05 | Run actually started (first keypress after navigation is swallowed — see "Testbed notes"). |
| 22:28:11 | Run `queue-ui-2226` **finished on its own** (60 trials in ~66 s) — too fast to abandon. Serves as the clean-run / result-contract check. |
| 22:28:44 | Run `queue-ui-2229` loaded. |
| 22:29:15 | Run `queue-ui-2229` started (took 2 click+key attempts). |
| **22:30:06** | Tab closed mid-run → abandoned session. |
| 22:33:22 | #262 deploy completes. |
| **22:33:47** | Metadata probe POSTed to `/api/data`. HTTP 400 `METADATA_ERROR`. |
| 22:34:21 | `/api/queuestatus` → `count=0`. |
| 22:34 | Dashboard live-sessions row = "Connection lost — may resume", running for 6 min. |
| **22:40:13** | Queue entry created for the abandoned session (`createdAt`). |
| 22:41:04 | First poll showing `count=1`. |
| 22:41–22:43 | Queue panel (1 waiting entry) observed + screenshotted, accordion expanded. |
| **~23:00:30** | Metadata-probe entry enters the queue (seen `count=2` at 23:01:04; absent at 23:00:05). |
| 23:03 | Queue panel with 2 waiting entries observed + screenshotted. |
| ~23:05 | Metadata-probe file stored; queue back to `count=1` (confirmed 23:07:48). |
| 23:08 | "Accept new data" switched OFF again. Testbed tab closed. |

## `/api/queuestatus` evidence

Abandoned-session entry (unchanged 22:41 → 23:07):

```json
{
 "id": "64asU9SsEIPJ:data_raw_testbed-queue-ui-2229-20260919T222844-5bbq3d6n-0fc2d2a7.partial.json",
 "filename": "data/raw/testbed-queue-ui-2229-20260919T222844-5bbq3d6n-0fc2d2a7.partial.json",
 "dataType": "data",
 "status": "pending",
 "errorCode": 0,
 "retryCount": 0,
 "maxRetries": 5,
 "createdAt": "2026-09-19T22:40:13.484Z",
 "lastAttemptAt": null,
 "nextRetryAt": "2026-09-19T23:40:13.484Z",
 "failureReason": "Recovered from an abandoned session (40 trials)"
}
```

Metadata-probe entry (at 23:01:04):

```json
{
 "filename": "data/raw/queue-ui-metadata-probe-2234.csv",
 "status": "pending",
 "retryCount": 0,
 "lastAttemptAt": null,
 "nextRetryAt": "2026-09-19T23:01:26.174Z",
 "failureReason": "Kept after a metadata failure (raw data stored without Psych-DS files)"
}
```

**The probe's `failureReason` is the NEW label**, not the old
"Recovered from interrupted upload (server restart or memory limit)".

Note `nextRetryAt` for the recovered partial is exactly `createdAt + 1h`
(the known "first Drive attempt is 1h later" behaviour). The metadata-kept copy
got `createdAt + ~1 min` instead, so it stored on the very next 5-minute tick.

## Metadata probe response

POST `https://datapipe-test.web.app/api/data`, body
`{"experimentID":"64asU9SsEIPJ","filename":"queue-ui-metadata-probe-2234.csv","data":"this sentence is not a data file\n"}`

- Sent 2026-09-19T22:33:47.627Z, responded 22:33:48.882Z
- **HTTP 400**
- Body verbatim:

```json
{"success":false,"error":"METADATA_ERROR","message":"No columns were found in the submitted data, so Psych-DS metadata could not be generated. The data must be a JSON array of trials or a CSV with a header row.","metadataMessage":""}
```

Matches the expected 400 / `METADATA_ERROR` / "No columns were found in the submitted data…".
`metadataMessage` is present but an empty string.

## Upload-queue panel — NEW build (#262 live)

### Header chips

- 1 entry, collecting: `Accepting data` · `6 completed sessions` · `0 sessions in progress` · `— 1 upload waiting to be stored`
- 2 entries, collecting: `… · — 2 uploads waiting to be stored`
- 1 entry, not collecting: `Not accepting data` · `6 completed sessions` · `— 1 upload waiting to be stored`

The upload chip is **neutral** (same dash glyph and muted grey as "Not accepting data");
no orange, no red. Singular/plural agreement is correct ("1 upload" / "2 uploads").

### Panel chrome

Measured on the panel element: `background-color: rgb(28, 31, 34)` (identical to
`body` background — i.e. **no fill**), `border: 1px rgb(113, 113, 122)` on top, left
and right (**uniform neutral grey — no coloured left edge**), `border-radius: 6px`.
This matches the expected "plain neutral bordered panel" exactly. For contrast, the
rejections panel rendered with a thick red left edge and the same neutral body.

### Verbatim copy — one waiting entry

- Headline: `One file is waiting to be stored.` (preceded by a neutral `—` icon)
- Body: `DataPipe is storing these automatically; nothing has failed. You can download them now if you need them sooner.`
- Accordion trigger: `What is happening to these files?`
- Button: `Download all as ZIP` (outline, with a download glyph)
- Table headers: `Filename` · `Status` · `Reason` · `Stored for` (+ a visually-hidden `Download` header)
- Row:
  - Filename: `data/raw/testbed-queue-ui-2229-20260919T222844-5bbq3d6n-0fc2d2a7.partial.json`
  - Status: `Waiting to be stored` with a neutral `—` icon
  - Sub-line: `First attempt in 59m` (later `in 37m`, `in 32m` as time passed)
  - Reason: `Recovered from a session that did not finish (40 trials). It will be stored as a partial file.`
  - Stored for: `6d 23h`
  - Trailing ghost icon-button (download)

### Verbatim copy — two waiting entries

- Headline: `2 files are waiting to be stored.`
- Body / accordion / button: identical to above.
- Row 1: `data/raw/queue-ui-metadata-probe-2234.csv` · `Waiting to be stored` ·
  sub-line `First attempt soon` ·
  Reason `DataPipe could not generate Psych-DS metadata for this submission, so it is storing the raw file without it.` ·
  `6d 23h`
- Row 2: the partial, as above, sub-line `First attempt in 37m`.

### Accordion expanded content (verbatim)

```
DataPipe tries to store each submission in your storage provider the moment it arrives. A file is listed here when that has not happened yet.

• Waiting to be stored — DataPipe recovered the data from a session that did not finish, or kept the raw file after a processing problem, and has not tried to store it yet. Nothing has failed.
• Retrying — An attempt failed, usually because your storage provider was busy or unavailable, or because DataPipe's connection to it needs refreshing. DataPipe tries again automatically.
• Failed — Every retry was used up. Download the file and upload it to your storage provider yourself.

Files are stored for seven days, or up to fourteen if we couldn't deliver a failure notification to you.
```

## Differences from the expected copy / appearance

Copy that matched exactly: the headline (both singular and plural forms), the body
sentence, the accordion trigger, the "Download all as ZIP" label, the four column
headers, and both Reason strings. The panel's neutral styling matched exactly.

Differences and defects found:

1. **"Stored for" column shows time REMAINING, not time stored.** Both entries showed
   `6d 23h` — one created 22 minutes earlier, the other 1 minute earlier. Confirmed in
   `components/dashboard/QueuePanel.js`: the cell renders `timeRemaining(entry.createdAt)`,
   which is `createdAt + 7 days − now`. The header reads as elapsed time; the value is a
   countdown to deletion. This is the clearest copy bug in the panel.
2. **The 7-day figure in that column is hard-coded**, while the accordion one line above
   says files are kept "seven days, or up to fourteen if we couldn't deliver a failure
   notification". In the 14-day case the column will understate the remaining time.
3. **The status sub-line is misaligned.** `First attempt in 59m` / `First attempt soon`
   starts at the cell's left edge, underneath the `—` status icon, rather than indented
   to line up with the `Waiting to be stored` label text. It reads as hanging left of
   the label. (This was the specific alignment question asked; it does not line up.)
4. **The Status column is too narrow**: `Waiting to be stored` wraps to two lines even
   at a 1467 px-wide window, with plenty of empty space in the Reason column.
5. **The `Stored for` header itself wraps** to two lines (`Stored` / `for`) at the same
   width — the column is sized to its short values, not its header.
6. **Filenames are shown with the `data/raw/` storage prefix** and wrap across two
   lines. The dashboard elsewhere talks about files by name; the path prefix is noise
   and is what forces the wrap.
7. **Sub-line wording is inconsistent between the two cases**: `First attempt in 37m`
   reads as a sentence, `First attempt soon` drops the preposition. "First attempt in
   under a minute" or "First attempt due now" would match the other form.
8. **A `0 sessions in progress` chip is rendered** in the header whenever the experiment
   is accepting data, even at zero. It disappeared once collection was switched off.
   Not part of #262's scope, but it sits in the same chip row and adds noise next to the
   upload chip.
9. Minor: the `Download all as ZIP` button sits between the accordion and the table,
   and a horizontal rule runs directly above it, so the button reads as belonging to
   the accordion rather than to the table beneath it.

Not a defect, but worth recording: **the accordion expand is animated and my first
screenshot caught it mid-flight**, showing the explainer clipped to a ~4 px sliver.
Measuring the element afterwards gave `height: 207px`, `data-state="open"` — the
content renders correctly once the transition finishes. No clipping bug.

No box-inside-a-box border was seen around the table: the source comment in
`QueuePanel.js` shows the inner panel surface is deliberately dropped for the quiet
variant, and the rendered table had no second border.

## Queue-panel states NOT observed

- **"Retrying"** and **"Failed"** rows were not produced. Both require the Google Drive
  storage connection to be broken, which was out of scope. Their copy exists in the
  accordion (quoted above) but the row rendering, the warning/error icons, and the
  orange/red panel treatments were **not observed**.

## Rejections panel

Captured at 22:26, **against the OLD build**, while the queue was empty:

- Chip: `Some submissions were rejected` (red icon)
- Panel: neutral body with a **thin red left edge** and a red status icon
- Headline: `9 submissions to this experiment were rejected.`
- Body: `DataPipe refused these submissions. The most recent was 5 hours ago.`
- Accordion trigger: `Show what was rejected`, columns `What happened` / `Time`
- Button: `Clear this list` (small outline)
- METADATA_ERROR rows read:
  `An error occurred while processing metadata` /
  `Invalid metadata generated` /
  `The raw data was kept. DataPipe stores it in your storage provider without Psych-DS metadata, usually within about half an hour.` /
  `Code: METADATA_ERROR`

So the "raw data was kept" line is present on the old build. The rows there carry the
**old** detail `Invalid metadata generated`, not `No columns were found…`.

At 22:34 the headline had updated to `10 submissions to this experiment were rejected.`
/ `…The most recent was just now.` — my probe's rejection was counted.

**Not observed:** the rejections panel on the NEW build, and therefore whether my
METADATA_ERROR row renders the new "No columns were found in the submitted data…"
detail. The panel is hidden while the queue is non-empty, and the queue held the
recovered partial continuously from 22:40 onward (its first storage attempt is not
until 23:40:13). There was no moment after the deploy when the queue was empty.

**"Clear this list" was NOT clicked** — correctly, since the panel was never showing
after the probe. No `/api/clearerrors` request was made.

## Testbed result-contract findings (first real use)

The contract works. `document.documentElement.dataset.testbedStatus` and
`#testbed-result` were both readable from the DOM and behaved as designed:

- `data-testbed-status` was `running` during the live run and `finished` on completion.
- `#testbed-result` held valid JSON throughout, with `schema: 1`, a full `params` echo,
  `startedAt`, `finishedAt`, `filenames`, `requests` and `notes`.
- Clean run `queue-ui-2226` ended:
  `"status": "finished"`, `"startedAt": "2026-09-19T22:26:32.656Z"`,
  `"finishedAt": "2026-09-19T22:28:11.165Z"`,
  `"filenames": ["testbed-queue-ui-2226-20260919T222632-65wagjg3.csv"]`,
  `"requests": [{"label":"final-save","method":"POST","url":"https://datapipe-test.web.app/api/data/","status":201,"ok":true,"ms":null}]`
- Last log lines on screen: `18:26:32 filename testbed-…-65wagjg3.csv` and
  `18:26:32 streaming ON -- trials are staged as they happen`.

Problems / awkwardness with the contract:

1. **`data-testbed-status` is set to `running` at page load, before the participant has
   pressed a key.** It was already `running` while the screen still said "Press any key
   to start" and `startedAt` was already populated. A driver that waits for `running`
   to confirm the run has begun gets a false positive — I did, twice. A `waiting`/`ready`
   state before the first keypress would make the contract usable for that check.
2. **There is no trial counter.** `#testbed-result` exposes no progress field, so a
   driver that needs to act "at about trial N" has nothing to poll. This is what made
   the abandonment step guesswork: my first attempt overshot and the run finished
   (60 trials in ~66 s), and my second produced 40 trials rather than the 30 I aimed for.
   A `trialsCompleted` field would fix this.
3. **`sessionId` stayed `null`** for the whole streaming run, including after it
   finished, even though the extension had opened a session and staged trials. If the
   field is meant to carry the DataPipe session id it is not being populated; if it is
   not obtainable from the page, the `notes` should say so as they do for request detail.
4. `condition` stayed `null`. Expected here — the run did not pass `condition=1` — but
   the experiment has conditions ON, so the field does not reflect the assigned condition.
5. The recorded `url` is `https://datapipe-test.web.app/api/data/` **with a trailing
   slash**, which conflicts with the "use URLs without a trailing slash for /api/*"
   guidance. It returned 201, so it works, but the recorded value is inconsistent.
6. `ms` was `null` on the recorded request, so the contract carries no timing.
7. `get_page_text` on jspsych.github.io was refused, as previously observed; reading
   `document.body.innerText` via the JS tool worked fine and is the better route.

Also reconfirmed: **the first keypress after navigating to a testbed page is swallowed.**
Both runs needed click → key → (no start) → click → key. On the second run it took a
third keypress. `"f"` works; the earlier note that `"space"` never works was not retested.

## Other things worth knowing

- **Dark mode only.** The page rendered dark (`color-scheme: dark`, body background
  `rgb(28,31,34)`, `prefers-color-scheme: dark` = true). There is **no in-page theme
  toggle** on the experiment page — the accessibility tree has none and
  `data-theme` is unset, so the theme follows the OS preference. **Light mode was not
  observed.**
- **Responsive check NOT done.** `resize_window` reported success at 420 px and 440 px,
  but the page viewport never changed: `window.innerWidth` stayed at `1710`
  (= `screen.width`) while only `outerWidth` moved. The Chrome window appears to be in
  macOS fullscreen, so the renderer viewport does not follow the window bounds. Neither
  the ~420 px nor the ~1280 px check was performed. The source does wrap the table in
  `<Box overflowX="auto">`, so it is intended to scroll horizontally rather than
  overflow — but that was not verified in the browser.
- **Firebase ID tokens expire after ~1 hour mid-session.** A poller holding a captured
  token started getting `401 {"error":"Invalid authentication token"}` at 22:55. Re-reading
  the token from IndexedDB each cycle fixed it. Worth knowing for any future driver.
- Background tab timers are throttled: a 20 s `setInterval` poller in the backgrounded
  dashboard tab actually fired about once a minute. It still caught every transition.
- The completed-session count went 5 → 6 from the accidental full run `queue-ui-2226`.
  Rejection count went 9 → 10 from the metadata probe.

## What remains to be looked at

1. **Rejections panel on the NEW build**, in particular whether a METADATA_ERROR row now
   shows the `No columns were found in the submitted data, so Psych-DS metadata could not
   be generated. The data must be a JSON array of trials or a CSV with a header row.`
   detail alongside the "raw data was kept" line. Possible once the queue empties — the
   recovered partial's first storage attempt is **23:40:13 UTC**, so from roughly
   **23:40–23:45** the queue should be empty and the panel should reappear with 10
   rejections including the probe.
2. **"Clear this list"** behaviour: whether the panel and the header chip disappear
   without a reload, how long that takes, and the `/api/clearerrors` response status.
   Blocked on (1).
3. **Narrow (~420 px) and ~1280 px layouts**, and whether the table scrolls horizontally
   as intended. Needs a Chrome window not in fullscreen.
4. **Light mode.**
5. **"Retrying" and "Failed" queue rows** — cannot be produced without breaking the
   storage connection.

## Screenshots

Saved to `<local screenshots dir>/`:

- `screenshot-1789856768535-0.jpg` — rejections panel, accordion expanded (OLD build, 22:26)
- `screenshot-1789857686956-1.jpg` — queue panel, one waiting entry, accordion collapsed (NEW build, 22:41)
- `screenshot-1789857713817-2.jpg` — the same, caught mid expand-animation (explainer clipped to a sliver)
- `screenshot-1789857745109-3.jpg` — queue panel with the explainer fully expanded
- `screenshot-1789857774905-4.jpg` — same view after a failed resize attempt (unchanged)
- `screenshot-1789859000017-5.jpg` — queue panel with two waiting entries (23:03)
- `screenshot-1789859018409-6.png` — zoom of the two rows, showing the sub-line alignment and the wrapped `Stored for` header

## Final state

- "Accept new data" is **OFF** (header chip reads `Not accepting data`).
- One queue entry remains: the recovered partial, due for its first storage attempt at
  23:40:13 UTC. It will be stored automatically.
- All tabs I opened were closed. The user's dashboard tab is left on
  `https://datapipe-test.web.app/admin/64asU9SsEIPJ`.
- No code changed; nothing deleted; no provider or account settings touched.
