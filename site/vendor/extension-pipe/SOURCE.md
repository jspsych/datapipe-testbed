# Where `index.browser.min.js` came from

This is the browser bundle of `@jspsych/extension-pipe`, which is **not yet
released**. It is committed here so the testbed can run the unreleased
extension without publishing anything — validating it before release is the
whole reason this repository exists.

| | |
|---|---|
| Source repo | [jspsych/jsPsych](https://github.com/jspsych/jsPsych), `packages/extension-pipe` |
| Branch | `feat/extension-pipe` |
| Commit | `99f20db407f272f93be28027c17afd69953e1c86` |
| Built | 2026-09-16 13:54 UTC with `npm run build` |
| SHA-256 (first 16) | `a3cc799d3b2fb170` |
| datapipe-client | `^0.1.0`, bundled in |

It reports version `0.1.0` and defines the global `jsPsychExtensionPipe`.

`datapipe-client` and the Firebase SDK are bundled inside this file, which is
why it is ~185 KB. The plain-JavaScript page loads `datapipe-client` from the
CDN instead, since that one **is** published.

## Refreshing it

```
scripts/refresh-extension.sh [path-to-jsPsych]
```

Rebuilds from a local checkout and rewrites the table above. It refuses to run
if `packages/extension-pipe` has uncommitted changes, because then the recorded
commit would not describe the bundle.

## When to delete this

Once `@jspsych/extension-pipe` is on npm, point `site/jspsych/index.html` at
`https://unpkg.com/@jspsych/extension-pipe` and delete this directory along
with `scripts/refresh-extension.sh`. A vendored copy that outlives its reason
is just a stale build nobody remembers to update.
