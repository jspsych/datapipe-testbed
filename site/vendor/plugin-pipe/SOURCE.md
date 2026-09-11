# Where `index.browser.min.js` came from

This is the browser bundle of `@jspsych-contrib/plugin-pipe` with **incremental
upload**, which is not yet released. It is committed here so the testbed can run
the unreleased plugin without pushing or publishing anything.

| | |
|---|---|
| Source repo | [jspsych/jspsych-contrib](https://github.com/jspsych/jspsych-contrib), `packages/plugin-pipe` |
| Branch | `feat/pipe-streaming` (unpushed at the time of this build) |
| Commit | `5659fe71371cf7c45ef178c0117dbd96603fd1f5` |
| Built | 2026-09-11 17:19 UTC with `npm run build` |
| SHA-256 (first 16) | `d468ecb37435b477` |

It reports version `0.6.0` (the version bump to 0.7 happens at release) and
bundles the Firebase Realtime Database SDK, which is why it is ~53 KB gzipped.

**Licenses:** plugin-pipe is MIT (jsPsych contributors). The bundled Firebase
JS SDK is Apache-2.0 (Google LLC).

To rebuild it from a local checkout, run `scripts/refresh-plugin.sh`, which
rewrites this file. Once plugin-pipe 0.7 is published, delete this directory
and load it from the CDN like the other scripts.
