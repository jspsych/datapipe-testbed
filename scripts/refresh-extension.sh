#!/usr/bin/env bash
# Rebuild the committed extension-pipe bundle from a local jsPsych checkout.
#
#   scripts/refresh-extension.sh [path-to-jsPsych]
#
# Defaults to ../jsPsych. Builds whatever that checkout has checked out, copies
# the browser bundle into site/vendor/extension-pipe/, and rewrites SOURCE.md
# with the commit it came from -- so the page is always traceable to an exact
# revision. Refuses to run if extension-pipe has uncommitted changes, because
# then the recorded commit would not describe the bundle.
#
# This exists only while @jspsych/extension-pipe is unreleased. Once it is on
# npm, point site/jspsych/index.html at the CDN and delete this script along
# with site/vendor/.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
jspsych="${1:-$here/../jsPsych}"
pkg="$jspsych/packages/extension-pipe"
out="$here/site/vendor/extension-pipe"

[[ -d "$pkg" ]] || { echo "No extension-pipe at $pkg" >&2; exit 1; }
if [[ -n "$(git -C "$jspsych" status --porcelain -- packages/extension-pipe)" ]]; then
  echo "extension-pipe has uncommitted changes; commit them first so SOURCE.md is accurate." >&2
  exit 1
fi

(cd "$pkg" && npm run build >/dev/null)
cp "$pkg/dist/index.browser.min.js" "$out/"

sha="$(git -C "$jspsych" rev-parse HEAD)"
branch="$(git -C "$jspsych" rev-parse --abbrev-ref HEAD)"
sum="$(shasum -a 256 "$out/index.browser.min.js" | cut -c1-16)"
version="$(node -p "require('$pkg/package.json').version")"
client="$(node -p "require('$pkg/package.json').dependencies['datapipe-client']")"
built="$(date -u +"%Y-%m-%d %H:%M UTC")"

python3 - "$out/SOURCE.md" "$sha" "$branch" "$sum" "$version" "$built" "$client" <<'PY'
import re, sys
path, sha, branch, digest, version, built, client = sys.argv[1:]
s = open(path).read()
s = re.sub(r"\| Branch \| .* \|", f"| Branch | `{branch}` |", s)
s = re.sub(r"\| Commit \| .* \|", f"| Commit | `{sha}` |", s)
s = re.sub(r"\| Built \| .* \|", f"| Built | {built} with `npm run build` |", s)
s = re.sub(r"\| SHA-256 \(first 16\) \| .* \|", f"| SHA-256 (first 16) | `{digest}` |", s)
s = re.sub(r"\| datapipe-client \| .* \|", f"| datapipe-client | `{client}`, bundled in |", s)
s = re.sub(r"reports version `[^`]*`", f"reports version `{version}`", s)
open(path, "w").write(s)
PY

echo "Refreshed from $branch @ ${sha:0:7} ($sum). Review and commit site/vendor/extension-pipe/."
